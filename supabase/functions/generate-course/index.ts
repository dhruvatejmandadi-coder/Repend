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
- CRITICAL: Every choice MUST have "set_state" (NOT "effects")
- set_state maps ALL slider names to exact integer values 0-100
- Example: {"set_state": {"Understanding": 85, "Application": 60, "Confidence": 70}}
- NEVER use delta values, NEVER use "effects", NEVER leave set_state empty
- Each choice must set ALL sliders, modifying at least 2
- Example decisions array:
  [{"question":"What approach?","emoji":"⚡","choices":[{"text":"Option A","explanation":"Why A.","set_state":{"Understanding":85,"Application":60,"Confidence":70}},{"text":"Option B","explanation":"Why B.","set_state":{"Understanding":45,"Application":85,"Confidence":65}}]}]

LESSON FORMAT (CRITICAL — YOU MUST FOLLOW THIS EXACTLY):
- Each module MUST have 4–6 slides
- Separate EVERY slide with a line containing ONLY "---"
- Each slide starts with: ## 🎯 Title
- Use emojis in headings
- 2–3 short paragraphs per slide
- Example lesson_content value:
  "## 🎯 Slide 1 Title\\n\\nParagraph one.\\n\\nParagraph two.\\n\\n---\\n\\n## 🎯 Slide 2 Title\\n\\nParagraph one.\\n\\nParagraph two.\\n\\n---\\n\\n## 🎯 Slide 3 Title\\n\\nParagraph one.\\n\\nParagraph two."
