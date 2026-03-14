import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ===============================
   🔧 ZOD SCHEMAS & VALIDATORS
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
      lab_type: z.enum(["simulation", "classification", "policy_optimization", "ethical_dilemma", "decision_lab", "math_lab"]),
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
   🔧 VALIDATORS (RELAXED — preserve AI output)
================================ */

function isValidSimulation(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!Array.isArray(ld.parameters) || ld.parameters.length < 2 || ld.parameters.length > 6) return false;
  for (const p of ld.parameters) {
    if (typeof p.name !== "string") return false;
  }
  if (!Array.isArray(ld.decisions) || ld.decisions.length < 1) return false;
  for (const d of ld.decisions) {
    if (!Array.isArray(d.choices) || d.choices.length < 2) return false;
  }
  return true;
}

function isValidClassification(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!Array.isArray(ld.categories) || ld.categories.length < 2) return false;
  if (!Array.isArray(ld.items) || ld.items.length < 3) return false;
  for (const item of ld.items) {
    const content = item.content || item.name;
    const category = item.correctCategory || item.correct_category || item.correct;
    if (typeof content !== "string" || typeof category !== "string") return false;
  }
  return true;
}

function isValidPolicyOptimization(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!Array.isArray(ld.parameters) || ld.parameters.length < 2 || ld.parameters.length > 6) return false;
  for (const p of ld.parameters) {
    if (typeof p.name !== "string") return false;
  }
  if (!Array.isArray(ld.constraints) || ld.constraints.length < 1) return false;
  if (!Array.isArray(ld.decisions) || ld.decisions.length < 1) return false;
  return true;
}

function isValidEthicalDilemma(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!Array.isArray(ld.dimensions) || ld.dimensions.length < 2) return false;
  for (const dim of ld.dimensions) {
    if (typeof dim.name !== "string") return false;
  }
  if (!Array.isArray(ld.decisions) || ld.decisions.length < 2) return false;
  for (const d of ld.decisions) {
    if (!Array.isArray(d.choices) || d.choices.length < 2) return false;
  }
  return true;
}

function isValidDecisionLab(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!ld.decision_challenge && !ld.decisions) return false;
  const challenge = ld.decision_challenge;
  if (challenge) {
    if (typeof challenge.question !== "string") return false;
    if (!Array.isArray(challenge.options) || challenge.options.length < 2) return false;
  }
  return true;
}

/* ===============================
   🔧 STRUCTURAL REPAIR FUNCTIONS
   Normalize AI output instead of replacing it
================================ */

function repairSimulation(ld: any, title: string): any {
  const repaired = { ...ld };
  // Ensure parameters have required numeric fields
  if (Array.isArray(repaired.parameters)) {
    repaired.parameters = repaired.parameters.map((p: any) => ({
      name: String(p.name || "Variable"),
      icon: String(p.icon || "📊"),
      unit: String(p.unit || "%"),
      min: typeof p.min === "number" ? p.min : 0,
      max: typeof p.max === "number" ? p.max : 100,
      default: Math.max(0, Math.min(100, typeof p.default === "number" ? p.default : 50)),
      ...(p.description ? { description: p.description } : {}),
    }));
  }
  // Ensure thresholds exist
  if (!Array.isArray(repaired.thresholds) || repaired.thresholds.length === 0) {
    repaired.thresholds = [
      { label: "Excellent", min_percent: 75, message: "Outstanding performance — your decisions created strong outcomes." },
      { label: "Good", min_percent: 50, message: "Solid understanding, but some tradeoffs could be managed better." },
      { label: "Needs Work", min_percent: 0, message: "Review the tradeoffs and try a different strategy." },
    ];
  }
  // Fix decisions — ensure set_state maps all parameters
  const paramNames = (repaired.parameters || []).map((p: any) => p.name);
  if (Array.isArray(repaired.decisions)) {
    for (const d of repaired.decisions) {
      if (!d.choices) d.choices = [];
      for (const c of d.choices) {
        // Convert "effects" to "set_state" if needed
        if (c.effects && !c.set_state) {
          const ss: Record<string, number> = {};
          for (const pn of paramNames) ss[pn] = Math.max(0, Math.min(100, 50 + (c.effects[pn] ?? 0)));
          c.set_state = ss;
          delete c.effects;
        }
        if (!c.set_state) c.set_state = {};
        // Fill missing parameters with defaults
        for (const pn of paramNames) {
          if (typeof c.set_state[pn] !== "number") c.set_state[pn] = 50;
          c.set_state[pn] = Math.max(0, Math.min(100, c.set_state[pn]));
        }
      }
    }
  }
  return repaired;
}

function repairClassification(ld: any, title: string): any {
  const repaired = { ...ld };
  // Normalize categories — accept string[] or {name}[]
  if (Array.isArray(repaired.categories)) {
    repaired.categories = repaired.categories.map((cat: any) => {
      if (typeof cat === "string") return { name: cat, description: "", color: "#4CAF50" };
      return { name: String(cat.name || "Category"), description: cat.description || "", color: cat.color || "#4CAF50" };
    });
  }
  // Normalize items — accept various field names
  if (Array.isArray(repaired.items)) {
    repaired.items = repaired.items.map((item: any) => ({
      content: String(item.content || item.name || item.text || "Item"),
      correctCategory: String(item.correctCategory || item.correct_category || item.correct || item.category || ""),
      explanation: String(item.explanation || item.reason || ""),
    }));
  }
  return repaired;
}

function repairPolicyOptimization(ld: any, title: string): any {
  const repaired = { ...ld };
  if (Array.isArray(repaired.parameters)) {
    repaired.parameters = repaired.parameters.map((p: any) => ({
      name: String(p.name || "Variable"),
      icon: String(p.icon || "📊"),
      unit: String(p.unit || "%"),
      min: typeof p.min === "number" ? p.min : 0,
      max: typeof p.max === "number" ? p.max : 100,
      default: Math.max(0, Math.min(100, typeof p.default === "number" ? p.default : 50)),
    }));
  }
  if (!Array.isArray(repaired.constraints) || repaired.constraints.length === 0) {
    const pName = repaired.parameters?.[0]?.name || "Variable";
    repaired.constraints = [{ parameter: pName, operator: ">=", value: 60, label: `Keep ${pName} above 60%` }];
  } else {
    repaired.constraints = repaired.constraints.map((c: any) => ({
      parameter: String(c.parameter || "Variable"),
      operator: String(c.operator || ">="),
      value: typeof c.value === "number" ? c.value : 50,
      label: String(c.label || c.description || `Constraint on ${c.parameter}`),
    }));
  }
  if (typeof repaired.max_decisions !== "number") repaired.max_decisions = 3;
  // Fix decisions set_state
  const paramNames = (repaired.parameters || []).map((p: any) => p.name);
  if (Array.isArray(repaired.decisions)) {
    for (const d of repaired.decisions) {
      if (!d.choices) d.choices = [];
      for (const c of d.choices) {
        if (!c.set_state) c.set_state = {};
        for (const pn of paramNames) {
          if (typeof c.set_state[pn] !== "number") c.set_state[pn] = 50;
          c.set_state[pn] = Math.max(0, Math.min(100, c.set_state[pn]));
        }
      }
    }
  }
  return repaired;
}

function repairEthicalDilemma(ld: any, title: string): any {
  const repaired = { ...ld };
  if (Array.isArray(repaired.dimensions)) {
    repaired.dimensions = repaired.dimensions.map((dim: any) => ({
      name: String(dim.name || "Dimension"),
      icon: String(dim.icon || "⚖️"),
      description: String(dim.description || ""),
      default: typeof dim.default === "number" ? dim.default : 50,
    }));
  }
  const dimNames = (repaired.dimensions || []).map((d: any) => d.name);
  if (Array.isArray(repaired.decisions)) {
    for (const d of repaired.decisions) {
      if (!d.choices) d.choices = [];
      for (const c of d.choices) {
        if (!c.impacts) c.impacts = {};
        for (const dn of dimNames) {
          if (typeof c.impacts[dn] !== "number") c.impacts[dn] = 0;
        }
      }
    }
  }
  return repaired;
}

