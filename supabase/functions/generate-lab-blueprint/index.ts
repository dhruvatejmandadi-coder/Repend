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
    description: "Create an interactive SLIDER-BASED SIMULATION lab. Students adjust 2-5 sliders and see live outputs change. Every slider MUST affect at least one output.",
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
              type: { type: "string", enum: ["text", "choice_set", "slider", "control_panel", "output_display", "table", "chart", "insight", "image", "diagram"] },
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
    description: "Create a FLOWCHART lab where students fill in the correct process steps via dropdowns.",
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
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              correct_value: { type: "string" },
              options: { type: "array", items: { type: "string" } },
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
    description: "Create a CODE DEBUGGER lab where students find and fix bugs in code.",
    parameters: {
      type: "object",
      properties: {
        lab_type: { type: "string", const: "code_debugger" },
        title: { type: "string" },
        goal: { type: "string" },
        language: { type: "string" },
        starter_code: { type: "string" },
        expected_output: { type: "string" },
        initial_error: { type: "string" },
        hints: { type: "array", items: { type: "string" } },
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
    description: "Create a GRAPH lab where students manipulate mathematical functions via sliders and see the graph update in real-time.",
    parameters: {
      type: "object",
      properties: {
        lab_type: { type: "string", const: "graph" },
        title: { type: "string" },
        goal: { type: "string" },
        graph_type: { type: "string", enum: ["linear", "quadratic", "exponential", "trig", "custom"] },
        equation: { type: "string" },
        display_equation: { type: "string" },
        sliders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
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
          properties: {
            description: { type: "string" },
            params: { type: "object" },
            tolerance: { type: "number" },
          },
          required: ["description", "params"],
        },
        x_range: { type: "array", items: { type: "number" } },
        y_range: { type: "array", items: { type: "number" } },
        key_insight: { type: "string" },
      },
      required: ["lab_type", "title", "goal", "graph_type", "equation", "sliders"],
    },
  },
};

// ─── ADAPTIVE LAB TYPE SELECTION ───
// Weighted scoring: picks the best-matching lab type per module independently.

type LabCandidate = { type: string; score: number };

