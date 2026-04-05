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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    console.error("❌ No tool_calls in AI response. Full message:", JSON.stringify(message).slice(0, 500));
    throw new Error(`AI did not return structured data (reason: ${finishReason || "unknown"}).`);
  }
  const raw = toolCall.function.arguments || "";
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("❌ JSON parse failed on tool_calls.arguments");
    const cleaned = raw.replace(/,\s*$/, "");
    for (const closer of ["]}]}", "]}}", "]}", "}", "]"]) {
      try { return JSON.parse(cleaned + closer); } catch { /* next */ }
    }
    throw new Error("AI response was malformed or truncated.");
  }
}

// ─── TOOL SCHEMAS FOR EACH LAB TYPE ───

const simulationToolSchema = {
  type: "function" as const,
  function: {
    name: "create_simulation_lab",
    description: "Create an interactive SIMULATION lab with sliders, live outputs, rules, and decisions.",
    parameters: {
      type: "object",
      properties: {
        lab_type: { type: "string", const: "simulation" },
        title: { type: "string" },
        kind: { type: "string" },
        scenario: { type: "string" },
        learning_goal: { type: "string" },
        key_insight: { type: "string" },
        goal: {
          type: "object",
          properties: {
            description: { type: "string" },
            condition: { type: "string" },
          },
          required: ["description"],
        },
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
            required: ["name", "icon", "unit", "min", "max", "default", "description"],
          },
        },
        blocks: {
          type: "array",
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
                    feedback: { type: "string" },
                    effects: { type: "object" },
                    is_best: { type: "boolean" },
                  },
                  required: ["text", "feedback", "effects"],
                },
              },
              variables: { type: "array", items: { type: "string" } },
              outputs: { type: "array", items: { type: "string" } },
              prompt: { type: "string" },
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
              diagram_type: { type: "string" },
              diagram_nodes: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } }, required: ["id", "text"] } },
              diagram_edges: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, label: { type: "string" } }, required: ["from", "to"] } },
            },
            required: ["type"],
          },
        },
        completion_rule: { type: "string", enum: ["all_blocks", "all_choices", "all_tasks"] },
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              condition: { type: "string" },
              effects: { type: "object" },
              message: { type: "string" },
            },
            required: ["condition", "effects", "message"],
          },
        },
        formulas: { type: "object" },
        random_events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              probability: { type: "number" },
              effects: { type: "object" },
              message: { type: "string" },
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

const flowchartToolSchema = {
  type: "function" as const,
  function: {
    name: "create_flowchart_lab",
    description: "Create a FLOWCHART lab where students fill in the correct process steps via dropdowns. Use for topics involving ordered processes, workflows, or decision trees.",
    parameters: {
      type: "object",
      properties: {
        lab_type: { type: "string", const: "flowchart" },
        title: { type: "string" },
        goal: { type: "string" },
        scenario: { type: "string" },
        key_insight: { type: "string" },
        drop_zones: {
          type: "array",
          description: "Ordered steps in the flowchart. Each has a label prompt, the correct value, and shuffled options (including the correct one + distractors).",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string", description: "The prompt/description for this step" },
              correct_value: { type: "string", description: "The correct answer for this dropdown" },
              options: { type: "array", items: { type: "string" }, description: "3-5 options including the correct one, shuffled" },
            },
            required: ["id", "label", "correct_value", "options"],
          },
        },
      },
      required: ["lab_type", "title", "goal", "drop_zones"],
    },
  },
};

const codeDebuggerToolSchema = {
  type: "function" as const,
  function: {
    name: "create_code_debugger_lab",
    description: "Create a CODE DEBUGGER lab where students find and fix bugs in code. Use for programming, logic, and computational topics.",
    parameters: {
      type: "object",
      properties: {
        lab_type: { type: "string", const: "code_debugger" },
        title: { type: "string" },
        goal: { type: "string", description: "What the code should do when fixed" },
        language: { type: "string", description: "Programming language (python, javascript, etc.)" },
        starter_code: { type: "string", description: "The BROKEN code with 1-3 bugs" },
        expected_output: { type: "string", description: "The exact output the fixed code should produce" },
        initial_error: { type: "string", description: "The error or wrong output the broken code currently produces" },
        hints: { type: "array", items: { type: "string" }, description: "Progressive hints, from vague to specific" },
        key_insight: { type: "string" },
      },
      required: ["lab_type", "title", "goal", "language", "starter_code", "expected_output", "initial_error"],
    },
  },
};