function repairDecisionLab(ld: any, title: string): any {
  const repaired = { ...ld };
  if (!repaired.concept_knowledge) {
    repaired.concept_knowledge = {
      definition: `${title} refers to the study and application of key principles in this domain.`,
      key_ideas: [`${title} involves balancing multiple factors.`, `Decisions have short and long-term consequences.`],
      examples: [`Applying ${title.toLowerCase()} in a real-world scenario.`],
    };
  } else {
    if (typeof repaired.concept_knowledge.definition !== "string") repaired.concept_knowledge.definition = `${title} concept`;
    if (!Array.isArray(repaired.concept_knowledge.key_ideas)) repaired.concept_knowledge.key_ideas = ["Key idea"];
    if (!Array.isArray(repaired.concept_knowledge.examples)) repaired.concept_knowledge.examples = ["Example"];
  }
  if (!repaired.real_world_relevance) {
    repaired.real_world_relevance = { explanation: `${title} is relevant in real-world decision-making.`, domain: "General" };
  }
  if (typeof repaired.scenario !== "string" || repaired.scenario.length < 10) {
    repaired.scenario = repaired.scenario_context || repaired.description || `You are facing a decision related to ${title.toLowerCase()}.`;
  }
  if (!repaired.decision_challenge) {
    repaired.decision_challenge = {
      question: `What approach would you take for ${title.toLowerCase()}?`,
      options: [
        { id: "a", text: "Option A", consequence: "Consequence A", is_best: true },
        { id: "b", text: "Option B", consequence: "Consequence B", is_best: false },
        { id: "c", text: "Option C", consequence: "Consequence C", is_best: false },
      ],
    };
  } else {
    if (!Array.isArray(repaired.decision_challenge.options)) repaired.decision_challenge.options = [];
    repaired.decision_challenge.options = repaired.decision_challenge.options.map((opt: any, i: number) => ({
      id: String(opt.id || String.fromCharCode(97 + i)),
      text: String(opt.text || opt.label || `Option ${i + 1}`),
      consequence: String(opt.consequence || opt.result || opt.outcome || "Consequence"),
      is_best: typeof opt.is_best === "boolean" ? opt.is_best : i === 0,
    }));
    // Ensure exactly one is_best
    const hasBest = repaired.decision_challenge.options.some((o: any) => o.is_best);
    if (!hasBest && repaired.decision_challenge.options.length > 0) repaired.decision_challenge.options[0].is_best = true;
  }
  if (typeof repaired.best_decision_explanation !== "string") {
    repaired.best_decision_explanation = `The best approach balances the key factors of ${title.toLowerCase()}.`;
  }
  return repaired;
}

/* ===============================
   🔧 FALLBACK GENERATORS
================================ */

function generateSimulationFallback(title: string) {
  const t = title || "Topic";
  const h = hashString(t);
  
  const paramSets = [
    [`${t} Efficiency`, `${t} Quality`, `${t} Sustainability`],
    [`${t} Growth Rate`, `${t} Stability`, `${t} Public Trust`],
    [`${t} Output`, `${t} Resource Usage`, `${t} Innovation`],
    [`${t} Adoption`, `${t} Cost Effectiveness`, `${t} Long-term Viability`],
  ];
  const [p1, p2, p3] = paramSets[h % paramSets.length];

  const questionSets = [
    [
      { q: `A stakeholder demands faster ${t.toLowerCase()} results. How do you respond?`, emoji: "🔬",
        c: [{ text: "Accelerate timelines", explanation: `Pushing faster improves short-term ${t.toLowerCase()} output but strains resources.`, s: { [p1]: 80, [p2]: 45, [p3]: 40 } },
            { text: "Maintain current pace", explanation: `Steady progress preserves quality and team morale.`, s: { [p1]: 55, [p2]: 70, [p3]: 65 } }] },
      { q: `New data reveals a flaw in your ${t.toLowerCase()} approach. What now?`, emoji: "⚡",
        c: [{ text: "Pivot strategy completely", explanation: `A full pivot addresses the flaw but disrupts ongoing work.`, s: { [p1]: 50, [p2]: 85, [p3]: 60 } },
            { text: "Adapt incrementally", explanation: `Gradual changes minimize disruption while still improving.`, s: { [p1]: 60, [p2]: 65, [p3]: 75 } }] },
    ],
    [
      { q: `Resources for ${t.toLowerCase()} are being cut by 30%. Where do you focus?`, emoji: "💰",
        c: [{ text: "Protect core operations", explanation: `Maintaining essentials ensures baseline ${t.toLowerCase()} continues.`, s: { [p1]: 65, [p2]: 75, [p3]: 50 } },
            { text: "Invest in automation", explanation: `Automation reduces future costs but requires upfront effort.`, s: { [p1]: 50, [p2]: 55, [p3]: 80 } }] },
      { q: `A competitor has overtaken your ${t.toLowerCase()} results. Your move?`, emoji: "🏃",
        c: [{ text: "Innovate aggressively", explanation: `Bold innovation can leapfrog competitors but carries risk.`, s: { [p1]: 85, [p2]: 40, [p3]: 55 } },
            { text: "Improve existing strengths", explanation: `Refining what works builds reliable, sustainable advantage.`, s: { [p1]: 60, [p2]: 80, [p3]: 70 } }] },
    ],
    [
      { q: `Public opinion on ${t.toLowerCase()} is shifting negatively. How do you respond?`, emoji: "📢",
        c: [{ text: "Launch transparency initiative", explanation: `Openness rebuilds trust but exposes internal challenges.`, s: { [p1]: 55, [p2]: 60, [p3]: 80 } },
            { text: "Double down on results", explanation: `Strong outcomes speak for themselves, but perception may lag.`, s: { [p1]: 80, [p2]: 70, [p3]: 45 } }] },
      { q: `Two departments disagree on ${t.toLowerCase()} priorities. How do you mediate?`, emoji: "🤝",
        c: [{ text: "Let data decide", explanation: `Evidence-based decisions are fair but may ignore context.`, s: { [p1]: 70, [p2]: 75, [p3]: 55 } },
            { text: "Compromise on both sides", explanation: `Balanced concessions maintain relationships and momentum.`, s: { [p1]: 60, [p2]: 60, [p3]: 70 } }] },
    ],
  ];
  const questions = questionSets[h % questionSets.length];

  const roles = [
    `a department head managing ${t.toLowerCase()} across your organization`,
    `an operations manager responsible for optimizing ${t.toLowerCase()} outcomes`,
    `a strategic consultant hired to improve ${t.toLowerCase()} for a mid-sized company`,
  ];

  return {
    title: `${t} Simulation`,
    repend_intro: {
      relevance: `${t} directly affects how organizations perform in competitive environments. Understanding how to balance competing priorities in ${t.toLowerCase()} is a critical skill used by managers, analysts, and leaders every day.`,
      role: roles[h % roles.length],
      scenario_context: `Your organization is at a crossroads with ${t.toLowerCase()}. Multiple stakeholders have competing demands, resources are limited, and every decision creates ripple effects across the system. You need to navigate ${questions.length} critical scenarios.`,
      information: [
        `You're managing 3 key metrics: ${p1}, ${p2}, and ${p3}`,
        `Each decision shifts all metrics — there are no isolated choices`,
        `Your goal is to achieve the highest balanced score across all factors`,
      ],
      objective: `Learn how decisions in ${t.toLowerCase()} create tradeoffs and systemic consequences.`,
    },
    key_insight: `${t} is never about maximizing a single factor. The best ${t.toLowerCase()} strategies find the optimal balance between competing priorities, because over-optimizing one dimension always comes at the cost of another.`,
    parameters: [
      { name: p1, icon: "📊", unit: "%", min: 0, max: 100, default: 50 },
      { name: p2, icon: "📈", unit: "%", min: 0, max: 100, default: 50 },
      { name: p3, icon: "📉", unit: "%", min: 0, max: 100, default: 50 },
    ],
    thresholds: [
      [
        { label: `${t} Mastery`, min_percent: 75, message: `Exceptional command of ${t.toLowerCase()} — your decisions created strong outcomes across all dimensions.` },
        { label: `Developing ${t} Insight`, min_percent: 50, message: `You're building a solid understanding of ${t.toLowerCase()}, but some tradeoffs could be managed better.` },
        { label: `${t} Foundations`, min_percent: 0, message: `Your ${t.toLowerCase()} approach needs refinement — revisit the tradeoffs and try a different strategy.` },
      ],
      [
        { label: `Strategic Leader`, min_percent: 75, message: `Your ${t.toLowerCase()} decisions demonstrate strong strategic thinking and balance.` },
        { label: `Competent Manager`, min_percent: 50, message: `Reasonable ${t.toLowerCase()} decisions, though some areas were under-prioritized.` },
        { label: `Novice Analyst`, min_percent: 0, message: `Your ${t.toLowerCase()} strategy missed key factors — consider the full picture next time.` },
      ],
      [
        { label: `System Optimizer`, min_percent: 75, message: `You found an effective balance across all ${t.toLowerCase()} factors — impressive systemic thinking.` },
        { label: `Partial Optimizer`, min_percent: 50, message: `Some ${t.toLowerCase()} factors improved, but others suffered — tradeoff management is key.` },
        { label: `Imbalanced Approach`, min_percent: 0, message: `Your ${t.toLowerCase()} decisions created significant imbalances — try distributing focus more evenly.` },
      ],
    ][h % 3],
    decisions: questions.map(q => ({
      question: q.q,
      emoji: q.emoji,
      choices: q.c.map(c => ({ text: c.text, explanation: c.explanation, set_state: c.s })),
    })),
  };
}

