import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircleQuestion } from "lucide-react";

/* ================= TYPES ================= */

type Parameter = {
  name: string;
  icon: string;
  min: number;
  max: number;
  default: number;
  weight?: number;
};

type Scenario = {
  id: string;
  question: string;
  emoji?: string;
  impact: Record<string, number>;
};

type SimulationData = {
  topic: string;
  parameters: Parameter[];
  scenarios: Scenario[];
  thresholds: {
    label: string;
    min_percent: number;
    message: string;
  }[];
};

type Props = {
  labData: SimulationData;
};

/* ================= COMPONENT ================= */

export default function InteractiveLab({ labData }: Props) {
  const { topic, parameters, scenarios, thresholds } = labData;

  const [values, setValues] = useState<Record<string, number>>({});
  const [currentScenario, setCurrentScenario] = useState(0);
  const [answered, setAnswered] = useState<number[]>([]);

  /* ================= INIT ================= */

  useEffect(() => {
    const initial = Object.fromEntries(parameters.map((p) => [p.name, p.default]));
    setValues(initial);
  }, [labData]);

  /* ================= WEIGHTED TOTAL ================= */

  const totalPercent = useMemo(() => {
    let totalWeight = 0;
    let weightedScore = 0;

    parameters.forEach((p) => {
      const weight = p.weight ?? 1;
      totalWeight += weight;

      const normalized = ((values[p.name] ?? p.default) - p.min) / (p.max - p.min);

      weightedScore += normalized * weight;
    });

    return Math.round((weightedScore / totalWeight) * 100);
  }, [values, parameters]);

  const threshold = useMemo(() => {
    const sorted = [...thresholds].sort((a, b) => b.min_percent - a.min_percent);
    return sorted.find((t) => totalPercent >= t.min_percent) ?? sorted[sorted.length - 1];
  }, [totalPercent, thresholds]);

  /* ================= API CALLBACK ================= */

  useEffect(() => {
    async function updateAPI() {
      try {
        await fetch("/api/lab/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            values,
            total: totalPercent,
          }),
        });
      } catch (err) {
        console.error("API update failed");
      }
    }

    updateAPI();
  }, [values, totalPercent, topic]);

  /* ================= SCENARIO APPLY ================= */

  const applyScenario = async (scenario: Scenario) => {
    setValues((prev) => {
      const updated = { ...prev };
      Object.entries(scenario.impact).forEach(([key, delta]) => {
        updated[key] = Math.max(0, Math.min(100, (prev[key] ?? 50) + delta));
      });
      return updated;
    });

    setAnswered((prev) => [...prev, currentScenario]);

    try {
      await fetch("/api/lab/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          scenarioId: scenario.id,
        }),
      });
    } catch (err) {
      console.error("Scenario API failed");
    }
  };

  /* ================= UI ================= */

  return (
    <div className="space-y-6">
      {/* ===== SCENARIO BOX ===== */}
      {currentScenario < scenarios.length && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="w-5 h-5 text-primary" />
              <h3 className="font-bold">
                Scenario {currentScenario + 1} of {scenarios.length}
              </h3>
            </div>

            <p>
              {scenarios[currentScenario].emoji ?? "📌"} {scenarios[currentScenario].question}
            </p>

            <Button
              onClick={() => applyScenario(scenarios[currentScenario])}
              disabled={answered.includes(currentScenario)}
            >
              Apply Decision
            </Button>

            {answered.includes(currentScenario) && currentScenario < scenarios.length - 1 && (
              <Button variant="outline" onClick={() => setCurrentScenario((prev) => prev + 1)}>
                Next →
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== PARAMETERS ===== */}
      {parameters.map((param) => {
        const value = values[param.name] ?? param.default;

        return (
          <Card key={param.name}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between">
                <div className="flex items-center gap-2">
                  <span>{param.icon}</span>
                  <span>{param.name}</span>
                </div>

                <Badge variant="outline">{value}</Badge>
              </div>

              <Slider
                value={[value]}
                min={param.min}
                max={param.max}
                step={1}
                onValueChange={([v]) =>
                  setValues((prev) => ({
                    ...prev,
                    [param.name]: v,
                  }))
                }
              />
            </CardContent>
          </Card>
        );
      })}

      {/* ===== OUTCOME ===== */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex justify-between">
            <span className="font-bold">{threshold?.label ?? "Outcome"}</span>
            <Badge>{totalPercent}%</Badge>
          </div>

          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${totalPercent}%` }} />
          </div>

          <p className="text-sm text-muted-foreground">{threshold?.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
