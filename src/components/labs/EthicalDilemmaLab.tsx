import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, RotateCcw } from "lucide-react";

type Dimension = {
  name: string;
  icon: string;
  description: string;
};

type Decision = {
  question: string;
  emoji?: string;
  choices: {
    text: string;
    explanation?: string;
    impacts: Record<string, number>; // dimension name → delta (-50 to +50)
  }[];
};

type EthicalData = {
  title?: string;
  description?: string;
  dimensions: Dimension[];
  decisions: Decision[];
};

export default function EthicalDilemmaLab({ data }: { data: EthicalData }) {
  const dimensions = data.dimensions ?? [];
  const decisions = data.decisions ?? [];

  const [scores, setScores] = useState<Record<string, number>>(
    () => Object.fromEntries(dimensions.map((d) => [d.name, 50]))
  );
  const [answered, setAnswered] = useState<Record<number, number>>({});
  const [currentDecision, setCurrentDecision] = useState(0);

  const allDone = Object.keys(answered).length === decisions.length;

  const handleChoice = (choiceIdx: number) => {
    if (answered[currentDecision] !== undefined) return;
    const choice = decisions[currentDecision]?.choices[choiceIdx];
    if (!choice) return;

    setScores((prev) => {
      const next = { ...prev };
      for (const dim of dimensions) {
        const delta = choice.impacts[dim.name] ?? 0;
        next[dim.name] = Math.max(0, Math.min(100, (prev[dim.name] ?? 50) + delta));
      }
      return next;
    });

    setAnswered((prev) => ({ ...prev, [currentDecision]: choiceIdx }));
  };

  // Balance score: how close all dimensions are to each other (0-100)
  const balanceScore = useMemo(() => {
    if (dimensions.length < 2) return 100;
    const vals = dimensions.map((d) => scores[d.name] ?? 50);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const maxDeviation = vals.reduce((max, v) => Math.max(max, Math.abs(v - avg)), 0);
    return Math.round(Math.max(0, 100 - maxDeviation * 2));
  }, [scores, dimensions]);

  const reset = () => {
    setScores(Object.fromEntries(dimensions.map((d) => [d.name, 50])));
    setAnswered({});
    setCurrentDecision(0);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Ethical Dilemma</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Every choice improves one dimension but harms another. There is no perfect answer — balance matters.
          </p>
        </CardContent>
      </Card>

      {/* Dimensions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dimensions.map((dim) => {
          const val = scores[dim.name] ?? 50;
          const color = val >= 60 ? "text-green-500" : val >= 40 ? "text-yellow-500" : "text-red-500";
          return (
            <Card key={dim.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{dim.icon} {dim.name}</span>
                  <Badge variant="outline" className={color}>{val}%</Badge>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${val}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{dim.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Decision */}
      {!allDone && decisions[currentDecision] && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Dilemma {currentDecision + 1} of {decisions.length}
              </Badge>
            </div>
            <p className="font-medium">
              {decisions[currentDecision].emoji ?? "⚖️"} {decisions[currentDecision].question}
            </p>
            {decisions[currentDecision].choices.map((c, i) => {
              const isChosen = answered[currentDecision] === i;
              const isAnswered = answered[currentDecision] !== undefined;
              return (
                <div key={i} className="space-y-1">
                  <button
                    onClick={() => handleChoice(i)}
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
              <Button size="sm" variant="outline" onClick={() => setCurrentDecision((p) => p + 1)}>
                Next Dilemma →
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Outcome */}
      {allDone && (
        <Card className="border-primary/20">
          <CardContent className="p-5 text-center space-y-3">
            <Scale className="w-10 h-10 text-primary mx-auto" />
            <h3 className="font-bold text-lg">Ethical Balance Score: {balanceScore}%</h3>
            <div className="h-3 bg-secondary rounded-full overflow-hidden max-w-xs mx-auto">
              <div className="h-full bg-primary transition-all" style={{ width: `${balanceScore}%` }} />
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {balanceScore >= 75
                ? "Excellent balance! You maintained equity across all ethical dimensions."
                : balanceScore >= 50
                  ? "Decent balance, but some dimensions suffered significantly."
                  : "Your choices heavily favored certain dimensions over others. Consider the tradeoffs."}
            </p>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" /> Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
