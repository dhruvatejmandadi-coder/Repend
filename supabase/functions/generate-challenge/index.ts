import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Challenge type → prompt strategy mapping ── */

function isMathTopic(topic: string): boolean {
  const mathKeywords = [
    "math", "algebra", "geometry", "calculus", "trigonometry", "statistics",
    "equation", "function", "graph", "polynomial", "quadratic", "linear",
    "derivative", "integral", "matrix", "vector", "probability", "fraction",
    "exponent", "logarithm", "inequality", "triangle", "circle", "angle",
    "theorem", "arithmetic", "number theory", "combinatorics", "slope",
    "intercept", "vertex", "parabola", "hyperbola", "sine", "cosine",
    "tangent", "factoring", "simplif", "expression", "coordinate",
  ];
  const lower = topic.toLowerCase();
  return mathKeywords.some((kw) => lower.includes(kw));
}

function buildSystemPrompt(challengeType: string, labTypes: string[], isMath: boolean): string {
  const baseRules = `You are an interactive learning challenge generator for a cognitive simulation platform.
Given a topic, create an engaging challenge with full structured content.

You MUST generate ALL of these fields:
- title: Challenge title (max 80 chars)
- description: Short summary (max 300 chars)
- objective: What the learner should practice (1-2 sentences)
- instructions: Step-by-step instructions for the challenge (use numbered steps)
- problem: The actual challenge problem statement (detailed, real-world scenario)
- hints: Array of exactly 2 hint strings
- solution: The expected answer or solution
- solution_explanation: Detailed explanation of why this is the solution
- difficulty: "easy", "medium", or "hard"
- challenge_type: The type of challenge`;

  // ── MATH LAB: specialized math generator ──
  if (isMath) {
    return `${baseRules}
- lab_type: MUST be "math_lab"
- lab_data: A complete math lab with visual representations

You are generating a MATH LAB. This is a specialized interactive math experience.

The lab_data MUST contain ALL of these fields:
- title: Lab title
- objective: What math skill the student will practice
- concept_overview: 2-4 sentence explanation of the math concept
- visual_type: One of "graph", "geometry", "solution_steps", "chart"
- scenario: A RELEVANT real-world scenario tied to the specific math concept
- instructions: Step-by-step lab instructions
- tasks: Array of 3-5 tasks (each with id, description, type, correct_answer)
- hints: Array of 2 hint strings
- solution: The correct answer
- solution_explanation: Step-by-step explanation

SCENARIO RULES (CRITICAL):
The scenario MUST be unique and directly relevant to the math concept:
- Linear functions → business revenue, distance vs time, phone plan pricing
- Quadratic functions → projectile motion, maximizing garden area, bridge arches
- Systems of equations → comparing pricing plans, mixing solutions
- Geometry/triangles → building structures, measuring land, architecture
- Statistics → analyzing survey data, sports statistics, weather patterns
- Trigonometry → measuring heights with angles, wave motion, navigation
- Exponential/logarithmic → population growth, radioactive decay, compound interest
- Probability → games of chance, quality control, medical testing
NEVER reuse the same generic scenario across different topics. Each lab must feel like a unique real-world application.

VISUAL TYPE SELECTION RULES:
- If the topic involves functions, equations, graphing, slopes, intercepts, transformations → visual_type = "graph"
- If the topic involves shapes, angles, triangles, circles, polygons → visual_type = "geometry"
- If the topic involves solving equations step-by-step, simplifying → visual_type = "solution_steps"
- If the topic involves data, statistics, probability → visual_type = "chart"

FOR visual_type = "graph", lab_data MUST include graph_data AND interactive_params:

graph_data:
{
  "type": "function" or "scatter" or "bar",
  "equation": "a*x^2 + b*x + c" (JavaScript math expression using x and parameter variables a, b, c),
  "x_label": "x (meaningful label, e.g. 'Time (seconds)')",
  "y_label": "y (meaningful label, e.g. 'Height (meters)')",
  "x_range": [-5, 10],
  "y_range": [-5, 15],
  "key_points": [{"x": 2, "y": -1, "label": "Vertex (2,-1)"}, {"x": 1, "y": 0, "label": "Root (1,0)"}]
}

interactive_params (REQUIRED for graph topics):
[
  {"name": "a", "label": "Coefficient a", "min": -5, "max": 5, "step": 0.5, "default": 1},
  {"name": "b", "label": "Coefficient b", "min": -10, "max": 10, "step": 1, "default": -4},
  {"name": "c", "label": "Constant c", "min": -10, "max": 10, "step": 1, "default": 3}
]
These allow students to adjust sliders and watch the graph change in real-time.
Use parameter variables (a, b, c, m, etc.) in the equation so sliders actually affect the graph.

IMPORTANT: The equation must be a valid JavaScript math expression. Use * for multiplication, ^ for exponents. Examples:
- "a*x^2 + b*x + c" for quadratics with interactive params
- "m*x + b" for linear with slope/intercept sliders
- "a*Math.sin(b*x + c)" for trig with amplitude/frequency/phase sliders
- "a*Math.abs(x - h) + k" for absolute value with transformations

FOR visual_type = "geometry", lab_data MUST include geometry (array of shapes):
[{
  "type": "triangle",
  "points": [{"x": 1, "y": 1, "label": "A"}, {"x": 5, "y": 1, "label": "B"}, {"x": 3, "y": 7, "label": "C"}],
  "measurements": {"AB": "4 units", "BC": "6.3 units", "angle_B": "45°"}
}]
Points must be in range 0-10 for proper rendering.

FOR visual_type = "solution_steps", lab_data MUST include solution_steps:
[{"step": 1, "expression": "2x + 5 = 15", "explanation": "Start with the original equation"},
 {"step": 2, "expression": "2x = 10", "explanation": "Subtract 5 from both sides"}]

FOR visual_type = "chart", lab_data MUST include graph_data:
{"type": "bar", "data_labels": ["A", "B", "C"], "data_values": [10, 25, 15], "x_label": "Category", "y_label": "Value"}

TASK FORMAT:
Each task must have: id (number), description (string), type ("input" | "choice" | "explanation"), correct_answer (string)
For choice tasks, also include options (array of 3-4 strings).
Tasks should progress from easier to harder.
Include at least one task that references the visual (e.g. "Using the graph, identify..." or "From the diagram, calculate...").

Return the result using the create_challenge_full function.`;
  }

  // ── Lab / Interactive: MUST generate full interactive lab ──
  if (challengeType === "lab_interactive") {
    return `${baseRules}
- lab_type: Choose from ${labTypes.join(", ")}
- lab_data: Structured lab data matching the lab_type schema

YOU ARE GENERATING A HANDS-ON INTERACTIVE LAB. This is the most important part.
The lab_data MUST be complete and playable.

Guidelines for lab type selection:
- "simulation": For causal/systemic topics. Students adjust parameters and see outcomes.
- "classification": For analytical/sorting topics. Students categorize items correctly.
- "ethical_dilemma": For moral/ethical topics. Every choice has tradeoffs across dimensions.
- "policy_optimization": For strategy/constraint topics. Students must hit targets within limits.
- "decision_lab": For complex reasoning. Students analyze scenarios and make decisions.

CRITICAL RULES FOR LAB DATA:

For "simulation" type:
- Exactly 3 parameters with name, icon (emoji), unit, min (0), max (100), default (40-60)
- Exactly 3 thresholds with label, min_percent, message
- 2-4 decisions, each with a question, emoji, and 2-3 choices
- EVERY choice MUST have set_state with ALL 3 parameter names as keys and values 0-100

For "classification" type:
- 5-8 items with name, description
- 2-4 categories with name, description
- correct_mapping object mapping every item name to its correct category name

For "ethical_dilemma" type:
- 3-4 dimensions with name, icon (emoji), description, initial_value (40-60)
- 2-4 decisions with scenario, emoji, and 2-3 options
- Each option has label, description, and impacts (dimension name → number change, e.g. +15 or -10)

For "policy_optimization" type:
- 3-4 parameters with name, icon (emoji), unit, min (0), max (100), default, step (5-10)
- 2-4 constraints with description
- 2-3 targets with name, operator (">=", "<="), value, unit
- max_moves: 3-5

For "decision_lab" type:
- scenario: detailed scenario text (at least 3 sentences)
- 3-4 constraints (strings)
- decision_prompt: what the user must decide
- considerations: 3-4 key factors to weigh

Return the result using the create_challenge_full function.`;
  }

  // ── Concept Check: Quick knowledge questions ──
  if (challengeType === "concept_check") {
    return `${baseRules}
- lab_type: "classification"
- lab_data: A classification lab that tests conceptual understanding

Generate a classification-style lab where students must sort or categorize concepts correctly.
Use 5-8 items and 2-4 categories. Include correct_mapping for all items.
The problem should be a quick conceptual check, not a deep problem.

Return the result using the create_challenge_full function.`;
  }

  // ── Challenge Problem: Deeper thinking, optional lab ──
  return `${baseRules}
- lab_type: Choose from ${labTypes.join(", ")}
- lab_data: Structured lab data matching the lab_type schema

Generate a challenge that requires deeper thinking and problem-solving.
Include a full interactive lab that reinforces the problem.
Prefer "simulation" or "ethical_dilemma" lab types for challenge problems.

CRITICAL RULES FOR LAB DATA:

For "simulation" type:
- Exactly 3 parameters with name, icon (emoji), unit, min (0), max (100), default (40-60)
- Exactly 3 thresholds with label, min_percent, message
- 2-4 decisions, each with a question, emoji, and 2-3 choices
- EVERY choice MUST have set_state with ALL 3 parameter names as keys and values 0-100

For "classification" type:
- 5-8 items with name, description
- 2-4 categories with name, description
- correct_mapping object mapping every item name to its correct category name

For "ethical_dilemma" type:
- 3-4 dimensions with name, icon (emoji), description, initial_value (40-60)
- 2-4 decisions with scenario, emoji, and 2-3 options
- Each option has label, description, and impacts (dimension name → number change)

For "policy_optimization" type:
- 3-4 parameters with name, icon (emoji), unit, min (0), max (100), default, step (5-10)
- 2-4 constraints with description
- 2-3 targets with name, operator (">=", "<="), value, unit
- max_moves: 3-5

For "decision_lab" type:
- scenario: detailed scenario text
- 3-4 constraints (strings)
- decision_prompt: what the user must decide
- considerations: 3-4 key factors

Return the result using the create_challenge_full function.`;
}

