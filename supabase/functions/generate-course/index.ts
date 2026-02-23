import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ===============================
   🔒 ZOD SCHEMA VALIDATION
================================ */

const CourseSchema = z.object({
  title: z.string(),
  description: z.string(),
  modules: z.array(
    z.object({
      title: z.string(),
      lesson_content: z.string(),
      youtube_query: z.string().optional(),
      youtube_title: z.string().optional(),
      lab_type: z.enum(["simulation", "classification", "sorting", "math"]),
      lab_data: z.any(),
      quiz: z.array(
        z.object({
          question: z.string(),
          options: z.array(z.string()),
          correct: z.number(),
          explanation: z.string(),
        }),
      ),
    }),
  ),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { topic } = await req.json();
    if (!topic?.trim()) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Create course row
    const { data: course } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        title: topic.trim(),
        topic: topic.trim(),
        status: "generating",
      })
      .select()
      .single();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `You are an expert course architect. Return structured JSON only via the function tool.

COURSE STRUCTURE:
- Generate 4-6 modules per course
- Each module lesson_content must have 4-6 slides separated by "\\n---\\n"
- Each slide starts with "## Heading"

LAB TYPE SELECTION (CRITICAL - follow exactly):
1. "math" — Use when topic involves equations, calculations, numeric answers, algebra, calculus, derivatives, integrals, unit conversions, word problems with computed results.
2. "sorting" — Use when topic involves ordering steps, ranking, sequences, timelines, process flows, algorithm steps. ALSO use as the UNIVERSAL FALLBACK when topic doesn't clearly fit simulation, math, or classification.
3. "classification" — Use when topic involves grouping concepts, categorizing examples, identifying types, sorting items into labeled categories.
4. "simulation" — Use ONLY when topic benefits from cause-and-effect experimentation with tunable slider parameters and dynamic variable interactions.

FALLBACK RULE: If unsure, use "sorting". Never leave lab_data empty. Never return {}.

LAB DATA FORMATS (STRICT):

If lab_type = "sorting":
{ "title": string, "description": string, "items": [{ "text": string, "correct_position": number }] }
- 4-8 items, correct_position must be unique sequential integers starting at 1.

If lab_type = "math":
{ "title": string, "description": string, "problems": [{ "question": string, "answer": number, "tolerance": number, "hint": string, "explanation": string }] }
- 4-6 problems, answer must be a single number, tolerance defaults to 0.01.

If lab_type = "classification":
{ "title": string, "description": string, "categories": [{ "name": string, "emoji": string, "description": string }], "items": [{ "name": string, "correct_category": string, "hint": string }] }

If lab_type = "simulation":
{ "title": string, "description": string, "parameters": [{ "name": string, "icon": string, "unit": string, "min": 0, "max": 100, "default": number, "description": string }], "thresholds": [{ "label": string, "min_percent": number, "message": string }], "decisions": [{ "question": string, "emoji": string, "choices": [{ "text": string, "explanation": string, "set_state": { "<param_name>": integer_0_100 } }] }] }
- Every choice set_state MUST include ALL parameter names with integer values 0-100.
`,
          },
          { role: "user", content: `Create a course on: ${topic}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_course",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  modules: { type: "array" },
                },
                required: ["title", "description", "modules"],
              },
            },
          },
        ],
        tool_choice: "auto",
      }),
    });

    const aiData = await response.json();

    if (!aiData.choices?.length) {
      throw new Error("Empty AI response");
    }

    const message = aiData.choices[0].message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No function call returned by AI");
    }

    // 🔥 PARSE RAW JSON
    const parsed = JSON.parse(toolCall.function.arguments);

    // 🔒 VALIDATE STRUCTURE (THIS IS THE NEW PART)
    const courseData = CourseSchema.parse(parsed);

    // If validation passes, continue safely
    await supabase
      .from("courses")
      .update({
        title: courseData.title,
        description: courseData.description,
        status: "ready",
      })
      .eq("id", course.id);

    /* ===============================
       🔥 POST PROCESSING (YOUR LOGIC)
    ================================= */

    const modules = courseData.modules.map((mod: any, index: number) => {
      let lessonContent = mod.lesson_content || "";

      // Force slide separators
      if (!lessonContent.includes("\n---\n")) {
        const sections = lessonContent.split(/(?=^## )/m).filter(Boolean);
        if (sections.length > 1) {
          lessonContent = sections.join("\n\n---\n\n");
        }
      }

      // Sorting: fix positions to be unique and sequential
      if (mod.lab_type === "sorting" && mod.lab_data?.items) {
        mod.lab_data.items = mod.lab_data.items.map((item: any, idx: number) => ({
          ...item,
          correct_position: item.correct_position ?? idx + 1,
        }));
      }

      // Math: fix answer types and tolerance
      if (mod.lab_type === "math" && mod.lab_data?.problems) {
        mod.lab_data.problems = mod.lab_data.problems.map((p: any) => ({
          ...p,
          answer: typeof p.answer === "number" ? p.answer : parseFloat(p.answer) || 0,
          tolerance: p.tolerance ?? 0.01,
        }));
      }

      return {
        course_id: course.id,
        module_order: index + 1,
        title: mod.title,
        lesson_content: lessonContent,
        youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
          mod.youtube_query || mod.title,
        )}`,
        youtube_title: mod.youtube_title || mod.title,
        lab_type: mod.lab_type,
        lab_data: mod.lab_data,
        quiz: mod.quiz,
      };
    });

    await supabase.from("course_modules").insert(modules);

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("COURSE GENERATION ERROR:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