function classifyLabType(topic: string, moduleTitle: string, lessonContent: string): string {
  const combined = `${topic} ${moduleTitle} ${lessonContent}`.toLowerCase();

  const labProfiles: Record<string, { keywords: [string, number][] }> = {
    graph: {
      keywords: [
        // Math graphing
        ["graph", 3], ["plot", 3], ["equation", 2], ["parabola", 4], ["quadratic", 4],
        ["polynomial", 3], ["slope", 3], ["intercept", 3], ["vertex", 3],
        ["exponential", 3], ["logarithm", 3], ["asymptote", 3],
        // Trig / polar
        ["trigonometr", 5], ["sine", 5], ["cosine", 5], ["tangent", 4],
        ["amplitude", 5], ["period", 4], ["phase shift", 5], ["frequency", 3],
        ["polar", 5], ["polar coordinate", 6], ["unit circle", 5],
        ["radian", 4], ["parametric", 4], ["sinusoidal", 5],
        ["y = ", 3], ["f(x)", 3], ["transformation", 2],
        ["linear equation", 3], ["linear function", 3],
        ["domain and range", 2], ["curve", 2],
        // Statistics / data viz
        ["histogram", 4], ["scatter plot", 4], ["box plot", 4],
        ["distribution", 3], ["regression", 3], ["correlation", 3],
        ["normal distribution", 4], ["standard deviation", 3],
        ["statistics", 2], ["probability distribution", 4],
        ["z-score", 4], ["confidence interval", 3], ["chi-square", 4],
        // Physics graphing
        ["ohm's law", 4], ["voltage", 3], ["resistance", 3],
        ["wave", 3], ["wavelength", 3], ["harmonic", 3],
        // Astronomy / orbital
        ["orbital", 4], ["eccentricity", 4], ["semi-major axis", 5],
        ["kepler", 5], ["escape velocity", 4], ["celestial", 3],
        // Pharmacokinetics curves
        ["pharmacokinetic", 4], ["half-life", 3], ["plasma concentration", 5],
        ["dosage", 2], ["clearance rate", 4],
      ],
    },
    code_debugger: {
      keywords: [
        ["debug", 5], ["syntax error", 5], ["code", 3], ["coding", 3],
        ["program", 3], ["python", 4], ["javascript", 4], ["java ", 3],
        ["c++", 3], ["html", 3], ["css", 3], ["sql", 4],
        ["algorithm", 2], ["data structure", 3], ["compile", 3],
        ["runtime", 3], ["loop", 2], ["array", 2], ["recursion", 3],
        ["object-oriented", 3], ["oop", 3], ["api", 2],
        // Cybersecurity code
        ["sql injection", 5], ["xss", 5], ["cross-site", 4],
        ["injection", 4], ["exploit", 4], ["vulnerability", 3],
        ["penetration test", 4], ["malware", 3],
        // Data queries
        ["query", 3], ["database", 2], ["join", 2], ["select", 2],
        // Web dev
        ["web development", 3], ["front-end", 3], ["back-end", 3],
        ["react", 3], ["node", 2], ["typescript", 3],
      ],
    },
    flowchart: {
      keywords: [
        ["process", 2], ["workflow", 4], ["procedure", 3], ["step-by-step", 3],
        ["pipeline", 4], ["lifecycle", 4], ["methodology", 3],
        ["framework", 2], ["protocol", 3], ["sequence of steps", 4],
        ["phases", 3], ["stages", 3], ["design process", 4],
        ["scientific method", 4], ["sdlc", 5], ["agile", 3],
        ["waterfall", 4], ["project management", 3],
        ["decision tree", 4], ["flow chart", 5], ["flowchart", 5],
        // Biology processes
        ["cell division", 3], ["mitosis", 3], ["meiosis", 3],
        ["digestive system", 3], ["respiration", 2],
        ["photosynthesis", 3], ["krebs cycle", 4], ["dna replication", 4],
        // Business processes
        ["supply chain", 4], ["logistics", 3], ["onboarding", 3],
        ["hiring process", 4], ["marketing funnel", 4],
        ["customer journey", 4], ["sales pipeline", 4],
        // Critical thinking / logic
        ["logical fallac", 4], ["deductive", 3], ["inductive", 3],
        ["argument structure", 4], ["syllogism", 4],
        // Engineering
        ["circuit", 3], ["logic gate", 4], ["boolean", 3],
        // Cybersecurity processes
        ["incident response", 5], ["forensic", 4], ["chain of custody", 5],
        ["evidence handling", 4], ["authentication", 3],
        ["handshake", 4], ["tcp/ip", 4], ["osi model", 5],
        ["network protocol", 4], ["dns resolution", 4],
        // Legal / medical processes
        ["trial process", 4], ["legal procedure", 4], ["diagnosis", 3],
        ["triage", 4], ["clinical pathway", 4],
      ],
    },
    simulation: {
      keywords: [
        // Physics
        ["physics", 2], ["projectile", 4], ["friction", 3], ["force", 2],
        ["acceleration", 3], ["momentum", 3], ["energy", 2], ["gravity", 3],
        ["thermodynamic", 3], ["heat transfer", 3], ["pressure", 2],
        ["chemical reaction", 3], ["equilibrium", 2], ["concentration", 2],
        ["velocity", 3], ["kinematics", 4], ["newton", 3],
        // Biology
        ["population", 3], ["ecosystem", 4], ["predator", 4], ["prey", 4],
        ["evolution", 2], ["natural selection", 3], ["food chain", 3],
        ["genetics", 3], ["punnett", 4], ["heredity", 3], ["allele", 4],
        ["phenotype", 3], ["genotype", 3], ["mutation", 3],
        ["carrying capacity", 4], ["birth rate", 3], ["death rate", 3],
        // Economics / Business
        ["supply and demand", 4], ["inflation", 4], ["interest rate", 4],
        ["market", 2], ["profit", 3], ["revenue", 3], ["investment", 3],
        ["budget", 3], ["pricing", 3], ["elasticity", 3],
        ["gdp", 3], ["monetary policy", 4], ["fiscal", 3],
        ["consumer surplus", 4], ["producer surplus", 4], ["deadweight loss", 4],
        // Finance
        ["portfolio", 3], ["stock", 2], ["bond", 2], ["compound interest", 4],
        ["amortization", 4], ["depreciation", 3], ["cash flow", 3],
        ["valuation", 3], ["dcf", 4], ["roi", 3],
        // Health / medicine
        ["nutrition", 3], ["metabolism", 3], ["calorie", 3], ["bmi", 3],
        ["drug", 2], ["pharmacology", 4], ["dose", 3],
        ["bioavailability", 4], ["therapeutic", 3], ["toxicity", 3],
        // Psychology / behavior
        ["cognitive bias", 5], ["confirmation bias", 4], ["anchoring", 4],
        ["heuristic", 3], ["decision quality", 4], ["psychology", 3],
        ["behavioral", 3], ["perception", 2],
        // Negotiation / soft skills
        ["negotiation", 4], ["conflict resolution", 3], ["persuasion", 3],
        ["leadership", 2], ["emotional intelligence", 3],
        // Engineering
        ["structural", 3], ["stress", 2], ["load", 2], ["bridge", 3],
        ["material", 2], ["tensile", 3],
        // Environmental
        ["climate", 3], ["carbon", 3], ["emission", 3], ["sustainability", 3],
        ["renewable", 3], ["pollution", 3], ["carbon cycle", 4],
        ["deforestation", 3], ["reforestation", 3], ["greenhouse", 3],
        // Law
        ["evidence strength", 4], ["verdict", 4], ["prosecution", 3],
        ["defense", 2], ["jury", 3], ["trial", 2], ["witness", 3],
        ["burden of proof", 4], ["reasonable doubt", 4],
        // Cybersecurity (slider-based)
        ["password strength", 4], ["entropy", 3], ["phishing", 4],
        ["server hardening", 4], ["access control", 3],
        ["firewall rule", 4], ["packet", 3], ["network security", 3],
        ["encryption strength", 4], ["cipher", 3], ["steganography", 4],
        ["rogue access point", 4], ["signal strength", 3],
        // Chemistry
        ["reaction rate", 4], ["activation energy", 4], ["catalyst", 3],
        ["le chatelier", 4], ["molarity", 3], ["titration", 3],
        // General simulation
        ["optimize", 2], ["tradeoff", 3], ["trade-off", 3],
        ["simulation", 5], ["model", 2], ["system", 1],
        ["cause and effect", 3], ["what happens when", 3],
      ],
    },
  };

  const candidates: LabCandidate[] = [];

  for (const [labType, profile] of Object.entries(labProfiles)) {
    let score = 0;
    let matchCount = 0;
    for (const [keyword, weight] of profile.keywords) {
      if (combined.includes(keyword)) {
        score += weight;
        matchCount++;
      }
    }
    if (matchCount >= 2 || score >= 4) {
      candidates.push({ type: labType, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score >= 4) {
    console.log(`[Lab Selection] Candidates: ${candidates.map(c => `${c.type}(${c.score})`).join(", ")} → picked: ${candidates[0].type}`);
    return candidates[0].type;
  }

  console.log(`[Lab Selection] No strong match, defaulting to simulation (universal slider fallback)`);
  return "simulation";
}

// ─── GUARANTEED FALLBACK: deterministic slider lab ───
// If AI generation fails completely, this creates a working lab from the topic alone.
function createFallbackSliderLab(topic: string, moduleTitle: string): any {
  // Extract meaningful words from topic/title to create contextual labels
  const words = `${topic} ${moduleTitle}`.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(w => w.length > 3);
  const label1 = words[0] || "Intensity";
  const label2 = words[1] || "Scale";
  const label3 = words[2] || "Factor";

  // Randomize defaults ±20%
  const jitter = (base: number) => Math.round(base * (0.8 + Math.random() * 0.4));

  return {
    lab_type: "simulation",
    title: `Explore: ${moduleTitle}`,
    kind: "exploration",
    scenario: `Adjust the sliders below to explore how different factors in ${moduleTitle} affect the outcome. Observe the relationships between variables.`,
    learning_goal: `Understand the key variables and tradeoffs in ${moduleTitle}`,
    key_insight: `Changing one variable often has cascading effects on the entire system.`,
    goal: { description: `Explore how each variable affects the output by adjusting all sliders.` },
    variables: [
      { name: label1, icon: "📊", unit: "%", min: 0, max: 100, default: jitter(50), description: `Controls the ${label1.toLowerCase()} level` },
      { name: label2, icon: "📈", unit: "%", min: 0, max: 100, default: jitter(40), description: `Controls the ${label2.toLowerCase()} factor` },
      { name: label3, icon: "⚡", unit: "%", min: 0, max: 100, default: jitter(60), description: `Controls the ${label3.toLowerCase()} impact` },
    ],
    blocks: [
      { type: "text", content: `🔬 **${moduleTitle}** — Use the sliders to explore how different factors interact. Watch the outputs change in real-time as you adjust each variable.` },
      { type: "control_panel", prompt: "Adjust the variables to explore their effects:", variables: [label1, label2, label3] },
      { type: "output_display", prompt: "Observe how the outputs respond:", outputs: ["Effectiveness", "Risk Level", "Overall Score"] },
      { type: "choice_set", question: `Which factor do you think has the most impact on ${moduleTitle.toLowerCase()}?`, emoji: "🤔", choices: [
        { text: `High ${label1}`, feedback: `Increasing ${label1.toLowerCase()} boosts effectiveness but may increase risk.`, effects: { [label1]: 80, [label2]: 30 }, is_best: false },
        { text: `Balanced approach`, feedback: `A balanced approach provides steady results with manageable risk.`, effects: { [label1]: 50, [label2]: 50, [label3]: 50 }, is_best: true },
        { text: `Focus on ${label3}`, feedback: `Prioritizing ${label3.toLowerCase()} can yield high scores but requires careful management.`, effects: { [label3]: 90, [label1]: 20 }, is_best: false },
      ]},
      { type: "insight", content: `The key takeaway: in ${moduleTitle.toLowerCase()}, no single variable works in isolation. Understanding the relationships between factors is essential for making informed decisions.` },
    ],
    completion_rule: "all_choices",
    rules: [
      { condition: `${label1} > 80`, effects: { [label2]: -10 }, message: `⚠️ High ${label1.toLowerCase()} is putting pressure on ${label2.toLowerCase()}!` },
      { condition: `${label3} < 20`, effects: {}, message: `💡 Low ${label3.toLowerCase()} may limit your overall effectiveness.` },
    ],
    formulas: {
      "Effectiveness": `(${label1} * 0.4 + ${label2} * 0.3 + ${label3} * 0.3)`,
      "Risk Level": `Math.max(0, ${label1} - ${label3})`,
      "Overall Score": `(${label1} + ${label2} + ${label3}) / 3`,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRole = token === serviceRoleKey;

    const supabase = isServiceRole
      ? createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey!)
      : createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });

    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Unauthorized");
    }

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

    // Skip only if already done AND has actual lab data
    if (mod.lab_generation_status === "done") {
      // Check if lab_data actually exists
      const { data: fullMod } = await supabase
        .from("course_modules")
        .select("lab_data")
        .eq("id", moduleId)
        .single();
      
      if (fullMod?.lab_data && typeof fullMod.lab_data === "object" && Object.keys(fullMod.lab_data).length > 0) {
        return new Response(JSON.stringify({ status: "already_done" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Otherwise, regenerate — lab was marked done but has no data
      console.log(`[Lab Gen] Module "${moduleId}" was marked done but has no lab_data — regenerating`);
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
- Each lab focuses on ONE core graph concept
- Sliders MUST directly control equation parameters
- Graph MUST update in real-time when sliders move
- Set appropriate x_range and y_range
- Include a target the student must match
- The equation must use the slider variable names

=== GRAPH TYPES ===
- linear: y = mx + b
- quadratic: y = A(x-H)²+K
- exponential: y = a * b^x
- trig: y = A*sin(B*(x-C))+D
- custom: any equation with slider params

=== LESSON ALIGNMENT ===
Only use concepts from the lesson content provided.`;

      userPrompt = `Create an interactive GRAPH LAB for: "${moduleTitle}"
Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT ===
${lessonSummary}

Create a graph lab with 2-4 sliders, proper equation, target challenge, and axis ranges.`;

    } else if (labType === "flowchart") {
      toolSchema = flowchartToolSchema;
      toolName = "create_flowchart_lab";
      systemPrompt = `You are a PROCESS FLOWCHART LAB DESIGNER. Create interactive flowchart labs where students fill in process steps using dropdown menus.

=== RULES ===
- Create 4-8 ordered steps
- Each step: descriptive label + dropdown with 3-5 options
- One correct option per step, others are plausible distractors
- Process must come from the lesson content
- Steps must have clear logical order

=== LESSON ALIGNMENT ===
Only use processes explicitly taught in the lesson.`;

      userPrompt = `Create a FLOWCHART LAB for: "${moduleTitle}"
Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT ===
${lessonSummary}

Create a flowchart with 4-8 steps, each with label, correct answer, and 3-5 shuffled options.`;

    } else if (labType === "code_debugger") {
      toolSchema = codeDebuggerToolSchema;
      toolName = "create_code_debugger_lab";
      systemPrompt = `You are a CODE DEBUGGING LAB DESIGNER. Create labs where students find and fix bugs in code.

=== RULES ===
- 1-3 clear bugs in starter code
- Bugs relate to lesson concepts
- Short code (10-20 lines)
- Python by default unless lesson specifies another language
- Include 2-3 progressive hints
- Expected output must be simple and verifiable

=== LESSON ALIGNMENT ===
Bugs must test understanding of concepts from the lesson.`;

      userPrompt = `Create a CODE DEBUGGER LAB for: "${moduleTitle}"
Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT ===
${lessonSummary}

Create broken code (10-20 lines) with 1-3 bugs testing lesson concepts. Include expected output and hints.`;

    } else {
      // Default: simulation (universal slider lab)
      toolSchema = simulationToolSchema;
      toolName = "create_simulation_lab";

      // ─── DOMAIN-SPECIFIC EXAMPLE TEMPLATES (from blueprints) ───
      const domainTemplates = selectDomainTemplate(topic, moduleTitle, lessonContent);

      systemPrompt = `You are a SIMULATION SYSTEM DESIGNER creating SLIDER-BASED interactive labs. Students adjust sliders and see live outputs change.

=== CRITICAL: EVERY LAB MUST HAVE ===
1. 3-5 domain-specific slider variables with realistic units/ranges
2. At least 2 control_panel blocks for slider interaction
3. At least 1 output_display block with computed values
4. 1-2 choice_set blocks for strategic decisions
5. Formulas connecting slider values to outputs
6. Rules creating cause→effect relationships

=== VARIABLE DESIGN ===
- DOMAIN-SPECIFIC names (NEVER "quality", "efficiency" generically)
- Variables MUST interconnect via rules
- Use realistic units and ranges from the subject matter

=== ANTI-PATTERNS ===
- NO generic variable names
- NO "correct/incorrect" feedback — describe CONSEQUENCES
- NO labs where sliders don't affect outputs
- NO step_task blocks

=== LESSON ALIGNMENT ===
ONLY use concepts from the lesson content provided.

=== DOMAIN-SPECIFIC REFERENCE TEMPLATES ===
Use these as inspiration for the variable names, units, ranges, and outputs. Pick the best match for the topic:

${domainTemplates}`;

      userPrompt = `Design an interactive SLIDER SIMULATION for: "${moduleTitle}"
Topic: ${topic}
Concept: ${labConcept}

=== LESSON CONTENT (use ONLY these concepts) ===
${lessonSummary}

REQUIREMENTS:
1. 3-5 domain-specific slider variables (see templates above for examples)
2. At least 2 control_panel blocks
3. At least 1 output_display block with live values
4. 3-5 rules creating cause→effect relationships
5. 2-4 formulas for derived outputs
6. 1-2 choice_set blocks with tradeoff decisions
7. Clear measurable goal`;
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
          model: "gpt-4o-mini",
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
        if (labType === "simulation" && blueprint.variables?.length > 0 && blueprint.blocks?.length > 0) break;
        
        if (blueprint && typeof blueprint === "object") break;
      } catch (e: any) {
        lastGenError = e.message || "Unknown generation error";
        console.warn(`Gen attempt ${genAttempt} failed: ${lastGenError}`);
        if (e.message?.includes("credits")) throw e;
      }
    }

    // ═══ GUARANTEED FALLBACK: NEVER FAIL TO GENERATE A LAB ═══
    if (!blueprint || typeof blueprint !== "object") {
      console.log(`[Fallback] AI generation failed for "${moduleTitle}", creating deterministic slider lab`);
      blueprint = createFallbackSliderLab(topic, moduleTitle);
    }

    // If simulation but has no variables or blocks, also fallback
    if (labType === "simulation" && (!blueprint.variables?.length || !blueprint.blocks?.length)) {
      console.log(`[Fallback] Simulation blueprint empty for "${moduleTitle}", using fallback slider lab`);
      blueprint = createFallbackSliderLab(topic, moduleTitle);
    }

    // Ensure lab_type is set
    blueprint.lab_type = blueprint.lab_type || labType;

    // ── Post-processing by lab type ──

    if (blueprint.lab_type === "simulation" || labType === "simulation") {
      if (!Array.isArray(blueprint.blocks)) blueprint.blocks = [];
      if (!Array.isArray(blueprint.variables)) blueprint.variables = [];

      // Repair variables
      for (const v of blueprint.variables) {
        v.min = typeof v.min === "number" ? v.min : 0;
        v.max = typeof v.max === "number" ? v.max : 100;
        v.default = Math.max(v.min, Math.min(v.max, typeof v.default === "number" ? v.default : 50));
      }

      // Filter out step_task blocks
      blueprint.blocks = blueprint.blocks.filter((b: any) => b.type !== "step_task");

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
    }

    if (labType === "flowchart") {
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
      if (Array.isArray(blueprint.sliders)) {
        blueprint.sliders = blueprint.sliders.map((s: any) => ({
          ...s,
          step: s.step || 0.1,
          default: typeof s.default === "number" ? s.default : 1,
        }));
      }
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

    console.log(`✅ Lab generated for "${moduleTitle}" → type: ${labType}, kind: ${blueprint.kind || labType}`);

    return new Response(JSON.stringify({ status: "done", blueprint }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LAB GENERATION ERROR:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
