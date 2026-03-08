import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2, XCircle, RotateCcw, Target } from "lucide-react";

type Parameter = {
  name: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  default: number;
};

type Constraint = {
  parameter: string;
  operator: ">" | "<" | ">=" | "<=";
  value: number;
  label: string;
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

type PolicyData = {
  title?: string;
  description?: string;
  parameters: Parameter[];
  constraints: Constraint[];
  max_decisions: number;
  decisions: Decision[];
};

function checkConstraint(c: Constraint, value: number): boolean {
  switch (c.operator) {
    case ">": return value > c.value;
    case "<": return value < c.value;
    case ">=": return value >= c.value;
    case "<=": return value <= c.value;
    default: return false;
  }
}

export default function PolicyOptimizationLab({ data, onComplete, isCompleted }: { data: PolicyData; onComplete?: () => void; isCompleted?: boolean }) {
  const parameters = data.parameters ?? [];
  const constraints = data.constraints ?? [];
  const decisions = data.decisions ?? [];
  const maxDecisions = data.max_decisions || decisions.length;

  const [values, setValues] = useState<Record<string, number>>(
    () => Object.fromEntries(parameters.map((p) => [p.name, p.default]))
  );
  const [decisionsMade, setDecisionsMade] = useState<number[]>([]);
  const [currentDecision, setCurrentDecision] = useState(0);
  const [completionFired, setCompletionFired] = useState(false);

  const constraintResults = useMemo(() =>
    constraints.map((c) => ({
      ...c,
      currentValue: values[c.parameter] ?? 0,
      met: checkConstraint(c, values[c.parameter] ?? 0),
    })),
    [constraints, values]
  );

  const allMet = constraintResults.every((c) => c.met);
  const isFinished = decisionsMade.length >= maxDecisions || decisionsMade.length >= decisions.length;

  // Fire onComplete via useEffect
  useEffect(() => {
    if (isFinished && !completionFired && onComplete && !isCompleted) {
      onComplete();
      setCompletionFired(true);
    }
  }, [isFinished, completionFired, onComplete, isCompleted]);

  const handleChoice = (choiceIdx: number) => {
    const choice = decisions[currentDecision]?.choices[choiceIdx];
    if (!choice) return;

    setValues((prev) => {
      const next = { ...prev };
      for (const p of parameters) {
        next[p.name] = Math.max(0, Math.min(100, choice.set_state[p.name] ?? prev[p.name] ?? p.default));
      }
      return next;
    });

    setDecisionsMade((prev) => [...prev, choiceIdx]);
    if (currentDecision < decisions.length - 1) {
      setCurrentDecision((prev) => prev + 1);
    }
  };

  const reset = () => {
    setValues(Object.fromEntries(parameters.map((p) => [p.name, p.default])));
    setDecisionsMade([]);
    setCurrentDecision(0);
    setCompletionFired(false);
  };

  // Show completed state when revisiting
  if (isCompleted && !isFinished) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
          <h3 className="font-bold text-lg">Policy Optimization Complete</h3>
          <p className="text-sm text-muted-foreground">You've already completed this optimization exercise.</p>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Goal Banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Policy Targets</h3>
            <Badge variant="secondary" className="ml-auto">
              {decisionsMade.length}/{maxDecisions} decisions used
            </Badge>
          </div>
          <div className="space-y-2">
            {constraintResults.map((c, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${c.met ? "bg-green-500/10" : "bg-destructive/10"}`}>
                <div className="flex items-center gap-2">
                  {c.met ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
                  <span>{c.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {c.parameter} {c.operator} {c.value}% (current: {c.currentValue}%)
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Decision Card */}
      {!isFinished && decisions[currentDecision] && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="font-medium">
              {decisions[currentDecision].emoji ?? "🎯"} {decisions[currentDecision].question}
            </p>
            {decisions[currentDecision].choices.map((c, i) => (
              <button
                key={i}
                onClick={() => handleChoice(i)}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary/40 text-sm transition"
              >
                {c.text}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Parameters */}
      {parameters.map((p) => (
        <Card key={p.name}>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span>{p.icon} {p.name}</span>
              <Badge variant="outline">{values[p.name] ?? p.default}{p.unit}</Badge>
            </div>
            <Slider value={[values[p.name] ?? p.default]} min={0} max={100} disabled className="pointer-events-none" />
          </CardContent>
        </Card>
      ))}

      {/* Result */}
      {isFinished && (
        <Card className={allMet ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}>
          <CardContent className="p-5 text-center space-y-3">
            {allMet ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <h3 className="font-bold text-lg">All targets met!</h3>
                <p className="text-sm text-muted-foreground">You optimized the policy within {decisionsMade.length} decisions.</p>
              </>
            ) : (
              <>
                <XCircle className="w-10 h-10 text-destructive mx-auto" />
                <h3 className="font-bold text-lg">Targets not met</h3>
                <p className="text-sm text-muted-foreground">
                  {constraintResults.filter((c) => !c.met).length} constraint(s) still unmet. Try a different strategy.
                </p>
              </>
            )}
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" /> Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
