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
      if (!response.ok) { console.error(`[AI Error ${response.status}] Body:`, text.slice(0, 500)); lastError = `AI error (${response.status}): ${text.slice(0, 200)}`; continue; }
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
  const finishReason = aiData.choices?.[0]?.finish_reason;
  if (finishReason === "error") throw new Error("MODEL_ERROR");
  const message = aiData.choices[0].message;
  const toolCall = message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error(`AI did not return structured data (reason: ${finishReason || "unknown"}).`);
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
    description: "Create an interactive SIMULATION lab — a system the user controls with sliders and decisions, seeing live outputs update in real time.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        kind: { type: "string", description: "Unique descriptive kind like 'ecosystem_balance', 'reaction_optimizer'" },
        scenario: { type: "string", description: "2-3 sentence real-world scenario placing the student in a role" },
        learning_goal: { type: "string" },
        key_insight: { type: "string", description: "The main takeaway from this lab" },
        goal: {
          type: "object",
          description: "The objective the student is trying to achieve. Include a measurable condition.",
          properties: {
            description: { type: "string", description: "Human-readable goal like 'Maximize efficiency above 80% while keeping costs below $5000'" },
            condition: { type: "string", description: "mathjs expression that evaluates to true when goal is met, e.g. 'efficiency > 80 and costs < 5000'" },
          },
          required: ["description"],
        },
        variables: {
          type: "array",
          description: "3-6 domain-specific system variables. Each MUST have a clear description explaining what it controls in plain language (e.g. 'Controls how much budget is allocated to advertising — higher values increase reach but cost more').",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              icon: { type: "string" },
              unit: { type: "string" },
              min: { type: "number" },
              max: { type: "number" },
              default: { type: "number" },
              description: { type: "string", description: "REQUIRED. A clear 1-sentence explanation of what this variable controls and how it affects the system. Written for students, not engineers." },
            },
            required: ["name", "icon", "unit", "min", "max", "default", "description"],
          },
        },
        blocks: {
          type: "array",
          description: "Ordered UI blocks. MUST include control_panel and output_display blocks for interactivity.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["text", "choice_set", "slider", "control_panel", "output_display", "table", "step_task", "chart", "insight", "image", "diagram"] },
              content: { type: "string" },
              question: { type: "string" },
              emoji: { type: "string" },
              choices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    feedback: { type: "string", description: "Describe CONSEQUENCES, not correct/incorrect" },
                    effects: { type: "object", description: "Maps variable name to new value" },
                    is_best: { type: "boolean" },
                  },
                  required: ["text", "feedback", "effects"],
                },
              },
              variable: { type: "string", description: "For slider block: which variable to control" },
              variables: { type: "array", items: { type: "string" }, description: "For control_panel block: list of variable names to show as sliders" },
              outputs: { type: "array", items: { type: "string" }, description: "For output_display block: list of formula keys or variable names to display live" },
              image_prompt: { type: "string" },
              image_caption: { type: "string" },
              diagram_type: { type: "string", enum: ["flowchart", "system_map", "process", "cycle", "hierarchy", "comparison"] },
              diagram_nodes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    text: { type: "string" },
                    x: { type: "number" },
                    y: { type: "number" },
                  },
                  required: ["id", "text"],
                },
              },
              diagram_edges: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    from: { type: "string" },
                    to: { type: "string" },
                    label: { type: "string" },
                  },
                  required: ["from", "to"],
                },
              },
              diagram_caption: { type: "string" },
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
        rules: {
          type: "array",
          description: "3-5 global rules checked after EVERY variable change (slider or decision). Use mathjs syntax. These make the system feel alive.",
          items: {
            type: "object",
            properties: {
              condition: { type: "string", description: "mathjs expression e.g. 'temperature > 80' or 'pressure < 20'" },
              effects: { type: "object", description: "Maps variable name to new value or formula string like '+10' or '-15'" },
              message: { type: "string", description: "Feedback shown when rule fires — describe what's happening in the system" },
            },
            required: ["condition", "effects", "message"],
          },
        },
        formulas: {
          type: "object",
          description: "2-4 derived values computed from variables using mathjs. These update LIVE as sliders move. E.g. { 'efficiency': 'output / input * 100' }",
        },
        random_events: {
          type: "array",
          description: "1-3 random events that may fire during simulation. Each has a probability (0-1) of occurring per interaction.",
          items: {
            type: "object",
            properties: {
              probability: { type: "number", description: "Chance of firing (0.05 to 0.3)" },
              effects: { type: "object", description: "Variable changes when event fires" },
              message: { type: "string", description: "What happened — e.g. 'Unexpected market crash! Revenue drops.'" },
            },
            required: ["probability", "effects", "message"],
          },
        },
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
      required: ["title", "kind", "scenario", "variables", "blocks", "completion_rule", "rules", "formulas", "goal"],
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

    const { data: mod, error: modError } = await supabase
      .from("course_modules")
      .select("id, title, lab_description, lab_generation_status, course_id, lesson_content")
      .eq("id", moduleId)
      .single();

    if (modError || !mod) throw new Error("Module not found");

    const { data: course } = await supabase
      .from("courses")
      .select("id, topic, user_id")
      .eq("id", mod.course_id)
      .single();

    if (!course) throw new Error("Course not found");

    if (mod.lab_generation_status === "done") {
      return new Response(JSON.stringify({ status: "already_done" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("course_modules").update({ lab_generation_status: "generating" }).eq("id", moduleId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const topic = course.topic;
    const moduleTitle = mod.title;
    const labConcept = mod.lab_description || mod.title;
    const lessonContent = mod.lesson_content || "";

    // Extract key concepts from lesson for alignment
    const lessonSummary = lessonContent
      .replace(/\n---\n/g, "\n")
      .replace(/#{1,3}\s/g, "")
      .slice(0, 3000);

    const systemPrompt = `You are a SIMULATION SYSTEM DESIGNER for Repend. You convert ANY topic into an INTERACTIVE SYSTEM the student controls.

=== CORE PRINCIPLE ===
You are NOT making quizzes or static content. You are building a CONTROLLABLE SYSTEM where:
- Students adjust variables via sliders
- The system reacts in REAL TIME (rules fire, derived outputs update)
- Different inputs lead to different outcomes
- No single "correct" path — students explore and discover

=== CLARITY REQUIREMENTS (CRITICAL) ===
Every lab MUST be immediately understandable. Students should NEVER feel confused.

1. TITLE: Clear, descriptive title
2. SCENARIO: 2-3 sentences explaining the student's role and what they're managing
3. LEARNING_GOAL: One sentence stating what the student will understand after completing the lab
4. GOAL: A measurable objective so the student knows what "success" looks like

For EVERY variable:
- description MUST explain what it controls in plain language
- Example: "Controls the temperature of the reaction chamber — higher values speed up the reaction but risk instability"

For EVERY control_panel block:
- prompt MUST explain what the student should do with these controls
- Example: "Adjust these parameters to optimize the reaction. Watch how changing one affects the others."

For EVERY output_display block:
- prompt MUST explain what these outputs represent
- Example: "These metrics show the current state of your system. Your goal is to get efficiency above 80%."

For EVERY choice_set block:
- question MUST clearly present the decision and its context
- EVERY choice feedback MUST describe CONSEQUENCES (what happens to the system), NOT "correct/incorrect"

=== TOPIC CLASSIFICATION ===
Classify the topic into a simulation type:
- Math → calculation_simulation (inputs → computed outputs)
- Science → variable_relationship_simulation (interconnected variables)
- Business/Economics → decision_tradeoff_simulation (optimize competing goals)
- Biology → rule_based_simulation (conditions trigger system changes)
- General → interactive_scenario (decisions with consequences)

=== REQUIRED BLOCK STRUCTURE (8-10 blocks) ===
1. text — Set the scene. Explain the student's role, what they're managing, and what they need to achieve.
2. diagram — System architecture showing how variables connect.
3. control_panel — 2-4 INTERACTIVE SLIDERS. Include a prompt explaining what to adjust and why.
4. output_display — Show 2-3 LIVE computed values. Include a prompt explaining what these numbers mean.
5. table — Reference data for decision-making.
6. choice_set — Strategic decision with 3-4 options. Each creates different tradeoffs.
7. control_panel — Second round of adjustments after seeing effects.
8. choice_set — Higher-stakes decision building on previous state.
9. step_task — 1-2 analysis tasks using current variable values.
10. insight — Key takeaway connecting to real-world applications.

=== LESSON ALIGNMENT (CRITICAL) ===
The lab MUST ONLY use concepts, terminology, and variables that were explicitly taught in the lesson content provided below. Do NOT introduce new concepts, jargon, or systems not covered in the lesson. Every variable and decision in the lab must directly map to something the student already learned.

=== VARIABLE DESIGN ===
- Create 4-6 DOMAIN-SPECIFIC variables (NEVER generic like "quality" or "efficiency")
- Variables MUST interconnect via rules
- Use realistic units and ranges from the actual domain
- EVERY variable MUST have a description field

=== RULES (3-5, MANDATORY) ===
Rules fire automatically when conditions are met. They make the system FEEL ALIVE.
Use mathjs syntax. Effects use relative changes ("+10", "-15") or formulas.

=== FORMULAS (2-4, MANDATORY) ===
Derived values computed from variables. These update LIVE as sliders change.

=== RANDOM EVENTS (1-3) ===
Low-probability events that add variability. Probability between 0.05 and 0.2.

=== GOAL (MANDATORY) ===
Every lab MUST have a clear, measurable objective.

=== ANTI-PATTERNS (NEVER DO) ===
- NO generic variable names (Topic Quality, Topic Efficiency)
- NO "correct/incorrect" feedback — describe CONSEQUENCES
- NO static content without interactivity
- NO labs where sliders don't affect outputs
- NO single obvious correct answer — every choice has tradeoffs
- NO missing descriptions on variables — every slider must be explained
- NO confusing jargon without explanation`;

    const userPrompt = `Design an interactive SIMULATION for: "${moduleTitle}"

Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT (use ONLY these concepts) ===
${lessonSummary}

REQUIREMENTS (lab must align with lesson above):
1. The student must have at least 2 control_panel blocks with interactive sliders
2. At least 1 output_display block showing live-computed derived values
3. 4-6 domain-specific variables for ${topic} (NOT generic names)
4. 3-5 rules that create cause→effect relationships between variables
5. 2-4 formulas for derived outputs that update as sliders move
6. A clear, measurable goal/objective
7. 1-3 random events for variability
8. Multiple paths — no single correct answer

The student controls the system, sees it react, and discovers relationships.`;

    let blueprint: any = null;
    let lastGenError = "";

    for (let genAttempt = 0; genAttempt < 3; genAttempt++) {
      if (genAttempt > 0) {
        console.log(`Retry attempt ${genAttempt} for "${moduleTitle}"...`);
        await new Promise(r => setTimeout(r, genAttempt * 2000));
      }
      try {
        const prompt = genAttempt === 0 ? userPrompt :
          `CRITICAL: You MUST generate a simulation lab with AT LEAST 6 blocks for: "${moduleTitle}" (${topic}).

Return EXACTLY:
- 1 text block setting the scenario
- 1 table block with data
- 3 choice_set blocks with 3-4 choices each. Every choice must have effects setting ALL variables to specific numbers.
- 1 step_task block with 2 tasks (each with correct_answer, hint, explanation)
- 1 insight block

Create 3-5 domain-specific variables for ${topic}.
EVERY choice feedback must describe consequences, NOT say "correct" or "incorrect".
Do NOT return empty blocks.`;

        const aiData = await callAI(LOVABLE_API_KEY, {
          model: "openai/gpt-5",
          max_completion_tokens: 8192,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          tools: [blueprintToolSchema],
          tool_choice: { type: "function", function: { name: "create_lab_blueprint" } },
        });

        const result = extractToolArgs(aiData);
        blueprint = result.blueprint || result;
        if (blueprint && typeof blueprint === "object" && Array.isArray(blueprint.blocks) && blueprint.blocks.length > 0) break;
        if (blueprint && typeof blueprint === "object") {
          // Try to extract blocks from alternative structures
          if (!Array.isArray(blueprint.blocks)) blueprint.blocks = [];
        }
      } catch (e: any) {
        lastGenError = e.message || "Unknown generation error";
        console.warn(`Gen attempt ${genAttempt} failed: ${lastGenError}`);
        if (e.message?.includes("credits")) throw e;
      }
    }

    if (!blueprint || typeof blueprint !== "object") {
      await supabase.from("course_modules").update({ lab_generation_status: "failed", lab_error: lastGenError || "AI returned empty blueprint" }).eq("id", moduleId);
      return new Response(JSON.stringify({ status: "failed", error: lastGenError || "Empty blueprint" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Repair blocks from alternative structures
    if (!Array.isArray(blueprint.blocks)) blueprint.blocks = [];

    if (blueprint.blocks.length === 0) {
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
            ...(t.explanation ? { explanation: t.explanation } : {}),
          })),
        });
      }
    }

    if (blueprint.blocks.length === 0) {
      await supabase.from("course_modules").update({
        lab_generation_status: "failed",
        lab_error: "Blueprint generation produced no blocks after 3 attempts",
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

    console.log(`Lab generated for "${moduleTitle}" -> kind: ${blueprint.kind}, blocks: ${blueprint.blocks.length}, vars: ${blueprint.variables.length}`);

    return new Response(JSON.stringify({ status: "done", blueprint }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LAB GENERATION ERROR:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
