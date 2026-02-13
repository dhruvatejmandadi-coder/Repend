import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react";

type Choice = {
  text: string;
  consequence: string;
  impact: "positive" | "negative" | "neutral";
  next_scenario?: number;
};

type Scenario = {
  title: string;
  description: string;
  emoji: string;
  choices: Choice[];
};

type DecisionData = {
  title: string;
  description: string;
  scenarios: Scenario[];
  summary_prompt: string;
};

export default function DecisionLab({ data }: { data: DecisionData }) {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [decisions, setDecisions] = useState<{ scenario: string; choice: string; impact: string }[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
  const [completed, setCompleted] = useState(false);

  const scenario = data.scenarios[currentScenario];

  const handleChoice = (choice: Choice) => {
    setSelectedChoice(choice);
    setDecisions((prev) => [...prev, { scenario: scenario.title, choice: choice.text, impact: choice.impact }]);
  };

  const handleNext = () => {
    if (selectedChoice?.next_scenario !== undefined && selectedChoice.next_scenario < data.scenarios.length) {
      setCurrentScenario(selectedChoice.next_scenario);
    } else if (currentScenario + 1 < data.scenarios.length) {
      setCurrentScenario(currentScenario + 1);
    } else {
      setCompleted(true);
    }
    setSelectedChoice(null);
  };

  const reset = () => {
    setCurrentScenario(0);
    setDecisions([]);
    setSelectedChoice(null);
    setCompleted(false);
  };

  if (completed) {
    const positives = decisions.filter((d) => d.impact === "positive").length;
    const negatives = decisions.filter((d) => d.impact === "negative").length;
    return (
      <div className="space-y-4">
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <h3 className="font-display font-bold text-lg">Decisions Complete!</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{data.summary_prompt}</p>
            <div className="flex gap-3 mb-4">
              <Badge variant="outline" className="bg-green-500/10 text-green-500">{positives} Positive</Badge>
              <Badge variant="outline" className="bg-destructive/10 text-destructive">{negatives} Negative</Badge>
              <Badge variant="outline">{decisions.length - positives - negatives} Neutral</Badge>
            </div>
            <div className="space-y-2">
              {decisions.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-secondary/30">
                  <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${d.impact === "positive" ? "bg-green-500" : d.impact === "negative" ? "bg-destructive" : "bg-muted-foreground"}`} />
                  <div>
                    <span className="font-medium">{d.scenario}:</span>{" "}
                    <span className="text-muted-foreground">{d.choice}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" /> Try Different Choices</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">Scenario {currentScenario + 1} of {data.scenarios.length}</Badge>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{scenario.emoji}</span>
            <h3 className="font-display font-bold text-lg">{scenario.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{scenario.description}</p>

          <div className="space-y-2">
            {scenario.choices.map((choice, i) => {
              const isSelected = selectedChoice === choice;
              return (
                <button
                  key={i}
                  onClick={() => !selectedChoice && handleChoice(choice)}
                  disabled={!!selectedChoice}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                    isSelected
                      ? choice.impact === "positive"
                        ? "border-green-500 bg-green-500/10"
                        : choice.impact === "negative"
                        ? "border-destructive bg-destructive/10"
                        : "border-primary bg-primary/10"
                      : selectedChoice
                      ? "border-border opacity-50"
                      : "border-border hover:border-primary/30 hover:bg-secondary/30"
                  }`}
                >
                  {choice.text}
                </button>
              );
            })}
          </div>

          {selectedChoice && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              selectedChoice.impact === "positive" ? "bg-green-500/10 border border-green-500/30" :
              selectedChoice.impact === "negative" ? "bg-destructive/10 border border-destructive/30" :
              "bg-secondary/50 border border-border"
            }`}>
              <p className="font-medium mb-1">Consequence:</p>
              <p className="text-muted-foreground">{selectedChoice.consequence}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedChoice && (
        <Button variant="hero" onClick={handleNext}>
          {currentScenario + 1 < data.scenarios.length ? (
            <><ArrowRight className="w-4 h-4 mr-1" /> Next Scenario</>
          ) : (
            <>See Results</>
          )}
        </Button>
      )}
    </div>
  );
}
