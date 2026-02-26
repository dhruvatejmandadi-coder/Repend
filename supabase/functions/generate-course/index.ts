import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

/* ===============================
   CORS
================================ */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ===============================
   ZOD VALIDATION
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
      lab_type: z.enum(["simulation", "classification"]),
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

/* ===============================
   TOOL CALLING SCHEMA
================================ */
const courseToolSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Course title" },
    description: { type: "string", description: "Course description (1-2 sentences)" },
    modules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          lesson_content: {
            type: "string",
            description: "Exactly 4 slides of markdown content separated by \\n---\\n",
          },
          youtube_query: { type: "string", description: "YouTube search query for this topic" },
          youtube_title: { type: "string", description: "Suggested YouTube video title" },
          lab_type: { type: "string", enum: ["simulation", "classification"] },
          lab_data: {
            type: "object",
            description:
              "For simulation: {scenario, parameters:[{name,label,initial}], decisions:[{id,title,description,choices:[{id,label,description,set_state:{paramName:value}}]}]}. For classification: {title,description,categories:[{id,name}],items:[{id,content,correctCategory}]}",
          },
          quiz: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct: { type: "integer", description: "0-based index of the correct option" },
                explanation: { type: "string" },
              },
              required: ["question", "options", "correct", "explanation"],
            },
          },
        },
        required: ["title", "lesson_content", "lab_type", "lab_data", "quiz"],
      },
    },
  },
  required: ["title", "description", "modules"],
};

