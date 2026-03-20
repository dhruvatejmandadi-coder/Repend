import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAI(apiKey: string, body: any, retries = 2): Promise<any> {
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 3000;
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 429) { lastError = "Rate limit exceeded."; continue; }
      if (response.status === 402) throw new Error("AI credits exhausted.");
      const text = await response.text();
      if (!response.ok) { lastError = `AI error (${response.status}).`; continue; }
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { lastError = "Invalid AI response."; continue; }
      if (!parsed.choices?.length) { lastError = "Empty AI response."; continue; }
      return parsed;
    } catch (e: any) {
      if (e.message?.includes("credits")) throw e;
      lastError = e.message || "Network error.";
    }
  }
  throw new Error(lastError || "AI call failed after retries.");
}

function extractToolArgs(aiData: any): any {
  const message = aiData.choices[0].message;
  const toolCall = message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error(`AI did not return structured data (reason: ${aiData.choices[0]?.finish_reason || "unknown"}).`);
  }
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    let raw = toolCall.function.arguments || "";
    raw = raw.replace(/,\s*$/, "");
    for (const closer of ["]}]}", "]}}", "]}", "}", "]"]) {
      try { return JSON.parse(raw + closer); } catch { /* next */ }
    }
    throw new Error("AI response was truncated.");
  }
}

