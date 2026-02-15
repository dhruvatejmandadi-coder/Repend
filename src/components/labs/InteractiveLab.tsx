import { FlaskConical } from "lucide-react";
import SimulationLab from "./SimulationLab";
import DecisionLab from "./DecisionLab";
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
    if (labType === "decision") {
      return Array.isArray(labData.scenarios) && labData.scenarios.length > 0;
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
    ]
  );
}

function sim(title: string | null | undefined, labTitle: string, description: string, eqLabel: string, params: any[], thresholds: any[]) {
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
    },
  };
}

export default function InteractiveLab({ labType, labData, labTitle, labDescription }: Props) {
  const resolved = useMemo(() => {
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
      {resolved.type === "decision" && <DecisionLab data={resolved.data} />}
      {resolved.type === "classification" && <ClassificationLab data={resolved.data} />}
    </div>
  );
}