/* ===============================
   REPAIR LAYER
================================ */
function repairModules(parsed: any): any {
  if (!parsed.modules) parsed.modules = [];

  for (const mod of parsed.modules) {
    // Fix lesson_content from alternate field names
    if (!mod.lesson_content) {
      mod.lesson_content =
        mod.content || mod.lesson || mod.slides || "## Introduction\n\nContent coming soon.\n\n---\n\n## Key Concepts\n\nCore ideas for this topic.\n\n---\n\n## Details\n\nDeeper exploration.\n\n---\n\n## Summary\n\nKey takeaways.";
    }

    // Add slide separators if missing
    if (!mod.lesson_content.includes("\n---\n")) {
      const sections = mod.lesson_content.split(/(?=^## )/m).filter(Boolean);
      if (sections.length > 1) {
        mod.lesson_content = sections.join("\n\n---\n\n");
      }
    }

    // Fix lab_type
    if (!mod.lab_type) mod.lab_type = "classification";

    // Fix lab_data
    if (!mod.lab_data) mod.lab_data = {};

    // Fix quiz
    if (!mod.quiz || !Array.isArray(mod.quiz) || mod.quiz.length === 0) {
      mod.quiz = [
        {
          question: "What is the main concept covered in this module?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correct: 0,
          explanation: "Review the lesson content for more details.",
        },
      ];
    }

    // Ensure quiz items have all fields
    for (const q of mod.quiz) {
      if (!q.question) q.question = "Review question";
      if (!q.options || !Array.isArray(q.options)) q.options = ["A", "B", "C", "D"];
      if (q.correct === undefined || q.correct === null) q.correct = 0;
      if (!q.explanation) q.explanation = "Review the lesson.";
    }

    // Fix simulation set_state
    if (mod.lab_type === "simulation" && mod.lab_data?.decisions) {
      const parameters = mod.lab_data.parameters || [];

      for (const d of mod.lab_data.decisions) {
        for (const c of d.choices || []) {
          // Convert legacy "effects" to "set_state"
          if (!c.set_state && c.effects) {
            c.set_state = {};
            for (const [key, val] of Object.entries(c.effects)) {
              c.set_state[key] = Math.max(0, Math.min(100, Math.round(50 + Number(val))));
            }
            delete c.effects;
          }

          if (!c.set_state) c.set_state = {};

          // Ensure all parameters are present
          for (const p of parameters) {
            if (c.set_state[p.name] === undefined) c.set_state[p.name] = 50;
            c.set_state[p.name] = Math.max(0, Math.min(100, Math.round(c.set_state[p.name])));
          }
        }
      }
    }

    // Inject fallback simulation data if lab_data is empty for simulation type
    if (mod.lab_type === "simulation" && (!mod.lab_data.decisions || mod.lab_data.decisions.length === 0)) {
      mod.lab_data = {
        scenario: `Simulation for: ${mod.title}`,
        parameters: [
          { name: "effectiveness", label: "Effectiveness", initial: 50 },
          { name: "cost", label: "Cost", initial: 50 },
        ],
        decisions: [
          {
            id: "d1",
            title: "Choose your approach",
            description: "Select a strategy",
            choices: [
              { id: "c1", label: "Conservative", description: "Low risk approach", set_state: { effectiveness: 40, cost: 30 } },
              { id: "c2", label: "Aggressive", description: "High risk approach", set_state: { effectiveness: 80, cost: 70 } },
            ],
          },
        ],
      };
    }
  }

  return parsed;
}

/* ===============================
   MAIN HANDLER
================================ */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let course: any = null;
  let supabase: any = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { topic } = await req.json();
    if (!topic?.trim()) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI API key not configured");

    /* ===============================
       CREATE COURSE ROW
    ================================= */
    const { data: courseData } = await supabase
      .from("courses")
      .insert({ user_id: user.id, title: topic.trim(), topic: topic.trim(), status: "generating" })
      .select()
      .single();

    course = courseData;

    /* ===============================
       CALL AI VIA LOVABLE GATEWAY
    ================================= */
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        temperature: 0.4,
        max_tokens: 16000,
        tools: [
          {
            type: "function",
            function: {
              name: "create_course",
              description: "Create a structured educational course with modules, lessons, labs, and quizzes.",
              parameters: courseToolSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_course" } },
        messages: [
          {
            role: "system",
            content: `You are an expert course architect. You MUST call the create_course function.

CRITICAL RULES:
1. Create 4-6 modules with progressive difficulty.
2. EVERY module MUST include: lesson_content, lab_type, lab_data, quiz.
3. lesson_content: exactly 4 slides of markdown, separated by "\\n---\\n".
4. lab_type: either "simulation" or "classification". Mix both types across modules.
5. For simulation labs:
   - set_state MUST include ALL parameter names
   - All values must be integers 0-100 (absolute, not deltas)
   - NEVER use "effects", only "set_state"
   - Each choice must modify at least 2 parameters
6. For classification labs: provide categories and items to sort.
7. quiz: 3-5 questions per module, each with 4 options.

EXAMPLE simulation lab_data:
{
  "scenario": "Managing a startup budget",
  "parameters": [{"name": "growth", "label": "Growth Rate", "initial": 50}, {"name": "risk", "label": "Risk Level", "initial": 50}],
  "decisions": [{"id": "d1", "title": "Funding Strategy", "description": "Choose funding approach", "choices": [
    {"id": "c1", "label": "Bootstrap", "description": "Self-fund", "set_state": {"growth": 30, "risk": 20}},
    {"id": "c2", "label": "Venture Capital", "description": "Seek VC", "set_state": {"growth": 80, "risk": 70}}
  ]}]
}`,
          },
          {
            role: "user",
            content: `Create a complete course on "${topic}" with 4-6 modules. Make difficulty progressive.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) throw new Error("AI rate limit exceeded. Please try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`AI gateway error (${response.status})`);
    }

    const aiData = await response.json();

    /* ===============================
       PARSE RESPONSE (tool call or fallback)
    ================================= */
    let parsed: any;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall) {
      parsed = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: extract JSON from raw content
      const raw = aiData.choices?.[0]?.message?.content || "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No structured data in AI response");
      parsed = JSON.parse(match[0]);
    }

    /* ===============================
       REPAIR → VALIDATE
    ================================= */
    const repaired = repairModules(parsed);
    const validatedCourse = CourseSchema.parse(repaired);

    /* ===============================
       UPDATE COURSE
    ================================= */
    await supabase
      .from("courses")
      .update({ title: validatedCourse.title, description: validatedCourse.description, status: "ready" })
      .eq("id", course.id);

    /* ===============================
       INSERT MODULES
    ================================= */
    const modules = validatedCourse.modules.map((mod: any, index: number) => ({
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

    // Mark course as failed so it doesn't stay stuck on "generating"
    if (course?.id && supabase) {
      try {
        await supabase.from("courses").update({ status: "failed" }).eq("id", course.id);
      } catch (_) {
        // ignore cleanup error
      }
    }

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      : error instanceof Error
        ? error.message
        : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
