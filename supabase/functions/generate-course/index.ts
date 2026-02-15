import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { topic } = await req.json();
    if (!topic?.trim()) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Create course record
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({ user_id: user.id, title: topic.trim(), topic: topic.trim(), status: "generating" })
      .select()
      .single();

    if (courseError) throw courseError;

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
            content: `You are an educational lab generator and course creator. Generate a structured course with 4-6 progressive modules on the given topic.

CRITICAL INSTRUCTION — TOPIC LOCKING:
- Before generating lab_data for each module, internally restate the module title and the course topic. Ensure every parameter, scenario, or classification item directly tests knowledge of that EXACT topic. Do NOT output the restatement.
- All lab parameters, scenarios, and classification items MUST reference real concepts from the module's lesson_content. Do NOT introduce unrelated subtopics. If unsure, stay narrower — never broader.
- All lab_data MUST be based only on the module's lesson_content. If information is not present in the lesson, do not invent it.

CRITICAL RULES FOR lab_data:
- Every module MUST have a fully populated lab_data object. NEVER return an empty {} object.
- lab_data MUST contain all required fields for its lab_type.
- Labs must be SPECIFIC to the module topic with domain-specific variables, NOT generic "understanding/practice/critical thinking" sliders.

For "simulation" labs: Create parameters that represent REAL measurable variables from the module's specific lesson content.
  Example for "Stoichiometry": parameters like "Moles of Reactant A" (mol), "Moles of Reactant B" (mol), "Temperature" (°C)
  Example for "Supply & Demand": parameters like "Price" ($), "Consumer Income" ($K), "Number of Competitors"
  
For "decision" labs: Create realistic scenarios with meaningful trade-offs drawn directly from concepts in the module's lesson content.

For "classification" labs: Use real items and categories from the module's lesson content (e.g., types of reactions, parts of speech, literary devices).

CRITICAL: LAB TYPE VARIETY
- A course with 4-6 modules MUST use a MIX of lab types. Use at least 2 different lab_type values across the course.
- Suggested distribution: 2 simulation labs, 2 decision labs, 1-2 classification labs.
- Decision labs work great for modules about processes, trade-offs, real-world applications, ethics, or strategy.
- Classification labs work great for modules about categorization, terminology, identifying types, or sorting concepts.
- Simulation labs work great for modules about measurable variables, cause-and-effect, or quantitative relationships.
- Pick the lab_type that best fits each module's content — do NOT default everything to simulation.

Make each lab genuinely educational — a student should learn by interacting with it.`
          },
          { role: "user", content: `Create a comprehensive course on: ${topic}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_course",
              description: "Create a structured learning course with interactive labs",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Course title" },
                  description: { type: "string", description: "2-3 sentence course description" },
                  modules: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        lesson_content: { type: "string", description: "Detailed lesson in markdown, 3-5 paragraphs with examples" },
                        youtube_query: { type: "string" },
                        youtube_title: { type: "string" },
                        lab_type: { type: "string", enum: ["simulation", "decision", "classification"] },
                        lab_data: {
                          type: "object",
                          description: "MUST be fully populated. For simulation: title, description, equation_label, output_label, parameters (array of {name,icon,unit,min,max,default,description}), thresholds (array of {label,min_percent,message}). For decision: title, description, scenarios (array of {title,description,emoji,choices:[{text,consequence,impact}]}), summary_prompt. For classification: title, description, categories (array of {name,emoji,description}), items (array of {name,correct_category,hint}).",
                          properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            equation_label: { type: "string" },
                            output_label: { type: "string" },
                            parameters: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  name: { type: "string" },
                                  icon: { type: "string" },
                                  unit: { type: "string" },
                                  min: { type: "number" },
                                  max: { type: "number" },
                                  default: { type: "number" },
                                  description: { type: "string" }
                                },
                                required: ["name", "icon", "unit", "min", "max", "default", "description"]
                              }
                            },
                            thresholds: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  label: { type: "string" },
                                  min_percent: { type: "number" },
                                  message: { type: "string" }
                                },
                                required: ["label", "min_percent", "message"]
                              }
                            },
                            scenarios: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  title: { type: "string" },
                                  description: { type: "string" },
                                  emoji: { type: "string" },
                                  choices: {
                                    type: "array",
                                    items: {
                                      type: "object",
                                      properties: {
                                        text: { type: "string" },
                                        consequence: { type: "string" },
                                        impact: { type: "string", enum: ["positive", "negative", "neutral"] }
                                      },
                                      required: ["text", "consequence", "impact"]
                                    }
                                  }
                                },
                                required: ["title", "description", "emoji", "choices"]
                              }
                            },
                            summary_prompt: { type: "string" },
                            categories: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  name: { type: "string" },
                                  emoji: { type: "string" },
                                  description: { type: "string" }
                                },
                                required: ["name", "emoji", "description"]
                              }
                            },
                            items: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  name: { type: "string" },
                                  correct_category: { type: "string" },
                                  hint: { type: "string" }
                                },
                                required: ["name", "correct_category"]
                              }
                            }
                          },
                          required: ["title", "description"]
                        },
                        quiz: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              question: { type: "string" },
                              options: { type: "array", items: { type: "string" } },
                              correct: { type: "number" }
                            },
                            required: ["question", "options", "correct"]
                          }
                        }
                      },
                      required: ["title", "lesson_content", "youtube_query", "youtube_title", "lab_type", "lab_data", "quiz"]
                    }
                  }
                },
                required: ["title", "description", "modules"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_course" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      await supabase.from("courses").update({ status: "failed" }).eq("id", course.id);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI service temporarily unavailable");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      await supabase.from("courses").update({ status: "failed" }).eq("id", course.id);
      throw new Error("Failed to generate course structure");
    }

    const courseData = JSON.parse(toolCall.function.arguments);

    // Update course with generated title and description
    await supabase.from("courses").update({
      title: courseData.title,
      description: courseData.description,
      status: "ready"
    }).eq("id", course.id);

    // Validate and fix lab data before inserting
    const modules = courseData.modules.map((mod: any, index: number) => {
      let labData = mod.lab_data;
      let labType = mod.lab_type;

      // Validate lab_data has actual content
      const isValid = labData && typeof labData === "object" && (
        (labType === "simulation" && Array.isArray(labData.parameters) && labData.parameters.length > 0) ||
        (labType === "decision" && Array.isArray(labData.scenarios) && labData.scenarios.length > 0) ||
        (labType === "classification" && Array.isArray(labData.items) && labData.items.length > 0)
      );

      if (!isValid) {
        console.warn(`[generate-course] Empty/invalid lab_data for module "${mod.title}", generating server fallback.`);

        // Extract key noun phrases from lesson content for topic-relevant fallback
        const lessonSnippet = (mod.lesson_content || "").slice(0, 300);
        const words = lessonSnippet
          .replace(/[^a-zA-Z\s]/g, " ")
          .split(/\s+/)
          .filter((w: string) => w.length > 5);
        const seen = new Set<string>();
        const keyTerms: string[] = [];
        const stopWords = ["which", "their", "these", "about", "through", "between", "understanding", "important", "different", "example", "process", "called", "during"];
        for (const w of words) {
          const lower = w.toLowerCase();
          if (!seen.has(lower) && !stopWords.includes(lower)) {
            seen.add(lower);
            keyTerms.push(w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
            if (keyTerms.length >= 6) break;
          }
        }
        if (keyTerms.length < 3) {
          const titleWords = mod.title.split(/\s+/).filter((w: string) => w.length > 3);
          for (const w of titleWords) {
            if (keyTerms.length >= 3) break;
            const cap = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            if (!seen.has(cap.toLowerCase())) { keyTerms.push(cap); seen.add(cap.toLowerCase()); }
          }
        }
        while (keyTerms.length < 6) keyTerms.push(`Concept ${keyTerms.length + 1}`);

        const fallbackType = index % 3;

        if (fallbackType === 1) {
          // Decision lab fallback
          labType = "decision";
          labData = {
            title: `${mod.title} Decisions`,
            description: `Make critical decisions related to ${mod.title.toLowerCase()}.`,
            scenarios: [
              {
                title: `${keyTerms[0]} Strategy`,
                description: `You need to decide how to approach ${keyTerms[0].toLowerCase()} in the context of ${mod.title.toLowerCase()}.`,
                emoji: "🤔",
                choices: [
                  { text: `Prioritize ${keyTerms[0].toLowerCase()}`, consequence: `Strong focus on ${keyTerms[0].toLowerCase()} yields deep understanding but may neglect other factors.`, impact: "positive" },
                  { text: `Balance ${keyTerms[0].toLowerCase()} with ${keyTerms[1].toLowerCase()}`, consequence: `A balanced approach covers more ground but with less depth.`, impact: "neutral" },
                  { text: `Ignore ${keyTerms[0].toLowerCase()}`, consequence: `Skipping this fundamental concept creates knowledge gaps.`, impact: "negative" },
                ],
              },
              {
                title: `${keyTerms[1]} Trade-off`,
                description: `Consider the trade-offs when applying ${keyTerms[1].toLowerCase()} to ${mod.title.toLowerCase()}.`,
                emoji: "⚖️",
                choices: [
                  { text: `Apply ${keyTerms[1].toLowerCase()} carefully`, consequence: `Careful application leads to better outcomes.`, impact: "positive" },
                  { text: `Partial application of ${keyTerms[1].toLowerCase()}`, consequence: `Some benefit, but results are inconsistent.`, impact: "neutral" },
                  { text: `Skip ${keyTerms[1].toLowerCase()} entirely`, consequence: `Missing this step leads to poor results.`, impact: "negative" },
                ],
              },
            ],
            summary_prompt: `Reflect on how your decisions about ${keyTerms[0].toLowerCase()} and ${keyTerms[1].toLowerCase()} impact ${mod.title.toLowerCase()}.`,
          };
        } else if (fallbackType === 2) {
          // Classification lab fallback
          labType = "classification";
          const catTerms = keyTerms.slice(0, 3);
          const itemTerms = keyTerms.slice(0, 6);
          labData = {
            title: `${mod.title} Classifier`,
            description: `Sort concepts related to ${mod.title.toLowerCase()} into the correct categories.`,
            categories: catTerms.map((t: string, i: number) => ({
              name: t,
              emoji: ["📁", "📂", "🗂️"][i],
              description: `Items related to ${t.toLowerCase()} in ${mod.title.toLowerCase()}.`,
            })),
            items: itemTerms.map((t: string, i: number) => ({
              name: `${t} concept`,
              correct_category: catTerms[i % catTerms.length],
              hint: `Think about how this relates to ${catTerms[i % catTerms.length].toLowerCase()}.`,
            })),
          };
        } else {
          // Simulation lab fallback (existing logic)
          labType = "simulation";
          const simTerms = keyTerms.slice(0, 3);
          const icons = ["🔬", "📊", "⚙️"];
          labData = {
            title: `${mod.title} Lab`,
            description: `Explore the key factors of ${mod.title.toLowerCase()} in this interactive simulation.`,
            equation_label: `${mod.title} Model`,
            equation_template: `${simTerms[0]} + ${simTerms[1]} + ${simTerms[2]} → Output`,
            output_label: `${mod.title} Score`,
            parameters: simTerms.map((term: string, i: number) => ({
              name: term, icon: icons[i] || "📐", unit: "%", min: 0, max: 100, default: 50,
              description: `Level of ${term.toLowerCase()} as it relates to ${mod.title.toLowerCase()}`
            })),
            thresholds: [
              { label: "🌟 Expert Level", min_percent: 80, message: `Strong command of ${mod.title.toLowerCase()}.` },
              { label: "📈 Progressing", min_percent: 50, message: "Solid foundation — focus on weaker areas." },
              { label: "🔰 Beginner", min_percent: 0, message: "Keep exploring — increase each factor to build mastery." },
            ],
          };
        }
      }

      return {
        course_id: course.id,
        module_order: index + 1,
        title: mod.title,
        lesson_content: mod.lesson_content,
        youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.youtube_query)}`,
        youtube_title: mod.youtube_title,
        lab_title: labData?.title || mod.title + " Lab",
        lab_description: null,
        lab_type: labType,
        lab_data: labData,
        quiz: mod.quiz,
      };
    });

    const { error: modulesError } = await supabase.from("course_modules").insert(modules);
    if (modulesError) {
      console.error("Modules insert error:", modulesError);
      await supabase.from("courses").update({ status: "failed" }).eq("id", course.id);
      throw modulesError;
    }

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate course error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
