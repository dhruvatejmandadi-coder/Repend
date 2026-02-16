import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LabDefinition, LabMetrics, initialMetrics } from "@/data/labs";
import { LabCompletionScreen } from "./LabCompletionScreen";
import { usePoints } from "@/hooks/usePoints";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Lightbulb } from "lucide-react";

interface LabRunnerProps {
  lab: LabDefinition;
  onExit: () => void;
  showHints: boolean;
}

const LAB_POINTS = 75;

export function LabRunner({ lab, onExit, showHints }: LabRunnerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [metrics, setMetrics] = useState<LabMetrics>({ ...initialMetrics });
  const [decisions, setDecisions] = useState<{ scenarioIndex: number; choiceIndex: number }[]>([]);
  const [completed, setCompleted] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const { addPoints } = usePoints();
  const { user } = useAuth();

  const scenario = lab.scenarios[currentStep];
  const progress = ((currentStep) / lab.scenarios.length) * 100;

  const handleChoice = (choiceIndex: number) => {
    if (transitioning) return;
    setSelectedChoice(choiceIndex);
    setTransitioning(true);

    const choice = scenario.choices[choiceIndex];
    const newMetrics = {
      growth: metrics.growth + choice.impact.growth,
      skill: metrics.skill + choice.impact.skill,
      stress: metrics.stress + choice.impact.stress,
      confidence: metrics.confidence + choice.impact.confidence,
    };

    const newDecisions = [...decisions, { scenarioIndex: currentStep, choiceIndex }];

    setTimeout(() => {
      setMetrics(newMetrics);
      setDecisions(newDecisions);

      if (currentStep + 1 >= lab.scenarios.length) {
        // Lab complete
        setCompleted(true);
        addPoints(LAB_POINTS, "lab_completion");

        // Save to DB if authenticated
        if (user) {
          const style = computeStyleLabel(lab, newMetrics);
          supabase.from("lab_results").insert({
            user_id: user.id,
            lab_id: lab.id,
            metrics: newMetrics as any,
            decisions: newDecisions as any,
            decision_style: style,
          }).then(() => {});
        }
      } else {
        setCurrentStep(currentStep + 1);
        setSelectedChoice(null);
      }
      setTransitioning(false);
    }, 600);
  };

  if (completed) {
    return (
      <LabCompletionScreen
        lab={lab}
        metrics={metrics}
        decisions={decisions}
        onRestart={() => {
          setCurrentStep(0);
          setMetrics({ ...initialMetrics });
          setDecisions([]);
          setCompleted(false);
          setSelectedChoice(null);
        }}
        pointsAwarded={LAB_POINTS}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Exit Lab
        </Button>
        <Badge variant="outline">{currentStep + 1} / {lab.scenarios.length}</Badge>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2" />

      {/* Scenario */}
      <Card className={`p-6 space-y-4 transition-opacity duration-300 ${transitioning ? "opacity-50" : "opacity-100"}`}>
        <div className="space-y-2">
          <h3 className="font-display text-xl font-bold text-foreground">{scenario.title}</h3>
          <p className="text-muted-foreground">{scenario.description}</p>
        </div>

        {/* Choices */}
        <div className="space-y-3 pt-2">
          {scenario.choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => handleChoice(idx)}
              disabled={transitioning}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200
                ${selectedChoice === idx
                  ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
                }
                ${transitioning ? "cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <span className="font-medium text-foreground">{choice.text}</span>
              {showHints && choice.hint && (
                <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500" />
                  <span>{choice.hint}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Mini metrics preview */}
      <div className="grid grid-cols-4 gap-2">
        {(["growth", "skill", "confidence", "stress"] as const).map((key) => (
          <div key={key} className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground capitalize">{key}</div>
            <div className="font-bold text-sm text-foreground">{Math.max(0, Math.min(100, metrics[key]))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeStyleLabel(lab: LabDefinition, metrics: LabMetrics): string {
  for (const style of lab.decisionStyles) {
    if (style.condition(metrics)) return style.label;
  }
  return "Adaptive Thinker";
}
