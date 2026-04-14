import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── CLAUDE API CALLER ───
// Returns the tool input JSON directly after one round-trip.

// callClaude: force a specific tool (used as fallback)
async function callClaude(
  apiKey: string,
  system: string,
  userMsg: string,
  tools: any[],
  toolName: string,
  retries = 2,
): Promise<any> {
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 4096,
          system,
          tools,
          tool_choice: { type: "tool", name: toolName },
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      if (response.status === 429) {
        lastError = "Rate limit exceeded.";
        continue;
      }
      const text = await response.text();
      if (!response.ok) {
        lastError = `Claude error (${response.status}): ${text.slice(0, 300)}`;
        continue;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        lastError = "Invalid JSON response from Claude.";
        continue;
      }

      const toolUseBlock = parsed.content?.find((c: any) => c.type === "tool_use");
      if (!toolUseBlock) {
        lastError = "Claude did not return a tool_use block.";
        continue;
      }
      return toolUseBlock.input;
    } catch (e: any) {
      lastError = e.message || "Network error.";
    }
  }
  throw new Error(lastError || "Claude call failed after retries.");
}

// callClaudeAuto: Claude picks the best tool from ALL available tools.
// This is the primary entry point — no keyword matching, Claude decides pedagogically.
async function callClaudeAuto(
  apiKey: string,
  system: string,
  userMsg: string,
  tools: any[],
  retries = 2,
): Promise<{ toolName: string; input: any }> {
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 4096,
          system,
          tools,
          tool_choice: { type: "any" }, // Claude picks the most appropriate activity
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      if (response.status === 429) { lastError = "Rate limit."; continue; }
      const text = await response.text();
      if (!response.ok) { lastError = `Claude error (${response.status}): ${text.slice(0, 300)}`; continue; }
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { lastError = "Invalid JSON."; continue; }
      const toolUseBlock = parsed.content?.find((c: any) => c.type === "tool_use");
      if (!toolUseBlock) { lastError = "No tool_use block."; continue; }
      return { toolName: toolUseBlock.name, input: toolUseBlock.input };
    } catch (e: any) {
      lastError = e.message || "Network error.";
    }
  }
  throw new Error(lastError || "Claude auto-select failed after retries.");
}

// ─── TOOL SCHEMAS (Claude input_schema format) ───

const simulationTool = {
  name: "create_simulation_lab",
  description:
    "Create an interactive SLIDER-BASED SIMULATION lab. Students adjust 2-5 sliders and see live outputs change. Every slider MUST affect at least one output.",
  input_schema: {
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
            type: {
              type: "string",
              enum: [
                "text", "choice_set", "slider", "control_panel",
                "output_display", "table", "chart", "insight", "diagram",
              ],
            },
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
            diagram_nodes: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, text: { type: "string" } },
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
};

const flowchartTool = {
  name: "create_flowchart_lab",
  description:
    "Create a FLOWCHART lab where students fill in the correct process steps via dropdowns.",
  input_schema: {
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
};

const codeDebuggerTool = {
  name: "create_code_debugger_lab",
  description: "Create a CODE DEBUGGER lab where students find and fix bugs in code.",
  input_schema: {
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
};

const graphTool = {
  name: "create_graph_lab",
  description:
    "Create a GRAPH lab where students manipulate mathematical functions via sliders and see the graph update in real-time.",
  input_schema: {
    type: "object",
    properties: {
      lab_type: { type: "string", const: "graph" },
      title: { type: "string" },
      goal: { type: "string" },
      graph_type: {
        type: "string",
        enum: ["linear", "quadratic", "exponential", "trig", "custom"],
      },
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
};

const matchingTool = {
  name: "create_matching_lab",
  description:
    "Create a MATCHING lab where students connect related pairs: terms to definitions, causes to effects, concepts to examples, etc. Best for vocabulary-heavy or relationship-heavy topics.",
  input_schema: {
    type: "object",
    properties: {
      lab_type: { type: "string", const: "matching" },
      title: { type: "string" },
      instructions: { type: "string" },
      pairs: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            left: { type: "string", description: "Term, concept, cause, or key phrase (short, max 6 words)" },
            right: { type: "string", description: "Definition, effect, or explanation (1-2 sentences)" },
          },
          required: ["id", "left", "right"],
        },
      },
      key_insight: { type: "string" },
    },
    required: ["lab_type", "title", "instructions", "pairs", "key_insight"],
  },
};

const orderingTool = {
  name: "create_ordering_lab",
  description:
    "Create an ORDERING lab where students arrange scrambled items into the correct sequence. Best for timelines, historical events, scientific processes, algorithms, or step-by-step procedures.",
  input_schema: {
    type: "object",
    properties: {
      lab_type: { type: "string", const: "ordering" },
      title: { type: "string" },
      context: { type: "string", description: "Brief framing paragraph explaining what is being ordered." },
      items: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string", description: "A single step, event, or stage (max 15 words)" },
            correct_position: { type: "number", description: "1-indexed correct position in the sequence" },
          },
          required: ["id", "text", "correct_position"],
        },
      },
      key_insight: { type: "string" },
    },
    required: ["lab_type", "title", "context", "items", "key_insight"],
  },
};

const scenarioBuilderTool = {
  name: "create_scenario_builder_lab",
  description:
    "Create a SCENARIO BUILDER lab with a real-world narrative containing [BLANK_N] placeholders. Students select the correct word/phrase for each blank. Best for business decisions, ethical dilemmas, historical interpretation, and applied reasoning.",
  input_schema: {
    type: "object",
    properties: {
      lab_type: { type: "string", const: "scenario_builder" },
      title: { type: "string" },
      setup: { type: "string", description: "Optional 1-2 sentence framing context shown before the narrative." },
      narrative: {
        type: "string",
        description:
          "A 3-6 sentence scenario with [BLANK_0], [BLANK_1], [BLANK_2] etc. placeholders. Blanks should test understanding of key concepts.",
      },
      blanks: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Must match exactly a [BLANK_N] marker in the narrative, e.g. BLANK_0",
            },
            correct: { type: "string", description: "The correct word or phrase" },
            options: {
              type: "array",
              minItems: 3,
              maxItems: 4,
              items: { type: "string" },
              description: "3-4 options including the correct answer; all should be plausible",
            },
            explanation: {
              type: "string",
              description: "1 sentence explaining why the correct answer is right",
            },
          },
          required: ["id", "correct", "options", "explanation"],
        },
      },
      key_insight: { type: "string" },
    },
    required: ["lab_type", "title", "narrative", "blanks", "key_insight"],
  },
};