function generateClassificationFallback(title: string) {
  const t = title || "Topic";
  const h = hashString(t);
  const roles = [
    `a research analyst categorizing ${t.toLowerCase()} elements for a government report`,
    `a consultant sorting ${t.toLowerCase()} factors for a client presentation`,
    `a team lead organizing ${t.toLowerCase()} components for a strategic review`,
  ];
  const cats = [
    { name: "Core Concepts", description: `Fundamental principles of ${t.toLowerCase()}`, color: "#4CAF50" },
    { name: "Supporting Factors", description: `Elements that contribute to ${t.toLowerCase()}`, color: "#2196F3" },
    { name: "Common Misconceptions", description: `Frequent misunderstandings about ${t.toLowerCase()}`, color: "#FF9800" },
  ];
  return {
    title: `${t} Classification`,
    description: `Categorize the following items related to ${t.toLowerCase()} into the correct groups.`,
    repend_intro: {
      relevance: `Professionals working with ${t.toLowerCase()} must quickly distinguish between core principles, supporting factors, and common misconceptions. This skill is essential in ${t.toLowerCase()} analysis, strategy, and communication.`,
      role: roles[h % roles.length],
      scenario_context: `You've been asked to organize key ${t.toLowerCase()} concepts into clear categories. Your analysis will inform a major decision — getting the classification wrong could lead to flawed strategy.`,
      information: [
        `There are ${cats.length} categories to sort items into`,
        `Some items may seem like they belong in multiple categories — choose the BEST fit`,
        `Pay attention to whether something is foundational, supportive, or misleading`,
      ],
      objective: `Develop the ability to accurately distinguish between core concepts, supporting elements, and misconceptions in ${t.toLowerCase()}.`,
    },
    key_insight: `In ${t.toLowerCase()}, confusing a misconception for a core concept can lead to fundamentally flawed decisions. The ability to categorize information accurately is one of the most important analytical skills in any domain.`,
    categories: cats,
    items: [
      { content: `Primary principle of ${t.toLowerCase()}`, correctCategory: "Core Concepts", explanation: "This is a foundational element." },
      { content: `Key theory behind ${t.toLowerCase()}`, correctCategory: "Core Concepts", explanation: "This forms the theoretical basis." },
      { content: `Resource that enables ${t.toLowerCase()}`, correctCategory: "Supporting Factors", explanation: "This supports but isn't central." },
      { content: `Tool commonly used in ${t.toLowerCase()}`, correctCategory: "Supporting Factors", explanation: "This is a supporting mechanism." },
      { content: `"${t} always works the same way"`, correctCategory: "Common Misconceptions", explanation: "This oversimplifies the reality." },
      { content: `"${t} has no tradeoffs"`, correctCategory: "Common Misconceptions", explanation: "Every system involves tradeoffs." },
    ],
  };
}

function generatePolicyOptimizationFallback(title: string) {
  const t = title || "Topic";
  const h = hashString(t);
  const paramSets = [
    [`${t} Performance`, `${t} Cost`, `${t} Risk`],
    [`${t} Reach`, `${t} Budget`, `${t} Compliance`],
    [`${t} Speed`, `${t} Accuracy`, `${t} Scalability`],
  ];
  const [p1, p2, p3] = paramSets[h % paramSets.length];
  
  const scenarioSets = [
    [
      { q: `How do you allocate resources for ${t.toLowerCase()}?`, emoji: "🎯",
        c: [{ text: "Aggressive investment", ex: "High performance but increased costs and risk.", s: { [p1]: 85, [p2]: 75, [p3]: 60 } },
            { text: "Conservative strategy", ex: "Lower risk but moderate performance gains.", s: { [p1]: 60, [p2]: 40, [p3]: 30 } }] },
      { q: `A new opportunity emerges in ${t.toLowerCase()}. How do you respond?`, emoji: "💡",
        c: [{ text: "Seize the opportunity", ex: "Potential for high reward but with elevated risk.", s: { [p1]: 80, [p2]: 65, [p3]: 55 } },
            { text: "Evaluate carefully", ex: "Measured approach that maintains stability.", s: { [p1]: 65, [p2]: 50, [p3]: 35 } }] },
    ],
    [
      { q: `Regulations around ${t.toLowerCase()} are tightening. How do you adapt?`, emoji: "📜",
        c: [{ text: "Exceed requirements proactively", ex: "Builds trust and future-proofs operations, but costs more upfront.", s: { [p1]: 60, [p2]: 70, [p3]: 25 } },
            { text: "Meet minimum standards", ex: "Saves budget now but may require costly changes later.", s: { [p1]: 75, [p2]: 45, [p3]: 50 } }] },
      { q: `Your ${t.toLowerCase()} team is understaffed. What's the priority?`, emoji: "👥",
        c: [{ text: "Hire specialists", ex: "Boosts quality but increases costs significantly.", s: { [p1]: 85, [p2]: 80, [p3]: 35 } },
            { text: "Train existing team", ex: "Slower improvement but more sustainable.", s: { [p1]: 65, [p2]: 50, [p3]: 30 } }] },
    ],
  ];
  const scenarios = scenarioSets[h % scenarioSets.length];

  return {
    title: `${t} Optimization`,
    description: `Optimize ${t.toLowerCase()} outcomes within the given constraints.`,
    repend_intro: {
      relevance: `In the real world, ${t.toLowerCase()} decisions are never unlimited. Leaders must achieve targets while operating under strict constraints — budget limits, time pressures, and resource scarcity.`,
      role: `a policy advisor tasked with optimizing ${t.toLowerCase()} outcomes for your organization`,
      scenario_context: `You have a limited number of decisions to make. Each one shifts the metrics — but you must hit ALL constraint targets by the end. Strategy and sequencing matter.`,
      information: [
        `You're managing: ${p1}, ${p2}, and ${p3}`,
        `Constraints define minimum/maximum thresholds you must meet`,
        `You only get ${3} decisions — choose wisely`,
      ],
      objective: `Learn to optimize ${t.toLowerCase()} outcomes within realistic constraints.`,
    },
    key_insight: `In ${t.toLowerCase()}, meeting all constraints simultaneously requires strategic thinking — not just maximizing one metric. The best decision-makers sequence their choices to create compounding positive effects.`,
    parameters: [
      { name: p1, icon: "🎯", unit: "%", min: 0, max: 100, default: 50 },
      { name: p2, icon: "💰", unit: "%", min: 0, max: 100, default: 50 },
      { name: p3, icon: "⚠️", unit: "%", min: 0, max: 100, default: 50 },
    ],
    constraints: [
      { parameter: p1, operator: ">", value: 60, label: `Keep ${t} ${p1.split(' ').pop()?.toLowerCase()} above 60%` },
      { parameter: p3, operator: "<", value: 40, label: `Keep ${t} ${p3.split(' ').pop()?.toLowerCase()} below 40%` },
    ],
    max_decisions: 3,
    decisions: scenarios.map(s => ({
      question: s.q, emoji: s.emoji,
      choices: s.c.map(c => ({ text: c.text, explanation: c.ex, set_state: c.s })),
    })),
  };
}

