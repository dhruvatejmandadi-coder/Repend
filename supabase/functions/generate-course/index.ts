import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIMARY_MODEL = "openai/gpt-5";
const FALLBACK_MODEL = "google/gemini-2.5-pro";

async function callAI(apiKey: string, body: any, retries = 2): Promise<any> {
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 3000;
      console.log(`[AI Retry] Attempt ${attempt + 1} after ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 429) { lastError = "Rate limit exceeded."; continue; }
      if (response.status === 402) throw new Error("AI credits exhausted. Please add funds in Settings > Workspace > Usage.");
      const text = await response.text();
      if (!response.ok) {
        console.error(`[AI Error ${response.status}] Body:`, text.slice(0, 500));
        lastError = `AI error (${response.status}): ${text.slice(0, 200)}`;
        continue;
      }
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { lastError = "Invalid AI response."; continue; }
      if (!parsed.choices?.length) { lastError = "Empty AI response."; continue; }
      return parsed;
    } catch (e: any) {
      if (e.message?.includes("credits")) throw e;
      lastError = e.message || "Network error.";
    }
  }
  throw new Error(lastError || "AI call failed after retries.");
}

/** Try primary model, if 400 error retry with fallback model */
async function callAIWithFallback(apiKey: string, body: any): Promise<any> {
  try {
    return await callAI(apiKey, { ...body, model: PRIMARY_MODEL });
  } catch (e: any) {
    if (e.message?.includes("400") || e.message?.includes("AI error")) {
      console.warn(`[Fallback] ${PRIMARY_MODEL} failed, trying ${FALLBACK_MODEL}...`);
      return await callAI(apiKey, { ...body, model: FALLBACK_MODEL });
    }
    throw e;
  }
}

function extractToolArgs(aiData: any): any {
  const message = aiData.choices[0].message;
  const toolCall = message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error(`AI did not return structured data (reason: ${aiData.choices[0]?.finish_reason || "unknown"}).`);
  }
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    let raw = toolCall.function.arguments || "";
    raw = raw.replace(/,\s*$/, "");
    for (const closer of ["]}]}", "]}}", "]}", "}", "]"]) {
      try { return JSON.parse(raw + closer); } catch { /* next */ }
    }
    throw new Error("AI response was truncated. Try a simpler topic.");
  }
}

function repairLessonContent(content: string): string {
  if (!content) return "## Lesson\n\nContent is being prepared.";
  let repaired = content;
  if (!repaired.includes("\n---\n")) {
    const sections = repaired.split(/(?=^## )/m).filter(Boolean);
    if (sections.length > 1) repaired = sections.join("\n\n---\n\n");
  }
  const slides = repaired.split(/\n---\n/).map((s: string) => s.trim()).filter(Boolean);
  while (slides.length > 8) {
    let minLen = Infinity, minIdx = 0;
    for (let i = 0; i < slides.length - 1; i++) {
      const combined = slides[i].length + slides[i + 1].length;
      if (combined < minLen) { minLen = combined; minIdx = i; }
    }
    slides[minIdx] = slides[minIdx] + "\n" + slides[minIdx + 1];
    slides.splice(minIdx + 1, 1);
  }
  return slides.join("\n\n---\n\n");
}

async function extractFileContent(filePath: string, supabaseAdmin: any): Promise<{ text?: string; imageBase64?: string; mimeType?: string }> {
  const { data, error } = await supabaseAdmin.storage.from("course-uploads").download(filePath);
  if (error || !data) { console.error("Failed to download file:", error); return {}; }
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const imageExts = ["png", "jpg", "jpeg", "webp"];
  const textExts = ["txt", "md", "csv"];
  if (imageExts.includes(ext)) {
    const buffer = await data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
    return { imageBase64: base64, mimeType: mimeMap[ext] || "image/png" };
  }
  if (textExts.includes(ext)) { return { text: (await data.text()).slice(0, 50000) }; }
  if (ext === "pdf") {
    try {
      const text = await data.text();
      const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").trim();
      if (cleaned.length > 100) return { text: cleaned.slice(0, 50000) };
      const buffer = await data.arrayBuffer();
      return { imageBase64: btoa(String.fromCharCode(...new Uint8Array(buffer))), mimeType: "application/pdf" };
    } catch { return {}; }
  }
  return {};
}

/* ===============================
   🎯 PERSONALIZATION ADAPTER
================================ */

function buildPersonalizationContext(prefs: any): string {
  if (!prefs) return "";
  const parts: string[] = [];
  if (prefs.level) {
    const levelMap: Record<string, string> = {
      beginner: "Student is a BEGINNER. Use simple language, define all terms, provide many examples.",
      intermediate: "Student has INTERMEDIATE knowledge. Assume basic familiarity.",
      advanced: "Student is ADVANCED. Skip basics, focus on nuance and edge cases.",
    };
    parts.push(levelMap[prefs.level] || "");
  }
  if (prefs.style) {
    const styleMap: Record<string, string> = {
      visual: "LEARNING STYLE: Visual. Use tables, diagrams, charts.",
      "hands-on": "LEARNING STYLE: Hands-on. Include challenges and practice.",
      conceptual: "LEARNING STYLE: Conceptual. Focus on WHY things work.",
      mixed: "LEARNING STYLE: Mixed. Balance theory, visuals, and practice.",
    };
    parts.push(styleMap[prefs.style] || "");
  }
  if (prefs.goal) {
    const goalMap: Record<string, string> = {
      basics: "GOAL: Understand basics.",
      "test-prep": "GOAL: Test preparation. Include exam-style questions.",
      "real-world": "GOAL: Real-world application.",
      mastery: "GOAL: Deep mastery.",
    };
    parts.push(goalMap[prefs.goal] || "");
  }
  if (prefs.pace) {
    const paceMap: Record<string, string> = {
      fast: "PACE: Fast. Key points only.",
      balanced: "PACE: Balanced.",
      detailed: "PACE: Detailed. Thorough explanations.",
    };
    parts.push(paceMap[prefs.pace] || "");
  }
  return parts.filter(Boolean).join("\n");
}

/* ===============================
   🚀 STEP 1: OUTLINE ONLY (small call)
================================ */

async function generateOutline(apiKey: string, topic: string, hasFile: boolean, preferences: any): Promise<any> {
  console.log("[Step 1] Generating course outline structure...");
  const personalization = buildPersonalizationContext(preferences);

  const systemPrompt = `You are an expert educational designer. Generate a course OUTLINE — just the structure, NOT full lesson content.
${personalization ? `\nPERSONALIZATION:\n${personalization}` : ""}
${hasFile ? "\nBase content on the uploaded source material." : ""}
Generate 4-6 modules.`;

  const aiData = await callAIWithFallback(apiKey, {
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Create a course outline for: ${topic}` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "create_outline",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            modules: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  lab_concept: { type: "string", description: "What simulation/decision scenario the lab should present" },
                  lab_title: { type: "string" },
                  youtube_query: { type: "string" },
                },
                required: ["title", "lab_concept"],
              },
            },
          },
          required: ["title", "description", "modules"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "create_outline" } },
  });

  return extractToolArgs(aiData);
}