const highlightSelectTool = {
  name: "create_highlight_select_lab",
  description:
    "Create a HIGHLIGHT & SELECT lab where students tap/click ALL items that match a given criterion. There are multiple correct answers. Best for identifying examples vs non-examples, spotting exceptions, recognizing valid statements, or filtering a set.",
  input_schema: {
    type: "object",
    properties: {
      lab_type: { type: "string", const: "highlight_select" },
      title: { type: "string" },
      instruction: {
        type: "string",
        description: "Clear directive: 'Select ALL items that are examples of X' or 'Click every statement that is TRUE about Y'",
      },
      items: {
        type: "array",
        minItems: 5,
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string", description: "Short item text (max 20 words)" },
            is_correct: { type: "boolean" },
            explanation: { type: "string", description: "Why this item is correct or incorrect" },
          },
          required: ["id", "text", "is_correct", "explanation"],
        },
      },
      key_insight: { type: "string" },
    },
    required: ["lab_type", "title", "instruction", "items", "key_insight"],
  },
};

const debateBuilderTool = {
  name: "create_debate_builder_lab",
  description:
    "Create a DEBATE BUILDER lab where students sort statements into 'For' or 'Against' a given position. Best for ethics, policy debates, historical analysis, persuasive writing, pros/cons evaluation, and critical thinking.",
  input_schema: {
    type: "object",
    properties: {
      lab_type: { type: "string", const: "debate_builder" },
      title: { type: "string" },
      topic: { type: "string", description: "The debate proposition, e.g. 'Should X?' or 'X is beneficial'" },
      for_label: { type: "string", description: "Label for the FOR side (default: 'For')" },
      against_label: { type: "string", description: "Label for the AGAINST side (default: 'Against')" },
      statements: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string", description: "A clear argument statement (1-2 sentences)" },
            side: { type: "string", enum: ["for", "against"] },
            explanation: { type: "string", description: "Why this statement belongs to that side" },
          },
          required: ["id", "text", "side", "explanation"],
        },
      },
      key_insight: { type: "string" },
    },
    required: ["lab_type", "title", "topic", "statements", "key_insight"],
  },
};

const budgetAllocatorTool = {
  name: "create_budget_allocator_lab",
  description:
    "Create a BUDGET ALLOCATOR lab where students distribute a fixed total (100%) across categories using sliders. Best for resource allocation decisions: government budgets, personal finance, policy tradeoffs, energy portfolios, time management, ecosystem resources.",
  input_schema: {
    type: "object",
    properties: {
      lab_type: { type: "string", const: "budget_allocator" },
      title: { type: "string" },
      scenario: {
        type: "string",
        description: "2-3 sentence context placing the student in the decision-maker role",
      },
      unit: { type: "string", description: "Always '%' for percentage-based allocation" },
      categories: {
        type: "array",
        minItems: 3,
        maxItems: 7,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            icon: { type: "string", description: "Single emoji icon" },
            description: { type: "string", description: "1 sentence about what this category funds" },
            recommended_min: { type: "number", description: "Minimum % to avoid 'underfunded' warning" },
            recommended_max: { type: "number", description: "Maximum % before 'overfunded' warning" },
            explanation: { type: "string", description: "Feedback shown after submission" },
          },
          required: ["id", "name", "icon", "description", "recommended_min", "recommended_max", "explanation"],
        },
      },
      reflection: { type: "string", description: "Open-ended reflection question shown after submitting" },
      key_insight: { type: "string" },
    },
    required: ["lab_type", "title", "scenario", "categories", "key_insight"],
  },
};

const cohesiveTool = {
  name: "create_cohesive_lab",
  description:
    "Create a COHESIVE multi-activity lab with a narrative spine, persistent metrics, and unlock progression. Choose this for rich, complex topics where a single activity isn't enough — history, ethics, business, science processes, social topics. Contains 4-5 sequential activities of DIFFERENT types (classify_sort, branch_chain, build_order, match_chain, fill_lab). Each activity unlocks after the previous is complete. Ends with a graded final verdict.",
  input_schema: {
    type: "object",
    properties: {
      lab_type: { type: "string", const: "cohesive" },
      title: { type: "string" },
      narrative: { type: "string", description: "2-3 sentence mission statement placing the student in a real-world role connected to the topic" },
      metrics: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            icon: { type: "string", description: "Single emoji" },
            value: { type: "number", description: "Starting value" },
            max: { type: "number", description: "Maximum value" },
          },
          required: ["id", "label", "icon", "value", "max"],
        },
      },
      activities: {
        type: "array",
        minItems: 4,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["classify_sort", "branch_chain", "build_order", "match_chain", "fill_lab"] },
            title: { type: "string" },
            context: { type: "string", description: "1-2 sentences connecting this activity to the narrative" },
            metric_effects: { type: "object", description: "Which metrics change on completion, e.g. {trust: 15, budget: -10}" },
            categories: { type: "array", items: { type: "string" }, description: "classify_sort only: 2-4 category names" },
            items: {
              type: "array",
              description: "classify_sort only: 8-12 items to classify",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                  category: { type: "string" },
                  explanation: { type: "string" },
                },
                required: ["id", "text", "category", "explanation"],
              },
            },
            decisions: {
              type: "array",
              description: "branch_chain only: 3-4 sequential decisions",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  prompt: { type: "string" },
                  hint: { type: "string" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        consequence: { type: "string" },
                        is_best: { type: "boolean" },
                      },
                      required: ["text", "consequence", "is_best"],
                    },
                  },
                },
                required: ["id", "prompt", "options"],
              },
            },
            steps: {
              type: "array",
              description: "build_order only: 6-8 steps to arrange",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                  position: { type: "number" },
                },
                required: ["id", "text", "position"],
              },
            },
            par_time: { type: "number", description: "build_order only: seconds allowed (default 90)" },
            pairs: {
              type: "array",
              description: "match_chain only: 5-7 term-definition pairs",
              items: {
                type: "object",
                properties: {
                  left: { type: "string" },
                  right: { type: "string" },
                },
                required: ["left", "right"],
              },
            },
            template: { type: "string", description: "fill_lab only: passage with [BLANK_1], [BLANK_2] etc." },
            blanks: {
              type: "array",
              description: "fill_lab only",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correct: { type: "string" },
                  explanation: { type: "string" },
                },
                required: ["id", "options", "correct"],
              },
            },
          },
          required: ["id", "type", "title", "context", "metric_effects"],
        },
      },
      verdict_tiers: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            grade: { type: "string", enum: ["S", "A", "B", "C", "D"] },
            threshold: { type: "number", description: "Minimum score % (0-100) to reach this grade" },
            title: { type: "string", description: "Role/title earned, e.g. 'Master Strategist'" },
            description: { type: "string", description: "2 sentences describing what this outcome means" },
          },
          required: ["grade", "threshold", "title", "description"],
        },
      },
    },
    required: ["lab_type", "title", "narrative", "metrics", "activities", "verdict_tiers"],
  },
};