function generateEthicalDilemmaFallback(title: string) {
  const t = title || "Topic";
  const h = hashString(t);
  
  const dimSets = [
    [{ name: "Effectiveness", icon: "🎯", description: `How well ${t.toLowerCase()} achieves its goals` },
     { name: "Fairness", icon: "⚖️", description: `How equitably ${t.toLowerCase()} impacts stakeholders` },
     { name: "Sustainability", icon: "🌱", description: `Long-term viability of ${t.toLowerCase()} decisions` }],
    [{ name: "Innovation", icon: "💡", description: `How much ${t.toLowerCase()} drives progress` },
     { name: "Safety", icon: "🛡️", description: `Risk mitigation in ${t.toLowerCase()}` },
     { name: "Accessibility", icon: "🌍", description: `How widely ${t.toLowerCase()} benefits people` }],
    [{ name: "Profit", icon: "💰", description: `Financial returns from ${t.toLowerCase()}` },
     { name: "Community", icon: "🏘️", description: `Social impact of ${t.toLowerCase()}` },
     { name: "Environment", icon: "🌿", description: `Environmental footprint of ${t.toLowerCase()}` }],
  ];
  const dims = dimSets[h % dimSets.length];
  const dn = dims.map(d => d.name);

  const dilemmaTemplates = [
    [
      { q: `${t} can be optimized for speed or inclusivity. What do you prioritize?`, emoji: "⚖️",
        c: [{ text: "Optimize for speed", ex: "Fast results but some groups may be left behind.", impacts: { [dn[0]]: 15, [dn[1]]: -10, [dn[2]]: 0 } },
            { text: "Ensure inclusivity", ex: "Broader reach but slower progress.", impacts: { [dn[0]]: -10, [dn[1]]: 15, [dn[2]]: 5 } }] },
      { q: `A cheaper method for ${t.toLowerCase()} has hidden downsides. Your call?`, emoji: "🤔",
        c: [{ text: "Use the cheaper method", ex: "Saves money now but creates problems later.", impacts: { [dn[0]]: 10, [dn[1]]: -15, [dn[2]]: 5 } },
            { text: "Pay more for the ethical option", ex: "Higher cost but aligns with values.", impacts: { [dn[0]]: -5, [dn[1]]: 10, [dn[2]]: 10 } }] },
      { q: `Expanding ${t.toLowerCase()} requires sacrificing one area. Which?`, emoji: "🗣️",
        c: [{ text: `Sacrifice short-term ${dn[2].toLowerCase()}`, ex: "Growth now at the expense of durability.", impacts: { [dn[0]]: 10, [dn[1]]: 5, [dn[2]]: -15 } },
            { text: `Accept lower ${dn[0].toLowerCase()}`, ex: "Slower gains but a more resilient foundation.", impacts: { [dn[0]]: -15, [dn[1]]: 5, [dn[2]]: 10 } }] },
    ],
    [
      { q: `A whistleblower exposes problems in ${t.toLowerCase()}. How do you react?`, emoji: "📢",
        c: [{ text: "Full public disclosure", ex: "Builds long-term trust but causes short-term chaos.", impacts: { [dn[0]]: -10, [dn[1]]: 20, [dn[2]]: 0 } },
            { text: "Internal resolution only", ex: "Maintains control but risks credibility if leaked.", impacts: { [dn[0]]: 10, [dn[1]]: -15, [dn[2]]: 5 } }] },
      { q: `${t} data shows a vulnerable group is disproportionately affected. What now?`, emoji: "🏥",
        c: [{ text: "Redesign for equity", ex: "Costly redesign but ethically sound.", impacts: { [dn[0]]: -10, [dn[1]]: 15, [dn[2]]: 10 } },
            { text: "Maintain current approach", ex: "Efficient but perpetuates inequality.", impacts: { [dn[0]]: 15, [dn[1]]: -10, [dn[2]]: -5 } }] },
      { q: `Fast-tracking ${t.toLowerCase()} could cut corners on quality. Worth it?`, emoji: "⏱️",
        c: [{ text: "Fast-track it", ex: "Meets deadlines but quality suffers.", impacts: { [dn[0]]: 15, [dn[1]]: -10, [dn[2]]: -5 } },
            { text: "Take the time needed", ex: "Better outcomes but misses the window.", impacts: { [dn[0]]: -5, [dn[1]]: 5, [dn[2]]: 15 } }] },
    ],
  ];
  const dilemmas = dilemmaTemplates[h % dilemmaTemplates.length];

  return {
    title: `${t} Ethical Dilemma`,
    description: `Navigate ethical tradeoffs in ${t.toLowerCase()}. Every choice has consequences.`,
    repend_intro: {
      relevance: `${t} decisions in the real world often involve ethical tradeoffs. There's rarely a perfect answer — leaders must balance ${dn.map(d => d.toLowerCase()).join(", ")} while accepting that improving one area may harm another.`,
      role: `a decision-maker navigating ethical challenges in ${t.toLowerCase()}`,
      scenario_context: `You'll face ${dilemmas.length} dilemmas where every choice helps one dimension and hurts another. Your goal isn't to find the "right" answer — it's to maintain the best possible balance.`,
      information: [
        `You're balancing ${dims.length} dimensions: ${dims.map(d => `${d.icon} ${d.name}`).join(", ")}`,
        `Each choice has positive AND negative impacts — there are no free wins`,
        `You'll be scored on overall balance, not any single dimension`,
      ],
      objective: `Understand how ethical tradeoffs work in ${t.toLowerCase()} and practice maintaining balance under pressure.`,
    },
    key_insight: `In ${t.toLowerCase()}, ethical decisions are never black and white. The most effective leaders acknowledge tradeoffs openly, communicate their reasoning, and strive for balance — not perfection.`,
    dimensions: dims,
    decisions: dilemmas.map(d => ({
      question: d.q, emoji: d.emoji,
      choices: d.c.map(c => ({ text: c.text, explanation: c.ex, impacts: c.impacts })),
    })),
  };
}

