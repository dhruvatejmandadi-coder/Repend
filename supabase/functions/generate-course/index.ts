import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ===============================
   🔒 STRICT SCHEMAS (MATCH FRONTEND)
================================ */

// Simulation structures (must match InteractiveLab)
const ParameterSchema = z.object({
  name: z.string(),
  icon: z.string(),
  unit: z.string(),
  min: z.number(),
  max: z.number(),
  default: z.number(),
  description: z.string().optional(),
});

const DecisionSchema = z.object({
  question: z.string(),
  emoji: z.string().optional(),
  choices: z.array(
    z.object({
      text: z.string(),
      explanation: z.string().optional(),
      set_state: z.record(z.number()).optional(),
      effects: z.record(z.number()).optional(), // legacy support
    }),
  ),
});

const SimulationLabSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  parameters: z.array(ParameterSchema).min(1),
  thresholds: z
    .array(
      z.object({
        label: z.string(),
        min_percent: z.number(),
        message: z.string(),
      }),
    )
    .min(1),
  decisions: z.array(DecisionSchema).optional(),
});

const ClassificationLabSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  categories: z.array(z.string()).min(1),
  items: z
    .array(
      z.object({
        text: z.string(),
        category: z.string(),
      }),
    )
    .min(1),
});

const ModuleSchema = z.object({
  title: z.string(),
  lesson_content: z.string(),
  youtube_query: z.string().optional(),
  youtube_title: z.string().optional(),
  lab_type: z.enum(["simulation", "classification"]),
  lab_data: z.any(),
  quiz: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        correct: z.number(),
        explanation: z.string(),
      }),
    )
    .min(1),
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
    if (!topic?.trim()) throw new Error("Topic required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing API key");

    // Create placeholder course
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
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
Return structured JSON only.
Create exactly 4 modules.

Each module must include:
- lesson_content (4 slides separated by "\\n---\\n")
- lab_type ("simulation" OR "classification" ONLY)
- lab_data (NEVER EMPTY)
- quiz (at least 1 question)

Simulation lab_data must include:
- parameters (min 1)
- thresholds (min 1)
- optional decisions

Classification lab_data must include:
- categories (min 1)
- items (min 1)

Never use any other lab_type.
Never return empty arrays.
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
    if (!toolCall) throw new Error("AI failed");

    const parsed = JSON.parse(toolCall.function.arguments);
    const courseData = CourseSchema.parse(parsed);

    /* ===============================
       🔍 VALIDATE LAB DATA PER TYPE
    ================================= */

    const validatedModules = courseData.modules.map((mod) => {
      if (mod.lab_type === "simulation") {
        SimulationLabSchema.parse(mod.lab_data);
      }

      if (mod.lab_type === "classification") {
        ClassificationLabSchema.parse(mod.lab_data);
      }

      return mod;
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

    const modules = validatedModules.map((mod, index) => ({
      course_id: course.id,
      module_order: index + 1,
      title: mod.title,
      lesson_content: mod.lesson_content,
      youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.youtube_query || mod.title)}`,
      youtube_title: mod.youtube_title || mod.title,
      lab_type: mod.lab_type,
      lab_data: mod.lab_data,
      quiz: mod.quiz,
    }));

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
