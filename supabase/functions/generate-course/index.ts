import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      if (!response.ok) { lastError = `AI error (${response.status}).`; continue; }
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
      beginner: "Student is a BEGINNER. Use simple language, define all terms, provide many examples. Start from first principles.",
      intermediate: "Student has INTERMEDIATE knowledge. Assume basic familiarity. Focus on deeper connections and applied understanding.",
      advanced: "Student is ADVANCED. Skip basics, focus on nuance, edge cases, expert-level analysis, and complex tradeoffs.",
    };
    parts.push(levelMap[prefs.level] || "");
  }

  if (prefs.style) {
    const styleMap: Record<string, string> = {
      visual: "LEARNING STYLE: Visual. Use many tables, diagrams descriptions, charts, and visual comparisons. Minimize long paragraphs.",
      "hands-on": "LEARNING STYLE: Hands-on. Include many challenges, interactive examples, and practice problems in every slide.",
      conceptual: "LEARNING STYLE: Conceptual. Focus on WHY things work, underlying principles, and theoretical frameworks.",
      mixed: "LEARNING STYLE: Mixed. Balance theory, visuals, and practice across slides.",
    };
    parts.push(styleMap[prefs.style] || "");
  }

  if (prefs.goal) {
    const goalMap: Record<string, string> = {
      basics: "GOAL: Understand basics. Focus on foundational concepts, clear definitions, and simple real-world examples.",
      "test-prep": "GOAL: Test preparation. Include exam-style questions, key formulas, common mistakes to avoid, and memory aids.",
      "real-world": "GOAL: Real-world application. Every concept must connect to practical uses, industry examples, and career relevance.",
      mastery: "GOAL: Deep mastery. Cover advanced theory, research-level insights, edge cases, and complex problem-solving.",
    };
    parts.push(goalMap[prefs.goal] || "");
  }

  if (prefs.pace) {
    const paceMap: Record<string, string> = {
      fast: "PACE: Fast. Keep slides concise. Key points only. No redundancy.",
      balanced: "PACE: Balanced. Standard depth with clear explanations.",
      detailed: "PACE: Detailed. Thorough explanations. Multiple examples per concept. Step-by-step breakdowns.",
    };
    parts.push(paceMap[prefs.pace] || "");
  }

  return parts.filter(Boolean).join("\n");
}

/* ===============================
   🚀 PHASE 1: OUTLINE + LESSONS + QUIZZES
================================ */