const graphToolSchema = {
  type: "function" as const,
  function: {
    name: "create_graph_lab",
    description: "Create a GRAPH lab where students manipulate mathematical functions via sliders and see the graph update in real-time. Use for math topics involving functions, equations, and graphing.",
    parameters: {
      type: "object",
      properties: {
        lab_type: { type: "string", const: "graph" },
        title: { type: "string" },
        goal: { type: "string" },
        graph_type: { type: "string", enum: ["linear", "quadratic", "exponential", "trig", "custom"] },
        equation: { type: "string", description: "Math expression using variable names from sliders + x. E.g. 'A * (x - H)^2 + K' or 'M * x + B'" },
        display_equation: { type: "string", description: "Human-readable equation form. E.g. 'f(x) = A(x - H)² + K'" },
        sliders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Variable name used in equation" },
              label: { type: "string" },
              min: { type: "number" },
              max: { type: "number" },
              step: { type: "number" },
              default: { type: "number" },
              description: { type: "string" },
            },
            required: ["name", "label", "min", "max", "step", "default"],
          },
        },
        target: {
          type: "object",
          description: "Target parameter values the student must match",
          properties: {
            description: { type: "string" },
            params: { type: "object", description: "Maps slider name to target value" },
            tolerance: { type: "number", description: "How close the student needs to be (default 0.3)" },
          },
          required: ["description", "params"],
        },
        x_range: { type: "array", items: { type: "number" }, description: "[min, max] for x-axis" },
        y_range: { type: "array", items: { type: "number" }, description: "[min, max] for y-axis" },
        key_insight: { type: "string" },
      },
      required: ["lab_type", "title", "goal", "graph_type", "equation", "sliders"],
    },
  },
};

// ─── LAB TYPE SELECTION LOGIC ───