const blueprintToolSchema = {
  type: "function" as const,
  function: {
    name: "create_lab_blueprint",
    description: "Create an interactive lab blueprint with UI blocks, variables, and scenario",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        kind: { type: "string" },
        scenario: { type: "string" },
        learning_goal: { type: "string" },
        variables: {
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
              description: { type: "string" },
            },
            required: ["name", "icon", "unit", "min", "max", "default"],
          },
        },
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["text", "choice_set", "slider", "table", "step_task", "chart", "insight"] },
              content: { type: "string" },
              question: { type: "string" },
              emoji: { type: "string" },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    feedback: { type: "string" },
                    effects: { type: "object" },
                    is_best: { type: "boolean" },
                  },
                  required: ["text", "feedback", "effects"],
                },
              },
              variable: { type: "string" },
              prompt: { type: "string" },
              interactive: { type: "boolean" },
              title: { type: "string" },
              headers: { type: "array", items: { type: "string" } },
              rows: { type: "array", items: { type: "array", items: { type: "string" } } },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    prompt: { type: "string" },
                    type: { type: "string", enum: ["input", "choice"] },
                    correct_answer: { type: "string" },
                    hint: { type: "string" },
                    explanation: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                  },
                  required: ["id", "prompt", "type", "correct_answer"],
                },
              },
              chart_type: { type: "string", enum: ["line", "bar", "area"] },
              x_label: { type: "string" },
              y_label: { type: "string" },
              datasets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    data: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } } },
                  },
                },
              },
            },
            required: ["type"],
          },
        },
        completion_rule: { type: "string", enum: ["all_blocks", "all_choices", "all_tasks"] },
        intro: {
          type: "object",
          properties: {
            relevance: { type: "string" },
            role: { type: "string" },
            scenario_context: { type: "string" },
            information: { type: "array", items: { type: "string" } },
            objective: { type: "string" },
          },
        },
      },
      required: ["title", "kind", "scenario", "variables", "blocks", "completion_rule"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { moduleId } = await req.json();
    if (!moduleId) throw new Error("moduleId is required");

    // Fetch module
    const { data: mod, error: modError } = await supabase
      .from("course_modules")
      .select("id, title, lab_description, lab_generation_status, course_id")
      .eq("id", moduleId)
      .single();

    if (modError || !mod) throw new Error("Module not found");

    // Verify user owns the course
    const { data: course } = await supabase
      .from("courses")
      .select("id, topic, user_id")
      .eq("id", mod.course_id)
      .single();

    if (!course) throw new Error("Course not found");

    // Skip if already done
    if (mod.lab_generation_status === "done") {
      return new Response(JSON.stringify({ status: "already_done" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as generating
    await supabase.from("course_modules").update({ lab_generation_status: "generating" }).eq("id", moduleId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const topic = course.topic;
    const moduleTitle = mod.title;
    const labConcept = mod.lab_description || mod.title;

    const systemPrompt = `You are a lab designer for Repend, a decision-based interactive learning platform.

Your job: Design a UNIQUE interactive lab blueprint for a specific concept. You are NOT constrained to any template.
You design the lab from scratch based on what interaction best teaches this concept.

=== RULES ===
1. Variables must be DOMAIN-SPECIFIC to ${topic}. Never use generic names like "Efficiency", "Quality", "Cost".
2. Design at least 3 choice_set blocks with real tradeoffs — no choice should improve everything.
3. Every choice effect must set ALL variables to specific values.
4. Include at least one step_task with 2-3 tasks.
5. The lab should feel like a real professional scenario, not a textbook exercise.
6. Mix block types — don't just use choice_sets. Use tables, charts, text, and step_tasks.
7. The "kind" field should be unique and descriptive.
8. Be creative! Each lab should feel different.`;

    const userPrompt = `Design a lab blueprint for: "${moduleTitle}"\n\nTopic: ${topic}\nLab concept: ${labConcept}\n\nYou MUST return at least 3 blocks mixing different types. Every choice_set must set ALL variables.`;

    let aiData = await callAI(LOVABLE_API_KEY, {
      model: "google/gemini-2.5-pro",
      temperature: 0.7,
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [blueprintToolSchema],
      tool_choice: { type: "function", function: { name: "create_lab_blueprint" } },
    });

    let result = extractToolArgs(aiData);
    let blueprint = result.blueprint || result;

    if (!blueprint || typeof blueprint !== "object") {
      await supabase.from("course_modules").update({ lab_generation_status: "failed", lab_error: "AI returned empty blueprint" }).eq("id", moduleId);
      return new Response(JSON.stringify({ status: "failed", error: "Empty blueprint" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Repair blocks
    if (!Array.isArray(blueprint.blocks)) {
      blueprint.blocks = [];
      if (Array.isArray(blueprint.decisions)) {
        for (const d of blueprint.decisions) {
          blueprint.blocks.push({
            type: "choice_set",
            question: d.question || d.prompt || "What do you decide?",
            emoji: d.emoji || "🔬",
            choices: Array.isArray(d.choices) ? d.choices.map((c: any) => ({
              text: c.text || c.label || "Choice",
              feedback: c.explanation || c.feedback || c.consequence || "",
              effects: c.set_state || c.effects || {},
              is_best: c.is_best || false,
            })) : [],
          });
        }
      }
      if (Array.isArray(blueprint.tasks)) {
        blueprint.blocks.push({
          type: "step_task",
          tasks: blueprint.tasks.map((t: any, i: number) => ({
            id: t.id || `t${i + 1}`,
            prompt: t.description || t.prompt || t.question || "Task",
            type: t.type || "input",
            correct_answer: t.correct_answer || t.answer || "",
            ...(t.options ? { options: t.options } : {}),
            ...(t.hint ? { hint: t.hint } : {}),
          })),
        });
      }
    }

    // Retry if empty
    if (!blueprint.blocks || blueprint.blocks.length === 0) {
      console.warn(`Attempt 1 returned 0 blocks for "${moduleTitle}". Retrying...`);
      const retryPrompt = `You MUST generate a lab blueprint with AT LEAST 3 blocks for: "${moduleTitle}" (${topic}).
Return: 1 text block, 2 choice_set blocks with 3 choices each, 1 step_task block, 1 insight block.
Variables must be domain-specific. Create at least 3 variables.`;

      aiData = await callAI(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-pro",
        temperature: 0.5,
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: retryPrompt },
        ],
        tools: [blueprintToolSchema],
        tool_choice: { type: "function", function: { name: "create_lab_blueprint" } },
      });

      result = extractToolArgs(aiData);
      blueprint = result.blueprint || result;
      if (!blueprint || typeof blueprint !== "object" || !Array.isArray(blueprint.blocks)) {
        blueprint = { blocks: [] };
      }
    }

    if (blueprint.blocks.length === 0) {
      await supabase.from("course_modules").update({
        lab_generation_status: "failed",
        lab_error: "Blueprint generation produced no blocks after 2 attempts",
      }).eq("id", moduleId);
      return new Response(JSON.stringify({ status: "failed", error: "No blocks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Repair variables
    if (!Array.isArray(blueprint.variables)) {
      blueprint.variables = [];
      if (Array.isArray(blueprint.parameters)) {
        blueprint.variables = blueprint.parameters.map((p: any) => ({
          name: String(p.name || "Variable"),
          icon: String(p.icon || "📊"),
          unit: String(p.unit || "%"),
          min: typeof p.min === "number" ? p.min : 0,
          max: typeof p.max === "number" ? p.max : 100,
          default: typeof p.default === "number" ? p.default : 50,
          description: p.description || "",
        }));
      }
    }

    // Clamp variable defaults
    for (const v of blueprint.variables) {
      v.min = typeof v.min === "number" ? v.min : 0;
      v.max = typeof v.max === "number" ? v.max : 100;
      v.default = Math.max(v.min, Math.min(v.max, typeof v.default === "number" ? v.default : 50));
    }

    // Ensure choice effects reference all variables
    const varNames = blueprint.variables.map((v: any) => v.name);
    for (const block of blueprint.blocks) {
      if (block.type === "choice_set" && Array.isArray(block.choices)) {
        for (const choice of block.choices) {
          if (!choice.effects || typeof choice.effects !== "object") choice.effects = {};
          for (const vn of varNames) {
            if (typeof choice.effects[vn] !== "number") choice.effects[vn] = 50;
            else choice.effects[vn] = Math.max(0, Math.min(100, choice.effects[vn]));
          }
        }
      }
    }

    // Add insight if missing
    const hasInsight = blueprint.blocks.some((b: any) => b.type === "insight");
    if (!hasInsight && blueprint.key_insight) {
      blueprint.blocks.push({ type: "insight", content: blueprint.key_insight });
    }

    blueprint.title = blueprint.title || moduleTitle;
    blueprint.kind = blueprint.kind || "dynamic_lab";
    blueprint.completion_rule = blueprint.completion_rule || "all_choices";

    // Save
    await supabase.from("course_modules").update({
      lab_data: blueprint,
      lab_blueprint: blueprint,
      lab_type: "dynamic",
      lab_generation_status: "done",
      lab_error: null,
    }).eq("id", moduleId);

    console.log(`Lab generated for "${moduleTitle}" → kind: ${blueprint.kind}, blocks: ${blueprint.blocks.length}, vars: ${blueprint.variables.length}`);

    return new Response(JSON.stringify({ status: "done", blueprint }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LAB GENERATION ERROR:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
