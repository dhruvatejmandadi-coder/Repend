import { FlaskConical } from "lucide-react";
import SimulationLab from "./SimulationLab";
import ClassificationLab from "./ClassificationLab";
import { useMemo } from "react";

type Props = {
  labType?: string | null;
  labData?: any;
  labTitle?: string | null;
  labDescription?: string | null;
};

function isValidLabData(labType: string | null | undefined, labData: any): boolean {
  if (!labType || !labData || typeof labData !== "object") return false;
  try {
    if (labType === "simulation") {
      return Array.isArray(labData.parameters) && labData.parameters.length > 0;
    }
    if (labType === "classification") {
      return Array.isArray(labData.items) && labData.items.length > 0 &&
             Array.isArray(labData.categories) && labData.categories.length > 0;
    }
  } catch (e) {
    console.warn("[InteractiveLab] Validation error:", e);
  }
  return false;
}

/** Generates a topic-relevant fallback simulation from the module title keywords */
function generateTopicFallback(title?: string | null): { type: string; data: any } {
  const t = (title || "").toLowerCase();
  console.info(`[InteractiveLab] Generating topic-aware fallback for: "${title}"`);

  // Math / Statistics
  if (/statistic|mean|median|deviation|variance|probability|data\s?set/i.test(t)) {
    return sim(title, "Statistical Analysis Lab",
      "Explore how sample properties affect statistical outcomes.",
      "Statistical Confidence Model",
      [
        { name: "Sample Size", icon: "📊", unit: "samples", min: 5, max: 500, default: 50, description: "Number of data points collected" },
        { name: "Variance", icon: "📈", unit: "%", min: 0, max: 100, default: 40, description: "How spread out the data is" },
        { name: "Confidence Level", icon: "🎯", unit: "%", min: 50, max: 99, default: 95, description: "Desired confidence in your conclusion" },
      ],
      [
        { label: "🌟 Highly Reliable", min_percent: 80, message: "Large sample with controlled variance — your analysis is robust." },
        { label: "📈 Moderate Confidence", min_percent: 50, message: "Reasonable results, but consider increasing sample size or reducing variance." },
        { label: "⚠️ Unreliable", min_percent: 0, message: "Too few samples or too much variance — conclusions are questionable." },
      ],
      [
        { question: "You have a tight deadline. How do you collect data?", emoji: "⏰", choices: [
          { text: "Grab a small convenience sample", explanation: "Fast but introduces bias and low confidence.", effects: { "Sample Size": -20, "Variance": 15 } },
          { text: "Use stratified random sampling", explanation: "Takes longer but ensures representative data.", effects: { "Sample Size": 50, "Variance": -10 } },
          { text: "Rely on existing datasets", explanation: "No new collection cost but variance depends on data quality.", effects: { "Confidence Level": -5, "Variance": 10 } },
        ]},
      ]
    );
  }

  // Science / Chemistry / Physics
  if (/chemi|reaction|element|atom|molecule|physics|force|energy|motion|wave/i.test(t)) {
    return sim(title, "Scientific Variables Lab",
      "Adjust experimental variables to observe their effect on the outcome.",
      "Experimental Outcome Model",
      [
        { name: "Temperature", icon: "🌡️", unit: "°C", min: 0, max: 200, default: 50, description: "Heat energy in the system" },
        { name: "Concentration", icon: "🧪", unit: "mol/L", min: 0, max: 100, default: 30, description: "Amount of reactant present" },
        { name: "Catalyst", icon: "⚡", unit: "%", min: 0, max: 100, default: 20, description: "Catalyst effectiveness" },
      ],
      [
        { label: "🌟 Optimal Reaction", min_percent: 80, message: "Conditions are ideal — maximum yield expected." },
        { label: "📈 Partial Reaction", min_percent: 50, message: "Reaction proceeds but is not fully optimized." },
        { label: "⚠️ Minimal Activity", min_percent: 0, message: "Insufficient energy or reagents — very little product formed." },
      ],
      [
        { question: "The reaction is too slow. What do you adjust?", emoji: "🧪", choices: [
          { text: "Crank up the temperature", explanation: "More heat speeds the reaction but risks side reactions.", effects: { "Temperature": 40, "Catalyst": -5 } },
          { text: "Add more catalyst", explanation: "Lowers activation energy without changing temperature.", effects: { "Catalyst": 30 } },
          { text: "Increase reactant concentration", explanation: "More collisions per second speeds things up.", effects: { "Concentration": 25 } },
        ]},
      ]
    );
  }

  // Economics / Business / Finance
  if (/econom|market|supply|demand|profit|finance|business|invest|budget|revenue/i.test(t)) {
    return sim(title, "Market Dynamics Lab",
      "Model how economic factors influence market outcomes.",
      "Economic Output Model",
      [
        { name: "Demand", icon: "📈", unit: "units", min: 0, max: 1000, default: 500, description: "Consumer demand for the product" },
        { name: "Supply", icon: "🏭", unit: "units", min: 0, max: 1000, default: 400, description: "Producer supply capacity" },
        { name: "Price Point", icon: "💰", unit: "$", min: 1, max: 100, default: 30, description: "Selling price per unit" },
      ],
      [
        { label: "🌟 Market Equilibrium", min_percent: 80, message: "Supply and demand are well balanced — healthy market conditions." },
        { label: "📈 Partial Balance", min_percent: 50, message: "Some imbalance exists — price adjustments may be needed." },
        { label: "⚠️ Market Failure", min_percent: 0, message: "Severe imbalance — surplus or shortage likely." },
      ],
      [
        { question: "A competitor slashes prices by 30%. How do you respond?", emoji: "⚡", choices: [
          { text: "Match their price cut", explanation: "Maintains market share but squeezes margins.", effects: { "Price Point": -15, "Demand": 100 } },
          { text: "Focus on quality branding", explanation: "Premium positioning retains loyal customers.", effects: { "Demand": -50, "Price Point": 10 } },
          { text: "Increase supply to lower costs", explanation: "Economies of scale may offset the price war.", effects: { "Supply": 150, "Price Point": -5 } },
        ]},
      ]
    );
  }

  // Biology / Health / Environment
  if (/bio|cell|organism|ecosystem|health|nutrition|gene|dna|evolut|environment|climate/i.test(t)) {
    return sim(title, "Ecosystem Balance Lab",
      "Explore how biological factors maintain balance in a system.",
      "Ecosystem Health Model",
      [
        { name: "Biodiversity", icon: "🌿", unit: "species", min: 1, max: 100, default: 40, description: "Number of different species present" },
        { name: "Resources", icon: "💧", unit: "%", min: 0, max: 100, default: 60, description: "Available food, water, and habitat" },
        { name: "Pollution", icon: "🏭", unit: "ppm", min: 0, max: 100, default: 20, description: "Level of environmental contamination (lower is better)" },
      ],
      [
        { label: "🌟 Thriving Ecosystem", min_percent: 80, message: "High biodiversity and resources with low pollution — ideal conditions." },
        { label: "📈 Stressed System", min_percent: 50, message: "The ecosystem is functional but under pressure." },
        { label: "⚠️ Ecosystem Collapse", min_percent: 0, message: "Critical imbalance — intervention needed to prevent collapse." },
      ],
      [
        { question: "A factory wants to build near the habitat. What's your call?", emoji: "🏭", choices: [
          { text: "Block the factory entirely", explanation: "Protects biodiversity but loses economic opportunity.", effects: { "Biodiversity": 15, "Resources": 10, "Pollution": -10 } },
          { text: "Allow with strict regulations", explanation: "Balanced approach — some pollution but controlled.", effects: { "Pollution": 15, "Resources": -5 } },
          { text: "Allow unrestricted development", explanation: "Economic boost but severe environmental damage.", effects: { "Pollution": 40, "Biodiversity": -20, "Resources": -15 } },
        ]},
      ]
    );
  }

  // Programming / Technology / CS
  if (/program|code|algorithm|software|comput|data\s?struct|web|api|machine\s?learn|ai|neural/i.test(t)) {
    return sim(title, "System Performance Lab",
      "Tune system parameters to optimize performance.",
      "Performance Optimization Model",
      [
        { name: "Code Quality", icon: "💻", unit: "%", min: 0, max: 100, default: 60, description: "Clean, tested, maintainable code" },
        { name: "Infrastructure", icon: "🖥️", unit: "%", min: 0, max: 100, default: 50, description: "Server capacity and reliability" },
        { name: "Optimization", icon: "⚡", unit: "%", min: 0, max: 100, default: 30, description: "Algorithmic and caching optimizations" },
      ],
      [
        { label: "🌟 Peak Performance", min_percent: 80, message: "System is fast, reliable, and well-optimized." },
        { label: "📈 Acceptable", min_percent: 50, message: "Functional but with room for improvement." },
        { label: "⚠️ Poor Performance", min_percent: 0, message: "Slow response times and potential failures — needs attention." },
      ],
      [
        { question: "Users report slow load times. Where do you invest?", emoji: "🐌", choices: [
          { text: "Refactor and optimize code", explanation: "Cleaner code reduces processing time.", effects: { "Code Quality": 20, "Optimization": 15 } },
          { text: "Scale up servers", explanation: "More hardware handles load but doesn't fix root causes.", effects: { "Infrastructure": 25 } },
          { text: "Add caching layers", explanation: "Dramatic speed boost for repeated requests.", effects: { "Optimization": 30, "Infrastructure": -5 } },
        ]},
      ]
    );
  }

  // History / Social Studies
  if (/histor|civil|war|revolution|empire|ancient|medieval|politic|govern|societ|cultur/i.test(t)) {
    return sim(title, "Civilization Factors Lab",
      "Explore how key factors influenced historical outcomes.",
      "Historical Impact Model",
      [
        { name: "Military Strength", icon: "⚔️", unit: "%", min: 0, max: 100, default: 50, description: "Armed forces and defense capability" },
        { name: "Economic Power", icon: "🏛️", unit: "%", min: 0, max: 100, default: 50, description: "Trade, treasury, and economic output" },
        { name: "Cultural Influence", icon: "🎭", unit: "%", min: 0, max: 100, default: 40, description: "Arts, religion, and soft power" },
      ],
      [
        { label: "🌟 Golden Age", min_percent: 80, message: "All pillars of civilization are thriving — expansion and prosperity." },
        { label: "📈 Stable Period", min_percent: 50, message: "The civilization endures but faces internal or external pressures." },
        { label: "⚠️ Decline", min_percent: 0, message: "Weakness across key areas — vulnerable to collapse." },
      ],
      [
        { question: "Neighboring empires threaten your borders. How do you respond?", emoji: "⚔️", choices: [
          { text: "Invest heavily in military", explanation: "Strong defense but drains treasury.", effects: { "Military Strength": 25, "Economic Power": -15 } },
          { text: "Form diplomatic alliances", explanation: "Cultural influence grows, military stays modest.", effects: { "Cultural Influence": 20, "Military Strength": 5 } },
          { text: "Focus on economic dominance", explanation: "Wealth buys influence and mercenaries.", effects: { "Economic Power": 25, "Cultural Influence": 5, "Military Strength": -10 } },
        ]},
      ]
    );
  }

  // Generic fallback — still uses the title
  return sim(title, `${title || "Exploration"} Lab`,
    "Explore how different factors interact and affect the outcome in this hands-on simulation.",
    "Factor Interaction Model",
    [
      { name: "Understanding", icon: "🧠", unit: "%", min: 0, max: 100, default: 50, description: "How well the core concepts are grasped" },
      { name: "Practice", icon: "✏️", unit: "%", min: 0, max: 100, default: 30, description: "Amount of hands-on practice applied" },
      { name: "Application", icon: "🚀", unit: "%", min: 0, max: 100, default: 40, description: "Real-world application of knowledge" },
    ],
    [
      { label: "🌟 Mastery Level", min_percent: 80, message: "Excellent! All factors are working together effectively." },
      { label: "📈 Building Momentum", min_percent: 50, message: "Good progress — keep pushing the weaker areas." },
      { label: "🔰 Getting Started", min_percent: 0, message: "Increase each factor to see how they compound together." },
    ],
    [
      { question: "You're stuck on a difficult concept. What do you do?", emoji: "🤔", choices: [
        { text: "Study the theory deeper", explanation: "Builds foundational understanding.", effects: { "Understanding": 25 } },
        { text: "Practice with exercises", explanation: "Hands-on work solidifies knowledge.", effects: { "Practice": 25, "Understanding": 5 } },
        { text: "Try applying it to a real project", explanation: "Real-world context accelerates learning.", effects: { "Application": 25, "Practice": 10 } },
      ]},
    ]
  );
}

