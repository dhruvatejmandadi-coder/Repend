import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ===============================
   🔒 SCHEMAS (TOLERANT)
================================ */

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
    })
  ),
});

const CourseSchema = z.object({
  title: z.string(),
  description: z.string(),
  modules: z.array(ModuleSchema).min(1),
});

/* ===============================
   🛠️ POST-PROCESSING / REPAIR
================================ */

function repairModules(parsed: any): any {
  if (!parsed?.modules || !Array.isArray(parsed.modules)) return parsed;

  const paramNames = ["Understanding", "Application", "Confidence"];

  for (const mod of parsed.modules) {
    // Fix lesson_content: use any available text field
    if (!mod.lesson_content) {
      mod.lesson_content = mod.content || mod.lesson || mod.text || 
        `## ${mod.title || "Lesson"}\n\nContent for this module.`;
    }

    // Force slide separators if missing
    if (!mod.lesson_content.includes("\n---\n")) {
      const sections = mod.lesson_content.split(/(?=^## )/m).filter(Boolean);
      if (sections.length > 1) {
        mod.lesson_content = sections.join("\n\n---\n\n");
      }
    }

    // Fix lab_type
    if (!mod.lab_type) {
      const validTypes = ["simulation", "classification", "sorting", "math"];
      mod.lab_type = validTypes.includes(mod.labType) ? mod.labType :
                     validTypes.includes(mod.lab) ? mod.lab : "classification";
    }

    // Fix lab_data
    if (!mod.lab_data) {
      mod.lab_data = mod.labData || mod.lab_content || {};
    }

    // Ensure lab_data is not empty for simulation
    if (mod.lab_type === "simulation") {
      const ld = mod.lab_data;
      if (!ld.parameters || !Array.isArray(ld.parameters) || ld.parameters.length === 0) {
        ld.parameters = paramNames.map(n => ({ name: n, min: 0, max: 100, default: 50 }));
      }
      if (!ld.decisions || !Array.isArray(ld.decisions) || ld.decisions.length === 0) {
        ld.decisions = [{
          scenario: `Key decision for ${mod.title || "this topic"}`,
          choices: [
            { text: "Deep dive into theory first", explanation: "Strong foundation approach.",
              set_state: { Understanding: 80, Application: 40, Confidence: 55 } },
            { text: "Jump into practice problems", explanation: "Hands-on learning approach.",
              set_state: { Understanding: 45, Application: 85, Confidence: 65 } },
          ]
        }];
      }
      // Repair decisions: convert effects to set_state, fill missing sliders
      for (const dec of ld.decisions) {
        if (!dec.choices || !Array.isArray(dec.choices)) continue;
        for (const choice of dec.choices) {
          if (!choice.set_state && choice.effects) {
            choice.set_state = {};
            for (const p of paramNames) {
              const delta = choice.effects[p] ?? 0;
              choice.set_state[p] = Math.max(0, Math.min(100, 50 + delta));
            }
            delete choice.effects;
          }
          if (!choice.set_state || typeof choice.set_state !== "object" || Object.keys(choice.set_state).length === 0) {
            choice.set_state = { Understanding: 50, Application: 50, Confidence: 50 };
          }
          // Fill missing sliders
          for (const p of paramNames) {
            if (choice.set_state[p] === undefined) choice.set_state[p] = 50;
            choice.set_state[p] = Math.max(0, Math.min(100, choice.set_state[p]));
          }
        }
      }
    }

    // Fix quiz
    if (!mod.quiz || !Array.isArray(mod.quiz)) {
      mod.quiz = mod.questions || mod.quizzes || [];
    }
    if (mod.quiz.length === 0) {
      mod.quiz = [{
        question: `What is a key concept in ${mod.title || "this topic"}?`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct: 0,
        explanation: "This is the correct answer based on the lesson content."
      }];
    }
  }

  return parsed;
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Unauthorized");

    const { topic } = await req.json();
    if (!topic?.trim()) throw new Error("Topic required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing API key");

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

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
              content: `Return structured JSON via the create_course tool call.

Generate exactly 4 modules.

LESSON FORMAT (CRITICAL):
- Each module needs "lesson_content" (a string)
- 4-6 slides per module separated by "\\n---\\n"
- Example: "## Slide 1\\n\\nContent...\\n\\n---\\n\\n## Slide 2\\n\\nContent...\\n\\n---\\n\\n## Slide 3\\n\\nContent..."

LAB TYPES: "simulation", "classification", "sorting", "math"

SIMULATION LAB REQUIREMENTS:
- lab_data must have "parameters" array and "decisions" array
- parameters: [{"name": "Understanding", "min": 0, "max": 100, "default": 50}, ...]
- Every decision choice MUST have "set_state" (NOT "effects")
- set_state maps ALL slider names to exact integer values 0-100
- Example choice: {"text": "Option", "set_state": {"Understanding": 85, "Application": 60, "Confidence": 70}, "explanation": "Why"}
- NEVER use "effects", delta values, or empty objects

QUIZ: Each module needs a "quiz" array with 3-4 questions.
Each question: {"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."}

NEVER return empty or null for lesson_content, lab_type, lab_data, or quiz.`,
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
                    modules: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          lesson_content: { type: "string", description: "4-6 slides separated by \\n---\\n" },
                          youtube_query: { type: "string" },
                          youtube_title: { type: "string" },
                          lab_type: { type: "string", enum: ["simulation", "classification", "sorting", "math"] },
                          lab_data: { type: "object" },
                          quiz: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                question: { type: "string" },
                                options: { type: "array", items: { type: "string" } },
                                correct: { type: "integer" },
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
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_course" } },
        }),
      }
    );

    const aiData = await response.json();
    console.log("AI response status:", response.status);
    
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in AI response:", JSON.stringify(aiData).slice(0, 500));
      throw new Error("AI did not return a tool call");
    }

    let parsed = JSON.parse(toolCall.function.arguments);
    
    // Repair any missing/malformed fields before validation
    parsed = repairModules(parsed);
    
    const courseData = CourseSchema.parse(parsed);

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

    const modules = courseData.modules.map((mod, index) => ({
      course_id: course.id,
      module_order: index + 1,
      title: mod.title,
      lesson_content: mod.lesson_content,
      youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        mod.youtube_query || mod.title
      )}`,
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
