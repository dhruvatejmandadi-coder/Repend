import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Parameter = {
  name: string;
  icon?: string;
  unit?: string;
  min: number;
  max: number;
  default: number;
  description?: string;
};

type Threshold = {
  label: string;
  min_percent: number;
  message: string;
};

type DecisionChoice = {
  text: string;
  explanation?: string;
  set_state?: Record<string, number>;
};

type Decision = {
  question: string;
  emoji?: string;
  choices: DecisionChoice[];
};

type Props = {
  data: {
    title?: string;
    description?: string;
    parameters: Parameter[];
    thresholds: Threshold[];
    decisions?: Decision[];
  };
};

export default function SimulationLab({ data }: Props) {
  const { title, description, parameters, thresholds, decisions = [] } = data;

  const [state, setState] = useState<Record<string, number>>(
    Object.fromEntries(parameters.map((p) => [p.name, p.default])),
  );

  const [decisionAnswers, setDecisionAnswers] = useState<Record<number, number>>({});

  /* ===============================
     SCORE CALCULATION
  ================================= */

  const scorePercent = useMemo(() => {
    const total = parameters.reduce((sum, p) => sum + p.max, 0);
    const current = parameters.reduce((sum, p) => sum + (state[p.name] ?? 0), 0);

    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  }, [state, parameters]);

  const currentThreshold =
    thresholds.sort((a, b) => b.min_percent - a.min_percent).find((t) => scorePercent >= t.min_percent) ||
    thresholds[0];

  /* ===============================
     DECISION HANDLER
  ================================= */

  const applyDecision = (decisionIndex: number, choiceIndex: number) => {
    const choice = decisions[decisionIndex].choices[choiceIndex];

    if (choice.set_state) {
      setState((prev) => {
        const updated = { ...prev };
        Object.entries(choice.set_state!).forEach(([key, val]) => {
          updated[key] = Math.max(
            0,
            Math.min(parameters.find((p) => p.name === key)?.max ?? val, (updated[key] ?? 0) + val),
          );
        });
        return updated;
      });
    }

    setDecisionAnswers((prev) => ({
      ...prev,
      [decisionIndex]: choiceIndex,
    }));
  };

  /* ===============================
     RENDER
  ================================= */

  return (
    <div className="space-y-6">
      {title && <h3 className="font-bold text-lg">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}

      {/* PARAMETERS */}
      <div className="space-y-4">
        {parameters.map((param) => (
          <Card key={param.name}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>
                  {param.icon} {param.name}
                </span>
                <span>
                  {state[param.name]} {param.unit}
                </span>
              </div>

              <Slider
                min={param.min}
                max={param.max}
                step={1}
                value={[state[param.name]]}
                onValueChange={(val) =>
                  setState((prev) => ({
                    ...prev,
                    [param.name]: val[0],
                  }))
                }
              />

              {param.description && <p className="text-xs text-muted-foreground">{param.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SCORE */}
      <Card>
        <CardContent className="p-4 text-center space-y-2">
          <div className="text-3xl font-bold">{scorePercent}%</div>
          <div className="text-sm">{currentThreshold.label}</div>
          <p className="text-sm text-muted-foreground">{currentThreshold.message}</p>
        </CardContent>
      </Card>

      {/* DECISIONS */}
      {decisions.map((decision, dIndex) => (
        <Card key={dIndex}>
          <CardContent className="p-4 space-y-3">
            <h4 className="font-medium">
              {decision.emoji} {decision.question}
            </h4>

            {decision.choices.map((choice, cIndex) => {
              const selected = decisionAnswers[dIndex] === cIndex;

              return (
                <Button
                  key={cIndex}
                  variant={selected ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => applyDecision(dIndex, cIndex)}
                >
                  {choice.text}
                </Button>
              );
            })}

            {decisionAnswers[dIndex] !== undefined && decision.choices[decisionAnswers[dIndex]]?.explanation && (
              <p className="text-sm text-muted-foreground">{decision.choices[decisionAnswers[dIndex]]?.explanation}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
