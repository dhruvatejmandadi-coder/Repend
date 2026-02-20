import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Create course record
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

    // 🔥 UPDATED PROMPT
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

Generate a structured course with AS MANY MODULES AS NEEDED to fully cover the topic.
- Simple topics: 4–5 modules
- Complex topics: 8–12+ modules
Each module should focus on ONE clear subtopic.

QUIZ REQUIREMENTS:
- 6–8 questions per module
- Mix conceptual, scenario, and application questions
- EVERY question MUST include an "explanation" field

SIMULATION LAB REQUIREMENTS:
- MUST include parameters (sliders with name, min, max, default, unit)
- MUST include 2–3 decision scenarios in the "decisions" array
- CRITICAL: Every choice in a decision MUST have a non-empty "effects" object
- Effects map parameter names to NUMERIC deltas (e.g. {"Pressure": 20, "Volume": -15})
- NEVER leave effects as an empty object {}

LESSON FORMAT:
- 4–6 slides
- Slides separated by ---
- Each slide starts with: ## 🎯 Title
- Use emojis
- 2–3 short paragraphs per slide

Return structured JSON only via the function tool.
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
                  modules: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        lesson_content: { type: "string" },
                        youtube_query: { type: "string" },
                        youtube_title: { type: "string" },
                        lab_type: {
                          type: "string",
                          enum: ["simulation", "classification"],
                        },
                        lab_data: { type: "object" },
                        quiz: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              question: { type: "string" },
                              options: {
                                type: "array",
                                items: { type: "string" },
                              },
                              correct: { type: "number" },
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
    });

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned");

    const courseData = JSON.parse(toolCall.function.arguments);

    await supabase
      .from("courses")
      .update({
        title: courseData.title,
        description: courseData.description,
        status: "ready",
      })
      .eq("id", course.id);

    // 🔥 POST-PROCESS MODULES
    const modules = courseData.modules.map((mod: any, index: number) => {
      let labData = mod.lab_data;
      let labType = mod.lab_type;

      // 🔥 FORCE DECISIONS + FIX EMPTY EFFECTS
      if (labType === "simulation" && labData?.parameters?.length > 0) {
        const params = labData.parameters;
        const paramNames = params.map((p: any) => p.name);

        // Generate decisions if missing entirely
        if (!Array.isArray(labData.decisions) || labData.decisions.length === 0) {
          labData.decisions = [
            {
              question: `How would you adjust ${paramNames[0]}?`,
              emoji: "⚡",
              choices: [
                {
                  text: "Increase it",
                  explanation: "Increasing strengthens this factor.",
                  effects: { [paramNames[0]]: 20 },
                },
                {
                  text: "Decrease it",
                  explanation: "Reducing may balance tradeoffs.",
                  effects: { [paramNames[0]]: -20 },
                },
              ],
            },
          ];
        } else {
          // Fix decisions that have empty effects
          labData.decisions = labData.decisions.map((d: any) => ({
            ...d,
            choices: (d.choices || []).map((c: any, cIdx: number) => {
              const hasEffects = c.effects && Object.keys(c.effects).length > 0 &&
                Object.values(c.effects).some((v: any) => v !== 0);
              if (hasEffects) return c;

              const param = params[cIdx % params.length];
              const range = (param.max || 100) - (param.min || 0);
              const delta = Math.round(range * 0.2) * (cIdx % 2 === 0 ? 1 : -1);
              return { ...c, effects: { [param.name]: delta || Math.round(range * 0.15) } };
            }),
          }));
        }
      }

      return {
        course_id: course.id,
        module_order: index + 1,
        title: mod.title,
        lesson_content: mod.lesson_content,
        youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
          mod.youtube_query || mod.title,
        )}`,
        youtube_title: mod.youtube_title || mod.title,
        lab_type: labType,
        lab_data: labData,
        quiz: mod.quiz,
      };
    });

    await supabase.from("course_modules").insert(modules);

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
