import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIMARY_MODEL = "google/gemini-2.5-pro";
const FAST_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-flash-lite";

const outlineToolSchema = {
  type: "function" as const,
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
              lab_concept: { type: "string" },
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
};

const moduleContentToolSchema = {
  type: "function" as const,
  function: {
    name: "create_module_content",
    parameters: {
      type: "object",
      properties: {
        lesson_content: { type: "string" },
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
};

async function callAI(apiKey: string, body: any, retries = 2): Promise<any> {
  let lastError = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 3000;
      console.log(`[AI Retry] Attempt ${attempt + 1} after ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        lastError = "Rate limit exceeded.";
        continue;
      }

      if (response.status === 402) {
        throw new Error("AI credits exhausted. Please add funds in Settings > Workspace > Usage.");
      }

      const text = await response.text();

      if (!response.ok) {
        console.error(`[AI Error ${response.status}] Body:`, text.slice(0, 500));
        lastError = `AI error (${response.status}): ${text.slice(0, 200)}`;
        continue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        lastError = "Invalid AI response.";
        continue;
      }

      if (!parsed.choices?.length) {
        lastError = "Empty AI response.";
        continue;
      }

      return parsed;
    } catch (e: any) {
      if (e.message?.includes("credits")) throw e;
      lastError = e.message || "Network error.";
    }
  }

  throw new Error(lastError || "AI call failed after retries.");
}

function isRetriableStructuredOutputError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");

  return [
    "reason: length",
    "did not return structured data",
    "malformed",
    "truncated",
    "Invalid AI response",
    "Empty AI response",
    "AI error (400)",
  ].some((fragment) => message.includes(fragment));
}

async function callStructuredAIWithFallback(
  apiKey: string,
  attempts: Array<{ label: string; body: any }>,
  preferredModel: string = PRIMARY_MODEL
): Promise<any> {
  let lastError: Error | null = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];

    try {
      const aiData = await callAI(apiKey, { ...attempt.body, model: preferredModel });
      return extractToolArgs(aiData);
    } catch (error) {
      if (error instanceof Error && error.message.includes("credits")) throw error;

      const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
      lastError = error instanceof Error ? error : new Error(message);
      console.warn(`[Structured Retry] ${attempt.label} failed: ${message}`);

      if (i < attempts.length - 1 && isRetriableStructuredOutputError(error)) {
        continue;
      }

      if (!isRetriableStructuredOutputError(error)) {
        throw lastError;
      }
    }
  }

  console.warn(`[Fallback] ${PRIMARY_MODEL} exhausted structured retries, trying ${FALLBACK_MODEL}...`);
  const fallbackAttempt = attempts[attempts.length - 1];
  const fallbackData = await callAI(apiKey, { ...fallbackAttempt.body, model: FALLBACK_MODEL });
  return extractToolArgs(fallbackData);
}

function extractToolArgs(aiData: any): any {
  const choice = aiData?.choices?.[0];
  const message = choice?.message;
  const toolCall = message?.tool_calls?.[0];

  if (!toolCall) {
    console.error("❌ No tool_calls in AI response. Full message:", JSON.stringify(message).slice(0, 500));
    if (choice?.finish_reason) {
      console.error("AI finish_reason:", choice.finish_reason);
    }
    throw new Error(`AI did not return structured data (reason: ${choice?.finish_reason || "unknown"}).`);
  }

  const raw = toolCall.function.arguments || "";

  try {
    return JSON.parse(raw);
  } catch {
    console.error("❌ JSON parse failed on tool_calls.arguments");
    console.error("Raw AI response (first 500 chars):", raw.slice(0, 500));

    const cleaned = raw.replace(/,\s*$/, "");
    for (const closer of ["]}]}", "]}}", "]}", "}", "]"]) {
      try {
        return JSON.parse(cleaned + closer);
      } catch {
        // keep trying repairs
      }
    }

    throw new Error("AI response was malformed or truncated. Try a simpler topic.");
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
    let minLen = Infinity;
    let minIdx = 0;

    for (let i = 0; i < slides.length - 1; i++) {
      const combined = slides[i].length + slides[i + 1].length;
      if (combined < minLen) {
        minLen = combined;
        minIdx = i;
      }
    }

    slides[minIdx] = slides[minIdx] + "\n" + slides[minIdx + 1];
    slides.splice(minIdx + 1, 1);
  }

  return slides.join("\n\n---\n\n");
}

async function extractFileContent(
  filePath: string,
  supabaseAdmin: any
): Promise<{ text?: string; imageBase64?: string; mimeType?: string }> {
  const { data, error } = await supabaseAdmin.storage.from("course-uploads").download(filePath);
  if (error || !data) {
    console.error("Failed to download file:", error);
    return {};
  }

  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const imageExts = ["png", "jpg", "jpeg", "webp"];
  const textExts = ["txt", "md", "csv"];

  if (imageExts.includes(ext)) {
    const buffer = await data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    return { imageBase64: base64, mimeType: mimeMap[ext] || "image/png" };
  }

  if (textExts.includes(ext)) {
    return { text: (await data.text()).slice(0, 50000) };
  }

  if (ext === "pdf") {
    try {
      const text = await data.text();
      const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").trim();
      if (cleaned.length > 100) return { text: cleaned.slice(0, 50000) };

      const buffer = await data.arrayBuffer();
      return {
        imageBase64: btoa(String.fromCharCode(...new Uint8Array(buffer))),
        mimeType: "application/pdf",
      };
    } catch {
      return {};
    }
  }

  return {};
}

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

async function generateOutline(apiKey: string, topic: string, hasFile: boolean, preferences: any): Promise<any> {
  console.log("[Step 1] Generating course outline structure...");
  const personalization = buildPersonalizationContext(preferences);

  const systemPrompt = `You are an expert educational designer.
Generate a concise course outline only.
Return ONLY valid structured data via the tool call.
No prose outside the tool call.
Be concise.
Create exactly 4 modules.
Keep title under 8 words.
Keep description under 30 words.
Keep each module title under 6 words.
Keep each lab concept under 16 words.
${personalization ? `\nPERSONALIZATION:\n${personalization}` : ""}
${hasFile ? "\nBase the outline on the uploaded source material." : ""}`;

  return await callStructuredAIWithFallback(apiKey, [
    {
      label: "outline-primary",
      body: {
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Create a course outline for: ${topic}. Use short phrases only.`,
          },
        ],
        tools: [outlineToolSchema],
        tool_choice: { type: "function", function: { name: "create_outline" } },
      },
    },
    {
      label: "outline-compact-retry",
      body: {
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Topic: ${topic}. Return an ultra-compact outline with exactly 4 modules and very short strings.`,
          },
        ],
        tools: [outlineToolSchema],
        tool_choice: { type: "function", function: { name: "create_outline" } },
      },
    },
  ]);
}

async function generateModuleContent(
  apiKey: string,
  topic: string,
  moduleTitle: string,
  moduleIndex: number,
  totalModules: number,
  hasFile: boolean,
  fileContext: string,
  preferences: any
): Promise<{ lesson_content: string; quiz: any[] }> {
  console.log(`[Step 2] Generating lesson+quiz for module ${moduleIndex + 1}/${totalModules}: "${moduleTitle}"`);
  const personalization = buildPersonalizationContext(preferences);

  const systemPrompt = `Expert lesson writer for high school and college students.
Return ONLY valid structured data via the tool call.
Be concise but ENGAGING — students struggle with staying engaged and seeing real-world relevance.
LESSON: 7 slides separated by "---".
Each slide needs an emoji heading and 3-5 short bullets.
Include at least ONE real-world application example per lesson.
Use relatable analogies and scenarios students can connect to.
Keep each slide under 120 words.
QUIZ: exactly 5 questions with practical application focus.
Keep explanations to 1 sentence.
${personalization ? `\n${personalization}` : ""}
${hasFile ? "\nBase content on the source material provided." : ""}`;

  const fullContextUserMsg = fileContext
    ? `Module ${moduleIndex + 1}/${totalModules} of course "${topic}": "${moduleTitle}"\n\nSource material context:\n${fileContext.slice(0, 6000)}`
    : `Module ${moduleIndex + 1}/${totalModules} of course "${topic}": "${moduleTitle}"`;

  const compactContextUserMsg = fileContext
    ? `Write the lesson and quiz for module "${moduleTitle}" in the course "${topic}" using only this context:\n${fileContext.slice(0, 2500)}`
    : `Write the lesson and quiz for module "${moduleTitle}" in the course "${topic}".`;

  const result = await callStructuredAIWithFallback(apiKey, [
    {
      label: `module-${moduleIndex + 1}-primary`,
      body: {
        max_tokens: 6000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fullContextUserMsg },
        ],
        tools: [moduleContentToolSchema],
        tool_choice: { type: "function", function: { name: "create_module_content" } },
      },
    },
    {
      label: `module-${moduleIndex + 1}-compact-retry`,
      body: {
        max_tokens: 4200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${compactContextUserMsg}\n\nKeep bullets tight and concise.` },
        ],
        tools: [moduleContentToolSchema],
        tool_choice: { type: "function", function: { name: "create_module_content" } },
      },
    },
  ], FAST_MODEL);

  return {
    lesson_content: repairLessonContent(result.lesson_content || ""),
    quiz: Array.isArray(result.quiz) && result.quiz.length > 0
      ? result.quiz
      : [{ question: `What is a key concept from "${moduleTitle}"?`, options: ["A", "B", "C", "D"], correct: 0, explanation: "Review the lesson." }],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Unauthorized");

    const { topic, filePath, filePaths, preferences, phase, courseId: existingCourseId, moduleIndex, moduleTitle } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // ─── PHASE 2: Generate a single module ───
    if (phase === 2 && existingCourseId && typeof moduleIndex === "number" && moduleTitle) {
      const allFilePaths: string[] = [];
      if (filePaths && Array.isArray(filePaths)) allFilePaths.push(...filePaths);
      else if (filePath) allFilePaths.push(filePath);

      let fileTextContext = "";
      if (allFilePaths.length > 0) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        for (const fp of allFilePaths) {
          const content = await extractFileContent(fp, supabaseAdmin);
          if (content.text) fileTextContext += content.text.slice(0, 10000) + "\n\n";
        }
      }

      const hasFile = fileTextContext.length > 0;
      const totalModules = 4;

      try {
        const content = await generateModuleContent(
          LOVABLE_API_KEY,
          topic || moduleTitle,
          moduleTitle,
          moduleIndex,
          totalModules,
          hasFile,
          fileTextContext,
          preferences
        );

        await supabase.from("course_modules").update({
          lesson_content: content.lesson_content,
          quiz: content.quiz,
        }).eq("course_id", existingCourseId).eq("module_order", moduleIndex + 1);

        console.log(`[Phase 2] Module ${moduleIndex + 1} "${moduleTitle}" done`);
      } catch (e: any) {
        console.error(`[Phase 2] Module ${moduleIndex + 1} failed: ${e.message}`);
        // Leave the placeholder content
      }

      // Check if all modules are done
      const { data: allModules } = await supabase
        .from("course_modules")
        .select("lesson_content")
        .eq("course_id", existingCourseId);

      const allDone = allModules?.every((m: any) => !m.lesson_content.startsWith("⏳"));
      if (allDone) {
        await supabase.from("courses").update({ status: "ready" }).eq("id", existingCourseId);
        console.log(`[Phase 2] All modules done — course ready`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PHASE 1: Generate outline + placeholder modules, return immediately ───
    if (!topic?.trim()) throw new Error("Topic is required");

    const allFilePaths: string[] = [];
    if (filePaths && Array.isArray(filePaths)) allFilePaths.push(...filePaths);
    else if (filePath) allFilePaths.push(filePath);

    let fileTextContext = "";
    if (allFilePaths.length > 0) {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      for (const fp of allFilePaths) {
        const content = await extractFileContent(fp, supabaseAdmin);
        if (content.text) fileTextContext += content.text.slice(0, 10000) + "\n\n";
      }
    }

    const hasFile = fileTextContext.length > 0;

    const { data: course } = await supabase
      .from("courses")
      .insert({ user_id: user.id, title: topic.trim(), topic: topic.trim(), status: "generating" })
      .select()
      .single();

    const outline = await generateOutline(LOVABLE_API_KEY, topic, hasFile, preferences);
    const modules = Array.isArray(outline.modules) ? outline.modules.slice(0, 4) : [];

    if (modules.length === 0) {
      throw new Error("Outline generation returned no modules.");
    }

    console.log(`[Phase 1] Outline: "${outline.title}" with ${modules.length} modules`);

    await supabase
      .from("courses")
      .update({
        title: outline.title || topic.trim(),
        description: outline.description || null,
        status: "generating",
      })
      .eq("id", course.id);

    // Insert placeholder modules immediately
    const moduleRows = modules.map((mod: any, i: number) => ({
      course_id: course.id,
      module_order: i + 1,
      title: mod.title,
      lesson_content: `⏳ Generating "${mod.title}"...`,
      youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.youtube_query || mod.title)}`,
      youtube_title: mod.youtube_title || mod.title,
      lab_type: "dynamic",
      lab_title: mod.lab_title || mod.title,
      lab_description: mod.lab_concept || null,
      lab_data: null,
      lab_generation_status: "pending",
      lab_blueprint: null,
      lab_error: null,
      quiz: [],
    }));

    await supabase.from("course_modules").insert(moduleRows);

    // Track file usage
    if (allFilePaths.length > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: existing } = await supabaseAdmin
        .from("usage_tracking")
        .select("id, file_courses_generated")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .single();

      if (existing) {
        await supabaseAdmin
          .from("usage_tracking")
          .update({ file_courses_generated: (existing.file_courses_generated || 0) + 1 })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("usage_tracking").insert({
          user_id: user.id,
          month: currentMonth,
          file_courses_generated: 1,
          courses_generated: 1,
        });
      }
    }

    // Return immediately with the outline data so the client can kick off phase 2
    return new Response(JSON.stringify({
      courseId: course.id,
      modules: modules.map((m: any, i: number) => ({ index: i, title: m.title })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("COURSE GENERATION ERROR:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
