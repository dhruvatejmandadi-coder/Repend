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

// ─── DOMAIN-SPECIFIC TEMPLATES (from PDF blueprints) ───
// Each template provides specific variable names, units, ranges, and outputs
// so the AI generates labs matching the blueprint specifications.

const DOMAIN_TEMPLATES: Record<string, string> = {
  // ── EduLabs PDF: STEM ──
  trigonometry: `TRIGONOMETRY: Sliders: Angle θ (0-360°), Amplitude A (0.1-5), Frequency B (0.1-5), Phase Shift C (-π to π), Vertical Shift D (-5 to 5). Outputs: sin(θ), cos(θ), tan(θ). Show unit circle connection.`,
  
  statistics: `STATISTICS: Sliders: Mean μ (-5 to 5), Standard Deviation σ (0.5 to 3), Sample Size n (10 to 1000). Outputs: Histogram shape, Confidence Interval, Z-score, Skewness. Toggle between Normal/Binomial/Uniform distributions.`,
  
  economics: `ECONOMICS (Supply & Demand): Sliders: Supply Curve Shift (-50% to +50%), Demand Curve Shift (-50% to +50%), Price Floor/Ceiling, Tax/Subsidy (0-30%). Outputs: Equilibrium Price, Equilibrium Quantity, Consumer Surplus, Producer Surplus, Deadweight Loss, Elasticity.`,
  
  physics: `PHYSICS (Projectile Motion): Sliders: Launch Angle (0-90°), Initial Velocity (5-50 m/s), Gravity (0.5-10 m/s²), Air Resistance toggle. Outputs: Time-to-Impact, Maximum Height, Range, Horizontal/Vertical velocity components.`,
  
  chemistry: `CHEMISTRY (Reaction Rate): Sliders: Temperature (250-400K), Catalyst Strength (0-100% Ea reduction), Concentration (0.1-2.0 M), Pressure (1-10 atm). Outputs: Reaction Rate, Collision Frequency, Equilibrium Constant Keq, Activation Energy diagram. Show Le Chatelier's principle.`,
  
  biology: `BIOLOGY (Population Dynamics): Sliders: Birth Rate (0-0.5), Death Rate (0-0.3), Carrying Capacity (100-10000), Predation Rate (0-0.2). Outputs: Current Population, Growth Rate %, Doubling Time, Stability indicator. Toggle Predator-Prey mode for oscillation.`,
  
  medicine: `MEDICINE (Pharmacokinetics): Sliders: Dose Amount (10-500 mg), Dosing Interval (4-24 hrs), Drug Half-life (2-48 hrs), Body Weight (50-150 kg), Liver Function (50-150%), Kidney Function (50-150%). Outputs: Clearance Rate, Bioavailability, Peak Concentration, Accumulation Factor, Toxicity Risk. Show therapeutic window.`,
  
  law: `LAW (Criminal Trial): Sliders: Evidence Strength (0-100), Defense Rebuttal (0-100), Witness Credibility (0-100), Jury Bias (-50 to +50). Outputs: Guilty Verdict Probability %, Confidence Interval, Influencing Factors breakdown. Show burden of proof threshold.`,
  
  environmental: `ENVIRONMENTAL SCIENCE (Carbon Cycle): Sliders: Fossil Fuel Emissions (0-100%), Deforestation Rate (0-100%), Renewable Energy Adoption (0-100%), Ocean Absorption (0-100%), Reforestation (0-100%). Outputs: CO₂ Concentration (ppm), Temperature Anomaly (°C), Carbon Budget breakdown, Time to Carbon Neutrality (years), Tipping Point status.`,
  
  psychology: `PSYCHOLOGY (Cognitive Bias): Sliders: Confirmation Bias (0-100%), Anchoring Bias (0-100%), Availability Heuristic (0-100%), Recency Bias (0-100%). Outputs: Decision Quality Score (/100), Accuracy %, Confidence %, Bias Impact Breakdown. Show debiasing strategies.`,
  
  astronomy: `ASTRONOMY (Orbital Mechanics): Sliders: Orbital Eccentricity (0-0.9), Semi-Major Axis (1-10 AU), Central Mass (0.5-2 solar masses), Initial Velocity (5-50 km/s). Outputs: Orbital Period (days), Escape Velocity (km/s), Aphelion Distance (AU), Perihelion Distance (AU). Demonstrate Kepler's Laws.`,
  
  genetics: `GENETICS (Mendelian Inheritance): Sliders: Parent 1 Genotype (AA/Aa/aa), Parent 2 Genotype (AA/Aa/aa), Sample Size (10-1000). Outputs: Genotype Ratios, Phenotype Distribution, Chi-Square test result, Hardy-Weinberg equilibrium check. Show Punnett Square.`,

  // ── Cybersecurity PDF: PLTW Units ──
  phishing: `CYBERSECURITY (Phishing & Password): Sliders: Password Length (4-24 chars), Character Variety (1-4 types), Phishing Awareness (0-100%), MFA Enabled (0 or 100%). Outputs: Password Entropy (bits), Crack Time estimate, Phishing Detection Rate %, Account Security Score. Scenario: analyze suspicious email for red flags.`,
  
  server_hardening: `CYBERSECURITY (Server Hardening): Sliders: Patch Level (0-100%), Access Control Strictness (0-100%), Encryption Strength (0-100%), Logging Verbosity (0-100%). Outputs: Vulnerability Score, CIA Triad Compliance (Confidentiality/Integrity/Availability), Attack Surface area, Compliance Rating.`,
  
  network_security: `CYBERSECURITY (Packet Analysis & Defense): Sliders: Firewall Strictness (0-100%), IDS Sensitivity (0-100%), Traffic Volume (low/med/high as 0-100), Encryption Level (0-100%). Outputs: Threat Detection Rate %, False Positive Rate %, Network Throughput, Blocked Attacks count. Scenario: detect Man-in-the-Middle attack.`,
  
  wireless_security: `CYBERSECURITY (Wireless Authentication): Sliders: Signal Strength (-90 to -20 dBm), Protocol Security (WEP=20/WPA2=70/WPA3=100), Rogue AP Distance (1-100m), Authentication Timeout (1-30s). Outputs: Connection Security Score, Handshake Vulnerability, Rogue AP Detection probability, Network Integrity.`,
  
  forensics: `CYBERSECURITY (Digital Forensics): Sliders: Evidence Collection Thoroughness (0-100%), Chain of Custody Integrity (0-100%), Analysis Depth (0-100%), Time Since Breach (1-720 hrs). Outputs: Evidence Admissibility %, Data Recovery Rate %, Case Strength Score, Investigation Completeness.`,
  
  cryptography: `CYBERSECURITY (Cryptography & Steganography): Sliders: Key Length (64-4096 bits), Cipher Complexity (0-100%), Frequency Analysis Depth (0-100%), Steganography Detection Level (0-100%). Outputs: Encryption Strength, Decryption Probability %, Hidden Data Detection %, Computational Cost.`,

  // ── Interactive Labs Blueprint PDF: AI & Tech ──
  prompt_engineering: `AI (Prompt Engineering): Sliders: Temperature (0-2.0), Max Tokens (50-4000), Prompt Specificity (0-100%), Few-Shot Examples (0-5). Outputs: Output Quality Score, Similarity Score, Response Length, Hallucination Risk %. Compare zero-shot vs few-shot vs chain-of-thought.`,
  
  neural_network: `AI (Neural Network Visualizer): Sliders: Hidden Layers (1-5), Neurons per Layer (2-16), Learning Rate (0.001-1.0), Training Epochs (10-500). Outputs: Accuracy %, Training Loss, Overfitting Indicator, Decision Boundary complexity.`,
  
  financial_modeling: `BUSINESS (Financial Modeling): Sliders: Revenue Growth (0-15%), EBITDA Margin (10-40%), WACC (5-15%), Terminal Growth (1-5%). Outputs: Revenue forecast, Net Income, DCF Valuation, EV/EBITDA multiple. Show 3-statement model impact.`,
  
  project_management: `BUSINESS (Project Management): Sliders: Scope (0-100%), Resources (0-100%), Timeline Pressure (0-100%), Risk Tolerance (0-100%). Outputs: Project Completion Probability %, Budget Overrun %, Critical Path length, Team Morale. Show scope creep effects.`,
  
  marketing_funnel: `BUSINESS (Marketing Funnel): Sliders: Ad Spend ($0-$10000), Conversion Rate (0-20%), Customer LTV ($0-$500), Churn Rate (0-30%). Outputs: LTV/CAC Ratio, Monthly Revenue, Payback Period, Viral Coefficient. Show funnel stages.`,
  
  negotiation: `SOFT SKILLS (Negotiation): Sliders: Opening Offer Aggressiveness (0-100%), Concession Rate (0-100%), Emotional Intelligence (0-100%), BATNA Strength (0-100%). Outputs: Deal Probability %, Surplus Captured %, Relationship Score, ZOPA range. Show anchoring effects.`,
  
  structural_engineering: `ENGINEERING (Structural): Sliders: Load Weight (100-10000 kg), Beam Length (1-20m), Material Strength (100-1000 MPa), Safety Factor (1-5). Outputs: Stress (MPa), Deflection (mm), Factor of Safety, Collapse Risk %. Show tension vs compression.`,

  // ── Universal fallback ──
  generic: `UNIVERSAL: Sliders: Variable A (0-100), Variable B (0-100), Variable C (0-100). Outputs: Effectiveness, Risk Level, Overall Score. The key is that each slider must have domain-specific names from the actual topic being taught. NEVER use generic names.`,
};

