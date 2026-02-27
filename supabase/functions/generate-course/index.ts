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
      lab_type: z.enum(["simulation", "classification", "policy_optimization", "ethical_dilemma"]),
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
   🔧 REPAIR MODULES
================================ */

function repairModules(parsed: any) {
  if (!parsed?.modules || !Array.isArray(parsed.modules)) return parsed;

  for (const mod of parsed.modules) {
    // Recover lesson_content from alternative field names
    if (!mod.lesson_content) {
      mod.lesson_content = mod.content || mod.lesson || mod.text || "## Lesson Content\n\nContent is being prepared.";
    }

    // Force slide separators
    if (mod.lesson_content && !mod.lesson_content.includes("\n---\n")) {
      const sections = mod.lesson_content.split(/(?=^## )/m).filter(Boolean);
      if (sections.length > 1) {
        mod.lesson_content = sections.join("\n\n---\n\n");
      }
    }

    // Default lab_type
    if (!mod.lab_type) {
      mod.lab_type = "simulation";
    }

    // Default quiz
    if (!mod.quiz || !Array.isArray(mod.quiz)) {
      mod.quiz = [
        {
          question: `What is a key concept from "${mod.title || "this module"}"?`,
          options: ["Option A", "Option B", "Option C", "Option D"],
          correct: 0,
          explanation: "Review the lesson content for details.",
        },
      ];
    }

    // Repair simulation lab_data
    if (mod.lab_type === "simulation" && mod.lab_data) {
      const ld = mod.lab_data;

      if (!ld.parameters || !Array.isArray(ld.parameters) || ld.parameters.length === 0) {
        ld.parameters = [
          { name: `${mod.title} Variable 1`, icon: "📊", unit: "%", min: 0, max: 100, default: 50 },
          { name: `${mod.title} Variable 2`, icon: "📈", unit: "%", min: 0, max: 100, default: 50 },
          { name: `${mod.title} Variable 3`, icon: "📉", unit: "%", min: 0, max: 100, default: 50 },
        ];
      }

      for (const p of ld.parameters) {
        p.min = 0;
        p.max = 100;
        if (typeof p.default !== "number" || p.default < 0 || p.default > 100) p.default = 50;
      }

      const paramNames = ld.parameters.map((p: any) => p.name);

      if (!ld.thresholds || !Array.isArray(ld.thresholds) || ld.thresholds.length === 0) {
        ld.thresholds = [
          { label: "Excellent", min_percent: 75, message: "Outstanding performance across all factors." },
          { label: "Good", min_percent: 50, message: "Solid results with room for improvement." },
          { label: "Needs Work", min_percent: 0, message: "Consider revisiting your approach." },
        ];
      }

      if (ld.decisions && Array.isArray(ld.decisions)) {
        for (const decision of ld.decisions) {
          if (!decision.choices || !Array.isArray(decision.choices)) continue;
          for (const choice of decision.choices) {
            if (choice.effects && !choice.set_state) {
              const setState: Record<string, number> = {};
              for (const pName of paramNames) {
                const delta = choice.effects[pName] ?? 0;
                setState[pName] = Math.max(0, Math.min(100, 50 + delta));
              }
              choice.set_state = setState;
              delete choice.effects;
            }

            if (choice.set_state) {
              for (const pName of paramNames) {
                if (typeof choice.set_state[pName] !== "number") {
                  choice.set_state[pName] = 50;
                }
                choice.set_state[pName] = Math.max(0, Math.min(100, choice.set_state[pName]));
              }
            } else {
              choice.set_state = {};
              for (const pName of paramNames) {
                choice.set_state[pName] = 50;
              }
            }
          }
        }
      }
    }

    // Repair policy_optimization lab_data
    if (mod.lab_type === "policy_optimization" && mod.lab_data) {
      const ld = mod.lab_data;
      if (!ld.constraints || !Array.isArray(ld.constraints)) {
        ld.constraints = [];
      }
      if (!ld.max_decisions) {
        ld.max_decisions = (ld.decisions?.length) || 3;
      }
      if (ld.parameters) {
        for (const p of ld.parameters) {
          p.min = 0;
          p.max = 100;
          if (typeof p.default !== "number" || p.default < 0 || p.default > 100) p.default = 50;
        }
      }
    }

    // Repair ethical_dilemma lab_data
    if (mod.lab_type === "ethical_dilemma" && mod.lab_data) {
      const ld = mod.lab_data;
      if (!ld.dimensions || !Array.isArray(ld.dimensions)) {
        ld.dimensions = [];
      }
      for (const dim of ld.dimensions) {
        if (!dim.icon) dim.icon = "⚖️";
        if (!dim.description) dim.description = "";
      }
    }
  }

  return parsed;
}

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
            content: `You are an expert course architect building interactive simulation-based courses. Return structured JSON only via the function tool.

CRITICAL MODULE STRUCTURE — every module MUST have ALL of these fields:
- title: string
- lesson_content: string (markdown with "---" slide separators between sections, use ## headings)
- youtube_query: string (search query to find a relevant video)
- youtube_title: string
- lab_type: one of "simulation", "classification", "policy_optimization", "ethical_dilemma"
- lab_data: object (format depends on lab_type, see below)
- quiz: array of {question, options: string[4], correct: number 0-3, explanation}

=== INTELLIGENT LAB ASSIGNMENT ===
Choose lab_type based on the topic's cognitive nature:
- "simulation" → for systemic/process topics (cause-and-effect systems like economics, physics, biology)
- "classification" → for analytical/sorting topics (categorization, identification, prioritization)
- "policy_optimization" → for strategic/constraint topics (reaching targets within limits)
- "ethical_dilemma" → for ethical/moral topics (tradeoff decisions with no perfect answer)

Mix lab types across modules. Do NOT use the same lab_type for every module.

=== SIMULATION LAB (lab_type: "simulation") ===
lab_data format:
{
  "parameters": [
    {"name": "<TOPIC-SPECIFIC FACTOR>", "icon": "📊", "unit": "%", "min": 0, "max": 100, "default": 50}
  ],
  "thresholds": [
    {"label": "Excellent", "min_percent": 75, "message": "..."},
    {"label": "Good", "min_percent": 50, "message": "..."},
    {"label": "Needs Work", "min_percent": 0, "message": "..."}
  ],
  "decisions": [
    {
      "question": "Scenario question?",
      "emoji": "🔬",
      "choices": [
        {"text": "Choice A", "explanation": "Why this matters", "set_state": {"Factor1": 80, "Factor2": 40, "Factor3": 55}},
        {"text": "Choice B", "explanation": "Why this matters", "set_state": {"Factor1": 45, "Factor2": 85, "Factor3": 65}}
      ]
    }
  ]
}
RULES: 3 parameters, 2-3 decisions with 2 choices each. Parameter names MUST be domain-specific (e.g. "GDP Growth", "Inflation Rate" for Economics). NEVER use generic names like "Understanding" or "Confidence". Every choice MUST have "set_state" mapping ALL parameter names to integers 0-100.

=== CLASSIFICATION LAB (lab_type: "classification") ===
lab_data format:
{
  "title": "...", "description": "...",
  "categories": [{"name": "Cat A", "description": "...", "color": "#hex"}],
  "items": [{"content": "...", "correctCategory": "Cat A", "explanation": "..."}]
}
RULES: 3-4 categories, 6-8 items minimum.

=== POLICY OPTIMIZATION LAB (lab_type: "policy_optimization") ===
lab_data format:
{
  "title": "...", "description": "...",
  "parameters": [
    {"name": "<TOPIC VARIABLE>", "icon": "📊", "unit": "%", "min": 0, "max": 100, "default": 50}
  ],
  "constraints": [
    {"parameter": "<PARAM NAME>", "operator": ">", "value": 70, "label": "Keep <param> above 70%"}
  ],
  "max_decisions": 3,
  "decisions": [
    {
      "question": "Policy scenario?", "emoji": "🎯",
      "choices": [
        {"text": "Option A", "explanation": "...", "set_state": {"Param1": 80, "Param2": 40, "Param3": 60}},
        {"text": "Option B", "explanation": "...", "set_state": {"Param1": 55, "Param2": 75, "Param3": 50}}
      ]
    }
  ]
}
RULES: 3 parameters, 2-3 constraints, max_decisions limits how many choices the student can make. Student must reach ALL constraint targets within the decision limit.

=== ETHICAL DILEMMA LAB (lab_type: "ethical_dilemma") ===
lab_data format:
{
  "title": "...", "description": "...",
  "dimensions": [
    {"name": "Profit", "icon": "💰", "description": "Financial performance"},
    {"name": "Ethics", "icon": "⚖️", "description": "Moral responsibility"},
    {"name": "Society", "icon": "🏘️", "description": "Social impact"}
  ],
  "decisions": [
    {
      "question": "Dilemma scenario?", "emoji": "⚖️",
      "choices": [
        {"text": "Option A", "explanation": "...", "impacts": {"Profit": 15, "Ethics": -20, "Society": 5}},
        {"text": "Option B", "explanation": "...", "impacts": {"Profit": -10, "Ethics": 20, "Society": -5}}
      ]
    }
  ]
}
RULES: 3-4 dimensions, 3-4 dilemmas. Every choice MUST improve at least one dimension AND harm at least one other. Use "impacts" (deltas, -50 to +50), NOT "set_state". Student is scored on BALANCE across dimensions.

Generate 4-6 modules with a good mix of lab types.`,
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
                  title: { type: "string", description: "Course title" },
                  description: { type: "string", description: "Course description" },
                  modules: {
                    type: "array",
                    description: "Array of course modules",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        lesson_content: { type: "string", description: "Markdown lesson with --- slide separators" },
                        youtube_query: { type: "string" },
                        youtube_title: { type: "string" },
                        lab_type: { type: "string", enum: ["simulation", "classification", "policy_optimization", "ethical_dilemma"] },
                        lab_data: { type: "object", description: "Lab configuration object" },
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

    if (!aiData.choices?.length) {
      throw new Error("Empty AI response");
    }

    const message = aiData.choices[0].message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No function call returned by AI");
    }

    // Parse and repair
    const parsed = JSON.parse(toolCall.function.arguments);
    const repaired = repairModules(parsed);

    // Validate
    const courseData = CourseSchema.parse(repaired);

    // Update course
    await supabase
      .from("courses")
      .update({
        title: courseData.title,
        description: courseData.description,
        status: "ready",
      })
      .eq("id", course.id);

    const modules = courseData.modules.map((mod: any, index: number) => {
      let lessonContent = mod.lesson_content || "";

      if (!lessonContent.includes("\n---\n")) {
        const sections = lessonContent.split(/(?=^## )/m).filter(Boolean);
        if (sections.length > 1) {
          lessonContent = sections.join("\n\n---\n\n");
        }
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

    if (error instanceof z.ZodError) {
      console.error("ZOD VALIDATION DETAILS:", JSON.stringify(error.issues, null, 2));
      return new Response(
        JSON.stringify({ error: "Course generation produced invalid data. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