/* ===============================
   🚀 STEP 2: LESSON + QUIZ per module (small call each)
================================ */

async function generateModuleContent(apiKey: string, topic: string, moduleTitle: string, moduleIndex: number, totalModules: number, hasFile: boolean, fileContext: string, preferences: any): Promise<{ lesson_content: string; quiz: any[] }> {
  console.log(`[Step 2] Generating lesson+quiz for module ${moduleIndex + 1}/${totalModules}: "${moduleTitle}"`);
  const personalization = buildPersonalizationContext(preferences);

  const systemPrompt = `You are an expert lesson writer. Generate ONE lesson and ONE quiz for a specific module.

=== LESSON FORMAT ===
7 slides separated by "---". Each slide: emoji title, short bullets, tables for comparisons.
Slide sequence: 🎯 Objective, 🧠 Core Concept, 📊 Visual/Example, 🌎 Real-World, 🧪 Lab Preview, 📋 Challenge, ✅ Takeaways

=== QUIZ ===
8-10 questions. Mix conceptual + applied. Each has explanation referencing the lesson.
${personalization ? `\n${personalization}` : ""}
${hasFile ? "\nBase content on the source material provided." : ""}`;

  const userMsg = fileContext
    ? `Module ${moduleIndex + 1}/${totalModules} of course "${topic}": "${moduleTitle}"\n\nSource material context:\n${fileContext.slice(0, 8000)}`
    : `Module ${moduleIndex + 1}/${totalModules} of course "${topic}": "${moduleTitle}"`;

  const aiData = await callAIWithFallback(apiKey, {
    temperature: 0.4,
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ],
    tools: [{
      type: "function",
      function: {
        name: "create_module_content",
        parameters: {
          type: "object",
          properties: {
            lesson_content: { type: "string", description: "Markdown lesson with --- slide separators. 7 slides." },
            quiz: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correct: { type: "number" },
                  explanation: { type: "string" },
                },
                required: ["question", "options", "correct", "explanation"],
              },
            },
          },
          required: ["lesson_content", "quiz"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "create_module_content" } },
  });

  const result = extractToolArgs(aiData);
  return {
    lesson_content: repairLessonContent(result.lesson_content || ""),
    quiz: Array.isArray(result.quiz) && result.quiz.length > 0
      ? result.quiz
      : [{ question: `What is a key concept from "${moduleTitle}"?`, options: ["A", "B", "C", "D"], correct: 0, explanation: "Review the lesson." }],
  };
}