/* ── Repair simulation lab data ── */

function repairSimulationLab(labData: any): any {
  if (!labData?.parameters) return labData;
  const params = labData.parameters;

  // Ensure exactly 3 parameters
  while (params.length < 3) {
    params.push({ name: `Factor ${params.length + 1}`, icon: "📊", unit: "%", min: 0, max: 100, default: 50 });
  }
  if (params.length > 3) labData.parameters = params.slice(0, 3);

  // Ensure thresholds
  if (!labData.thresholds || !Array.isArray(labData.thresholds) || labData.thresholds.length === 0) {
    labData.thresholds = [
      { label: "Critical", min_percent: 0, message: "Parameters are at critical levels. Major issues ahead." },
      { label: "Moderate", min_percent: 40, message: "Some stability, but improvements needed." },
      { label: "Optimal", min_percent: 75, message: "Strong performance across all parameters." },
    ];
  }

  // Repair decisions
  if (labData.decisions) {
    for (const decision of labData.decisions) {
      if (!decision.choices) decision.choices = [];
      for (const choice of decision.choices) {
        if (!choice.set_state) choice.set_state = {};
        for (const p of labData.parameters) {
          if (typeof choice.set_state[p.name] !== "number") {
            choice.set_state[p.name] = p.default ?? 50;
          }
          choice.set_state[p.name] = Math.max(0, Math.min(100, choice.set_state[p.name]));
        }
      }
    }
  }

  return labData;
}

