import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, BookOpen, Globe, Target, CheckCircle2, RotateCcw, ChevronRight, AlertCircle, Lightbulb, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/* ===== TYPES ===== */

interface DecisionOption {
  id: string;
  text: string;
  consequence: string;
  is_best: boolean;
}

interface DecisionLabData {
  concept_knowledge: {
    definition: string;
    key_ideas: string[];
    examples: string[];
  };
  real_world_relevance: {
    explanation: string;
    domain: string;
  };
  scenario: string;
  decision_challenge: {
    question: string;
    options: DecisionOption[];
  };
  best_decision_explanation: string;
  // Legacy fields (ignored but accepted)
  constraints?: string[];
  decision_prompt?: string;
  twist?: string;
  reflection_question?: string;
  difficulty_tier?: number;
  variables?: Record<string, { label: string; value: string | number }>;
}

type Phase = "concept" | "relevance" | "scenario" | "decide" | "result";

/* ===== COMPONENT ===== */

export default function DecisionLab({ data, onComplete, isCompleted }: { data: DecisionLabData; onComplete?: () => void; isCompleted?: boolean }) {
  const [phase, setPhase] = useState<Phase>("concept");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const chosen = data.decision_challenge?.options?.find((o) => o.id === selectedOption);
  const isCorrect = chosen?.is_best ?? false;

  const reset = () => {
    setPhase("concept");
    setSelectedOption(null);
    setConfirmed(false);
  };

  const handleConfirm = () => {
    setConfirmed(true);
    setPhase("result");
    if (onComplete) onComplete();
  };

  // Completed state
  if (isCompleted && phase === "concept") {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
          <h3 className="font-bold text-lg">Decision Lab Complete</h3>
          <p className="text-sm text-muted-foreground">You've already completed this decision lab.</p>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Phase indicator
  const phases: { key: Phase; label: string }[] = [
    { key: "concept", label: "Concept" },
    { key: "relevance", label: "Relevance" },
    { key: "scenario", label: "Scenario" },
    { key: "decide", label: "Decide" },
    { key: "result", label: "Result" },
  ];
  const phaseIndex = phases.findIndex((p) => p.key === phase);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="border-primary/40 text-primary">
          <Brain className="w-3 h-3 mr-1" /> Decision Lab
        </Badge>
      </div>

      {/* Phase Progress */}
      <div className="flex items-center gap-1">
        {phases.map((p, i) => (
          <div key={p.key} className="flex items-center gap-1">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i <= phaseIndex ? "bg-primary" : "bg-muted",
                i === phaseIndex ? "w-8" : "w-4"
              )}
            />
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-2">
          {phases[phaseIndex]?.label}
        </span>
      </div>

      {/* Phase: Concept Knowledge */}
      {phase === "concept" && data.concept_knowledge && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">Concept Knowledge</h3>
            </div>

            <div className="space-y-3">
              <div className="bg-background/60 rounded-lg p-4 border border-border">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Definition</span>
                <p className="text-sm mt-1 leading-relaxed">{data.concept_knowledge.definition}</p>
              </div>

              {data.concept_knowledge.key_ideas?.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Ideas</span>
                  <ul className="mt-1 space-y-1.5">
                    {data.concept_knowledge.key_ideas.map((idea, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-primary font-bold mt-0.5">•</span>
                        <span>{idea}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.concept_knowledge.examples?.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Examples</span>
                  <ul className="mt-1 space-y-1.5">
                    {data.concept_knowledge.examples.map((ex, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button onClick={() => setPhase("relevance")} className="w-full">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Real-World Relevance */}
      {phase === "relevance" && data.real_world_relevance && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-lg">Why This Matters</h3>
            </div>

            {data.real_world_relevance.domain && (
              <Badge variant="secondary" className="text-xs">
                {data.real_world_relevance.domain}
              </Badge>
            )}

            <p className="text-sm leading-relaxed">{data.real_world_relevance.explanation}</p>

            <Button onClick={() => setPhase("scenario")} className="w-full">
              See the Scenario <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Scenario */}
      {phase === "scenario" && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-lg">Scenario</h3>
            </div>

            <p className="text-sm leading-relaxed">{data.scenario}</p>

            <Button onClick={() => setPhase("decide")} className="w-full">
              Make Your Decision <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Decision Challenge */}
      {phase === "decide" && data.decision_challenge && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">Decision Challenge</h3>
            </div>

            <p className="text-sm font-medium">{data.decision_challenge.question}</p>

            <div className="space-y-2">
              {data.decision_challenge.options?.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                    selectedOption === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/30 bg-background"
                  )}
                >
                  <span className="text-sm font-medium">{option.text}</span>
                </button>
              ))}
            </div>

            <Button
              onClick={handleConfirm}
              disabled={!selectedOption}
              className="w-full"
            >
              Confirm Decision
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Result */}
      {phase === "result" && confirmed && chosen && (
        <div className="space-y-4">
          {/* Outcome Card */}
          <Card className={cn(
            "border-2",
            isCorrect ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"
          )}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <Trophy className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <h3 className="font-bold text-lg">
                  {isCorrect ? "Great Decision!" : "Not Quite — Here's What Happened"}
                </h3>
              </div>

              <div className="bg-background/60 rounded-lg p-4 border border-border">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Choice</span>
                <p className="text-sm font-medium mt-1">{chosen.text}</p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consequence</span>
                <p className="text-sm mt-1 leading-relaxed">{chosen.consequence}</p>
              </div>
            </CardContent>
          </Card>

          {/* All Consequences */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">All Possible Outcomes</h3>
              <div className="space-y-3">
                {data.decision_challenge.options.map((opt) => (
                  <div
                    key={opt.id}
                    className={cn(
                      "rounded-lg p-3 border text-sm",
                      opt.id === selectedOption
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-muted/30",
                      opt.is_best && "ring-1 ring-green-500/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{opt.text}</span>
                      {opt.is_best && (
                        <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">
                          Best Choice
                        </Badge>
                      )}
                      {opt.id === selectedOption && (
                        <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
                          Your Pick
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1">{opt.consequence}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Best Decision Explanation */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                <h3 className="font-bold">Why This Is the Best Decision</h3>
              </div>
              <p className="text-sm leading-relaxed">{data.best_decision_explanation}</p>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={reset} className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" /> Replay Lab
          </Button>
        </div>
      )}
    </div>
  );
}
