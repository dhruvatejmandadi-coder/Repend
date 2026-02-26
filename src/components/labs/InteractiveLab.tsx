import { useState, useMemo, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, MessageCircleQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import ClassificationLab from "./ClassificationLab";

/* ============================================================
   TYPES
============================================================ */

type Parameter = {
  name: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  weight?: number; // weighted impact on total score
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
  thresholds: {
    label: string;
    min_percent: number;
    message: string;
  }[];
  decisions?: Decision[];
};

type Props = {
  labType?: string | null;
  labData?: any;
  labTitle?: string | null;
  labDescription?: string | null;
};

/* ============================================================
   HELPERS
============================================================ */

function getParamLevel(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  if (pct >= 75) return { color: "text-green-500", icon: TrendingUp };
  if (pct >= 35) return { color: "text-yellow-500", icon: Minus };
  return { color: "text-red-500", icon: TrendingDown };
}

function ensureSetState(decisions: Decision[], parameters: Parameter[]): Decision[] {
  if (!decisions?.length || !parameters?.length) return decisions ?? [];

  return decisions.map((decision) => ({
    ...decision,
    choices: decision.choices.map((choice) => {
      const complete: Record<string, number> = {};

      for (const p of parameters) {
        const raw = choice.set_state?.[p.name] ?? p.default;

        complete[p.name] = Math.max(p.min, Math.min(p.max, raw));
      }

      return {
        ...choice,
        set_state: complete,
      };
    }),
  }));
}

/* ============================================================
   SIMULATION COMPONENT
============================================================ */

function SimulationLabInline({ data }: { data: SimulationData }) {
  const parameters = useMemo(() => data.parameters ?? [], [data]);
  const thresholds = useMemo(() => data.thresholds ?? [], [data]);
  const rawDecisions = useMemo(() => data.decisions ?? [], [data]);

  const decisions = useMemo(() => ensureSetState(rawDecisions, parameters), [rawDecisions, parameters]);

  const [values, setValues] = useState<Record<string, number>>({});
  const [currentScenario, setCurrentScenario] = useState(0);
  const [answered, setAnswered] = useState<Record<number, number>>({});

  /* ---------------- RESET ON LAB CHANGE ---------------- */

  useEffect(() => {
    const initial = Object.fromEntries(parameters.map((p) => [p.name, p.default]));
    setValues(initial);
    setCurrentScenario(0);
    setAnswered({});
  }, [data, parameters]);

  /* ---------------- WEIGHTED TOTAL ---------------- */

  const totalPercent = useMemo(() => {
    if (!parameters.length) return 0;

    const totalWeight = parameters.reduce((sum, p) => sum + (p.weight ?? 1), 0);

    const score = parameters.reduce((sum, p) => {
      const normalized = ((values[p.name] ?? p.default) - p.min) / (p.max - p.min);

      return sum + normalized * (p.weight ?? 1);
    }, 0);

    return Math.round((score / totalWeight) * 100);
  }, [values, parameters]);

  const threshold = useMemo(() => {
    if (!thresholds.length) return null;

    const sorted = [...thresholds].sort((a, b) => b.min_percent - a.min_percent);

    return sorted.find((t) => totalPercent >= t.min_percent) || sorted[sorted.length - 1];
  }, [thresholds, totalPercent]);

  /* ---------------- DECISION HANDLER ---------------- */

  const handleDecision = (scenarioIdx: number, choiceIdx: number) => {
    if (answered[scenarioIdx] !== undefined) return;

    const choice = decisions[scenarioIdx]?.choices[choiceIdx];
    if (!choice) return;

    setValues((prev) => {
      const next: Record<string, number> = {};

      for (const p of parameters) {
        next[p.name] = Math.max(p.min, Math.min(p.max, choice.set_state[p.name] ?? prev[p.name] ?? p.default));
      }

      return next;
    });

    setAnswered((prev) => ({
      ...prev,
      [scenarioIdx]: choiceIdx,
    }));

    // Auto-progress
    setTimeout(() => {
      setCurrentScenario((prev) => prev + 1);
    }, 500);
  };

  const allDone = currentScenario >= decisions.length;

  /* ---------------- API SYNC ---------------- */

  useEffect(() => {
    if (!parameters.length) return;

    const controller = new AbortController();

    async function sync() {
      try {
        await fetch("/api/simulation/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: values,
            totalPercent,
            scenario: currentScenario,
          }),
          signal: controller.signal,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Simulation sync error:", err);
        }
      }
    }

    sync();
    return () => controller.abort();
  }, [values, totalPercent, currentScenario, parameters]);

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6">
      {/* SCENARIOS */}
      {decisions.length > 0 && !allDone && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="w-5 h-5 text-primary" />
              <h3 className="font-bold">
                Scenario {currentScenario + 1} of {decisions.length}
              </h3>
            </div>

            <p>
              {decisions[currentScenario].emoji ?? "🔬"} {decisions[currentScenario].question}
            </p>

            {decisions[currentScenario].choices.map((c, i) => {
              const isAnswered = answered[currentScenario] !== undefined;
              const isChosen = answered[currentScenario] === i;

              return (
                <button
                  key={i}
                  onClick={() => handleDecision(currentScenario, i)}
                  disabled={isAnswered}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition ${
                    isChosen ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  {c.text}
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* PARAMETERS */}
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
                  <Badge variant="outline">
                    {value} {p.unit}
                  </Badge>
                </div>
              </div>

              <Slider
                value={[value]}
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
    </div>
  );
}

/* ============================================================
   MAIN EXPORT
============================================================ */

export default function InteractiveLab({ labType, labData }: Props) {
  if (!labData || Object.keys(labData).length === 0) {
    return null;
  }

  if (labType === "classification") {
    return <ClassificationLab data={labData} />;
  }

  return <SimulationLabInline data={labData} />;
}