/* ── Main handler ── */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { topic, skill, difficulty, challenge_type, extra_prompt } = body;

    const mainTopic = topic || body.prompt;
    if (!mainTopic || typeof mainTopic !== "string" || mainTopic.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please provide a topic (at least 3 characters)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const labTypes = ["simulation", "classification", "ethical_dilemma", "policy_optimization", "decision_lab", "math_lab"];
    const diff = difficulty || "medium";
    const cType = challenge_type || "lab_interactive";
    const skillText = skill ? `\nSkill/concept: ${skill}` : "";
    const extraText = extra_prompt ? `\nAdditional instructions: ${extra_prompt}` : "";

    const isMath = isMathTopic(mainTopic.trim() + " " + (skill || ""));

    const userPrompt = `Create an interactive learning challenge about: ${mainTopic.trim()}
Difficulty: ${diff}
Challenge type: ${cType}${skillText}${extraText}
${isMath ? "\nThis is a MATH topic. You MUST use lab_type = 'math_lab' and include the appropriate visual representation (graph, geometry diagram, solution steps, or chart)." : ""}
IMPORTANT: Generate a COMPLETE, PLAYABLE interactive lab with all required fields.`;

    const systemPrompt = buildSystemPrompt(cType, labTypes, isMath);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_challenge_full",
              description: "Create a complete challenge with content and lab data",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  objective: { type: "string" },
                  instructions: { type: "string" },
                  problem: { type: "string" },
                  hints: { type: "array", items: { type: "string" } },
                  solution: { type: "string" },
                  solution_explanation: { type: "string" },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                  challenge_type: { type: "string" },
                  lab_type: { type: "string", enum: labTypes },
                  lab_data: { type: "object" },
                },
                required: ["title", "description", "objective", "instructions", "problem", "hints", "solution", "solution_explanation", "difficulty", "challenge_type", "lab_type", "lab_data"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_challenge_full" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit reached. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Failed to generate challenge");
    }

    const aiData = await aiResponse.json();

    let challengeData: any;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      challengeData = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      challengeData = JSON.parse(cleaned);
    }

    if (!challengeData.title || !challengeData.lab_type || !challengeData.lab_data) {
      throw new Error("AI returned incomplete challenge data");
    }

    // ── Force math_lab for math topics ──
    if (isMath && challengeData.lab_type !== "math_lab") {
      challengeData.lab_type = "math_lab";
    }

    // ── Apply defaults ──
    if (!labTypes.includes(challengeData.lab_type)) challengeData.lab_type = "simulation";
    if (!challengeData.hints || !Array.isArray(challengeData.hints)) {
      challengeData.hints = ["Think about the key concepts.", "Consider the tradeoffs."];
    }
    if (!challengeData.objective) challengeData.objective = challengeData.description || "";
    if (!challengeData.instructions) challengeData.instructions = "Complete the interactive lab below.";
    if (!challengeData.problem) challengeData.problem = challengeData.description || "";
    if (!challengeData.solution) challengeData.solution = "See the explanation.";
    if (!challengeData.solution_explanation) challengeData.solution_explanation = "Review the challenge to understand the solution.";
    challengeData.difficulty = challengeData.difficulty || diff;
    challengeData.challenge_type = challengeData.challenge_type || cType;

    // ── Repair lab data by type ──
    if (challengeData.lab_type === "simulation") {
      challengeData.lab_data = repairSimulationLab(challengeData.lab_data);
    }

    if (challengeData.lab_type === "classification" && challengeData.lab_data) {
      if (!challengeData.lab_data.items || challengeData.lab_data.items.length === 0) {
        challengeData.lab_data.items = [
          { name: "Item 1", description: "First concept" },
          { name: "Item 2", description: "Second concept" },
          { name: "Item 3", description: "Third concept" },
          { name: "Item 4", description: "Fourth concept" },
          { name: "Item 5", description: "Fifth concept" },
        ];
      }
      if (!challengeData.lab_data.categories || challengeData.lab_data.categories.length === 0) {
        challengeData.lab_data.categories = [
          { name: "Category A", description: "First group" },
          { name: "Category B", description: "Second group" },
        ];
      }
      if (!challengeData.lab_data.correct_mapping) {
        challengeData.lab_data.correct_mapping = {};
        const cats = challengeData.lab_data.categories;
        challengeData.lab_data.items.forEach((item: any, i: number) => {
          challengeData.lab_data.correct_mapping[item.name] = cats[i % cats.length].name;
        });
      }
    }

    if (challengeData.lab_type === "ethical_dilemma" && challengeData.lab_data) {
      if (!challengeData.lab_data.dimensions || challengeData.lab_data.dimensions.length === 0) {
        challengeData.lab_data.dimensions = [
          { name: "Ethics", icon: "⚖️", description: "Ethical standing", initial_value: 50 },
          { name: "Profit", icon: "💰", description: "Financial outcome", initial_value: 50 },
          { name: "Public Trust", icon: "🤝", description: "Public perception", initial_value: 50 },
        ];
      }
    }

    if (challengeData.lab_type === "policy_optimization" && challengeData.lab_data) {
      if (!challengeData.lab_data.parameters || challengeData.lab_data.parameters.length === 0) {
        challengeData.lab_data.parameters = [
          { name: "Budget", icon: "💰", unit: "%", min: 0, max: 100, default: 50, step: 5 },
          { name: "Efficiency", icon: "⚡", unit: "%", min: 0, max: 100, default: 50, step: 5 },
          { name: "Satisfaction", icon: "😊", unit: "%", min: 0, max: 100, default: 50, step: 5 },
        ];
      }
      if (!challengeData.lab_data.max_moves) challengeData.lab_data.max_moves = 4;
    }

    // ── Repair math_lab data ──
    if (challengeData.lab_type === "math_lab" && challengeData.lab_data) {
      const ld = challengeData.lab_data;
      if (!ld.title) ld.title = challengeData.title;
      if (!ld.objective) ld.objective = challengeData.objective || "";
      if (!ld.concept_overview) ld.concept_overview = challengeData.description || "";
      if (!ld.visual_type) ld.visual_type = "graph";
      if (!ld.tasks || !Array.isArray(ld.tasks) || ld.tasks.length === 0) {
        ld.tasks = [
          { id: 1, description: "Analyze the visual representation.", type: "explanation", correct_answer: "" },
          { id: 2, description: "Identify the key values.", type: "input", correct_answer: "" },
          { id: 3, description: "Explain the concept in your own words.", type: "explanation", correct_answer: "" },
        ];
      }
      // Ensure task ids
      ld.tasks.forEach((t: any, i: number) => { if (!t.id) t.id = i + 1; });
      if (!ld.hints || !Array.isArray(ld.hints)) ld.hints = challengeData.hints || ["Think step by step.", "Review the visual."];
      if (!ld.solution) ld.solution = challengeData.solution || "";
      if (!ld.solution_explanation) ld.solution_explanation = challengeData.solution_explanation || "";
    }

    console.log("Generated challenge:", challengeData.lab_type, "with", Object.keys(challengeData.lab_data).length, "lab fields");

    return new Response(JSON.stringify({ challenge_data: challengeData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-challenge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