function generateDecisionLabFallback(title: string) {
  const t = title || "Topic";
  const h = hashString(t);
  
  const scenarioPool = [
    {
      scenario: `You are a consultant advising a city government on ${t.toLowerCase()}. The mayor wants rapid results before election season, but rushing could undermine public trust. Community leaders are divided on the best approach, and the budget only covers one major initiative.`,
      question: `Given competing pressures, which strategy do you recommend for this ${t.toLowerCase()} initiative?`,
      options: [
        { id: "a", text: "Launch a high-visibility pilot program", consequence: `The pilot generates media attention and quick data, but it only reaches a small population. Critics argue it's performative. If results are mixed, scaling becomes politically difficult.`, is_best: false },
        { id: "b", text: "Build a coalition with community stakeholders first", consequence: `Takes 2 months longer to launch, but community buy-in ensures the initiative addresses real needs. Implementation runs smoother and outcomes are more sustainable.`, is_best: true },
        { id: "c", text: "Commission an expert report before acting", consequence: `The report takes 4 months. By the time it's ready, political momentum has faded and the budget is reallocated. The opportunity window closes.`, is_best: false },
      ],
      explanation: `Building a coalition first is best because ${t.toLowerCase()} initiatives succeed when they address actual community needs. Stakeholder engagement creates ownership and sustainability — core principles of effective ${t.toLowerCase()} strategy.`,
    },
    {
      scenario: `You're leading a team at a mid-sized company tasked with improving ${t.toLowerCase()} outcomes. The CEO wants a 40% improvement within one quarter. Your team has identified three possible approaches, each with different tradeoffs in speed, cost, and long-term impact.`,
      question: `Which approach would you choose to improve ${t.toLowerCase()} outcomes?`,
      options: [
        { id: "a", text: "Restructure the entire workflow", consequence: `Massive disruption in the short term. Productivity drops 25% for 6 weeks. But after the transition period, the 40% improvement target is exceeded and the new system is more resilient.`, is_best: false },
        { id: "b", text: "Implement targeted improvements to bottlenecks", consequence: `Addresses the top 3 bottlenecks identified by data analysis. Achieves a 30% improvement within the quarter with minimal disruption. Sets up infrastructure for continued gains.`, is_best: true },
        { id: "c", text: "Outsource the function entirely", consequence: `Quick results on paper, but institutional knowledge is lost. Quality control becomes harder and costs increase 20% annually. The company becomes dependent on external providers.`, is_best: false },
      ],
      explanation: `Targeted bottleneck improvements work best because they use data to focus resources where impact is highest, minimize disruption, and create a foundation for iterative improvement — a key principle in ${t.toLowerCase()}.`,
    },
    {
      scenario: `A nonprofit focused on ${t.toLowerCase()} has received an unexpected $2M grant, but it comes with strings: the money must be spent within 18 months and measurable impact must be demonstrated. Your team of 12 is already at capacity with existing programs.`,
      question: `How do you deploy the $2M grant effectively?`,
      options: [
        { id: "a", text: "Hire aggressively and launch a new flagship program", consequence: `You hire 8 new staff and launch a bold new initiative. But onboarding takes months, the new program has untested assumptions, and by month 12 you've spent 70% of the budget with limited measurable results.`, is_best: false },
        { id: "b", text: "Scale proven programs and add evaluation infrastructure", consequence: `You expand 2 existing programs that already show results, hire 3 staff plus a data analyst, and invest in measurement tools. By month 15, you show clear impact data and the funder offers a renewal.`, is_best: true },
        { id: "c", text: "Distribute grants to partner organizations", consequence: `Quick disbursement satisfies the timeline, but you lose control over quality and measurement. Partner reports are inconsistent. The funder questions your organization's capacity to lead.`, is_best: false },
      ],
      explanation: `Scaling proven programs is optimal because it leverages existing evidence of impact, reduces execution risk, and builds measurement capacity — ensuring ${t.toLowerCase()} outcomes are both real and demonstrable.`,
    },
  ];
  const chosen = scenarioPool[h % scenarioPool.length];

  return {
    concept_knowledge: {
      definition: `${t} refers to the study and application of key principles that drive outcomes in this domain.`,
      key_ideas: [
        `${t} involves balancing multiple competing factors.`,
        `Decisions in ${t.toLowerCase()} have short-term and long-term consequences.`,
        `Understanding tradeoffs is essential to making effective choices.`,
      ],
      examples: [
        `A manager using ${t.toLowerCase()} principles to allocate limited resources across departments.`,
        `A government applying ${t.toLowerCase()} concepts when designing new public policy.`,
      ],
    },
    real_world_relevance: {
      explanation: `${t} directly impacts how organizations, governments, and individuals make critical decisions. Understanding this concept helps you anticipate consequences and design better strategies in real-world situations.`,
      domain: "Strategic Decision-Making",
    },
    scenario: chosen.scenario,
    decision_challenge: {
      question: chosen.question,
      options: chosen.options,
    },
    best_decision_explanation: chosen.explanation,
  };
}
/* ===============================
   REPAIR MODULES
================================ */

const MATH_VISUAL_TYPES = ["graph", "geometry", "solution_steps", "chart"] as const;
type MathVisualType = (typeof MATH_VISUAL_TYPES)[number];

