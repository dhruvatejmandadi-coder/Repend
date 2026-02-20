import { useState, useMemo, useEffect } from "react";
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  MessageCircleQuestion,
  CheckCircle2,
} from "lucide-react";
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

/* ======== HELPERS ======== */

function getParamLevel(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  if (pct >= 75) return { level: "high", color: "text-green-500", icon: TrendingUp };
  if (pct >= 35) return { level: "mid", color: "text-yellow-500", icon: Minus };
  return { level: "low", color: "text-red-500", icon: TrendingDown };
}

/* ======== FIX EMPTY EFFECTS ======== */

function ensureDecisionEffects(decisions: Decision[], parameters: Parameter[]): Decision[] {
  if (!decisions.length || !parameters.length) return decisions;

  return decisions.map((d) => ({
    ...d,
    choices: d.choices.map((c, cIdx) => {
      // If effects is empty or all values are 0, auto-generate from parameters
      const hasEffects = c.effects && Object.values(c.effects).some((v) => v !== 0);
      if (hasEffects) return c;

      // Pick a parameter and assign a delta based on choice index
      const param = parameters[cIdx % parameters.length];
      const range = param.max - param.min;
      const delta = Math.round(range * 0.2) * (cIdx % 2 === 0 ? 1 : -1);
      return {
        ...c,
        effects: { [param.name]: delta || Math.round(range * 0.15) },
      };
    }),
  }));
}

/* ======== SIMULATION ======== */

function SimulationLabInline({ data }: { data: SimulationData }) {
  const parameters = data.parameters ?? [];
  const thresholds = data.thresholds ?? [];
  const rawDecisions = data.decisions ?? [];
  const decisions = useMemo(() => ensureDecisionEffects(rawDecisions, parameters), [rawDecisions, parameters]);

  const [values, setValues] = useState<Record<string, number>>({});
  const [currentDecision, setCurrentDecision] = useState(0);
  const [answered, setAnswered] = useState<Record<number, number>>({});
  const [explanation, setExplanation] = useState<number | null>(null);

  /* 🔥 FIX: Reset state whenever lab data changes */
  useEffect(() => {
    const initial = Object.fromEntries(parameters.map((p) => [p.name, p.default]));
    setValues(initial);
    setCurrentDecision(0);
    setAnswered({});
    setExplanation(null);
  }, [data]);

  /* ===== OUTCOME ===== */

  const totalPercent = useMemo(() => {
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
    return sorted.find((t) => totalPercent >= t.min_percent) || sorted[sorted.length - 1];
  }, [totalPercent, thresholds]);

  /* ===== DECISION CLICK ===== */

  const handleDecision = (dIdx: number, cIdx: number) => {
    if (answered[dIdx] !== undefined) return;

    const choice = decisions[dIdx]?.choices[cIdx];
    if (!choice) return;

    setValues((prev) => {
      const next = { ...prev };

      Object.entries(choice.effects).forEach(([key, delta]) => {
        const param = parameters.find((p) => p.name === key);
        if (!param) return;

        const current = next[key] ?? param.default;
        next[key] = Math.max(param.min, Math.min(param.max, current + delta));
      });

      return next;
    });

    setAnswered((prev) => ({ ...prev, [dIdx]: cIdx }));
    setExplanation(cIdx);
  };

  const allDone = decisions.length > 0 && Object.keys(answered).length === decisions.length;

  return (
    <div className="space-y-5">
      {/* ===== SCENARIOS ===== */}

      {decisions.length > 0 && !allDone && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base">
                Scenario {currentDecision + 1} of {decisions.length}
              </h3>
            </div>

            <p className="text-sm font-medium">
              {decisions[currentDecision].emoji} {decisions[currentDecision].question}
            </p>

            {decisions[currentDecision].choices.map((c, i) => {
              const isChosen = answered[currentDecision] === i;
              const isAnswered = answered[currentDecision] !== undefined;

              return (
                <button
                  key={i}
                  onClick={() => handleDecision(currentDecision, i)}
                  disabled={isAnswered}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition ${
                    isChosen ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  {c.text}
                </button>
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

      {/* ===== SLIDERS ===== */}

      {parameters.map((p) => {
        const { level, color, icon: Icon } = getParamLevel(values[p.name] ?? p.default, p.min, p.max);

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
                  <Badge variant="outline">
                    {values[p.name] ?? p.default} {p.unit}
                  </Badge>
                </div>
              </div>

              <Slider
                value={[values[p.name] ?? p.default]}
                min={p.min}
                max={p.max}
                step={1}
                onValueChange={([v]) =>
                  setValues((prev) => ({
                    ...prev,
                    [p.name]: v,
                  }))
                }
              />
            </CardContent>
          </Card>
        );
      })}

      {/* ===== OUTCOME ===== */}

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
    </div>
  );
}

/* ======== MAIN ======== */

export default function InteractiveLab({ labType, labData }: Props) {
  if (!labData) return null;

  if (labType === "classification") {
    return <ClassificationLab data={labData} />;
  }

  return <SimulationLabInline data={labData} />;
}