- The "---" separator MUST appear between every slide. Without it, the lesson will display as a single wall of text.

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
        tool_choice: "auto",
      }),
    });

    const aiData = await response.json();
    
    if (!aiData.choices?.length) {
      console.error("AI response:", JSON.stringify(aiData));
      throw new Error("Empty AI response");
    }

    const message = aiData.choices[0].message;
    const toolCall = message?.tool_calls?.[0];
    
    let courseData: any;
    if (toolCall) {
      courseData = JSON.parse(toolCall.function.arguments);
    } else if (message?.content) {
      // Fallback: try to parse JSON from content
      const jsonMatch = message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        courseData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse course data from AI response");
      }
    } else {
      console.error("Full AI response:", JSON.stringify(aiData));
      throw new Error("No tool call or content returned");
    }

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

      // 🔥 GENERATE FALLBACK LAB DATA WHEN AI RETURNS EMPTY {}
      const isEmptyObj = !labData || (typeof labData === "object" && Object.keys(labData).length === 0);

      if (isEmptyObj && labType === "simulation") {
        labData = {
          parameters: [
            { name: "Understanding", icon: "🧠", unit: "%", min: 0, max: 100, default: 50 },
            { name: "Application", icon: "🔧", unit: "%", min: 0, max: 100, default: 40 },
            { name: "Confidence", icon: "💪", unit: "%", min: 0, max: 100, default: 30 },
          ],
          thresholds: [
            { label: "Expert", min_percent: 80, message: "Outstanding mastery of this topic!" },
            { label: "Proficient", min_percent: 50, message: "Good understanding, keep practicing." },
            { label: "Developing", min_percent: 0, message: "Review the lesson and try again." },
          ],
          decisions: [
            {
              question: `How would you approach learning ${mod.title}?`,
              emoji: "📚",
              choices: [
                { text: "Deep dive into theory first", explanation: "Strong foundation approach.", set_state: { Understanding: 80, Application: 40, Confidence: 55 } },
                { text: "Jump into practice problems", explanation: "Hands-on learning approach.", set_state: { Understanding: 45, Application: 85, Confidence: 65 } },
              ],
            },
            {
              question: `A student asks you to explain ${mod.title}. What do you do?`,
              emoji: "🎓",
              choices: [
                { text: "Use real-world analogies", explanation: "Makes concepts relatable.", set_state: { Understanding: 70, Application: 80, Confidence: 60 } },
                { text: "Walk through step-by-step examples", explanation: "Methodical teaching.", set_state: { Understanding: 85, Application: 55, Confidence: 75 } },
              ],
            },
          ],
        };
      }

      if (isEmptyObj && labType === "classification") {
        labData = {
          title: `Classify: ${mod.title}`,
          description: `Sort the following items into the correct categories for ${mod.title}.`,
          categories: [
            { name: "Key Concept", emoji: "🔑", description: "Core ideas and principles" },
            { name: "Application", emoji: "🔧", description: "Real-world uses and examples" },
            { name: "Common Mistake", emoji: "⚠️", description: "Frequent errors and misconceptions" },
          ],
          items: [
            { name: "Core formula or law", correct_category: "Key Concept", hint: "Think about the fundamental equation" },
            { name: "Real-world example", correct_category: "Application", hint: "Where do you see this in daily life?" },
            { name: "Unit conversion error", correct_category: "Common Mistake", hint: "A frequent source of wrong answers" },
            { name: "Defining relationship", correct_category: "Key Concept", hint: "How variables relate to each other" },
            { name: "Industry usage", correct_category: "Application", hint: "Professional or industrial context" },
            { name: "Forgetting constraints", correct_category: "Common Mistake", hint: "What conditions must hold?" },
          ],
        };
      }

      // 🔥 FORCE DECISIONS + FIX EMPTY EFFECTS (for non-empty simulation data)
      if (labType === "simulation" && labData?.parameters?.length > 0) {
        const params = labData.parameters;
        const paramNames = params.map((p: any) => p.name);

        // Generate decisions if missing entirely
        if (!Array.isArray(labData.decisions) || labData.decisions.length === 0) {
          const defaultState: Record<string, number> = {};
          for (const p of params) defaultState[p.name] = 50;
          labData.decisions = [
            {
              question: `How would you adjust ${paramNames[0]}?`,
              emoji: "⚡",
              choices: [
                {
                  text: "Increase it",
                  explanation: "Increasing strengthens this factor.",
                  set_state: { ...defaultState, [paramNames[0]]: 80 },
                },
                {
                  text: "Decrease it",
                  explanation: "Reducing may balance tradeoffs.",
                  set_state: { ...defaultState, [paramNames[0]]: 20 },
                },
              ],
            },
          ];
        } else {
          // Convert effects to set_state and ensure all sliders present
          labData.decisions = labData.decisions.map((d: any) => ({
            ...d,
            choices: (d.choices || []).map((c: any, cIdx: number) => {
              let setState = c.set_state;

              // Convert legacy effects to set_state
              if (!setState || Object.keys(setState).length === 0) {
                if (c.effects && Object.keys(c.effects).length > 0) {
                  console.warn(`[auto-repair] Converting effects to set_state in "${mod.title}"`);
                  setState = {};
                  for (const p of params) {
                    const delta = c.effects[p.name] ?? 0;
                    setState[p.name] = Math.max(0, Math.min(100, (p.default || 50) + delta));
                  }
                } else {
                  // No data at all, generate defaults
                  setState = {};
                  for (const p of params) {
                    setState[p.name] = cIdx % 2 === 0 ? 65 : 35;
                  }
                }
              }

              // Ensure ALL parameter names exist in set_state
              for (const p of params) {
                if (setState[p.name] === undefined) setState[p.name] = 50;
              }

              return { ...c, set_state: setState };
            }),
          }));
        }
      }

      // 🔥 POST-PROCESS: Force slide separators in lesson_content
      let lessonContent = mod.lesson_content || "";
      if (!lessonContent.includes("\n---\n")) {
        const sections = lessonContent.split(/(?=^## )/m).filter(Boolean);
        if (sections.length > 1) {
          lessonContent = sections.join("\n\n---\n\n");
          console.log(`[auto-repair] Added slide separators for module: ${mod.title} (${sections.length} slides)`);
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