// ─── DOMAIN-SPECIFIC SIMULATION TEMPLATES ───

const DOMAIN_TEMPLATES: Record<string, string> = {
  trigonometry: `TRIGONOMETRY: Sliders: Angle θ (0-360°), Amplitude A (0.1-5), Frequency B (0.1-5), Phase Shift C (-π to π), Vertical Shift D (-5 to 5). Outputs: sin(θ), cos(θ), tan(θ). Show unit circle connection.`,
  statistics: `STATISTICS: Sliders: Mean μ (-5 to 5), Standard Deviation σ (0.5 to 3), Sample Size n (10 to 1000). Outputs: Histogram shape, Confidence Interval, Z-score, Skewness.`,
  economics: `ECONOMICS (Supply & Demand): Sliders: Supply Curve Shift (-50% to +50%), Demand Curve Shift (-50% to +50%), Price Floor/Ceiling, Tax/Subsidy (0-30%). Outputs: Equilibrium Price, Equilibrium Quantity, Consumer Surplus, Producer Surplus, Deadweight Loss, Elasticity.`,
  physics: `PHYSICS (Projectile Motion): Sliders: Launch Angle (0-90°), Initial Velocity (5-50 m/s), Gravity (0.5-10 m/s²). Outputs: Time-to-Impact, Maximum Height, Range.`,
  chemistry: `CHEMISTRY (Reaction Rate): Sliders: Temperature (250-400K), Catalyst Strength (0-100% Ea reduction), Concentration (0.1-2.0 M), Pressure (1-10 atm). Outputs: Reaction Rate, Equilibrium Constant Keq, Activation Energy.`,
  biology: `BIOLOGY (Population Dynamics): Sliders: Birth Rate (0-0.5), Death Rate (0-0.3), Carrying Capacity (100-10000), Predation Rate (0-0.2). Outputs: Current Population, Growth Rate %, Doubling Time.`,
  medicine: `MEDICINE (Pharmacokinetics): Sliders: Dose Amount (10-500 mg), Dosing Interval (4-24 hrs), Drug Half-life (2-48 hrs), Body Weight (50-150 kg). Outputs: Clearance Rate, Peak Concentration, Toxicity Risk.`,
  law: `LAW (Criminal Trial): Sliders: Evidence Strength (0-100), Defense Rebuttal (0-100), Witness Credibility (0-100), Jury Bias (-50 to +50). Outputs: Guilty Verdict Probability %, Confidence Interval.`,
  environmental: `ENVIRONMENTAL SCIENCE (Carbon Cycle): Sliders: Fossil Fuel Emissions (0-100%), Deforestation Rate (0-100%), Renewable Energy Adoption (0-100%). Outputs: CO₂ Concentration (ppm), Temperature Anomaly (°C), Time to Carbon Neutrality (years).`,
  psychology: `PSYCHOLOGY (Cognitive Bias): Sliders: Confirmation Bias (0-100%), Anchoring Bias (0-100%), Availability Heuristic (0-100%). Outputs: Decision Quality Score (/100), Accuracy %, Confidence %.`,
  astronomy: `ASTRONOMY (Orbital Mechanics): Sliders: Orbital Eccentricity (0-0.9), Semi-Major Axis (1-10 AU), Initial Velocity (5-50 km/s). Outputs: Orbital Period (days), Escape Velocity (km/s), Perihelion Distance (AU).`,
  genetics: `GENETICS (Mendelian Inheritance): Sliders: Parent 1 Genotype (AA/Aa/aa mapped 0/50/100), Parent 2 Genotype similarly, Sample Size (10-1000). Outputs: Genotype Ratios, Phenotype Distribution.`,
  phishing: `CYBERSECURITY (Phishing & Password): Sliders: Password Length (4-24 chars), Character Variety (1-4 types), Phishing Awareness (0-100%), MFA Enabled (0 or 100%). Outputs: Password Entropy (bits), Crack Time, Phishing Detection Rate.`,
  server_hardening: `CYBERSECURITY (Server Hardening): Sliders: Patch Level (0-100%), Access Control Strictness (0-100%), Encryption Strength (0-100%). Outputs: Vulnerability Score, CIA Triad Compliance, Compliance Rating.`,
  network_security: `CYBERSECURITY (Network Defense): Sliders: Firewall Strictness (0-100%), IDS Sensitivity (0-100%), Traffic Volume (0-100), Encryption Level (0-100%). Outputs: Threat Detection Rate %, False Positive Rate %, Blocked Attacks count.`,
  cryptography: `CYBERSECURITY (Cryptography): Sliders: Key Length (64-4096 bits), Cipher Complexity (0-100%). Outputs: Encryption Strength, Decryption Probability %, Computational Cost.`,
  prompt_engineering: `AI (Prompt Engineering): Sliders: Temperature (0-2.0), Max Tokens (50-4000), Prompt Specificity (0-100%), Few-Shot Examples (0-5). Outputs: Output Quality Score, Hallucination Risk %.`,
  neural_network: `AI (Neural Network Visualizer): Sliders: Hidden Layers (1-5), Neurons per Layer (2-16), Learning Rate (0.001-1.0), Training Epochs (10-500). Outputs: Accuracy %, Training Loss, Overfitting Indicator.`,
  financial_modeling: `BUSINESS (Financial Modeling): Sliders: Revenue Growth (0-15%), EBITDA Margin (10-40%), WACC (5-15%), Terminal Growth (1-5%). Outputs: Revenue forecast, DCF Valuation, EV/EBITDA multiple.`,
  project_management: `BUSINESS (Project Management): Sliders: Scope (0-100%), Resources (0-100%), Timeline Pressure (0-100%), Risk Tolerance (0-100%). Outputs: Completion Probability %, Budget Overrun %, Team Morale.`,
  marketing_funnel: `BUSINESS (Marketing Funnel): Sliders: Ad Spend ($0-$10000), Conversion Rate (0-20%), Customer LTV ($0-$500), Churn Rate (0-30%). Outputs: LTV/CAC Ratio, Monthly Revenue, Payback Period.`,
  negotiation: `SOFT SKILLS (Negotiation): Sliders: Opening Aggressiveness (0-100%), Concession Rate (0-100%), Emotional Intelligence (0-100%), BATNA Strength (0-100%). Outputs: Deal Probability %, Surplus Captured %, Relationship Score.`,
  structural_engineering: `ENGINEERING (Structural): Sliders: Load Weight (100-10000 kg), Beam Length (1-20m), Material Strength (100-1000 MPa), Safety Factor (1-5). Outputs: Stress (MPa), Deflection (mm), Collapse Risk %.`,
  generic: `UNIVERSAL: Use domain-specific variable names derived from the actual lesson topic. Sliders: 3 key variables of the subject with realistic units and ranges. Outputs: at least 2 computed metrics that depend on the slider values.`,
};

