import { useState, useMemo } from "react";
import { FlaskConical, TrendingUp, TrendingDown, Minus, Lightbulb, MessageCircleQuestion, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ClassificationLab from "./ClassificationLab";

/* ======== TYPES ======== */

type Parameter = {
  name: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  description: string;
};

type Decision = {
  question: string;
  emoji: string;
  choices: {
    text: string;
    explanation: string;
    effects: Record<string, number>;
  }[];
};

type SimulationData = {
  title: string;
  description: string;
  equation_label?: string;
  equation_template?: string;
  output_label?: string;
  parameters: Parameter[];
  thresholds: { label: string; min_percent: number; message: string }[];
  decisions?: Decision[];
};

type Props = {
  labType?: string | null;
  labData?: any;
  labTitle?: string | null;
  labDescription?: string | null;
};

/* ======== VALIDATION ======== */

function isValidLabData(labType: string | null | undefined, labData: any): boolean {
  if (!labType || !labData || typeof labData !== "object") return false;
  try {
    if (labType === "simulation" || labType === "decision") {
      return Array.isArray(labData.parameters) && labData.parameters.length > 0;
    }
    if (labType === "classification") {
      return (
        Array.isArray(labData.items) &&
        labData.items.length > 0 &&
        Array.isArray(labData.categories) &&
        labData.categories.length > 0
      );
    }
  } catch (e) {
    console.warn("[InteractiveLab] Validation error:", e);
  }
  return false;
}

/* ======== AUTO-GENERATE DECISIONS ======== */

function generateDecisionsFromParameters(parameters: Parameter[]): Decision[] {
  if (!parameters.length) return [];
  return [
    {
      question: "You need to improve overall performance. What do you focus on?",
      emoji: "⚡",
      choices: parameters.slice(0, 3).map((p) => ({
        text: `Increase ${p.name}`,
        explanation: `Boosting ${p.name} will positively impact the outcome.`,
        effects: { [p.name]: Math.round((p.max - p.min) * 0.2) },
      })),
    },
    {
      question: "You're facing constraints. What do you reduce?",
      emoji: "⚠️",
      choices: parameters.slice(0, 3).map((p) => ({
        text: `Reduce ${p.name}`,
        explanation: `Lowering ${p.name} may negatively affect the result.`,
        effects: { [p.name]: -Math.round((p.max - p.min) * 0.15) },
      })),
    },
  ];
}

/* ======== CONVERT LEGACY DECISION DATA ======== */

function convertDecisionToSimulation(data: any): SimulationData {
  const effectKeys = new Set<string>();
  const scenarios = data.scenarios || data.decisions || [];
  for (const s of scenarios) {
    for (const c of s.choices || []) {
      for (const key of Object.keys(c.effects || {})) {
        effectKeys.add(key);
      }
    }
  }
  const parameters: Parameter[] = Array.from(effectKeys).map((key) => ({
    name: key,
    icon: "📊",
    unit: "pts",
    min: 0,
    max: 100,
    default: 50,
    description: `${key} factor`,
  }));
  return {
    title: data.title || "Decision Simulation",
    description: data.description || "",
    parameters,
    thresholds: [
      { label: "Excellent", min_percent: 75, message: "Outstanding performance!" },
      { label: "Good", min_percent: 40, message: "Decent result, room to improve." },
      { label: "Needs Work", min_percent: 0, message: "Consider adjusting your approach." },
    ],
    decisions: scenarios.map((s: any) => ({
      question: s.question || s.scenario || "",
      emoji: s.emoji || "🤔",
      choices: (s.choices || []).map((c: any) => ({
        text: c.text || c.label || "",
        explanation: c.explanation || c.feedback || "",
        effects: c.effects || {},
      })),
    })),
  };
}

/* ======== SLIDER HELPERS ======== */

function getParamLevel(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  if (pct >= 75) return { level: "high", color: "text-green-500", icon: TrendingUp };
  if (pct >= 35) return { level: "mid", color: "text-yellow-500", icon: Minus };
  return { level: "low", color: "text-red-500", icon: TrendingDown };
}

/* ======== SIMULATION COMPONENT (INLINE) ======== */

function SimulationLabInline({ data }: { data: SimulationData }) {
  const parameters = data?.parameters ?? [];
  const thresholds = data?.thresholds ?? [];
  const decisions = data?.decisions ?? [];

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(parameters.map((p) => [p.name, p.default]))
  );
  const [currentDecision, setCurrentDecision] = useState(0);
  const [answeredDecisions, setAnsweredDecisions] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<{ idx: number; choiceIdx: number } | null>(null);

  const totalCapacity = useMemo(() => {
    if (!parameters.length) return 0;
    const total = parameters.reduce((sum, p) => {
      const pct = ((values[p.name] ?? p.min) - p.min) / (p.max - p.min);
      return sum + pct;
    }, 0);
    return Math.round((total / parameters.length) * 100);
  }, [values, parameters]);

  const threshold = useMemo(() => {
    if (!thresholds.length) return null;
    const sorted = [...thresholds].sort((a, b) => b.min_percent - a.min_percent);
    return sorted.find((t) => totalCapacity >= t.min_percent) || sorted[sorted.length - 1];
  }, [totalCapacity, thresholds]);

  const handleDecisionChoice = (decisionIdx: number, choiceIdx: number) => {
    if (answeredDecisions[decisionIdx] !== undefined) return;
    const choice = decisions[decisionIdx]?.choices[choiceIdx];
    if (!choice) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const [paramName, delta] of Object.entries(choice.effects)) {
        const param = parameters.find((p) => p.name === paramName);
        if (param) {
          const current = next[paramName] ?? param.default;
          next[paramName] = Math.max(param.min, Math.min(param.max, current + delta));
        }
      }
      return next;
    });
    setAnsweredDecisions((prev) => ({ ...prev, [decisionIdx]: choiceIdx }));
    setShowExplanation({ idx: decisionIdx, choiceIdx });
  };

  if (!parameters.length) {
    return <Card><CardContent className="p-6 text-muted-foreground text-sm">No simulation data available.</CardContent></Card>;
  }

  const outcomeColor = totalCapacity >= 75
    ? "border-green-500/40 bg-green-500/5"
    : totalCapacity >= 40
    ? "border-yellow-500/40 bg-yellow-500/5"
    : "border-destructive/40 bg-destructive/5";

  const hasDecisions = decisions.length > 0;
  const activeDecision = decisions[currentDecision];
  const isAnswered = answeredDecisions[currentDecision] !== undefined;
  const allDecisionsDone = decisions.length > 0 && Object.keys(answeredDecisions).length === decisions.length;

  return (
    <div className="space-y-5">
      {/* Decision scenario */}
      {hasDecisions && !allDecisionsDone && activeDecision && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircleQuestion className="w-5 h-5 text-primary" />
                <h3 className="font-display font-bold text-base">Scenario {currentDecision + 1} of {decisions.length}</h3>
              </div>
              <Badge variant="secondary" className="text-xs">{Object.keys(answeredDecisions).length}/{decisions.length} answered</Badge>
            </div>
            <p className="text-sm font-medium">
              {activeDecision.emoji} {activeDecision.question}
            </p>
            <div className="space-y-2">
              {activeDecision.choices.map((choice, ci) => {
                const isChosen = answeredDecisions[currentDecision] === ci;
                return (
                  <button
                    key={ci}
                    onClick={() => handleDecisionChoice(currentDecision, ci)}
                    disabled={isAnswered}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      isAnswered && isChosen
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : isAnswered
                        ? "border-border/50 opacity-60"
                        : "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                    }`}
                  >
                    <span>{choice.text}</span>
                    {isAnswered && isChosen && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(choice.effects).map(([param, delta]) => (
                          <Badge key={param} variant={delta > 0 ? "default" : "destructive"} className="text-[10px] font-mono">
                            {param} {delta > 0 ? "+" : ""}{delta}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {showExplanation?.idx === currentDecision && (
              <div className="bg-secondary/50 rounded-lg p-3 text-sm text-muted-foreground">
                💡 {activeDecision.choices[showExplanation.choiceIdx]?.explanation}
              </div>
            )}
            {isAnswered && currentDecision < decisions.length - 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCurrentDecision((prev) => prev + 1);
                  setShowExplanation(null);
                }}
              >
                Next Scenario →
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {allDecisionsDone && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">All scenarios answered!</p>
              <p className="text-xs text-muted-foreground">Your decisions have shaped the factors below. Fine-tune the sliders to explore further.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasDecisions && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-display font-bold text-base mb-1">Adjust the factors below</h3>
                <p className="text-sm text-muted-foreground">
                  Each slider controls a key variable. Change them to see how different combinations affect the outcome.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {parameters.map((p) => {
        const { level, color, icon: StatusIcon } = getParamLevel(values[p.name], p.min, p.max);
        return (
          <Card key={p.name} className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.icon}</span>
                  <span className="font-medium text-sm">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${color}`} />
                  <Badge variant="outline" className="font-mono text-xs">
                    {values[p.name]} {p.unit}
                  </Badge>
                </div>
              </div>
              <Slider
                value={[values[p.name]]}
                min={p.min}
                max={p.max}
                step={1}
                onValueChange={([v]) => setValues((prev) => ({ ...prev, [p.name]: v }))}
                className="w-full"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex-1">{p.description}</p>
                <span className={`text-xs font-medium ${color} ml-2`}>
                  {level === "high" ? "Strong" : level === "mid" ? "Moderate" : "Weak"}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className={`border-2 ${outcomeColor}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display font-bold text-base">{threshold?.label || "Outcome"}</p>
            <Badge
              variant={totalCapacity >= 75 ? "default" : totalCapacity >= 40 ? "secondary" : "destructive"}
              className="font-mono"
            >
              {totalCapacity}%
            </Badge>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                totalCapacity >= 75 ? "bg-green-500" : totalCapacity >= 40 ? "bg-yellow-500" : "bg-destructive"
              }`}
              style={{ width: `${totalCapacity}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{threshold?.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ======== MAIN COMPONENT ======== */

export default function InteractiveLab({ labType, labData, labTitle, labDescription }: Props) {
  const resolved = useMemo(() => {
    // Handle decision type by converting to simulation
    if (labType === "decision" && labData) {
      const converted = convertDecisionToSimulation(labData);
      return { type: "simulation" as const, data: converted };
    }

    if (!isValidLabData(labType, labData)) {
      return {
        type: "simulation" as const,
        data: {
          title: labTitle || "Simulation Lab",
          description: labDescription || "",
          parameters: [],
          thresholds: [],
          decisions: [],
        } as SimulationData,
      };
    }

    let data = { ...labData };

    // Ensure decisions exist for simulation labs
    if (
      labType === "simulation" &&
      Array.isArray(data.parameters) &&
      data.parameters.length > 0 &&
      (!Array.isArray(data.decisions) || data.decisions.length === 0)
    ) {
      data.decisions = generateDecisionsFromParameters(data.parameters);
    }

    return { type: labType!, data };
  }, [labType, labData, labTitle, labDescription]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-lg">{resolved.data.title || labTitle}</h3>
      </div>

      {resolved.data.description && <p className="text-sm text-muted-foreground">{resolved.data.description}</p>}

      {resolved.type === "simulation" && <SimulationLabInline data={resolved.data} />}
      {resolved.type === "classification" && <ClassificationLab data={resolved.data} />}
    </div>
  );
}
