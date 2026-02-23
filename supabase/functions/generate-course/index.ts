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

const GraphLabSchema = z.object({
  title: z.string(),
  description: z.string(),
  equation: z.string(),
  parameters: z
    .array(
      z.object({
        name: z.string(),
        min: z.number(),
        max: z.number(),
        default: z.number(),
        step: z.number().optional(),
      }),
    )
    .min(1),
  domain: z.object({
    min: z.number(),
    max: z.number(),
    step: z.number(),
  }),
});

const SortingLabSchema = z.object({
  title: z.string(),
  description: z.string(),
  items: z
    .array(
      z.object({
        text: z.string(),
        correct_position: z.number(),
      }),
    )
    .min(2),
});

const ClassificationLabSchema = z.object({
  title: z.string(),
  description: z.string(),
  categories: z
    .array(
      z.object({
        name: z.string(),
        emoji: z.string(),
        description: z.string(),
      }),
    )
    .min(2),
  items: z
    .array(
      z.object({
        name: z.string(),
        correct_category: z.string(),
        hint: z.string(),
      }),
    )
    .min(2),
});

const SimulationLabSchema = z.object({
  title: z.string(),
  description: z.string(),
  parameters: z
    .array(
      z.object({
        name: z.string(),
        icon: z.string(),
        unit: z.string(),
        min: z.number(),
        max: z.number(),
        default: z.number(),
        description: z.string(),
      }),
    )
    .min(1),
  thresholds: z
    .array(
      z.object({
        label: z.string(),
        min_percent: z.number(),
        message: z.string(),
      }),
    )
    .min(1),
  decisions: z
    .array(
      z.object({
        question: z.string(),
        emoji: z.string(),
        choices: z
          .array(
            z.object({
              text: z.string(),
              explanation: z.string(),
              set_state: z.record(z.number()),
            }),
          )
          .min(2),
      }),
    )
    .min(1),
});

const ModuleSchema = z.object({
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
});

const CourseSchema = z.object({
  title: z.string(),
  description: z.string(),
  modules: z.array(ModuleSchema).min(1),
});

/* ===============================
   🚀 EDGE FUNCTION
================================ */

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

    // Create initial course row
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

    /* ===============================
       🤖 AI CALL
    ================================= */

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
            content: `
You are an expert course architect.

Return structured JSON ONLY via the function tool.

COURSE STRUCTURE:
- 4–6 modules
- Each lesson_content must contain 4–6 slides separated by "\\n---\\n"
- Each slide begins with "## Heading"

LAB TYPE RULES:

1) "math"
Use when topic involves equations, algebra, calculus, graph behavior, transformations.
FORMAT:
{
  "title": string,
  "description": string,
  "equation": string,
  "parameters": [
    {
      "name": string,
      "min": number,
      "max": number,
      "default": number,
      "step": number
    }
  ],
  "domain": {
    "min": number,
    "max": number,
    "step": number
  }
}

RULES:
- equation MUST be valid JavaScript math using variable x
- Use Math.sin, Math.cos, Math.exp, Math.log if needed
- 2–5 parameters
- domain required
- DO NOT create numeric quiz problems

2) "sorting"
{
  "title": string,
  "description": string,
  "items": [{ "text": string, "correct_position": number }]
}

3) "classification"
{
  "title": string,
  "description": string,
  "categories": [...],
  "items": [...]
}

4) "simulation"
{
  "title": string,
  "description": string,
  "parameters": [...],
  "thresholds": [...],
  "decisions": [...]
}

FALLBACK RULE:
If unsure → use "sorting"
Never return empty lab_data.
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
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) throw new Error("AI did not return function call");

    const parsed = JSON.parse(toolCall.function.arguments);
    const courseData = CourseSchema.parse(parsed);

    /* ===============================
       🔒 LAB VALIDATION
    ================================= */

    courseData.modules.forEach((mod) => {
      switch (mod.lab_type) {
        case "math":
          GraphLabSchema.parse(mod.lab_data);
          break;
        case "sorting":
          SortingLabSchema.parse(mod.lab_data);
          break;
        case "classification":
          ClassificationLabSchema.parse(mod.lab_data);
          break;
        case "simulation":
          SimulationLabSchema.parse(mod.lab_data);
          break;
      }
    });

    /* ===============================
       💾 SAVE COURSE
    ================================= */

    await supabase
      .from("courses")
      .update({
        title: courseData.title,
        description: courseData.description,
        status: "ready",
      })
      .eq("id", course.id);

    const modules = courseData.modules.map((mod, index) => {
      let lessonContent = mod.lesson_content;

      if (!lessonContent.includes("\n---\n")) {
        const sections = lessonContent.split(/(?=^## )/m).filter(Boolean);
        lessonContent = sections.join("\n---\n");
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