function selectDomainTemplate(topic: string, moduleTitle: string, lessonContent: string): string {
  const combined = `${topic} ${moduleTitle} ${lessonContent}`.toLowerCase();

  const matchMap: [string[], string][] = [
    [["trigonometr", "sine", "cosine", "unit circle", "radian"], "trigonometry"],
    [["statistic", "distribution", "standard deviation", "z-score", "histogram", "probability"], "statistics"],
    [["supply and demand", "elasticity", "equilibrium", "surplus", "deadweight", "gdp", "fiscal", "monetary policy"], "economics"],
    [["projectile", "kinematics", "newton", "friction", "momentum", "velocity", "acceleration"], "physics"],
    [["reaction rate", "catalyst", "activation energy", "le chatelier", "molarity", "titration", "chemical reaction"], "chemistry"],
    [["population", "ecosystem", "predator", "prey", "carrying capacity", "birth rate", "food chain"], "biology"],
    [["pharmacokinetic", "drug", "dosage", "half-life", "plasma concentration", "bioavailability"], "medicine"],
    [["trial", "verdict", "prosecution", "evidence strength", "jury", "burden of proof"], "law"],
    [["carbon cycle", "emission", "climate", "deforestation", "renewable energy", "greenhouse"], "environmental"],
    [["cognitive bias", "confirmation bias", "anchoring", "heuristic", "decision quality"], "psychology"],
    [["orbital", "kepler", "eccentricity", "semi-major axis", "escape velocity"], "astronomy"],
    [["genotype", "phenotype", "punnett", "allele", "mendelian", "heredity"], "genetics"],
    [["phishing", "password", "social engineering", "mfa", "two-factor"], "phishing"],
    [["server hardening", "patch", "vulnerability scan", "cia triad", "access control list"], "server_hardening"],
    [["packet", "firewall", "intrusion detection", "man-in-the-middle", "tcp/ip", "network security"], "network_security"],
    [["encryption", "cipher", "steganography", "cryptograph", "frequency analysis"], "cryptography"],
    [["prompt engineering", "llm", "few-shot", "chain-of-thought", "temperature"], "prompt_engineering"],
    [["neural network", "deep learning", "backpropagation", "hidden layer", "activation function"], "neural_network"],
    [["financial model", "dcf", "ebitda", "revenue growth", "valuation"], "financial_modeling"],
    [["project management", "critical path", "gantt", "scope creep", "agile"], "project_management"],
    [["marketing funnel", "conversion rate", "ltv", "cac", "churn"], "marketing_funnel"],
    [["negotiation", "batna", "zopa", "anchoring", "concession"], "negotiation"],
    [["structural", "stress", "load", "beam", "tensile", "compression"], "structural_engineering"],
  ];

  let bestMatch = "generic";
  let bestScore = 0;
  for (const [keywords, templateKey] of matchMap) {
    let score = 0;
    for (const kw of keywords) if (combined.includes(kw)) score++;
    if (score > bestScore) { bestScore = score; bestMatch = templateKey; }
  }

  const template = DOMAIN_TEMPLATES[bestMatch] || DOMAIN_TEMPLATES.generic;
  const otherKeys = Object.keys(DOMAIN_TEMPLATES).filter((k) => k !== bestMatch && k !== "generic");
  const shuffled = otherKeys.sort(() => Math.random() - 0.5).slice(0, 2);
  const extras = shuffled.map((k) => DOMAIN_TEMPLATES[k]).join("\n\n");
  return `PRIMARY MATCH:\n${template}\n\nOTHER EXAMPLES (for variety reference):\n${extras}`;
}

// ─── ADAPTIVE LAB TYPE SELECTION ───

type LabCandidate = { type: string; score: number };

const GRAPH_BLOCKLIST = [
  "cybersecurity", "cyber", "security", "law", "legal", "business",
  "marketing", "management", "negotiation", "history", "geography",
  "art", "music", "writing", "philosophy", "fitness", "sports", "cooking",
];

const CODE_BLOCKLIST = [
  "law", "legal", "cooking", "history", "geography", "art", "music",
  "writing", "philosophy", "fitness", "sports", "economics", "finance",
  "biology", "ecology", "psychology", "negotiation",
];

