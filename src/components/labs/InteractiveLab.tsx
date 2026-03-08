import { useState, useMemo, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, MessageCircleQuestion, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ClassificationLab from "./ClassificationLab";
import PolicyOptimizationLab from "./PolicyOptimizationLab";
import EthicalDilemmaLab from "./EthicalDilemmaLab";
import DecisionLab from "./DecisionLab";

/* ================= TYPES ================= */

type Parameter = {
  name: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  description?: string;
};

type Decision = {
  question: string;
  emoji?: string;
  choices: {
    text: string;
    explanation?: string;
    set_state: Record<string, number>;
  }[];
};

type SimulationData = {
  title?: string;
  description?: string;
  parameters: Parameter[];
  thresholds: { label: string; min_percent: number; message: string }[];
  decisions?: Decision[];
};

type Props = {
  labType?: string | null;
  labData?: any;
  labTitle?: string | null;
  labDescription?: string | null;
  onComplete?: () => void;
  isCompleted?: boolean;
};

/* ================= HELPERS ================= */

function getParamLevel(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  if (pct >= 75) return { level: "high", color: "text-green-500", icon: TrendingUp };
  if (pct >= 35) return { level: "mid", color: "text-yellow-500", icon: Minus };
  return { level: "low", color: "text-red-500", icon: TrendingDown };
}

/* ================= AUTO-FIX: CONVERT TO SET_STATE ================= */

function ensureDecisionSetState(decisions: Decision[], parameters: Parameter[]): Decision[] {
  if (!decisions?.length || !parameters?.length) return decisions ?? [];

  return decisions.map((decision) => ({
    ...decision,
    choices: decision.choices.map((choice) => {
      if (choice.set_state && Object.keys(choice.set_state).length > 0) {
        const filled: Record<string, number> = {};
        for (const p of parameters) {
          if (typeof choice.set_state[p.name] !== "number") {
            console.error(`[SimLab] Missing slider "${p.name}" in set_state. Defaulting to 50.`);
          }
          filled[p.name] = Math.max(0, Math.min(100, choice.set_state[p.name] ?? 50));
        }
        return { ...choice, set_state: filled };
      }

      console.error("[SimLab] Choice missing set_state entirely:", choice.text);
      const setState: Record<string, number> = {};
      for (const p of parameters) {
        setState[p.name] = p.default ?? 50;
      }
      return { ...choice, set_state: setState };
    }),
  }));
}

/* ================= SIMULATION ================= */

function SimulationLabInline({ data, onComplete, isCompleted }: { data: SimulationData; onComplete?: () => void; isCompleted?: boolean }) {
  const parameters = useMemo(() => data.parameters ?? [], [data]);
  const thresholds = useMemo(() => data.thresholds ?? [], [data]);
  const rawDecisions = useMemo(() => data.decisions ?? [], [data]);
  const decisions = useMemo(() => ensureDecisionSetState(rawDecisions, parameters), [rawDecisions, parameters]);

  const [values, setValues] = useState<Record<string, number>>({});
  const [currentDecision, setCurrentDecision] = useState(0);
  const [answered, setAnswered] = useState<Record<number, number>>({});

  useEffect(() => {
    const initial = Object.fromEntries(parameters.map((p) => [p.name, p.default]));
    setValues(initial);
    setCurrentDecision(0);
    setAnswered({});
  }, [data, parameters]);

  const totalPercent = useMemo(() => {
    if (!parameters.length) return 0;
    const total = parameters.reduce((sum, p) => {
      const pct = ((values[p.name] ?? p.default) - p.min) / (p.max - p.min);
      return sum + pct;
    }, 0);
    return Math.round((total / parameters.length) * 100);
  }, [values, parameters]);

  const threshold = useMemo(() => {
    if (!thresholds.length) return null;
    const sorted = [...thresholds].sort((a, b) => b.min_percent - a.min_percent);
    return sorted.find((t) => totalPercent >= t.min_percent) || sorted[sorted.length - 1];
  }, [totalPercent, thresholds]);

  const handleDecision = (dIdx: number, cIdx: number) => {
    if (answered[dIdx] !== undefined) return;
    const choice = decisions[dIdx]?.choices[cIdx];
    if (!choice) return;

    setValues((prev) => {
      const next = { ...prev };
      const setState = choice.set_state || {};
      for (const p of parameters) {
        next[p.name] = Math.max(0, Math.min(100, setState[p.name] ?? prev[p.name] ?? p.default));
      }
      return next;
    });

    setAnswered((prev) => ({ ...prev, [dIdx]: cIdx }));
  };

  const allDone = decisions.length > 0 && Object.keys(answered).length === decisions.length;

  // Fire completion callback once
  const [completionFired, setCompletionFired] = useState(false);
  useEffect(() => {
    if (allDone && !completionFired && onComplete) {
      onComplete();
      setCompletionFired(true);
    }
  }, [allDone, completionFired, onComplete]);

  const reset = () => {
    const initial = Object.fromEntries(parameters.map((p) => [p.name, p.default]));
    setValues(initial);
    setCurrentDecision(0);
    setAnswered({});
    setCompletionFired(false);
  };

  // Show completed state when revisiting
  if (isCompleted && !allDone) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
          <h3 className="font-bold text-lg">Simulation Complete</h3>
          <p className="text-sm text-muted-foreground">You've already completed this simulation.</p>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Replay Simulation
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* DECISIONS */}
      {decisions.length > 0 && !allDone && currentDecision < decisions.length && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="w-5 h-5 text-primary" />
              <h3 className="font-bold">
                Scenario {currentDecision + 1} of {decisions.length}
              </h3>
            </div>
            <p>{decisions[currentDecision].emoji ?? "🔬"} {decisions[currentDecision].question}</p>
            {decisions[currentDecision].choices.map((c, i) => {
              const isChosen = answered[currentDecision] === i;
              const isAnswered = answered[currentDecision] !== undefined;
              return (
                <div key={i} className="space-y-1">
                  <button
                    onClick={() => handleDecision(currentDecision, i)}
                    disabled={isAnswered}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition ${
                      isChosen ? "border-primary bg-primary/10" : isAnswered ? "opacity-50 border-border" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {c.text}
                  </button>
                  {isChosen && c.explanation && (
                    <p className="text-xs text-muted-foreground px-4 py-2 bg-muted/50 rounded-md">
                      💡 {c.explanation}
                    </p>
                  )}
                </div>
              );
            })}
            {answered[currentDecision] !== undefined && currentDecision < decisions.length - 1 && (
              <Button size="sm" variant="outline" onClick={() => setCurrentDecision((prev) => prev + 1)}>
                Next →
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* SLIDERS */}
      {parameters.map((p) => {
        const value = values[p.name] ?? p.default;
        const { color, icon: Icon } = getParamLevel(value, p.min, p.max);
        return (
          <Card key={p.name}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <Badge variant="outline">{value} {p.unit}</Badge>
                </div>
              </div>
              <Slider value={[value]} min={p.min} max={p.max} step={1} disabled className="pointer-events-none" />
            </CardContent>
          </Card>
        );
      })}

      {/* OUTCOME */}
      <Card>
        <CardContent className="p-5">
          <div className="flex justify-between mb-2">
            <span className="font-bold">{threshold?.label ?? "Outcome"}</span>
            <Badge>{totalPercent}%</Badge>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${totalPercent}%` }} />
          </div>
          <p className="text-sm text-muted-foreground mt-2">{threshold?.message}</p>
        </CardContent>
      </Card>

      {/* Reset button */}
      {allDone && (
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="w-4 h-4 mr-1" /> Replay Simulation
        </Button>
      )}
    </div>
  );
}

/* ================= EMPTY STATE ================= */

function LabEmptyState({ labType }: { labType?: string | null }) {
  return (
    <Card className="border-dashed border-2 border-muted-foreground/20">
      <CardContent className="p-8 text-center space-y-3">
        <div className="text-4xl">🔬</div>
        <h3 className="font-bold text-lg">Lab Data Unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The {labType || "simulation"} lab for this module wasn't generated properly.
          Try regenerating the course to get interactive labs.
        </p>
      </CardContent>
    </Card>
  );
}

/* ================= MAIN ROUTER ================= */

export default function InteractiveLab({ labType, labData, labTitle, labDescription, onComplete, isCompleted }: Props) {
  if (!labData || (typeof labData === "object" && Object.keys(labData).length === 0)) {
    return <LabEmptyState labType={labType} />;
  }

  // Classification
  if (labType === "classification") {
    const hasData = labData?.items?.length > 0 && labData?.categories?.length > 0;
    if (!hasData) return <LabEmptyState labType={labType} />;
    return <ClassificationLab data={labData} onComplete={onComplete} isCompleted={isCompleted} />;
  }

  // Policy Optimization
  if (labType === "policy_optimization") {
    const hasData = labData?.parameters?.length > 0 && labData?.constraints?.length > 0;
    if (!hasData) return <LabEmptyState labType={labType} />;
    return <PolicyOptimizationLab data={labData} onComplete={onComplete} isCompleted={isCompleted} />;
  }

  // Ethical Dilemma
  if (labType === "ethical_dilemma") {
    const hasData = labData?.dimensions?.length > 0 && labData?.decisions?.length > 0;
    if (!hasData) return <LabEmptyState labType={labType} />;
    return <EthicalDilemmaLab data={labData} onComplete={onComplete} isCompleted={isCompleted} />;
  }

  // Decision Lab
  if (labType === "decision_lab") {
    const hasData = labData?.scenario && labData?.constraints?.length > 0 && labData?.decision_prompt;
    if (!hasData) return <LabEmptyState labType={labType} />;
    return <DecisionLab data={labData} onComplete={onComplete} isCompleted={isCompleted} />;
  }

  // Default: Simulation
  const hasSimulationData = labData?.parameters?.length > 0;
  if (!hasSimulationData) return <LabEmptyState labType={labType} />;
  return <SimulationLabInline data={labData} onComplete={onComplete} isCompleted={isCompleted} />;
}
