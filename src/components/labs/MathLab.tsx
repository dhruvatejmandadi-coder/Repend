import { useState } from "react";
import { CheckCircle2, XCircle, Lightbulb, RotateCcw, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Problem = {
  question: string;
  answer: number;
  tolerance?: number;
  hint?: string;
  explanation?: string;
};

type Props = {
  data: {
    title?: string;
    description?: string;
    problems: Problem[];
  };
};

export default function MathLab({ data }: Props) {
  const problems = data.problems ?? [];

  const [current, setCurrent] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const problem = problems[current];

  const checkAnswer = () => {
    if (!problem || result) return;
    const parsed = parseFloat(userAnswer);
    if (isNaN(parsed)) return;
    const correct = Math.abs(parsed - problem.answer) <= (problem.tolerance ?? 0.01);
    setResult(correct ? "correct" : "incorrect");
    if (correct) setTotalCorrect((p) => p + 1);
  };

  const next = () => {
    if (current + 1 >= problems.length) {
      setFinished(true);
      return;
    }
    setCurrent((p) => p + 1);
    setUserAnswer("");
    setShowHint(false);
    setResult(null);
  };

  const reset = () => {
    setCurrent(0);
    setUserAnswer("");
    setShowHint(false);
    setResult(null);
    setTotalCorrect(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="text-4xl">{totalCorrect === problems.length ? "🎉" : "📊"}</div>
            <h3 className="font-bold text-xl">
              {totalCorrect === problems.length ? "Perfect Score!" : "Results"}
            </h3>
            <p className="text-lg">
              {totalCorrect} / {problems.length} correct
            </p>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!problem) return null;

  return (
    <div className="space-y-4">
      {(data.title || data.description) && (
        <div className="space-y-1">
          {data.title && <h3 className="font-bold text-lg">{data.title}</h3>}
          {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
        </div>
      )}

      <Badge variant="outline">
        Problem {current + 1} of {problems.length}
      </Badge>

      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="font-medium">{problem.question}</p>

          {!result && problem.hint && (
            <Button size="sm" variant="ghost" onClick={() => setShowHint((p) => !p)}>
              <Lightbulb className="w-4 h-4 mr-1" />
              {showHint ? "Hide Hint" : "Show Hint"}
            </Button>
          )}

          {showHint && !result && problem.hint && (
            <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
              💡 {problem.hint}
            </p>
          )}

          <div className="flex gap-2">
            <Input
              type="number"
              step="any"
              placeholder="Your answer"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={!!result}
              onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
              className="max-w-[200px]"
            />
            {!result && (
              <Button onClick={checkAnswer} disabled={!userAnswer.trim()}>
                Check
              </Button>
            )}
          </div>

          {result && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg ${
                result === "correct" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              {result === "correct" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {result === "correct" ? "Correct!" : `Incorrect. Answer: ${problem.answer}`}
                </p>
                {problem.explanation && <p>{problem.explanation}</p>}
              </div>
            </div>
          )}

          {result && (
            <Button onClick={next}>
              {current + 1 < problems.length ? (
                <>
                  Next <ArrowRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                "See Results"
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