/** Converts legacy "decision" lab data into simulation format */
function convertDecisionToSimulation(data: any): { type: string; data: any } {
  const scenarios = data?.scenarios ?? [];
  const effectKeys = new Set<string>();
  for (const s of scenarios) {
    for (const c of (s.choices || [])) {
      if (c.effects) Object.keys(c.effects).forEach((k: string) => effectKeys.add(k));
    }
  }
  const paramNames = effectKeys.size > 0 ? [...effectKeys] : ["Factor A", "Factor B", "Factor C"];
  const icons = ["📊", "📈", "⚙️", "🔬", "💡", "🎯"];
  return {
    type: "simulation",
    data: {
      title: data.title || "Decision Simulation",
      description: data.description || "Make decisions and see how they affect the outcome.",
      equation_label: "Impact Model",
      output_label: "Overall Score",
      parameters: paramNames.map((name: string, i: number) => ({
        name, icon: icons[i % icons.length], unit: "%", min: 0, max: 100, default: 50,
        description: `Level of ${name.toLowerCase()}`
      })),
      thresholds: [
        { label: "🌟 Optimal", min_percent: 80, message: "Excellent balance of factors." },
        { label: "📈 Moderate", min_percent: 50, message: "Reasonable, but room to improve." },
        { label: "⚠️ Needs Work", min_percent: 0, message: "Adjust factors to improve outcomes." },
      ],
      decisions: scenarios.map((s: any) => ({
        question: s.description || s.title,
        emoji: s.emoji || "🤔",
        choices: (s.choices || []).map((c: any) => ({
          text: c.text,
          explanation: c.consequence || c.explanation || "",
          effects: c.effects || {},
        })),
      })),
    },
  };
}

