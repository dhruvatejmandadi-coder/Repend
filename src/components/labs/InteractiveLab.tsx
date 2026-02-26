import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircleQuestion } from "lucide-react";

/* ===========================
   TYPES
=========================== */

type Parameter = {
  name: string;
  icon: string;
  min: number;
  max: number;
  default: number;
  weight: number;
};

type Scenario = {
  id: string;
  question: string;
  emoji: string;
  impact: Record<string, number>;
};

type Threshold = {
  label: string;
  min_percent: number;
  message: string;
};

type LabData = {
  topic: string;
  parameters: Parameter[];
  scenarios: Scenario[];
  thresholds: Threshold[];
};

/* ===========================
   COMPONENT
=========================== */

export default function InteractiveLab({ labData }: { labData: LabData }) {
  const { topic, parameters, scenarios, thresholds } = labData;

  const [values, setValues] = useState<Record<string, number>>({});
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [answered, setAnswered] = useState<number[]>([]);

  /* ===========================
     INITIALIZE DEFAULT VALUES
  =========================== */

  useEffect(() => {
    const initialValues: Record<string, number> = {};
    parameters.forEach((param) => {
      initialValues[param.name] = param.default;
    });
    setValues(initialValues);
  }, [parameters]);

  /* ===========================
     WEIGHTED TOTAL CALCULATION
  =========================== */

  const totalPercent = useMemo(() => {
    let weightedScore = 0;
    let totalWeight = 0;

    parameters.forEach((param) => {
      const value = values[param.name] ?? param.default;
      const normalized = (value - param.min) / (param.max - param.min);

      weightedScore += normalized * param.weight;
      totalWeight += param.weight;
    });

    return Math.round((weightedScore / totalWeight) * 100);
  }, [values, parameters]);

  /* ===========================
     THRESHOLD MATCHING
  =========================== */

  const outcome = useMemo(() => {
    const sorted = [...thresholds].sort((a, b) => b.min_percent - a.min_percent);

    return sorted.find((t) => totalPercent >= t.min_percent) ?? sorted[sorted.length - 1];
  }, [totalPercent, thresholds]);

  /* ===========================
     SCENARIO APPLY
  =========================== */

  const applyScenario = (scenario: Scenario) => {
    setValues((prev) => {
      const updated = { ...prev };

      Object.entries(scenario.impact).forEach(([key, delta]) => {
        const current = prev[key] ?? 50;
        const newValue = Math.max(0, Math.min(100, current + delta));
        updated[key] = newValue;
      });

      return updated;
    });

    setAnswered((prev) => [...prev, scenarioIndex]);
  };

  /* ===========================
     UI
  =========================== */

  return (
    <div className="space-y-6">
      {/* ===== SCENARIO SECTION ===== */}

      {scenarioIndex < scenarios.length && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">
                Scenario {scenarioIndex + 1} of {scenarios.length}
              </h3>
            </div>

            <p className="text-sm">
              {scenarios[scenarioIndex].emoji} {scenarios[scenarioIndex].question}
            </p>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => applyScenario(scenarios[scenarioIndex])}
                disabled={answered.includes(scenarioIndex)}
              >
                Apply Decision
              </Button>

              {answered.includes(scenarioIndex) && scenarioIndex < scenarios.length - 1 && (
                <Button variant="outline" onClick={() => setScenarioIndex((prev) => prev + 1)}>
                  Next →
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== PARAMETERS ===== */}

      {parameters.map((param) => {
        const value = values[param.name] ?? param.default;

        return (
          <Card key={param.name}>
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span>{param.icon}</span>
                  <span className="font-medium">{param.name}</span>
                </div>

                <Badge variant="outline">{value}</Badge>
              </div>

              <Slider
                value={[value]}
                min={param.min}
                max={param.max}
                step={1}
                onValueChange={([newValue]) =>
                  setValues((prev) => ({
                    ...prev,
                    [param.name]: newValue,
                  }))
                }
              />
            </CardContent>
          </Card>
        );
      })}

      {/* ===== OUTCOME ===== */}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold">{outcome?.label ?? "Outcome"}</span>
            <Badge>{totalPercent}%</Badge>
          </div>

          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${totalPercent}%` }} />
          </div>

          <p className="text-sm text-muted-foreground">{outcome?.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