function selectDomainTemplate(topic: string, moduleTitle: string, lessonContent: string): string {
  const combined = `${topic} ${moduleTitle} ${lessonContent}`.toLowerCase();
  
  const matchMap: [string[], string][] = [
    [["trigonometr", "sine", "cosine", "unit circle", "radian"], "trigonometry"],
    [["statistic", "distribution", "standard deviation", "z-score", "histogram", "probability"], "statistics"],
    [["supply and demand", "elasticity", "equilibrium", "surplus", "deadweight", "gdp", "fiscal", "monetary policy"], "economics"],
    [["projectile", "kinematics", "newton", "friction", "momentum", "velocity", "acceleration"], "physics"],
    [["reaction rate", "catalyst", "activation energy", "le chatelier", "molarity", "titration", "chemical reaction"], "chemistry"],
    [["population", "ecosystem", "predator", "prey", "carrying capacity", "birth rate", "food chain", "natural selection"], "biology"],
    [["pharmacokinetic", "drug", "dosage", "half-life", "plasma concentration", "bioavailability", "therapeutic"], "medicine"],
    [["trial", "verdict", "prosecution", "evidence strength", "jury", "burden of proof", "witness credibility"], "law"],
    [["carbon cycle", "emission", "climate", "deforestation", "renewable energy", "greenhouse", "carbon neutral"], "environmental"],
    [["cognitive bias", "confirmation bias", "anchoring", "heuristic", "decision quality", "behavioral"], "psychology"],
    [["orbital", "kepler", "eccentricity", "semi-major axis", "escape velocity", "celestial"], "astronomy"],
    [["genotype", "phenotype", "punnett", "allele", "mendelian", "heredity", "inheritance"], "genetics"],
    [["phishing", "password", "social engineering", "mfa", "two-factor"], "phishing"],
    [["server hardening", "patch", "vulnerability scan", "cia triad", "access control list"], "server_hardening"],
    [["packet", "firewall", "intrusion detection", "man-in-the-middle", "tcp/ip", "network security"], "network_security"],
    [["wireless", "wpa", "rogue access point", "handshake", "wifi", "signal strength"], "wireless_security"],
    [["forensic", "evidence handling", "chain of custody", "data recovery", "digital evidence"], "forensics"],
    [["encryption", "cipher", "steganography", "cryptograph", "frequency analysis", "decryption"], "cryptography"],
    [["prompt engineering", "llm", "few-shot", "chain-of-thought", "temperature"], "prompt_engineering"],
    [["neural network", "deep learning", "backpropagation", "hidden layer", "activation function"], "neural_network"],
    [["financial model", "dcf", "ebitda", "revenue growth", "valuation", "capital structure"], "financial_modeling"],
    [["project management", "critical path", "gantt", "scope creep", "agile", "waterfall"], "project_management"],
    [["marketing funnel", "conversion rate", "ltv", "cac", "churn", "viral"], "marketing_funnel"],
    [["negotiation", "batna", "zopa", "anchoring", "concession", "integrative bargaining"], "negotiation"],
    [["structural", "stress", "load", "beam", "tensile", "compression", "bridge", "material"], "structural_engineering"],
  ];
  
  let bestMatch = "generic";
  let bestScore = 0;
  
  for (const [keywords, templateKey] of matchMap) {
    let score = 0;
    for (const kw of keywords) {
      if (combined.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = templateKey;
    }
  }
  
  // Return the best match + generic as fallback guidance
  const template = DOMAIN_TEMPLATES[bestMatch] || DOMAIN_TEMPLATES.generic;
  // Also include 2 random other templates for variety awareness
  const otherKeys = Object.keys(DOMAIN_TEMPLATES).filter(k => k !== bestMatch && k !== "generic");
  const shuffled = otherKeys.sort(() => Math.random() - 0.5).slice(0, 2);
  const extras = shuffled.map(k => DOMAIN_TEMPLATES[k]).join("\n\n");
  
  return `PRIMARY MATCH:\n${template}\n\nOTHER EXAMPLES (for variety reference):\n${extras}`;
}

// ─── ADAPTIVE LAB TYPE SELECTION ───
// Weighted scoring: picks the best-matching lab type per module independently.
// KEY RULE: graph is ONLY for math/science with actual equations.
// Simulation is the universal fallback and preferred for most topics.

type LabCandidate = { type: string; score: number };

// Topics that should NEVER get graph labs (they don't have plottable equations)
const GRAPH_BLOCKLIST_DOMAINS = [
  "cybersecurity", "cyber", "security", "hacking", "phishing", "malware",
  "law", "legal", "trial", "court",
  "business", "marketing", "management", "negotiation", "leadership",
  "cooking", "culinary", "recipe",
  "history", "geography", "politics", "sociology",
  "art", "music", "writing", "literature", "philosophy",
  "fitness", "sports", "health",
];

// Topics that should NEVER get code_debugger labs (they're not about programming)
const CODE_BLOCKLIST_DOMAINS = [
  "law", "legal", "trial", "court",
  "cooking", "culinary", "recipe",
  "history", "geography", "politics", "sociology",
  "art", "music", "writing", "literature", "philosophy",
  "fitness", "sports", "health",
  "economics", "finance", "marketing", "business",
  "biology", "ecology", "anatomy",
  "psychology", "negotiation",
];

function classifyLabType(topic: string, moduleTitle: string, lessonContent: string): string {
  const combined = `${topic} ${moduleTitle} ${lessonContent}`.toLowerCase();
  const topicLower = topic.toLowerCase();
  const titleLower = moduleTitle.toLowerCase();

  // ── DOMAIN GUARDS: block inappropriate lab types ──
  const isGraphBlocked = GRAPH_BLOCKLIST_DOMAINS.some(d => topicLower.includes(d) || titleLower.includes(d));
  const isCodeBlocked = CODE_BLOCKLIST_DOMAINS.some(d => topicLower.includes(d) || titleLower.includes(d));

  const labProfiles: Record<string, { keywords: [string, number][] }> = {
    graph: {
      keywords: [
        // ONLY pure math/science graphing — no generic terms
        ["parabola", 5], ["quadratic", 5], ["polynomial", 4],
        ["slope", 4], ["intercept", 4], ["vertex", 4],
        ["exponential growth", 4], ["exponential decay", 4], ["logarithm", 4], ["asymptote", 4],
        // Trig / polar — strong signals
        ["trigonometr", 6], ["sine", 6], ["cosine", 6], ["tangent", 5],
        ["amplitude", 6], ["phase shift", 6], ["sinusoidal", 6],
        ["polar", 6], ["polar coordinate", 7], ["unit circle", 6],
        ["radian", 5], ["parametric", 5],
        ["y = ", 4], ["f(x)", 4],
        ["linear equation", 4], ["linear function", 4],
        // Statistics with actual plots
        ["histogram", 5], ["scatter plot", 5], ["box plot", 5],
        ["normal distribution", 5], ["probability distribution", 5],
        ["regression", 4], ["correlation", 4],
        // Physics with plottable equations
        ["ohm's law", 5], ["harmonic", 4], ["wavelength", 4],
        // Orbital mechanics
        ["orbital", 5], ["kepler", 6], ["eccentricity", 5], ["semi-major axis", 6],
        // Pharmacokinetics curves
        ["pharmacokinetic", 5], ["plasma concentration", 6],
      ],
    },
    code_debugger: {
      keywords: [
        // ONLY actual programming/coding tasks
        ["debug", 6], ["syntax error", 6], ["bug", 4],
        ["python", 5], ["javascript", 5], ["java ", 4],
        ["c++", 4], ["html", 4], ["css", 4],
        ["compile", 4], ["runtime error", 5],
        ["loop", 3], ["array", 3], ["recursion", 4],
        ["object-oriented", 4], ["oop", 4],
        // ONLY code-specific cyber (actual code exploitation)
        ["sql injection", 6], ["xss", 6], ["cross-site scripting", 6],
        ["code review", 5], ["source code", 5],
        // Web dev
        ["web development", 4], ["front-end", 4], ["back-end", 4],
        ["react", 4], ["typescript", 4],
        ["algorithm", 3], ["data structure", 4],
      ],
    },
    flowchart: {
      keywords: [
        ["workflow", 5], ["procedure", 4], ["step-by-step", 4],
        ["pipeline", 5], ["lifecycle", 5], ["methodology", 4],
        ["protocol", 4], ["sequence of steps", 5],
        ["design process", 5], ["scientific method", 5],
        ["sdlc", 6], ["agile", 4], ["waterfall", 5],
        ["decision tree", 5], ["flow chart", 6], ["flowchart", 6],
        // Biology processes
        ["cell division", 4], ["mitosis", 4], ["meiosis", 4],
        ["photosynthesis", 4], ["krebs cycle", 5], ["dna replication", 5],
        // Business processes
        ["supply chain", 5], ["onboarding", 4],
        ["hiring process", 5], ["customer journey", 5], ["sales pipeline", 5],
        // Cybersecurity processes — ONLY process-oriented ones
        ["incident response", 6], ["chain of custody", 6],
        ["evidence handling", 5], ["forensic process", 5],
        ["osi model", 6], ["tcp/ip", 5], ["dns resolution", 5],
        ["authentication flow", 5], ["handshake", 5],
        // Legal / medical processes
        ["trial process", 5], ["legal procedure", 5],
        ["triage", 5], ["clinical pathway", 5],
        // Logic
        ["logical fallac", 5], ["argument structure", 5],
        ["circuit", 4], ["logic gate", 5], ["boolean", 4],
      ],
    },
    simulation: {
      keywords: [
        // Physics
        ["physics", 3], ["projectile", 5], ["friction", 4], ["force", 3],
        ["acceleration", 4], ["momentum", 4], ["energy", 3], ["gravity", 4],
        ["thermodynamic", 4], ["heat transfer", 4], ["pressure", 3],
        ["velocity", 4], ["kinematics", 5], ["newton", 4],
        // Chemistry
        ["chemical reaction", 4], ["equilibrium", 3], ["concentration", 3],
        ["reaction rate", 5], ["activation energy", 5], ["catalyst", 4],
        ["le chatelier", 5], ["molarity", 4], ["titration", 4],
        // Biology
        ["population", 4], ["ecosystem", 5], ["predator", 5], ["prey", 5],
        ["natural selection", 4], ["food chain", 4],
        ["genetics", 4], ["punnett", 5], ["allele", 5],
        ["carrying capacity", 5], ["birth rate", 4],
        // Economics / Business
        ["supply and demand", 5], ["inflation", 5], ["interest rate", 5],
        ["market", 3], ["profit", 4], ["revenue", 4], ["investment", 4],
        ["budget", 4], ["pricing", 4], ["elasticity", 4],
        ["gdp", 4], ["monetary policy", 5], ["fiscal", 4],
        ["consumer surplus", 5], ["producer surplus", 5], ["deadweight loss", 5],
        // Finance
        ["portfolio", 4], ["compound interest", 5], ["cash flow", 4],
        ["valuation", 4], ["dcf", 5], ["roi", 4],
        // Health / medicine
        ["nutrition", 4], ["metabolism", 4], ["calorie", 4],
        ["pharmacology", 5], ["dose", 3], ["half-life", 4],
        ["bioavailability", 5], ["therapeutic", 4], ["toxicity", 4],
        // Psychology / behavior
        ["cognitive bias", 6], ["confirmation bias", 5], ["anchoring", 5],
        ["heuristic", 4], ["psychology", 4], ["behavioral", 4],
        // Negotiation / soft skills
        ["negotiation", 5], ["conflict resolution", 4], ["persuasion", 4],
        ["emotional intelligence", 4],
        // Engineering
        ["structural", 4], ["load", 3], ["bridge", 4], ["tensile", 4],
        // Environmental
        ["climate", 4], ["carbon", 4], ["emission", 4], ["sustainability", 4],
        ["renewable", 4], ["carbon cycle", 5], ["greenhouse", 4],
        // Law
        ["evidence strength", 5], ["verdict", 5], ["prosecution", 4],
        ["jury", 4], ["burden of proof", 5], ["reasonable doubt", 5],
        // ── CYBERSECURITY (STRONG simulation preference) ──
        ["cybersecurity", 6], ["cyber security", 6], ["cyber", 5],
        ["security", 4], ["threat", 4], ["attack", 4],
        ["password", 5], ["password strength", 6], ["entropy", 4],
        ["phishing", 6], ["social engineering", 5],
        ["server hardening", 6], ["access control", 5],
        ["firewall", 5], ["intrusion detection", 5],
        ["encryption", 5], ["encryption strength", 6],
        ["cipher", 4], ["steganography", 5], ["cryptography", 5],
        ["network security", 6], ["wireless security", 5],
        ["rogue access point", 5], ["signal strength", 4],
        ["vulnerability", 5], ["malware", 5], ["ransomware", 5],
        ["data privacy", 5], ["data breach", 5], ["data protection", 5],
        ["mfa", 5], ["two-factor", 5], ["authentication", 4],
        ["forensic", 4], ["digital forensic", 5],
        ["exploit", 4], ["penetration test", 5],
        // General
        ["optimize", 3], ["tradeoff", 4], ["trade-off", 4],
        ["simulation", 6], ["model", 2], ["system", 1],
        ["cause and effect", 4],
      ],
    },
  };

  const candidates: LabCandidate[] = [];

  for (const [labType, profile] of Object.entries(labProfiles)) {
    // ── Apply domain guards ──
    if (labType === "graph" && isGraphBlocked) continue;
    if (labType === "code_debugger" && isCodeBlocked) continue;

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

  // For graph to win, it needs a MUCH higher score than simulation (graph is specialized)
  if (candidates.length >= 2 && candidates[0].type === "graph") {
    const simCandidate = candidates.find(c => c.type === "simulation");
    if (simCandidate && candidates[0].score < simCandidate.score + 8) {
      // Graph doesn't have a strong enough lead — prefer simulation
      console.log(`[Lab Selection] Graph score ${candidates[0].score} not strong enough vs simulation ${simCandidate.score}, preferring simulation`);
      return "simulation";
    }
  }

  // For code_debugger to win, the module title must actually be about code
  if (candidates.length >= 1 && candidates[0].type === "code_debugger") {
    const codeSignals = ["code", "coding", "program", "debug", "python", "javascript", "sql injection", "xss", "script"];
    const titleHasCode = codeSignals.some(s => titleLower.includes(s));
    if (!titleHasCode) {
      // Module title isn't about code — fall to next candidate or simulation
      const alt = candidates.find(c => c.type !== "code_debugger");
      if (alt) {
        console.log(`[Lab Selection] code_debugger won but title "${moduleTitle}" isn't about coding, using ${alt.type} instead`);
        return alt.type;
      }
      console.log(`[Lab Selection] code_debugger won but title "${moduleTitle}" isn't about coding, defaulting to simulation`);
      return "simulation";
    }
  }

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

    const { moduleId, force } = await req.json();
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

    // Skip only if already done AND has actual lab data, unless force=true
    if (mod.lab_generation_status === "done" && !force) {
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
      console.log(`[Lab Gen] Module "${moduleId}" was marked done but has no lab_data — regenerating`);
    }

    await supabase.from("course_modules").update({ lab_generation_status: "generating" }).eq("id", moduleId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

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
2. At least 1 control_panel block for slider interaction
3. At least 1 output_display block with computed values
4. 1-2 choice_set blocks for strategic decisions
5. Formulas connecting slider values to outputs
6. Rules creating cause→effect relationships

=== STRICT JSON VALIDITY RULES ===
- ALL formula keys and output labels must be plain readable names
- EVERY output_display output MUST have a matching formula with the exact same label
- EVERY rule condition MUST be a valid mathjs expression
- Only use comparisons like: variable_name > 50, variable_name <= 80, a + b > 100
- DO NOT use percent signs in conditions
- DO NOT use words like "with low", "and high", or natural language in conditions
- Choice effects must use realistic values within each variable's own min/max range
- Do NOT set every variable to the same number

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
2. At least 1 control_panel block listing the variables it controls
3. At least 1 output_display block with live values
4. 3-5 rules using VALID math expressions only
5. 2-4 formulas for derived outputs, one for each output label
6. 1-2 choice_set blocks with realistic tradeoff decisions
7. Clear measurable goal
8. Return formulas and rules that can actually run`;

    }

    let blueprint: any = null;
    let lastGenError = "";

    for (let genAttempt = 0; genAttempt < 3; genAttempt++) {
      if (genAttempt > 0) {
        console.log(`Retry attempt ${genAttempt} for "${moduleTitle}" (${labType})...`);
        await new Promise(r => setTimeout(r, genAttempt * 2000));
      }
      try {
        const aiData = await callAI(LOVABLE_API_KEY, {
          model: "google/gemini-2.5-flash",
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

    // ═══ VALIDATION + NORMALIZATION LAYER ═══
    const _validation_warnings: string[] = [];
    let criticalErrors = 0;

    if (blueprint.lab_type === "simulation" || labType === "simulation") {
      if (!Array.isArray(blueprint.blocks)) blueprint.blocks = [];
      if (!Array.isArray(blueprint.variables)) blueprint.variables = [];
      if (!blueprint.formulas || typeof blueprint.formulas !== "object") blueprint.formulas = {};
      if (!Array.isArray(blueprint.rules)) blueprint.rules = [];

      // ── 1. Variable range validation ──
      for (const v of blueprint.variables) {
        // Sanitize variable name: no special chars
        const origName = v.name;
        v.name = String(v.name || "Variable").replace(/[^a-zA-Z0-9_ ]/g, "").trim() || "Variable";
        if (origName !== v.name) _validation_warnings.push(`Renamed var "${origName}" → "${v.name}"`);

        v.min = typeof v.min === "number" ? v.min : 0;
        v.max = typeof v.max === "number" ? v.max : 100;
        if (v.min >= v.max) { v.min = 0; v.max = 100; _validation_warnings.push(`Fixed inverted range for "${v.name}"`); criticalErrors++; }
        v.default = Math.max(v.min, Math.min(v.max, typeof v.default === "number" ? v.default : (v.min + v.max) / 2));
        if (!v.unit) v.unit = "%";
        if (!v.icon) v.icon = "📊";
        if (!v.description) v.description = `Controls the ${v.name.toLowerCase()} level`;
      }

      const varNames = blueprint.variables.map((v: any) => v.name);

      // ── 2. Formula validation ──
      const newFormulas: Record<string, string> = {};
      for (const [key, formula] of Object.entries(blueprint.formulas)) {
        const cleanKey = String(key).replace(/[^a-zA-Z0-9_ ]/g, "").trim();
        if (!cleanKey) { _validation_warnings.push(`Dropped formula with invalid key "${key}"`); criticalErrors++; continue; }
        const formulaStr = String(formula);
        // Reject formulas with natural language / percent signs / comparison operators used as logic
        if (/[%]/.test(formulaStr) || /\b(with|and|or|the|is|has|if|then)\b/i.test(formulaStr)) {
          _validation_warnings.push(`Replaced invalid formula "${cleanKey}": "${formulaStr}"`);
          criticalErrors++;
          // Replace with simple average of all variables
          newFormulas[cleanKey] = varNames.length > 0
            ? `(${varNames.map(n => `\`${n}\``).join(" + ")}) / ${varNames.length}`
            : "50";
        } else {
          newFormulas[cleanKey] = formulaStr;
        }
      }
      blueprint.formulas = newFormulas;

      // ── 3. Block validation: ensure control_panel and output_display exist ──
      const hasControlPanel = blueprint.blocks.some((b: any) => b.type === "control_panel");
      const hasOutputDisplay = blueprint.blocks.some((b: any) => b.type === "output_display");

      if (!hasControlPanel && varNames.length > 0) {
        blueprint.blocks.unshift({ type: "control_panel", prompt: "Adjust the variables:", variables: varNames });
        _validation_warnings.push("Added missing control_panel block");
      }

      if (!hasOutputDisplay) {
        const outputNames = Object.keys(blueprint.formulas);
        if (outputNames.length === 0) {
          // Add default formulas
          blueprint.formulas["Effectiveness"] = varNames.length > 0
            ? `(${varNames.map(n => `\`${n}\``).join(" + ")}) / ${varNames.length}` : "50";
          blueprint.formulas["Impact Score"] = varNames.length >= 2
            ? `\`${varNames[0]}\` * 0.6 + \`${varNames[1]}\` * 0.4` : "50";
          _validation_warnings.push("Added default formulas (none provided)");
        }
        blueprint.blocks.push({ type: "output_display", prompt: "Observe the results:", outputs: Object.keys(blueprint.formulas) });
        _validation_warnings.push("Added missing output_display block");
      } else {
        // Ensure every output has a matching formula
        for (const block of blueprint.blocks) {
          if (block.type === "output_display" && Array.isArray(block.outputs)) {
            for (const output of block.outputs) {
              if (!blueprint.formulas[output]) {
                blueprint.formulas[output] = varNames.length > 0
                  ? `(${varNames.map(n => `\`${n}\``).join(" + ")}) / ${varNames.length}` : "50";
                _validation_warnings.push(`Added missing formula for output "${output}"`);
              }
            }
          }
        }
      }

      // ── 4. Rule condition validation ──
      blueprint.rules = blueprint.rules.filter((r: any) => {
        if (!r.condition || typeof r.condition !== "string") return false;
        const cond = r.condition;
        // Allow only: variable names, numbers, operators, spaces, backticks
        if (/[%$#@!?]/.test(cond) || /\b(with|and|or|the|is|has|if|then|high|low|very)\b/i.test(cond)) {
          _validation_warnings.push(`Stripped invalid rule condition: "${cond}"`);
          criticalErrors++;
          return false;
        }
        if (!r.effects || typeof r.effects !== "object") r.effects = {};
        if (!r.message) r.message = "⚠️ Threshold reached!";
        return true;
      });

      // ── 5. Choice effects validation ──
      // Filter out step_task blocks
      blueprint.blocks = blueprint.blocks.filter((b: any) => b.type !== "step_task");

      for (const block of blueprint.blocks) {
        if (block.type === "choice_set" && Array.isArray(block.choices)) {
          for (const choice of block.choices) {
            if (!choice.effects || typeof choice.effects !== "object") choice.effects = {};
            for (const vn of varNames) {
              if (typeof choice.effects[vn] === "number") {
                const v = blueprint.variables.find((x: any) => x.name === vn);
                if (v) choice.effects[vn] = Math.max(v.min, Math.min(v.max, choice.effects[vn]));
              } else {
                // Set a reasonable default
                const v = blueprint.variables.find((x: any) => x.name === vn);
                choice.effects[vn] = v ? Math.round((v.min + v.max) / 2) : 50;
              }
            }
          }
        }
      }

      // ── 6. If too many critical errors, use fallback ──
      if (criticalErrors > 3) {
        console.log(`[Validation] ${criticalErrors} critical errors for "${moduleTitle}", switching to fallback`);
        _validation_warnings.push(`FALLBACK TRIGGERED: ${criticalErrors} critical errors`);
        blueprint = createFallbackSliderLab(topic, moduleTitle);
        blueprint.lab_type = "simulation";
      }

      // Add insight if missing
      const hasInsight = blueprint.blocks.some((b: any) => b.type === "insight");
      if (!hasInsight && blueprint.key_insight) {
        blueprint.blocks.push({ type: "insight", content: blueprint.key_insight });
      }

      blueprint.completion_rule = blueprint.completion_rule || "all_choices";
    }

    // Store validation warnings for debugging
    if (_validation_warnings.length > 0) {
      blueprint._validation_warnings = _validation_warnings;
      console.log(`[Validation] ${_validation_warnings.length} warnings for "${moduleTitle}":`, _validation_warnings);
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