/* ===============================
   🚀 MAIN HANDLER
================================ */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { topic, filePath, filePaths, preferences } = await req.json();
    if (!topic?.trim()) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Collect all file paths
    const allFilePaths: string[] = [];
    if (filePaths && Array.isArray(filePaths)) allFilePaths.push(...filePaths);
    else if (filePath) allFilePaths.push(filePath);

    // Extract file content
    let fileTextContext = "";
    if (allFilePaths.length > 0) {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      for (const fp of allFilePaths) {
        const content = await extractFileContent(fp, supabaseAdmin);
        if (content.text) fileTextContext += content.text.slice(0, 10000) + "\n\n";
      }
    }
    const hasFile = fileTextContext.length > 0;

    // Create course row
    const { data: course } = await supabase
      .from("courses")
      .insert({ user_id: user.id, title: topic.trim(), topic: topic.trim(), status: "generating" })
      .select().single();

    // ===== STEP 1: Generate outline only (small payload) =====
    const outline = await generateOutline(LOVABLE_API_KEY, topic, hasFile, preferences);
    console.log(`[Step 1] Outline: "${outline.title}" with ${outline.modules?.length || 0} modules`);

    await supabase.from("courses").update({ title: outline.title, description: outline.description, status: "generating" }).eq("id", course.id);

    // ===== STEP 2: Generate each module's lesson+quiz separately =====
    const modules = outline.modules || [];
    const moduleRows: any[] = [];

    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      try {
        const content = await generateModuleContent(
          LOVABLE_API_KEY, topic, mod.title, i, modules.length, hasFile, fileTextContext, preferences
        );
        moduleRows.push({
          course_id: course.id,
          module_order: i + 1,
          title: mod.title,
          lesson_content: content.lesson_content,
          youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.youtube_query || mod.title)}`,
          youtube_title: mod.youtube_title || mod.title,
          lab_type: "dynamic",
          lab_title: mod.lab_title || mod.title,
          lab_description: mod.lab_concept || null,
          lab_data: null,
          lab_generation_status: "pending",
          lab_blueprint: null,
          lab_error: null,
          quiz: content.quiz,
        });
        console.log(`[Step 2] Module ${i + 1}/${modules.length} "${mod.title}" done`);
      } catch (e: any) {
        console.error(`[Step 2] Module ${i + 1} failed: ${e.message}`);
        // Insert with placeholder content so the course isn't broken
        moduleRows.push({
          course_id: course.id,
          module_order: i + 1,
          title: mod.title,
          lesson_content: `## ${mod.title}\n\nContent generation failed. Please regenerate this module.`,
          youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.title)}`,
          youtube_title: mod.title,
          lab_type: "dynamic",
          lab_title: mod.lab_title || mod.title,
          lab_description: mod.lab_concept || null,
          lab_data: null,
          lab_generation_status: "pending",
          lab_blueprint: null,
          lab_error: null,
          quiz: [{ question: `What is a key concept from "${mod.title}"?`, options: ["A", "B", "C", "D"], correct: 0, explanation: "Review the lesson." }],
        });
      }
    }

    const { data: insertedModules } = await supabase.from("course_modules").insert(moduleRows).select("id, title, module_order");
    console.log(`[Done] Inserted ${insertedModules?.length || 0} modules`);

    await supabase.from("courses").update({ status: "ready" }).eq("id", course.id);

    // Track usage
    if (allFilePaths.length > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: existing } = await supabaseAdmin.from("usage_tracking").select("id, file_courses_generated").eq("user_id", user.id).eq("month", currentMonth).single();
      if (existing) {
        await supabaseAdmin.from("usage_tracking").update({ file_courses_generated: (existing.file_courses_generated || 0) + 1 }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("usage_tracking").insert({ user_id: user.id, month: currentMonth, file_courses_generated: 1, courses_generated: 1 });
      }
    }

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("COURSE GENERATION ERROR:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
