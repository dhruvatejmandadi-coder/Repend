import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

interface QuizSlidesProps {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<number, number>, score: number, total: number) => void;
  isCompleted?: boolean;
  initialAnswers?: Record<number, number>;
  initialSubmitted?: boolean;
}

const PASS_THRESHOLD = 0.7;

export default function QuizSlides({ questions, onSubmit, isCompleted, initialAnswers, initialSubmitted }: QuizSlidesProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>(initialAnswers || {});
  const [submitted, setSubmitted] = useState(initialSubmitted || false);
  const total = questions.length;

  const goNext = useCallback(() => setCurrent((c) => Math.min(c + 1, total)), [total]);
  const goPrev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const selectAnswer = (questionIndex: number, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleSubmit = () => {
    const score = questions.filter((q, i) => answers[i] === q.correct).length;
    setSubmitted(true);
    setCurrent(total); // Go to results slide
    onSubmit(answers, score, total);
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setCurrent(0);
  };

  const score = questions.filter((q, i) => answers[i] === q.correct).length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = pct >= PASS_THRESHOLD * 100;
  const allAnswered = Object.keys(answers).length >= total;
  const isResults = current === total;
  const progressPercent = total > 0 ? ((Math.min(current + 1, total)) / (total + 1)) * 100 : 100;

  return (
    <Card className="overflow-hidden">
      <Progress value={progressPercent} className="h-1.5 rounded-none" />
      <CardContent className="p-6">
        {!isResults ? (
          <>
            {/* Question slide — NO immediate feedback, just selection */}
            <div className="mb-4 flex items-center justify-between">
              <Badge variant="outline" className="text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
                Question {current + 1} of {total}
              </Badge>
              {isCompleted && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                </Badge>
              )}
            </div>

            <div key={current} className="min-h-[300px] animate-fade-in">
              <h2 className="font-display text-xl font-bold text-foreground mb-6 leading-snug">
                {questions[current]?.question}
              </h2>

              <div className="space-y-3">
                {questions[current]?.options?.map((opt, oi) => {
                  const selected = answers[current] === oi;
                  const isCorrect = oi === questions[current].correct;

                  // Before submit: just show selected state
                  // After submit: show correct/incorrect
                  let style = "border-border/50 hover:border-primary/30 hover:bg-primary/[0.03]";

                  if (submitted) {
                    if (isCorrect) style = "border-green-500/40 bg-green-500/[0.06]";
                    else if (selected && !isCorrect) style = "border-destructive/40 bg-destructive/[0.06]";
                    else style = "border-border/30 opacity-60";
                  } else if (selected) {
                    style = "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20";
                  }

                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => selectAnswer(current, oi)}
                      className={`w-full text-left px-4 py-3.5 rounded-lg border text-sm transition-all duration-150 ${style}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full border border-border/50 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                          {submitted && isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : submitted && selected && !isCorrect ? (
                            <XCircle className="w-4 h-4 text-destructive" />
                          ) : (
                            String.fromCharCode(65 + oi)
                          )}
                        </span>
                        <span>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Show explanation ONLY after submit (review mode) */}
              {submitted && questions[current]?.explanation && (
                <div className={`mt-5 p-4 rounded-xl border space-y-1.5 ${
                  answers[current] === questions[current].correct
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-destructive/5 border-destructive/20"
                }`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {answers[current] === questions[current].correct ? "✅ Why this is correct" : "📖 Explanation"}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{questions[current].explanation}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Results slide */
          <div key="results" className="min-h-[300px] flex flex-col items-center justify-center text-center animate-fade-in">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
              passed ? "bg-green-500/10" : "bg-destructive/10"
            }`}>
              {passed ? (
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              ) : (
                <XCircle className="w-10 h-10 text-destructive" />
              )}
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">
              {passed ? "Quiz Passed! 🎉" : "Not Quite Yet"}
            </h2>
            <p className="text-muted-foreground mb-4">
              You scored <span className="font-bold text-foreground">{score}/{total}</span> ({pct}%)
              {!passed && " — Need 70% to pass"}
            </p>
            <div className="flex gap-3">
              {!passed && (
                <Button variant="outline" onClick={handleRetry}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Retry Quiz
                </Button>
              )}
              <Button variant="ghost" onClick={() => setCurrent(0)}>
                Review Answers
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={goPrev} disabled={current === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <div className="flex items-center gap-1.5">
            {[...Array(total + 1)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current ? "bg-primary scale-125" :
                  i === total ? "bg-muted-foreground/20" :
                  answers[i] !== undefined ? "bg-primary/40" : "bg-muted-foreground/30"
                }`}
                aria-label={i === total ? "Results" : `Question ${i + 1}`}
              />
            ))}
          </div>
          {!isResults ? (
            current === total - 1 && allAnswered && !submitted ? (
              <Button size="sm" onClick={handleSubmit}>
                Submit Quiz
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={goNext} disabled={current >= total - 1 && !submitted}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )
          ) : (
            <div />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