function isMathVisualType(value: unknown): value is MathVisualType {
  return typeof value === "string" && MATH_VISUAL_TYPES.includes(value as MathVisualType);
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickMathVisualType(title: string, moduleIndex: number): MathVisualType {
  const base = hashString((title || "math").toLowerCase());
  return MATH_VISUAL_TYPES[(base + moduleIndex) % MATH_VISUAL_TYPES.length];
}

function generateMathLabFallback(title: string, visualType: MathVisualType) {
  const t = title || "Math Topic";
  const tLower = t.toLowerCase();

  // Derive topic-aware defaults instead of always using quadratics
  const isTrig = /trig|sin|cos|tan|angle|radian|unit circle/i.test(t);
  const isCalc = /deriv|tangent|limit|integral|rate of change|slope/i.test(t);
  const isGeom = /triangle|circle|area|perim|angle|polygon|congruent|similar/i.test(t);
  const isStats = /stat|mean|median|data|probability|distribution|regression/i.test(t);
  const isLinear = /linear|slope|intercept|line/i.test(t) && !isCalc;

  const shared = {
    title: t,
    objective: `Practice ${t} through an interactive ${visualType.replace("_", " ")} lab.`,
    concept_overview: `This lab helps you apply ${t} using visual reasoning and structured problem solving.`,
    scenario: `You are applying ${tLower} to solve a practical real-world problem.`,
    instructions: "Complete each task in order, show your reasoning, and verify your final answer.",
    tasks: [
      { id: 1, description: `Identify the key information and formulas needed for this ${tLower} problem.`, type: "explanation", correct_answer: "" },
      { id: 2, description: `Compute the required value using ${tLower} methods.`, type: "input", correct_answer: "" },
      { id: 3, description: "Explain why your method is valid and check your answer.", type: "explanation", correct_answer: "" },
    ],
    hints: [
      `Review the key formulas for ${tLower}.`,
      "Keep units and signs consistent.",
      "Check your answer against the visual representation.",
    ],
    solution: `Apply the standard ${tLower} method step by step to find the answer.`,
    solution_explanation: `Break the ${tLower} problem into smaller steps, compute carefully, then validate.`,
  };

  if (visualType === "graph") {
    // Topic-aware equation defaults
    let equation = "a*x^2 + b*x + c";
    let keyPoints = [{ x: 2, y: -1, label: "Vertex" }];
    let xRange: [number, number] = [-5, 10];
    let yRange: [number, number] = [-5, 15];
    let xLabel = "x", yLabel = "y";
    let params = [
      { name: "a", label: "Coefficient a", min: -5, max: 5, step: 1, default: 1 },
      { name: "b", label: "Coefficient b", min: -10, max: 10, step: 1, default: -4 },
      { name: "c", label: "Constant c", min: -10, max: 10, step: 1, default: 3 },
    ];

    if (isTrig) {
      equation = "a*Math.sin(b*x)+c";
      keyPoints = [{ x: 0, y: 0, label: "Origin" }, { x: 1.57, y: 1, label: "Peak" }];
      xRange = [-7, 7]; yRange = [-6, 6];
      params = [
        { name: "a", label: "Amplitude", min: 1, max: 5, step: 1, default: 1 },
        { name: "b", label: "Frequency", min: 1, max: 4, step: 1, default: 1 },
        { name: "c", label: "Vertical shift", min: -3, max: 3, step: 1, default: 0 },
      ];
    } else if (isCalc) {
      equation = "b*x^3 - 3*b*x + c";
      keyPoints = [{ x: 1, y: -2, label: "Point of tangency" }];
      xRange = [-4, 4]; yRange = [-10, 10];
      params = [
        { name: "a", label: "Tangent point x", min: -3, max: 3, step: 0.5, default: 1 },
        { name: "b", label: "Coefficient", min: 1, max: 5, step: 1, default: 1 },
        { name: "c", label: "Vertical shift", min: -5, max: 5, step: 1, default: 0 },
      ];
    } else if (isLinear) {
      equation = "a*x + b";
      keyPoints = [{ x: 0, y: 1, label: "y-intercept" }];
      xRange = [-5, 5]; yRange = [-15, 15];
      params = [
        { name: "a", label: "Slope (m)", min: -5, max: 5, step: 1, default: 2 },
        { name: "b", label: "y-intercept (b)", min: -10, max: 10, step: 1, default: 1 },
        { name: "c", label: "Unused", min: 0, max: 0, step: 1, default: 0 },
      ];
    }

    return {
      ...shared,
      visual_type: "graph",
      graph_data: { type: "function", equation, x_label: xLabel, y_label: yLabel, x_range: xRange, y_range: yRange, key_points: keyPoints },
      interactive_params: params,
    };
  }

  if (visualType === "geometry") {
    return {
      ...shared,
      visual_type: "geometry",
      geometry: [
        {
          type: isGeom && /circle/i.test(t) ? "circle" : "triangle",
          points: [
            { x: 2, y: 2, label: "A" },
            { x: 8, y: 2, label: "B" },
            { x: 5, y: 7, label: "C" },
          ],
          measurements: { AB: "6", BC: "5.83", AC: "5.83" },
        },
      ],
    };
  }

  if (visualType === "chart") {
    return {
      ...shared,
      visual_type: "chart",
      graph_data: {
        type: isStats ? "bar" : "bar",
        data_labels: isStats ? ["Q1", "Q2", "Q3", "Q4"] : ["Set A", "Set B", "Set C", "Set D"],
        data_values: isStats ? [78, 85, 72, 91] : [12, 18, 9, 15],
        x_label: isStats ? "Quarter" : "Set",
        y_label: isStats ? "Score" : "Value",
      },
    };
  }

  return {
    ...shared,
    visual_type: "solution_steps",
    solution_steps: [
      { step: 1, expression: `Identify knowns for ${tLower}`, explanation: "List all given values and define the target variable." },
      { step: 2, expression: `Apply ${tLower} formula`, explanation: "Substitute values carefully and simplify." },
      { step: 3, expression: "Verify and interpret", explanation: "Check arithmetic and explain what the result means." },
    ],
  };
}

function normalizeMathLabData(labData: any, title: string, moduleIndex: number) {
  const preferredVisual = pickMathVisualType(title, moduleIndex);
  const requestedVisual = isMathVisualType(labData?.visual_type) ? labData.visual_type : preferredVisual;
  const fallback = generateMathLabFallback(title, requestedVisual);

  const normalized: any = {
    ...fallback,
    ...(labData && typeof labData === "object" ? labData : {}),
    visual_type: requestedVisual,
  };

  if (!Array.isArray(normalized.tasks) || normalized.tasks.length === 0) {
    normalized.tasks = fallback.tasks;
  }

  normalized.tasks = normalized.tasks.map((task: any, i: number) => {
    const nextTask: any = {
      id: typeof task?.id === "number" ? task.id : i + 1,
      description: typeof task?.description === "string" && task.description.trim().length > 0
        ? task.description
        : `Solve task ${i + 1} for ${title}.`,
      type: task?.type === "choice" || task?.type === "explanation" || task?.type === "input" ? task.type : "input",
      correct_answer: typeof task?.correct_answer === "string" ? task.correct_answer : "",
    };

    if (Array.isArray(task?.options) && task.options.length > 0) {
      nextTask.options = task.options;
    } else if (nextTask.type === "choice") {
      nextTask.options = ["Option A", "Option B", "Option C"];
    }

    return nextTask;
  });

  if (!Array.isArray(normalized.hints) || normalized.hints.length === 0) {
    normalized.hints = fallback.hints;
  }

  if (!normalized.instructions) normalized.instructions = fallback.instructions;
  if (!normalized.objective) normalized.objective = fallback.objective;
  if (!normalized.concept_overview) normalized.concept_overview = fallback.concept_overview;
  if (!normalized.solution) normalized.solution = fallback.solution;
  if (!normalized.solution_explanation) normalized.solution_explanation = fallback.solution_explanation;

  if ((normalized.visual_type === "graph" || normalized.visual_type === "chart") && !normalized.graph_data) {
    normalized.graph_data = fallback.graph_data;
  }

  if (normalized.visual_type === "graph" && (!Array.isArray(normalized.interactive_params) || normalized.interactive_params.length === 0)) {
    normalized.interactive_params = fallback.interactive_params;
  }

  if (normalized.visual_type === "geometry" && (!Array.isArray(normalized.geometry) || normalized.geometry.length === 0)) {
    normalized.geometry = fallback.geometry;
  }

  if (normalized.visual_type === "solution_steps" && (!Array.isArray(normalized.solution_steps) || normalized.solution_steps.length === 0)) {
    normalized.solution_steps = fallback.solution_steps;
  }

  return normalized;
}

function repairModules(parsed: any) {
  if (!parsed?.modules || !Array.isArray(parsed.modules)) return parsed;

  for (let moduleIndex = 0; moduleIndex < parsed.modules.length; moduleIndex++) {
    const mod = parsed.modules[moduleIndex];
    mod.lab_data = mod.lab_data ?? {};

    if (!mod.lesson_content) {
      mod.lesson_content = mod.content || mod.lesson || mod.text || "## Lesson Content\n\nContent is being prepared.";
    }

    if (mod.lesson_content && !mod.lesson_content.includes("\n---\n")) {
      const sections = mod.lesson_content.split(/(?=^## )/m).filter(Boolean);
      if (sections.length > 1) {
        mod.lesson_content = sections.join("\n\n---\n\n");
      }
    }

    if (mod.lesson_content) {
      const slides = mod.lesson_content.split(/\n---\n/).map((s: string) => s.trim()).filter(Boolean);
      const repairedSlides: string[] = [];

      let inTable = false;
      for (let si = 0; si < slides.length; si++) {
        let slide = slides[si];

        const lines = slide.split("\n");
        const repaired: string[] = [];
        inTable = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { inTable = false; repaired.push(""); continue; }
          // Preserve table rows and separators
          if (trimmed.startsWith("|") || /^\|[-:| ]+\|$/.test(trimmed)) {
            inTable = true;
            repaired.push(line);
          } else if (inTable && trimmed.startsWith("|")) {
            repaired.push(line);
          } else if (
            // Preserve: headings, comments, existing bullets, emoji headers, numbered lists, bold text, blockquotes
            trimmed.startsWith("#") || trimmed.startsWith("<!--") || 
            trimmed.startsWith("- ") || trimmed.startsWith("* ") || 
            trimmed.startsWith("> ") ||
            trimmed.startsWith("**") ||
            /^\d+\./.test(trimmed) ||
            // Preserve any line starting with an emoji (covers 🔥💡📊🎯🧪🧠✅⚡🛠📈🌎🎭📋 etc.)
            /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/u.test(trimmed)
          ) {
            inTable = false;
            repaired.push(line);
          } else {
            inTable = false;
            // Don't aggressively bulletize — only convert plain text lines that are clearly paragraphs (>80 chars)
            if (trimmed.length > 80 && !trimmed.includes("|")) {
              repaired.push(`- ${trimmed}`);
            } else {
              repaired.push(line);
            }
          }
        }
        slide = repaired.join("\n");

        if (!slide.includes("<!-- type:")) {
          if (si === slides.length - 1 && slide.toLowerCase().includes("takeaway")) {
            slide = `<!-- type: key_takeaways -->\n${slide}`;
          } else {
            slide = `<!-- type: concept -->\n${slide}`;
          }
        }

        repairedSlides.push(slide);
      }

      if (repairedSlides.length > 0) {
        const last = repairedSlides[repairedSlides.length - 1];
        if (!last.includes("<!-- type: key_takeaways -->")) {
          repairedSlides[repairedSlides.length - 1] = last.replace(/<!-- type: \w+ -->/, "<!-- type: key_takeaways -->");
        }
      }

      while (repairedSlides.length > 8) {
        let minLen = Infinity, minIdx = 0;
        for (let i = 0; i < repairedSlides.length - 1; i++) {
          const combined = repairedSlides[i].length + repairedSlides[i + 1].length;
          if (combined < minLen) { minLen = combined; minIdx = i; }
        }
        repairedSlides[minIdx] = repairedSlides[minIdx] + "\n" + repairedSlides[minIdx + 1];
        repairedSlides.splice(minIdx + 1, 1);
      }

      mod.lesson_content = repairedSlides.join("\n\n---\n\n");
    }

    if (!mod.lab_type) {
      mod.lab_type = "simulation";
    }

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

    const ld = mod.lab_data;
    const title = mod.title || "Topic";

    if (mod.lab_type === "simulation") {
      if (ld && typeof ld === "object" && Array.isArray(ld.parameters) && ld.parameters.length >= 1) {
        // AI generated something with parameters — repair it, don't replace
        console.log(`[RepairModules] Repairing AI simulation for: "${title}" (${ld.parameters.length} params)`);
        mod.lab_data = repairSimulation(ld, title);
      } else if (!isValidSimulation(ld)) {
        console.warn(`[RepairModules] Simulation completely unusable for: "${title}" — using fallback`);
        mod.lab_data = generateSimulationFallback(title);
      }
    } else if (mod.lab_type === "classification") {
      if (ld && typeof ld === "object" && (Array.isArray(ld.items) || Array.isArray(ld.categories))) {
        console.log(`[RepairModules] Repairing AI classification for: "${title}"`);
        mod.lab_data = repairClassification(ld, title);
      } else if (!isValidClassification(ld)) {
        console.warn(`[RepairModules] Classification completely unusable for: "${title}" — using fallback`);
        mod.lab_data = generateClassificationFallback(title);
      }
    } else if (mod.lab_type === "policy_optimization") {
      if (ld && typeof ld === "object" && Array.isArray(ld.parameters) && ld.parameters.length >= 1) {
        console.log(`[RepairModules] Repairing AI policy_optimization for: "${title}" (${ld.parameters.length} params)`);
        mod.lab_data = repairPolicyOptimization(ld, title);
      } else if (!isValidPolicyOptimization(ld)) {
        console.warn(`[RepairModules] Policy optimization completely unusable for: "${title}" — using fallback`);
        mod.lab_data = generatePolicyOptimizationFallback(title);
      }
    } else if (mod.lab_type === "ethical_dilemma") {
      if (ld && typeof ld === "object" && Array.isArray(ld.dimensions) && ld.dimensions.length >= 1) {
        console.log(`[RepairModules] Repairing AI ethical_dilemma for: "${title}" (${ld.dimensions.length} dims)`);
        mod.lab_data = repairEthicalDilemma(ld, title);
      } else if (!isValidEthicalDilemma(ld)) {
        console.warn(`[RepairModules] Ethical dilemma completely unusable for: "${title}" — using fallback`);
        mod.lab_data = generateEthicalDilemmaFallback(title);
      }
    } else if (mod.lab_type === "decision_lab") {
      // Always attempt repair first — decision labs have the most varied AI output
      console.log(`[RepairModules] Repairing AI decision_lab for: "${title}"`);
      mod.lab_data = repairDecisionLab(ld || {}, title);
    } else if (mod.lab_type === "math_lab") {
      mod.lab_data = normalizeMathLabData(mod.lab_data, title, moduleIndex);
    }

    // --- FINAL GUARD (relaxed) ---
    // Only fallback if lab_data is completely empty/null after repair
    const finalLD = mod.lab_data;
    const hasAnyContent = finalLD && typeof finalLD === "object" && Object.keys(finalLD).length > 2;

    if (!hasAnyContent) {
      console.error(`[RepairModules] FINAL GUARD - Lab still empty after repair for: "${title}" — generating fallback`);
      mod.lab_type = "simulation";
      mod.lab_data = generateSimulationFallback(title);
    }
  }

  const mathModules = parsed.modules
    .filter((mod: any) => mod.lab_type === "math_lab" && mod.lab_data)
    .map((mod: any, idx: number) => ({ mod, idx }));

  if (mathModules.length > 1) {
    const uniqueVisualTypes = new Set(
      mathModules
        .map(({ mod }) => mod.lab_data?.visual_type)
        .filter((v) => isMathVisualType(v)),
    );

    if (uniqueVisualTypes.size <= 1) {
      mathModules.forEach(({ mod, idx }) => {
        const forcedVisual = MATH_VISUAL_TYPES[idx % MATH_VISUAL_TYPES.length];
        mod.lab_data = normalizeMathLabData(
          { ...mod.lab_data, visual_type: forcedVisual },
          mod.title || "Math Topic",
          idx,
        );
      });
    }
  }

  return parsed;
}

/* ===============================
   📄 FILE CONTENT EXTRACTION
================================ */

async function extractFileContent(filePath: string, supabaseAdmin: any): Promise<{ text?: string; imageBase64?: string; mimeType?: string }> {
  const { data, error } = await supabaseAdmin.storage.from("course-uploads").download(filePath);
  if (error || !data) {
    console.error("Failed to download file:", error);
    return {};
  }

  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const imageExts = ["png", "jpg", "jpeg", "webp"];
  const textExts = ["txt", "md", "csv"];

  if (imageExts.includes(ext)) {
    const buffer = await data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
    return { imageBase64: base64, mimeType: mimeMap[ext] || "image/png" };
  }

  if (textExts.includes(ext)) {
    const text = await data.text();
    return { text: text.slice(0, 50000) }; // Cap at 50k chars
  }

  if (ext === "pdf") {
    // For PDFs, read as text (basic extraction — works for text-based PDFs)
    try {
      const text = await data.text();
      // If it looks like binary PDF content, extract what we can
      const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").trim();
      if (cleaned.length > 100) {
        return { text: cleaned.slice(0, 50000) };
      }
      // Fallback: send as image-like content for Gemini multimodal
      const buffer = await data.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return { imageBase64: base64, mimeType: "application/pdf" };
    } catch {
      return {};
    }
  }

  return {};
}

/* ===============================
   🚀 MAIN HANDLER
================================ */

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

    const { topic, filePath } = await req.json();
    if (!topic?.trim()) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Extract file content if provided
    let fileContent: { text?: string; imageBase64?: string; mimeType?: string } = {};
    if (filePath) {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      fileContent = await extractFileContent(filePath, supabaseAdmin);
      console.log(`[FileUpload] Extracted content from: ${filePath}, hasText: ${!!fileContent.text}, hasImage: ${!!fileContent.imageBase64}`);
    }

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

    // Build user message content
    let userContent: any;
    const topicMessage = fileContent.text
      ? `Create a course on: ${topic}\n\nSOURCE MATERIAL (use this as the primary basis for the course content — all lessons, labs, and quizzes should be grounded in this material):\n\n${fileContent.text}`
      : `Create a course on: ${topic}`;

    if (fileContent.imageBase64 && fileContent.mimeType) {
      // Multimodal: send image + text
      userContent = [
        {
          type: "image_url",
          image_url: { url: `data:${fileContent.mimeType};base64,${fileContent.imageBase64}` },
        },
        {
          type: "text",
          text: `Create a course on: ${topic}\n\nThe attached image/document is the SOURCE MATERIAL. Use it as the primary basis for the course content — all lessons, labs, and quizzes should be grounded in this material.`,
        },
      ];
    } else {
      userContent = topicMessage;
    }

    const aiRequestBody = JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `You are an expert educational designer for Repend, an AI-powered cognitive simulation learning platform.

CRITICAL IDENTITY: You are NOT filling a pre-existing lab template. You must DESIGN a unique lab structure that fits each concept. Each lab must introduce its own mechanics, visuals, and student decisions.

Repend is NOT a static lesson generator. It generates interactive labs and simulations dynamically through a backend simulation engine.

Your task: generate structured course modules where each module contains a VISUAL LESSON that teaches the concept, followed by a DYNAMICALLY GENERATED LAB SIMULATION built from the topic itself.

Return structured JSON only via the function tool.

=== CORE PHILOSOPHY ===
1. Students do NOT passively consume lessons — they learn → observe → test → apply
2. Every lesson must TEACH the concept visually BEFORE the lab begins
3. Labs are DYNAMICALLY GENERATED from the topic — never from predefined templates
4. Labs must feel like SYSTEM EXPLORATION, not worksheets or school lab reports
5. RELEVANCE IS KING — every slide, lab, and quiz must directly match the module concept
6. The system generates TWO parts: a visible student lesson and hidden lab structure (lab_data) for rendering

=== CRITICAL MODULE STRUCTURE ===
Every module MUST have ALL of these fields:
- title: string
- lesson_content: string (slide-based markdown, see LESSON FORMAT below)
- youtube_query: string (search query to find a relevant video)
- youtube_title: string
- lab_type: one of "simulation", "classification", "policy_optimization", "ethical_dilemma", "decision_lab", "math_lab"
- lab_data: object (SIMULATION BLUEPRINT — format depends on lab_type, see below)
- quiz: array of {question, options: string[4], correct: number 0-3, explanation}

=== LESSON FORMAT — VISUAL NOTES STYLE ===
Each slide is separated by "---". Slides must be VISUAL, CLEAN, and MODERN.

MANDATORY FORMATTING RULES:
• Use emojis in EVERY section header (🔥 🎯 📊 💡 🧪 🧠 ✅ ⚡ 🛠 📈 🌎 🎭)
• Use TABLES when explaining concepts
• Short paragraphs ONLY (2-3 sentences MAX)
• Use bullet points for all lists
• Include at least ONE table per module across all slides

SLIDE FORMAT:
<!-- type: [concept|example|case_study|comparison|quick_think|myth_vs_reality|process|interactive_predict|key_takeaways] -->
## 🔥 Slide Title (emoji in EVERY title)

STUDENT LESSON FLOW — mandatory 7-slide sequence:
Slide 1: 🎯 Learning Objective
Slide 2: 🧠 Core Concept Explanation with definitions, formulas, examples, and a table
Slide 3: 📊 Visual Concept Summary table
Slide 4: 🌎 Real-World Relevance
Slide 5: 🧪 Lab Preview — describe the simulation
Slide 6: 🧠 Challenge — problem to solve
Slide 7: ✅ Key Takeaways

SLIDE RULES: 5-8 slides per module (7 ideal), 4-7 bullets per slide under 15 words, NO long paragraphs.

=== QUIZ RULES ===
- 8-10 questions per module (70% to pass)
- Mix: 3 conceptual, 3 applied reasoning, 2-3 scenario-based, 1 advanced challenge
- No definition-only questions, no "All of the above"

=== DYNAMIC LAB ENGINE ===
You are generating the lab ENGINE, not filling a template.

LAB DESIGN RULES:
1. Dynamically generated from the concept — no school lab formats
2. Interactive system with simulations, adjustable parameters, scenario-based decisions
3. Visual component required (graphs, diagrams, dashboards)
4. Student decisions must change outcomes
5. Every lab must include tradeoffs — no choice improves everything
6. Labs feel like system exploration, not worksheets
7. Connect to real-world systems
8. AI may invent new lab mechanics
9. Each module MUST have a different lab experience

=== LAB TYPE SELECTION ===
| Topic Type | Lab Type |
|-----------|----------|
| Systemic/process | simulation |
| Analytical/sorting | classification |
| Strategic/constraint | policy_optimization |
| Ethical/moral | ethical_dilemma |
| Strategic reasoning | decision_lab |
| Math | math_lab |

MATH LAB RULE: If math-related, use "math_lab" for ALL modules with rotating visual_type.

=== REPEND LEARNING FORMULA ===
Every lab_data (except math_lab) MUST include:
{
  "repend_intro": {
    "relevance": "WHERE used in real life",
    "role": "Specific role (e.g., 'the head nurse at a 200-bed hospital')",
    "scenario_context": "2-3 sentences setting the scene",
    "information": ["Key fact 1", "Key fact 2", "Key fact 3"],
    "objective": "1 sentence skill/insight"
  },
  "key_insight": "Core lesson in 1-2 sentences"
}

=== SIMULATION LAB (lab_type: "simulation") ===
{ "title", "repend_intro", "key_insight", "parameters": [{"name": "<TOPIC-SPECIFIC>", "icon", "unit": "%", "min": 0, "max": 100, "default": 50}], "thresholds": [{label, min_percent, message}], "decisions": [{"question", "emoji", "choices": [{"text", "explanation", "set_state": {all params mapped to 0-100}}]}] }
RULES: 3-5 parameters, 2-3 decisions with 2 choices each. Domain-specific variable names.

=== CLASSIFICATION LAB (lab_type: "classification") ===
{ "title", "description", "repend_intro", "key_insight", "categories": [{"name", "description", "color"}], "items": [{"content", "correctCategory", "explanation"}] }
RULES: 3-4 categories, 6-8 items minimum.

=== POLICY OPTIMIZATION LAB (lab_type: "policy_optimization") ===
{ "title", "description", "repend_intro", "key_insight", "parameters": [...], "constraints": [{"parameter", "operator", "value", "label"}], "max_decisions": 3, "decisions": [...] }
RULES: 3 parameters, 2-3 constraints.

=== ETHICAL DILEMMA LAB (lab_type: "ethical_dilemma") ===
{ "title", "description", "repend_intro", "key_insight", "dimensions": [{"name", "icon", "description"}], "decisions": [{"question", "emoji", "choices": [{"text", "explanation", "impacts": {dim: delta}}]}] }
RULES: 3-4 dimensions, 3-4 dilemmas. Impacts are deltas -50 to +50.

=== DECISION LAB (lab_type: "decision_lab") ===
{ "concept_knowledge": {"definition", "key_ideas": [], "examples": []}, "real_world_relevance": {"explanation", "domain"}, "scenario": "3-5 sentences", "decision_challenge": {"question", "options": [{"id", "text", "consequence", "is_best": boolean}]}, "best_decision_explanation" }
RULES: 3-4 options, exactly 1 is_best: true.

=== MATH LAB (lab_type: "math_lab") ===
{ "title", "objective", "concept_overview", "visual_type": "graph"|"geometry"|"solution_steps"|"chart", "graph_data", "scenario", "instructions", "tasks": [{"id", "description", "type": "input"|"choice"|"explanation", "correct_answer"}], "hints", "solution", "solution_explanation" }

=== ANTI-REPETITION RULES ===
- Each module MUST use a DIFFERENT lab mechanic and scenario
- Domain-specific variables (chemistry: Temperature/pH, physics: Velocity/Force, NOT Efficiency/Quality)
- For 4-6 modules, use AT LEAST 3 different lab_types

${filePath ? "IMPORTANT: Base ALL content on the uploaded SOURCE MATERIAL." : ""}
Generate 4-6 modules with at least 3 different lab types. Include 1-2 decision_lab modules.`,
          },
          { role: "user", content: userContent },
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
                        lab_type: { type: "string", enum: ["simulation", "classification", "policy_optimization", "ethical_dilemma", "decision_lab", "math_lab"] },
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
      });

    // Retry logic for transient AI gateway errors
    const MAX_RETRIES = 2;
    let aiData: any = null;
    let lastError = "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 3000; // 3s, 6s
        console.log(`[AI Retry] Attempt ${attempt + 1} after ${delay}ms delay...`);
        await new Promise(r => setTimeout(r, delay));
      }

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: aiRequestBody,
        });

        if (response.status === 429) {
          lastError = "Rate limit exceeded. Please wait a moment and try again.";
          console.warn(`[AI Retry] 429 rate limited on attempt ${attempt + 1}`);
          continue;
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits to continue generating courses.");
        }

        const responseText = await response.text();
        
        if (!response.ok) {
          console.warn(`[AI Retry] Gateway returned ${response.status} on attempt ${attempt + 1}:`, responseText.substring(0, 300));
          lastError = `AI gateway error (${response.status}). Please try again.`;
          continue;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          console.error("AI response was not valid JSON:", responseText.substring(0, 500));
          lastError = "AI returned an invalid response. Please try again.";
          continue;
        }

        if (!parsed.choices?.length) {
          console.warn(`[AI Retry] No choices on attempt ${attempt + 1}:`, JSON.stringify(parsed).substring(0, 300));
          lastError = "Empty AI response. The model may have been overloaded — please try again.";
          continue;
        }

        aiData = parsed;
        break; // Success
      } catch (fetchErr: any) {
        if (fetchErr.message?.includes("credits")) throw fetchErr; // Don't retry payment errors
        console.warn(`[AI Retry] Fetch error on attempt ${attempt + 1}:`, fetchErr.message);
        lastError = fetchErr.message || "Network error contacting AI gateway.";
      }
    }

    if (!aiData) {
      throw new Error(lastError || "Failed to get AI response after multiple attempts. Please try again.");
    }

    const message = aiData.choices[0].message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall) {
      const finishReason = aiData.choices[0]?.finish_reason;
      console.error("No tool call. finish_reason:", finishReason, "message:", JSON.stringify(message).substring(0, 300));
      throw new Error(`AI did not return course data (reason: ${finishReason || "unknown"}). Please try again.`);
    }

    // Parse and repair — handle truncated JSON from the model
    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      // Attempt to repair truncated JSON
      let raw = toolCall.function.arguments || "";
      // Remove trailing incomplete tokens and try to close the JSON
      raw = raw.replace(/,\s*$/, "");
      // Try progressively closing brackets
      const closers = ["]}]}", "]}}", "]}", "}", "]"];
      let repaired = false;
      for (const closer of closers) {
        try {
          parsed = JSON.parse(raw + closer);
          console.warn("Repaired truncated JSON by appending:", closer);
          repaired = true;
          break;
        } catch { /* try next */ }
      }
      if (!repaired) {
        console.error("Could not repair truncated AI output:", raw.substring(raw.length - 200));
        throw new Error("AI response was truncated. Please try again with a simpler topic or fewer modules.");
      }
    }
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

    // Track file-based course generation
    if (filePath) {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      
      const { data: existing } = await supabaseAdmin
        .from("usage_tracking")
        .select("id, file_courses_generated")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .single();

      if (existing) {
        await supabaseAdmin
          .from("usage_tracking")
          .update({ file_courses_generated: (existing.file_courses_generated || 0) + 1 })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("usage_tracking")
          .insert({ user_id: user.id, month: currentMonth, file_courses_generated: 1, courses_generated: 1 });
      }
    }

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