async function generateOutline(apiKey: string, topic: string, userContent: any, hasFile: boolean, preferences: any): Promise<any> {
  console.log("[Phase 1] Generating course outline, lessons, and quizzes...");

  const personalization = buildPersonalizationContext(preferences);

  const systemPrompt = `You are an expert educational designer for Repend, a decision-based interactive learning platform.

Generate a course OUTLINE with lessons and quizzes. Do NOT generate lab data — just describe what each lab should teach.

=== LESSON FORMAT ===
Each lesson is a series of slides separated by "---". Each slide must focus on ONE idea.

SLIDE STRUCTURE (follow this for each slide):
- Clear title with emoji (## 🎯 Title)
- Short bullet points (2-4 max)
- Include at least one of: table, visual description, real-world example, or formula
- End with a one-line takeaway or question

SLIDE SEQUENCE (7 slides per lesson):
1. 🎯 Objective — what student will learn, why it matters
2. 🧠 Core Concept — main idea with clear definition
3. 📊 Visual/Example — table, comparison, or diagram description
4. 🌎 Real-World Context — where this is used, why it matters
5. 🧪 Lab Preview — brief preview of the lab exercise
6. 📋 Challenge — practice question with clear answer expected
7. ✅ Key Takeaways — 3-4 bullet summary

RULES:
- Every slide must have a clear title
- Use emoji headers
- Use tables for comparisons (NOT long paragraphs)
- Keep bullet points SHORT (under 15 words each)
- Include a challenge/question in slide 6 that requires an answer
- Do NOT clutter — one idea per slide
- Every visual/table needs a 1-2 line explanation below it

=== LAB CONCEPT ===
For each module, describe what concept the lab should explore. Do NOT pick a lab_type — the AI will design the interaction later.
Just describe: what concept to simulate, what tradeoffs exist, what decisions students should face.
Focus on SIMULATION-style interactions: decisions with consequences, not quiz-style Q&A.

=== QUIZ RULES ===
8-10 questions per module. Mix: conceptual, applied, scenario-based. No "all of the above".
Each question MUST have an explanation field.

${personalization ? `=== PERSONALIZATION ===\n${personalization}\n` : ""}
${hasFile ? "IMPORTANT: Base ALL content on the uploaded SOURCE MATERIAL." : ""}
Generate 4-6 modules.`;

  const aiData = await callAI(apiKey, {
    model: "google/gemini-3-flash-preview",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    tools: [{
      type: "function",
      function: {
        name: "create_course_outline",
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
                  lesson_content: { type: "string", description: "Markdown lesson with --- slide separators. 7 slides. Each slide has ONE idea, emoji title, short bullets, tables for comparisons." },
                  youtube_query: { type: "string" },
                  youtube_title: { type: "string" },
                  lab_concept: { type: "string", description: "What simulation/decision-making scenario the lab should present. Focus on tradeoffs and consequences, NOT quiz-style Q&A." },
                  lab_title: { type: "string" },
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
                required: ["title", "lesson_content", "lab_concept", "quiz"],
              },
            },
          },
          required: ["title", "description", "modules"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "create_course_outline" } },
  });

  const parsed = extractToolArgs(aiData);
  if (parsed.modules) {
    for (const mod of parsed.modules) {
      mod.lesson_content = repairLessonContent(mod.lesson_content || "");
      if (!mod.quiz || !Array.isArray(mod.quiz) || mod.quiz.length === 0) {
        mod.quiz = [{ question: `What is a key concept from "${mod.title}"?`, options: ["A", "B", "C", "D"], correct: 0, explanation: "Review the lesson." }];
      }
    }
  }
  return parsed;
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

    // Collect all file paths (support both single and multiple)
    const allFilePaths: string[] = [];
    if (filePaths && Array.isArray(filePaths)) allFilePaths.push(...filePaths);
    else if (filePath) allFilePaths.push(filePath);

    // Extract content from all files
    const allFileContents: { text?: string; imageBase64?: string; mimeType?: string }[] = [];
    if (allFilePaths.length > 0) {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      for (const fp of allFilePaths) {
        const content = await extractFileContent(fp, supabaseAdmin);
        if (content.text || content.imageBase64) allFileContents.push(content);
      }
    }

    // Create course row
    const { data: course } = await supabase
      .from("courses")
      .insert({ user_id: user.id, title: topic.trim(), topic: topic.trim(), status: "generating" })
      .select().single();

    // Build user message content from all files
    let userContent: any;
    if (allFileContents.length === 0) {
      userContent = `Create a course on: ${topic}`;
    } else if (allFileContents.length === 1 && allFileContents[0].imageBase64 && allFileContents[0].mimeType) {
      userContent = [
        { type: "image_url", image_url: { url: `data:${allFileContents[0].mimeType};base64,${allFileContents[0].imageBase64}` } },
        { type: "text", text: `Create a course on: ${topic}\n\nThe attached image/document is the SOURCE MATERIAL.` },
      ];
    } else {
      // Combine all text + image content into a multipart message
      const parts: any[] = [];
      const textParts: string[] = [];
      for (const fc of allFileContents) {
        if (fc.imageBase64 && fc.mimeType) {
          parts.push({ type: "image_url", image_url: { url: `data:${fc.mimeType};base64,${fc.imageBase64}` } });
        }
        if (fc.text) textParts.push(fc.text);
      }
      const combinedText = textParts.length > 0
        ? `Create a course on: ${topic}\n\nSOURCE MATERIALS (${allFileContents.length} files):\n\n${textParts.join("\n\n--- NEXT FILE ---\n\n")}`
        : `Create a course on: ${topic}\n\nThe attached images/documents are the SOURCE MATERIALS.`;
      parts.push({ type: "text", text: combinedText });
      // If only text parts, flatten to string
      userContent = parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
    }

    // ===== PHASE 1: Outline + Lessons + Quizzes =====
    const outline = await generateOutline(LOVABLE_API_KEY, topic, userContent, allFilePaths.length > 0, preferences);
    console.log(`[Phase 1] Complete: "${outline.title}" with ${outline.modules.length} modules`);

    // Update course title/description
    await supabase.from("courses").update({ title: outline.title, description: outline.description, status: "generating" }).eq("id", course.id);

    // Insert modules with lab_generation_status = 'pending'
    const moduleRows = outline.modules.map((mod: any, index: number) => ({
      course_id: course.id,
      module_order: index + 1,
      title: mod.title,
      lesson_content: mod.lesson_content,
      youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.youtube_query || mod.title)}`,
      youtube_title: mod.youtube_title || mod.title,
      lab_type: "dynamic",
      lab_title: mod.lab_title || mod.title,
      lab_description: mod.lab_concept || null,
      lab_data: null,
      lab_generation_status: "pending",
      lab_blueprint: null,
      lab_error: null,
      quiz: mod.quiz,
    }));

    const { data: insertedModules } = await supabase.from("course_modules").insert(moduleRows).select("id, title, lab_description, module_order");
    console.log(`[Phase 1] Inserted ${insertedModules?.length || 0} modules`);

    // Mark course as ready — labs generate on-demand
    await supabase.from("courses").update({ status: "ready" }).eq("id", course.id);
    console.log(`[Phase 1] Course "${outline.title}" ready. Labs will generate on-demand.`);

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