function sim(title: string | null | undefined, labTitle: string, description: string, eqLabel: string, params: any[], thresholds: any[], decisions?: any[]) {
  return {
    type: "simulation",
    data: {
      title: labTitle,
      description,
      equation_label: eqLabel,
      equation_template: params.map(p => p.name).join(" + ") + " → Output",
      output_label: "Overall Result",
      parameters: params,
      thresholds,
      decisions: decisions || [],
    },
  };
}

export default function InteractiveLab({ labType, labData, labTitle, labDescription }: Props) {
  const resolved = useMemo(() => {
    // Convert legacy "decision" labs to simulation format
    if (labType === "decision" && labData?.scenarios?.length > 0) {
      console.info("[InteractiveLab] Converting decision lab to simulation format.");
      return convertDecisionToSimulation(labData);
    }
    if (isValidLabData(labType, labData)) {
      return { type: labType!, data: labData };
    }
    if (labType && !isValidLabData(labType, labData)) {
      console.warn(`[InteractiveLab] Invalid ${labType} lab data for "${labTitle}", using topic fallback.`, { labData });
    } else if (!labType) {
      console.info("[InteractiveLab] No lab type specified, using topic fallback.");
    }
    return generateTopicFallback(labTitle);
  }, [labType, labData, labTitle]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-lg">{resolved.data.title || labTitle}</h3>
      </div>
      {resolved.data.description && (
        <p className="text-sm text-muted-foreground">{resolved.data.description}</p>
      )}
      {resolved.type === "simulation" && <SimulationLab data={resolved.data} />}
      {resolved.type === "classification" && <ClassificationLab data={resolved.data} />}
    </div>
  );
}