function classifyLabType(topic: string, moduleTitle: string, lessonContent: string): string {
  const combined = `${topic} ${moduleTitle} ${lessonContent}`.toLowerCase();

  // Graph lab: math functions, graphing, equations, transformations
  const graphKeywords = [
    "graph", "plot", "equation", "function", "parabola", "quadratic", "linear",
    "slope", "intercept", "vertex", "transformation", "exponential", "logarithm",
    "trigonometr", "sine", "cosine", "tangent", "amplitude", "period",
    "y = ", "f(x)", "asymptote", "polynomial"
  ];
  if (graphKeywords.some(k => combined.includes(k))) return "graph";

  // Code debugger: programming, coding, debugging, algorithms
  const codeKeywords = [
    "code", "coding", "program", "debug", "syntax", "algorithm", "function",
    "variable", "loop", "array", "python", "javascript", "java ", "c++",
    "html", "css", "sql", "data structure", "compile", "runtime"
  ];
  // Only match if strongly coding-related (not just "function" which is also math)
  const codeScore = codeKeywords.filter(k => combined.includes(k)).length;
  if (codeScore >= 2) return "code_debugger";

  // Flowchart: processes, workflows, steps, procedures
  const flowchartKeywords = [
    "process", "workflow", "procedure", "step-by-step", "pipeline",
    "lifecycle", "methodology", "framework", "protocol", "algorithm",
    "sequence", "phases", "stages", "design process", "scientific method",
    "project management", "sdlc", "agile", "waterfall"
  ];
  const flowScore = flowchartKeywords.filter(k => combined.includes(k)).length;
  if (flowScore >= 2) return "flowchart";

  // Default: simulation (works for business, science, economics, general)
  return "simulation";
}

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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

    const topic = course.topic;
    const moduleTitle = mod.title;
    const labConcept = mod.lab_description || mod.title;
    const lessonContent = mod.lesson_content || "";
    const lessonSummary = lessonContent.replace(/\n---\n/g, "\n").replace(/#{1,3}\s/g, "").slice(0, 3000);

    // Classify what type of lab this topic needs
    const labType = classifyLabType(topic, moduleTitle, lessonContent);
    console.log(`[Lab Gen] Topic: "${moduleTitle}" → Lab type: ${labType}`);

    // Build the right prompt and tool based on lab type
    let systemPrompt: string;
    let userPrompt: string;
    let toolSchema: any;
    let toolName: string;

    if (labType === "graph") {
      toolSchema = graphToolSchema;
      toolName = "create_graph_lab";
      systemPrompt = `You are a MATH GRAPH LAB DESIGNER. You create interactive graphing labs where students manipulate equation parameters via sliders and see the graph update in real time.

=== RULES ===
- Each lab focuses on ONE core graph concept (transformations, slope, vertex, etc.)
- Sliders MUST directly control equation parameters
- Graph MUST update in real-time when sliders move
- Only include sliders relevant to the topic
- Set appropriate x_range and y_range for the function type
- Include a target the student must match by adjusting sliders
- The equation must use the slider variable names (e.g. if slider name is "m", equation uses "m")

=== GRAPH TYPES ===
- linear: y = mx + b (sliders: m, b)
- quadratic: y = A(x-H)²+K (sliders: A (Strech), H (Horizontal shift), K (Vertical shift))
- exponential: y = a * b^x (sliders: a, b)
- trig: y = A*sin(B*(x-C))+D (sliders: A, B, C, D)

=== LESSON ALIGNMENT ===
Only use concepts from the lesson content provided.`;

      userPrompt = `Create an interactive GRAPH LAB for: "${moduleTitle}"
Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT ===
${lessonSummary}

Create a graph lab with:
1. The right equation for this topic
2. 2-4 sliders controlling equation parameters
3. A target the student must match
4. Appropriate axis ranges`;

    } else if (labType === "flowchart") {
      toolSchema = flowchartToolSchema;
      toolName = "create_flowchart_lab";
      systemPrompt = `You are a PROCESS FLOWCHART LAB DESIGNER. You create interactive flowchart labs where students fill in the correct steps of a process using dropdown menus.

=== RULES ===
- Create 4-8 ordered steps in the process
- Each step has a descriptive label and a dropdown with 3-5 options
- One option per step is correct, others are plausible distractors
- The process must be directly from the lesson content
- Steps must have a clear logical order
- Completion requires ALL steps correct (no partial credit)
- Distractors should be related but wrong (common misconceptions)

=== LESSON ALIGNMENT ===
Only use processes and steps explicitly taught in the lesson.`;

      userPrompt = `Create a FLOWCHART LAB for: "${moduleTitle}"
Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT ===
${lessonSummary}

Create a flowchart with 4-8 steps. Each step needs:
- A clear label describing what this step involves
- The correct answer for the dropdown
- 3-5 shuffled options including the correct one and plausible distractors`;

    } else if (labType === "code_debugger") {
      toolSchema = codeDebuggerToolSchema;
      toolName = "create_code_debugger_lab";
      systemPrompt = `You are a CODE DEBUGGING LAB DESIGNER. You create interactive labs where students find and fix bugs in code.

=== RULES ===
- The starter code must have 1-3 clear bugs
- Bugs should relate to the lesson concepts (not random typos)
- The expected output must be simple and verifiable (a number, string, or short text)
- Include 2-3 progressive hints (vague → specific)
- Keep code SHORT (10-20 lines max)
- Use Python by default unless the lesson is about another language
- The initial_error shows what the broken code currently outputs
- Use print() for Python, console.log() for JavaScript

=== LESSON ALIGNMENT ===
Bugs must test understanding of concepts from the lesson.`;

      userPrompt = `Create a CODE DEBUGGER LAB for: "${moduleTitle}"
Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT ===
${lessonSummary}

Create broken code (10-20 lines) with 1-3 bugs that test understanding of the lesson concepts. Include the expected output and progressive hints.`;

    } else {
      // Default: simulation
      toolSchema = simulationToolSchema;
      toolName = "create_simulation_lab";
      systemPrompt = `You are a SIMULATION SYSTEM DESIGNER. Return ONLY valid structured data. Be concise.

You convert topics into INTERACTIVE SYSTEMS with sliders, live outputs, and decisions.
- Students adjust variables via sliders
- The system reacts in REAL TIME (rules fire, derived outputs update)
- Different inputs lead to different outcomes

=== CLARITY REQUIREMENTS ===
Every variable MUST have a description explaining what it controls in plain language.
Every control_panel block MUST have a prompt explaining what to adjust.
Every output_display block MUST have a prompt explaining what the outputs represent.
Every choice_set feedback MUST describe CONSEQUENCES, not "correct/incorrect".

=== REQUIRED BLOCKS (8-10) ===
1. text — Scene setting
2. diagram — System architecture
3. control_panel — Interactive sliders
4. output_display — Live computed values
5. table — Reference data
6. choice_set — Strategic decision with tradeoffs
7. control_panel — Second round adjustments
8. choice_set — Higher-stakes decision
9. step_task — Analysis tasks
10. insight — Key takeaway

=== VARIABLE DESIGN ===
- 4-6 DOMAIN-SPECIFIC variables (NEVER generic like "quality")
- Variables MUST interconnect via rules
- Use realistic units and ranges

=== ANTI-PATTERNS ===
- NO generic variable names
- NO "correct/incorrect" feedback — describe CONSEQUENCES
- NO labs where sliders don't affect outputs

=== LESSON ALIGNMENT ===
ONLY use concepts from the lesson content provided.`;

      userPrompt = `Design an interactive SIMULATION for: "${moduleTitle}"
Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT (use ONLY these concepts) ===
${lessonSummary}

REQUIREMENTS:
1. At least 2 control_panel blocks with interactive sliders
2. At least 1 output_display block with live-computed values
3. 4-6 domain-specific variables
4. 3-5 rules creating cause→effect relationships
5. 2-4 formulas for derived outputs
6. Clear measurable goal
7. Multiple paths — no single correct answer`;
    }

    let blueprint: any = null;
    let lastGenError = "";

    for (let genAttempt = 0; genAttempt < 3; genAttempt++) {
      if (genAttempt > 0) {
        console.log(`Retry attempt ${genAttempt} for "${moduleTitle}" (${labType})...`);
        await new Promise(r => setTimeout(r, genAttempt * 2000));
      }
      try {
        const aiData = await callAI(OPENAI_API_KEY, {
          model: "gpt-4o",
          max_completion_tokens: 6000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [toolSchema],
          tool_choice: { type: "function", function: { name: toolName } },
        });

        const result = extractToolArgs(aiData);
        blueprint = result.blueprint || result;

        // Validate based on lab type
        if (labType === "graph" && blueprint.sliders?.length > 0 && blueprint.equation) break;
        if (labType === "flowchart" && blueprint.drop_zones?.length > 0) break;
        if (labType === "code_debugger" && blueprint.starter_code && blueprint.expected_output) break;
        if (labType === "simulation" && blueprint.blocks?.length > 0) break;
        
        // If we got something but not validated, still use it
        if (blueprint && typeof blueprint === "object") break;
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

    // Ensure lab_type is set
    blueprint.lab_type = blueprint.lab_type || labType;

    // ── Post-processing by lab type ──

    if (labType === "simulation") {
      // Repair simulation-specific data
      if (!Array.isArray(blueprint.blocks)) blueprint.blocks = [];
      if (!Array.isArray(blueprint.variables)) blueprint.variables = [];

      // Repair variables
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

      blueprint.completion_rule = blueprint.completion_rule || "all_choices";

      if (blueprint.blocks.length === 0) {
        await supabase.from("course_modules").update({
          lab_generation_status: "failed",
          lab_error: "Blueprint generation produced no blocks after 3 attempts",
        }).eq("id", moduleId);
        return new Response(JSON.stringify({ status: "failed", error: "No blocks" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (labType === "flowchart") {
      // Ensure drop_zones have proper structure
      if (Array.isArray(blueprint.drop_zones)) {
        blueprint.drop_zones = blueprint.drop_zones.map((dz: any, i: number) => ({
          id: dz.id || `step_${i + 1}`,
          label: dz.label || `Step ${i + 1}`,
          correct_value: dz.correct_value || "",
          options: Array.isArray(dz.options) ? dz.options : [dz.correct_value || "Option"],
        }));
      }
    }

    if (labType === "graph") {
      // Ensure sliders have proper defaults
      if (Array.isArray(blueprint.sliders)) {
        blueprint.sliders = blueprint.sliders.map((s: any) => ({
          ...s,
          step: s.step || 0.1,
          default: typeof s.default === "number" ? s.default : 1,
        }));
      }
      // Ensure ranges
      if (!blueprint.x_range) blueprint.x_range = [-10, 10];
      if (!blueprint.y_range) blueprint.y_range = [-10, 10];
    }

    blueprint.title = blueprint.title || moduleTitle;

    // Save
    const labTypeForDb = labType === "simulation" ? "dynamic" : labType;
    await supabase.from("course_modules").update({
      lab_data: blueprint,
      lab_blueprint: blueprint,
      lab_type: labTypeForDb,
      lab_generation_status: "done",
      lab_error: null,
    }).eq("id", moduleId);

    console.log(`Lab generated for "${moduleTitle}" → type: ${labType}, kind: ${blueprint.kind || labType}`);

    return new Response(JSON.stringify({ status: "done", blueprint }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LAB GENERATION ERROR:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