function classifyLabType(topic: string, moduleTitle: string, lessonContent: string): string {
  const combined = `${topic} ${moduleTitle} ${lessonContent}`.toLowerCase();
  const topicLower = topic.toLowerCase();
  const titleLower = moduleTitle.toLowerCase();

  const isGraphBlocked = GRAPH_BLOCKLIST.some((d) => topicLower.includes(d) || titleLower.includes(d));
  const isCodeBlocked = CODE_BLOCKLIST.some((d) => topicLower.includes(d) || titleLower.includes(d));

  const labProfiles: Record<string, { keywords: [string, number][] }> = {
    graph: {
      keywords: [
        ["parabola", 5], ["quadratic", 5], ["polynomial", 4], ["slope", 4], ["intercept", 4],
        ["exponential growth", 4], ["exponential decay", 4], ["logarithm", 4],
        ["trigonometr", 6], ["sine", 6], ["cosine", 6], ["tangent", 5],
        ["amplitude", 6], ["phase shift", 6], ["sinusoidal", 6], ["unit circle", 6],
        ["polar", 6], ["radian", 5], ["parametric", 5], ["y = ", 4], ["f(x)", 4],
        ["linear equation", 4], ["linear function", 4], ["orbital", 5], ["kepler", 6],
        ["harmonic", 4], ["histogram", 5], ["scatter plot", 5], ["normal distribution", 5],
        ["pharmacokinetic", 5], ["plasma concentration", 6],
      ],
    },
    code_debugger: {
      keywords: [
        ["debug", 6], ["syntax error", 6], ["bug", 4], ["python", 5], ["javascript", 5],
        ["java ", 4], ["c++", 4], ["html", 4], ["compile", 4], ["runtime error", 5],
        ["recursion", 4], ["object-oriented", 4], ["oop", 4], ["sql injection", 6],
        ["xss", 6], ["cross-site scripting", 6], ["code review", 5], ["source code", 5],
        ["algorithm", 3], ["data structure", 4],
      ],
    },
    flowchart: {
      keywords: [
        ["workflow", 5], ["procedure", 4], ["step-by-step", 4], ["pipeline", 5],
        ["lifecycle", 5], ["methodology", 4], ["protocol", 4], ["design process", 5],
        ["scientific method", 5], ["sdlc", 6], ["agile", 4], ["waterfall", 5],
        ["decision tree", 5], ["flowchart", 6], ["cell division", 4], ["mitosis", 4],
        ["photosynthesis", 4], ["krebs cycle", 5], ["dna replication", 5],
        ["supply chain", 5], ["hiring process", 5], ["customer journey", 5],
        ["incident response", 6], ["chain of custody", 6], ["osi model", 6],
        ["authentication flow", 5], ["trial process", 5], ["triage", 5],
        ["logic gate", 5], ["boolean", 4],
      ],
    },
    matching: {
      keywords: [
        ["vocabulary", 5], ["terminology", 5], ["definition", 5], ["glossary", 5],
        ["concept", 3], ["term", 3], ["identify", 3], ["meaning", 4],
        ["compare", 4], ["contrast", 4], ["match", 5], ["associate", 4],
        ["cause and effect", 6], ["causes and effects", 6], ["effect of", 4],
        ["relationship between", 5], ["correlat", 4], ["classify", 4],
        ["map to", 4], ["corresponding", 4], ["pair", 3],
        // Subject areas where matching is ideal
        ["anatomy", 5], ["biology terms", 5], ["law terms", 4],
        ["parts of", 5], ["types of", 4], ["components of", 4],
      ],
    },
    ordering: {
      keywords: [
        ["timeline", 6], ["chronological", 6], ["historical", 4], ["history of", 4],
        ["sequence", 5], ["in order", 5], ["correct order", 5], ["steps of", 4],
        ["stages of", 5], ["phases of", 4], ["process of", 3],
        ["first", 2], ["second", 2], ["third", 2], ["finally", 3],
        ["development of", 4], ["evolution of", 4], ["progression", 4],
        ["precede", 5], ["follow", 3], ["before and after", 5],
      ],
    },
    scenario_builder: {
      keywords: [
        ["scenario", 5], ["case study", 6], ["decision", 4], ["ethical", 6],
        ["dilemma", 6], ["business case", 6], ["strategy", 4], ["tradeoff", 4],
        ["what would you do", 6], ["apply", 3], ["real-world", 5],
        ["situation", 3], ["practical", 4], ["role play", 5],
        ["business decision", 5], ["management decision", 5], ["policy", 4],
        ["negotiation scenario", 6], ["legal scenario", 5], ["ethical scenario", 6],
        ["clinical scenario", 5], ["medical scenario", 5],
      ],
    },
    simulation: {
      keywords: [
        ["physics", 3], ["projectile", 5], ["friction", 4], ["force", 3],
        ["acceleration", 4], ["momentum", 4], ["energy", 3], ["gravity", 4],
        ["thermodynamic", 4], ["pressure", 3], ["velocity", 4], ["kinematics", 5],
        ["chemical reaction", 4], ["equilibrium", 3], ["concentration", 3],
        ["reaction rate", 5], ["activation energy", 5], ["catalyst", 4],
        ["population", 4], ["ecosystem", 5], ["predator", 5], ["prey", 5],
        ["carrying capacity", 5], ["birth rate", 4], ["genetics", 4],
        ["supply and demand", 5], ["inflation", 5], ["interest rate", 5],
        ["profit", 4], ["revenue", 4], ["investment", 4], ["budget", 4],
        ["elasticity", 4], ["gdp", 4], ["monetary policy", 5],
        ["nutrition", 4], ["metabolism", 4], ["pharmacology", 5],
        ["cognitive bias", 6], ["confirmation bias", 5], ["anchoring", 5],
        ["cybersecurity", 6], ["cyber security", 6], ["password", 5],
        ["phishing", 6], ["server hardening", 6], ["firewall", 5],
        ["encryption", 5], ["network security", 6], ["vulnerability", 5],
        ["climate", 4], ["carbon", 4], ["emission", 4], ["sustainability", 4],
        ["structural", 4], ["load", 3], ["bridge", 4], ["tensile", 4],
        ["optimize", 3], ["tradeoff", 4], ["simulation", 6], ["model", 2],
      ],
    },
  };

  const candidates: LabCandidate[] = [];
  for (const [labType, profile] of Object.entries(labProfiles)) {
    if (labType === "graph" && isGraphBlocked) continue;
    if (labType === "code_debugger" && isCodeBlocked) continue;
    let score = 0;
    let matchCount = 0;
    for (const [keyword, weight] of profile.keywords) {
      if (combined.includes(keyword)) { score += weight; matchCount++; }
    }
    if (matchCount >= 2 || score >= 4) candidates.push({ type: labType, score });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Graph needs a strong lead over simulation
  if (candidates.length >= 2 && candidates[0].type === "graph") {
    const sim = candidates.find((c) => c.type === "simulation");
    if (sim && candidates[0].score < sim.score + 8) return "simulation";
  }

  // Code debugger needs the title to literally be about code
  if (candidates.length >= 1 && candidates[0].type === "code_debugger") {
    const codeSignals = ["code", "coding", "program", "debug", "python", "javascript", "sql injection", "xss", "script"];
    if (!codeSignals.some((s) => titleLower.includes(s))) {
      const alt = candidates.find((c) => c.type !== "code_debugger");
      return alt ? alt.type : "simulation";
    }
  }

  if (candidates.length > 0 && candidates[0].score >= 4) {
    console.log(`[Lab Selection] Picked: ${candidates[0].type} (score ${candidates[0].score})`);
    return candidates[0].type;
  }

  return "simulation";
}

// ─── DETERMINISTIC FALLBACK ───

function createFallbackSliderLab(topic: string, moduleTitle: string): any {
  const words = `${topic} ${moduleTitle}`.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter((w) => w.length > 3);
  const label1 = words[0] || "Intensity";
  const label2 = words[1] || "Scale";
  const label3 = words[2] || "Factor";
  const jitter = (base: number) => Math.round(base * (0.8 + Math.random() * 0.4));

  return {
    lab_type: "simulation",
    title: `Explore: ${moduleTitle}`,
    kind: "exploration",
    scenario: `Adjust the sliders to explore how different factors in ${moduleTitle} affect the outcome.`,
    learning_goal: `Understand the key variables and tradeoffs in ${moduleTitle}`,
    key_insight: `Changing one variable often has cascading effects on the entire system.`,
    goal: { description: `Explore how each variable affects the output by adjusting all sliders.` },
    variables: [
      { name: label1, icon: "📊", unit: "%", min: 0, max: 100, default: jitter(50), description: `Controls the ${label1.toLowerCase()} level` },
      { name: label2, icon: "📈", unit: "%", min: 0, max: 100, default: jitter(40), description: `Controls the ${label2.toLowerCase()} factor` },
      { name: label3, icon: "⚡", unit: "%", min: 0, max: 100, default: jitter(60), description: `Controls the ${label3.toLowerCase()} impact` },
    ],
    blocks: [
      { type: "text", content: `🔬 **${moduleTitle}** — Use the sliders to explore how different factors interact.` },
      { type: "control_panel", prompt: "Adjust the variables to explore their effects:", variables: [label1, label2, label3] },
      { type: "output_display", prompt: "Observe how the outputs respond:", outputs: ["Effectiveness", "Risk Level", "Overall Score"] },
      { type: "choice_set", question: `Which factor has the most impact on ${moduleTitle.toLowerCase()}?`, emoji: "🤔", choices: [
        { text: `High ${label1}`, feedback: `Increasing ${label1.toLowerCase()} boosts effectiveness but may increase risk.`, effects: { [label1]: 80, [label2]: 30 }, is_best: false },
        { text: `Balanced approach`, feedback: `A balanced approach provides steady results with manageable risk.`, effects: { [label1]: 50, [label2]: 50, [label3]: 50 }, is_best: true },
        { text: `Focus on ${label3}`, feedback: `Prioritizing ${label3.toLowerCase()} can yield high scores but requires careful management.`, effects: { [label3]: 90, [label1]: 20 }, is_best: false },
      ]},
      { type: "insight", content: `In ${moduleTitle.toLowerCase()}, no single variable works in isolation. Understanding the relationships between factors is essential.` },
    ],
    completion_rule: "all_choices",
    rules: [
      { condition: `${label1} > 80`, effects: { [label2]: -10 }, message: `⚠️ High ${label1.toLowerCase()} is putting pressure on ${label2.toLowerCase()}!` },
      { condition: `${label3} < 20`, effects: {}, message: `💡 Low ${label3.toLowerCase()} may limit your overall effectiveness.` },
    ],
    formulas: {
      "Effectiveness": `(${label1} * 0.4 + ${label2} * 0.3 + ${label3} * 0.3)`,
      "Risk Level": `${label1} - ${label3}`,
      "Overall Score": `(${label1} + ${label2} + ${label3}) / 3`,
    },
  };
}

// ─── MAIN HANDLER ───

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

    if (mod.lab_generation_status === "done" && !force) {
      const { data: fullMod } = await supabase
        .from("course_modules")
        .select("lab_data")
        .eq("id", moduleId)
        .single();
      if (fullMod?.lab_data && Object.keys(fullMod.lab_data).length > 0) {
        return new Response(JSON.stringify({ status: "already_done" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await supabase.from("course_modules").update({ lab_generation_status: "generating" }).eq("id", moduleId);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in Supabase secrets.");

    const topic = course.topic;
    const moduleTitle = mod.title;
    const labConcept = mod.lab_description || mod.title;
    const lessonContent = mod.lesson_content || "";
    const lessonSummary = lessonContent.replace(/\n---\n/g, "\n").replace(/#{1,3}\s/g, "").slice(0, 3000);

    // ── All 11 activity tools — Claude picks the most pedagogically appropriate one ──
    const ALL_TOOLS = [
      simulationTool, graphTool, flowchartTool, codeDebuggerTool,
      matchingTool, orderingTool, scenarioBuilderTool,
      highlightSelectTool, debateBuilderTool, budgetAllocatorTool,
      cohesiveTool,
    ];

    const domainTemplates = selectDomainTemplate(topic, moduleTitle, lessonContent);

    const system = `You are an expert educational lab designer for high school and lifelong learners. Your job is to create ONE interactive activity that best teaches a specific lesson concept.

You have 10 activity formats to choose from. Pick the ONE that will be most engaging and pedagogically effective for THIS specific topic:

1. create_simulation_lab — Adjust sliders, see live outputs change. Best for: physics, chemistry, economics, systems thinking, anything with variables that interact.
2. create_graph_lab — Manipulate equation parameters via sliders, see graph update. ONLY for pure math/science with actual plotable equations.
3. create_flowchart_lab — Fill in blank process steps via dropdowns. Best for: procedures, biological cycles, algorithms, workflows.
4. create_code_debugger_lab — Find and fix bugs in real code. ONLY when the lesson is literally about programming.
5. create_matching_lab — Connect terms to definitions or causes to effects. Best for: vocabulary-heavy lessons, relationship mapping, compare/contrast.
6. create_ordering_lab — Arrange scrambled items in correct sequence. Best for: timelines, historical events, step-by-step processes, chronological analysis.
7. create_scenario_builder_lab — Fill blanks in a real-world narrative. Best for: applied reasoning, business/legal/medical scenarios, reading comprehension with inference.
8. create_highlight_select_lab — Select ALL items that match a criterion. Best for: identifying examples vs non-examples, fact-checking, classifying a set.
9. create_debate_builder_lab — Sort statements into For/Against. Best for: ethics, policy debates, persuasive reasoning, pros/cons analysis, history perspectives.
10. create_budget_allocator_lab — Distribute 100% across categories with sliders. Best for: resource allocation, government/personal finance, tradeoff decisions, policy design.
11. create_cohesive_lab — Multi-activity narrative lab with 4-5 sequential activities, persistent metrics, unlock progression, and a final grade. Best for: rich complex topics where one activity isn't enough — history, ethics, complex science, business strategy, social issues, any topic that benefits from a story arc.

SELECTION GUIDELINES:
- Choose the format that makes the lesson concept come alive as an activity
- A lesson about "causes of WWI" → cohesive (narrative spine with ordering + debate + classify)
- A lesson about "DNA replication steps" → flowchart or ordering
- A lesson about "supply and demand" → simulation or budget_allocator
- A lesson about "logical fallacies" → highlight_select or matching
- A lesson about "climate policy" → cohesive (budget + debate + branch_chain) or budget_allocator
- A lesson about "quadratic equations" → graph
- A lesson about "Python loops" → code_debugger
- A lesson about vocabulary/terms → matching
- A lesson about ethics, justice, complex history, social topics → cohesive
- A lesson that covers multiple sub-concepts → cohesive
- When uncertain, simulation is the universal fallback

QUALITY RULES:
- All content must come directly from the lesson provided
- Activity must be completable in 3-7 minutes
- Every item/pair/blank must be unambiguous
- Use real numbers, realistic scenarios, domain-specific language

SIMULATION-SPECIFIC RULES (if you pick simulation):
- ALL formula keys must be plain readable names (no special chars)
- EVERY output_display output MUST have a matching formula with the exact same label
- EVERY rule condition MUST be a valid mathjs expression (variable_name > 50)
- NO percent signs or natural language in conditions
- NO step_task blocks
- Domain reference templates: ${domainTemplates}`;

    const userMsg = `Design an interactive lab activity for this lesson:

MODULE: "${moduleTitle}"
COURSE TOPIC: ${topic}
LAB CONCEPT: ${labConcept}

LESSON CONTENT:
${lessonSummary}

Choose the activity type that will best help a high school student truly understand and apply this concept. Then generate the full activity content.`;

    let blueprint: any = null;
    let labType = "simulation"; // will be set from Claude's tool choice
    let lastGenError = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        console.log(`[Retry ${attempt}] "${moduleTitle}"`);
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
      try {
        const result = await callClaudeAuto(ANTHROPIC_API_KEY, system, userMsg, ALL_TOOLS);
        blueprint = result.input;
        // Derive labType from the tool Claude chose
        const toolToType: Record<string, string> = {
          create_simulation_lab: "simulation",
          create_graph_lab: "graph",
          create_flowchart_lab: "flowchart",
          create_code_debugger_lab: "code_debugger",
          create_matching_lab: "matching",
          create_ordering_lab: "ordering",
          create_scenario_builder_lab: "scenario_builder",
          create_highlight_select_lab: "highlight_select",
          create_debate_builder_lab: "debate_builder",
          create_budget_allocator_lab: "budget_allocator",
          create_cohesive_lab: "cohesive",
        };
        labType = toolToType[result.toolName] || "simulation";
        console.log(`[Lab Gen] "${moduleTitle}" → Claude chose: ${result.toolName} (${labType})`);

        // Minimal validity check
        if (labType === "graph" && blueprint.sliders?.length > 0 && blueprint.equation) break;
        if (labType === "flowchart" && blueprint.drop_zones?.length > 0) break;
        if (labType === "code_debugger" && blueprint.starter_code && blueprint.expected_output) break;
        if (labType === "matching" && blueprint.pairs?.length >= 4) break;
        if (labType === "ordering" && blueprint.items?.length >= 4) break;
        if (labType === "scenario_builder" && blueprint.narrative && blueprint.blanks?.length >= 3) break;
        if (labType === "highlight_select" && blueprint.items?.length >= 4) break;
        if (labType === "debate_builder" && blueprint.statements?.length >= 4) break;
        if (labType === "budget_allocator" && blueprint.categories?.length >= 3) break;
        if (labType === "cohesive" && blueprint.activities?.length >= 4 && blueprint.metrics?.length >= 2) break;
        if (labType === "simulation" && blueprint.variables?.length > 0 && blueprint.blocks?.length > 0) break;
        if (blueprint && typeof blueprint === "object") break;
      } catch (e: any) {
        lastGenError = e.message || "Unknown error";
        console.warn(`[Gen attempt ${attempt} failed] ${lastGenError}`);
      }
    }

    // ── GUARANTEED FALLBACK ──
    if (!blueprint || typeof blueprint !== "object") {
      console.log(`[Fallback] AI generation failed for "${moduleTitle}", using deterministic slider lab`);
      blueprint = createFallbackSliderLab(topic, moduleTitle);
    }

    if (labType === "simulation" && (!blueprint.variables?.length || !blueprint.blocks?.length)) {
      blueprint = createFallbackSliderLab(topic, moduleTitle);
    }

    blueprint.lab_type = blueprint.lab_type || labType;

    // ═══ VALIDATION + NORMALIZATION (simulation only) ═══
    const _warnings: string[] = [];
    let criticalErrors = 0;

    if (labType === "simulation") {
      if (!Array.isArray(blueprint.blocks)) blueprint.blocks = [];
      if (!Array.isArray(blueprint.variables)) blueprint.variables = [];
      if (!blueprint.formulas || typeof blueprint.formulas !== "object") blueprint.formulas = {};
      if (!Array.isArray(blueprint.rules)) blueprint.rules = [];

      for (const v of blueprint.variables) {
        const origName = v.name;
        v.name = String(v.name || "Variable").replace(/[^a-zA-Z0-9_ ]/g, "").trim() || "Variable";
        if (origName !== v.name) _warnings.push(`Renamed var "${origName}" → "${v.name}"`);
        v.min = typeof v.min === "number" ? v.min : 0;
        v.max = typeof v.max === "number" ? v.max : 100;
        if (v.min >= v.max) { v.min = 0; v.max = 100; criticalErrors++; }
        v.default = Math.max(v.min, Math.min(v.max, typeof v.default === "number" ? v.default : (v.min + v.max) / 2));
        if (!v.unit) v.unit = "%";
        if (!v.icon) v.icon = "📊";
      }

      const varNames = blueprint.variables.map((v: any) => v.name);

      const newFormulas: Record<string, string> = {};
      for (const [key, formula] of Object.entries(blueprint.formulas)) {
        const cleanKey = String(key).replace(/[^a-zA-Z0-9_ ]/g, "").trim();
        if (!cleanKey) { criticalErrors++; continue; }
        const formulaStr = String(formula);
        if (/[%]/.test(formulaStr) || /\b(with|and|or|the|is|has|if|then)\b/i.test(formulaStr)) {
          criticalErrors++;
          newFormulas[cleanKey] = varNames.length > 0
            ? `(${varNames.map((n: string) => `\`${n}\``).join(" + ")}) / ${varNames.length}` : "50";
        } else {
          newFormulas[cleanKey] = formulaStr;
        }
      }
      blueprint.formulas = newFormulas;

      const hasControlPanel = blueprint.blocks.some((b: any) => b.type === "control_panel");
      const hasOutputDisplay = blueprint.blocks.some((b: any) => b.type === "output_display");

      if (!hasControlPanel && varNames.length > 0) {
        blueprint.blocks.unshift({ type: "control_panel", prompt: "Adjust the variables:", variables: varNames });
      }
      if (!hasOutputDisplay) {
        if (Object.keys(blueprint.formulas).length === 0) {
          blueprint.formulas["Effectiveness"] = varNames.length > 0
            ? `(${varNames.map((n: string) => `\`${n}\``).join(" + ")}) / ${varNames.length}` : "50";
          blueprint.formulas["Impact Score"] = varNames.length >= 2
            ? `\`${varNames[0]}\` * 0.6 + \`${varNames[1]}\` * 0.4` : "50";
        }
        blueprint.blocks.push({ type: "output_display", prompt: "Observe the results:", outputs: Object.keys(blueprint.formulas) });
      } else {
        for (const block of blueprint.blocks) {
          if (block.type === "output_display" && Array.isArray(block.outputs)) {
            for (const output of block.outputs) {
              if (!blueprint.formulas[output]) {
                blueprint.formulas[output] = varNames.length > 0
                  ? `(${varNames.map((n: string) => `\`${n}\``).join(" + ")}) / ${varNames.length}` : "50";
              }
            }
          }
        }
      }

      blueprint.rules = blueprint.rules.filter((r: any) => {
        if (!r.condition || typeof r.condition !== "string") return false;
        if (/[%$#@!?]/.test(r.condition) || /\b(with|and|or|the|is|has|if|then|high|low|very)\b/i.test(r.condition)) {
          criticalErrors++;
          return false;
        }
        if (!r.effects || typeof r.effects !== "object") r.effects = {};
        if (!r.message) r.message = "⚠️ Threshold reached!";
        return true;
      });

      blueprint.blocks = blueprint.blocks.filter((b: any) => b.type !== "step_task");

      for (const block of blueprint.blocks) {
        if (block.type === "choice_set" && Array.isArray(block.choices)) {
          for (const choice of block.choices) {
            if (!choice.effects || typeof choice.effects !== "object") choice.effects = {};
            for (const vn of varNames) {
              if (typeof choice.effects[vn] === "number") {
                const v = blueprint.variables.find((x: any) => x.name === vn);
                if (v) choice.effects[vn] = Math.max(v.min, Math.min(v.max, choice.effects[vn]));
              }
            }
          }
        }
      }

      if (criticalErrors > 3) {
        blueprint = createFallbackSliderLab(topic, moduleTitle);
        blueprint.lab_type = "simulation";
      }

      if (!blueprint.blocks.some((b: any) => b.type === "insight") && blueprint.key_insight) {
        blueprint.blocks.push({ type: "insight", content: blueprint.key_insight });
      }
      blueprint.completion_rule = blueprint.completion_rule || "all_choices";
    }

    // ── Normalize other types ──
    if (labType === "flowchart" && Array.isArray(blueprint.drop_zones)) {
      blueprint.drop_zones = blueprint.drop_zones.map((dz: any, i: number) => ({
        id: dz.id || `step_${i + 1}`,
        label: dz.label || `Step ${i + 1}`,
        correct_value: dz.correct_value || "",
        options: Array.isArray(dz.options) ? dz.options : [dz.correct_value || "Option"],
      }));
    }

    if (labType === "graph" && Array.isArray(blueprint.sliders)) {
      blueprint.sliders = blueprint.sliders.map((s: any) => ({
        ...s,
        step: s.step || 0.1,
        default: typeof s.default === "number" ? s.default : 1,
      }));
      if (!blueprint.x_range) blueprint.x_range = [-10, 10];
      if (!blueprint.y_range) blueprint.y_range = [-10, 10];
    }

    if (labType === "matching" && Array.isArray(blueprint.pairs)) {
      blueprint.pairs = blueprint.pairs.map((p: any, i: number) => ({
        id: p.id || String(i + 1),
        left: String(p.left || "Term"),
        right: String(p.right || "Definition"),
      }));
    }

    if (labType === "ordering" && Array.isArray(blueprint.items)) {
      // Guarantee correct_position is valid 1..N with no duplicates
      const usedPositions = new Set<number>();
      let nextPos = 1;
      blueprint.items = blueprint.items.map((item: any, i: number) => {
        let pos = typeof item.correct_position === "number" ? item.correct_position : i + 1;
        while (usedPositions.has(pos)) pos++;
        usedPositions.add(pos);
        return { id: item.id || String(i + 1), text: String(item.text || "Step"), correct_position: pos };
      });
    }

    if (labType === "scenario_builder" && Array.isArray(blueprint.blanks)) {
      const narrative = blueprint.narrative || "";
      blueprint.blanks = blueprint.blanks.filter((b: any) => {
        const exists = narrative.includes(`[${b.id}]`);
        if (!exists) console.warn(`[Scenario] Blank "${b.id}" not found in narrative, dropping`);
        return exists;
      });
      for (const b of blueprint.blanks) {
        if (!b.options?.includes(b.correct)) b.options = [b.correct, ...(b.options || [])];
      }
    }

    if (labType === "highlight_select" && Array.isArray(blueprint.items)) {
      blueprint.items = blueprint.items.map((item: any, i: number) => ({
        id: item.id || String(i + 1),
        text: String(item.text || "Item"),
        is_correct: Boolean(item.is_correct),
        explanation: item.explanation || "",
      }));
      // Ensure at least one correct and one incorrect
      const hasCorrect = blueprint.items.some((i: any) => i.is_correct);
      const hasWrong = blueprint.items.some((i: any) => !i.is_correct);
      if (!hasCorrect) blueprint.items[0].is_correct = true;
      if (!hasWrong && blueprint.items.length > 1) blueprint.items[blueprint.items.length - 1].is_correct = false;
    }

    if (labType === "debate_builder" && Array.isArray(blueprint.statements)) {
      blueprint.statements = blueprint.statements.map((s: any, i: number) => ({
        id: s.id || String(i + 1),
        text: String(s.text || "Statement"),
        side: s.side === "against" ? "against" : "for",
        explanation: s.explanation || "",
      }));
      // Ensure both sides represented
      const hasFor = blueprint.statements.some((s: any) => s.side === "for");
      const hasAgainst = blueprint.statements.some((s: any) => s.side === "against");
      if (!hasFor && blueprint.statements.length > 0) blueprint.statements[0].side = "for";
      if (!hasAgainst && blueprint.statements.length > 1) blueprint.statements[1].side = "against";
    }

    if (labType === "budget_allocator" && Array.isArray(blueprint.categories)) {
      blueprint.unit = blueprint.unit || "%";
      blueprint.categories = blueprint.categories.map((c: any, i: number) => ({
        id: c.id || String(i + 1),
        name: String(c.name || `Category ${i + 1}`),
        icon: c.icon || "📊",
        description: c.description || "",
        recommended_min: typeof c.recommended_min === "number" ? c.recommended_min : 10,
        recommended_max: typeof c.recommended_max === "number" ? c.recommended_max : 40,
        explanation: c.explanation || "",
      }));
    }

    if (_warnings.length > 0) {
      blueprint._validation_warnings = _warnings;
    }

    blueprint.title = blueprint.title || moduleTitle;

    // ── Save to DB ──
    const labTypeForDb = labType === "simulation" ? "dynamic" : labType;
    await supabase.from("course_modules").update({
      lab_data: blueprint,
      lab_blueprint: blueprint,
      lab_type: labTypeForDb,
      lab_generation_status: "done",
      lab_error: null,
    }).eq("id", moduleId);

    console.log(`✅ Lab generated: "${moduleTitle}" → type: ${labType}`);

    return new Response(JSON.stringify({ status: "done", blueprint }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LAB GENERATION ERROR:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
