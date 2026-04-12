import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type Statement = {
  id: string;
  text: string;
  side: "for" | "against";
  explanation?: string;
};

export type DebateBuilderLabData = {
  lab_type: "debate_builder";
  title?: string;
  topic: string;           // "Should nuclear energy replace fossil fuels?"
  for_label?: string;      // default "For"
  against_label?: string;  // default "Against"
  statements: Statement[];
  key_insight?: string;
};

type Assignment = "for" | "against" | null;

type Props = {
  data: DebateBuilderLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function DebateBuilderLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const statements = useMemo(() => shuffle(data.statements || []), [data]);
  const forLabel = data.for_label || "For";
  const againstLabel = data.against_label || "Against";

  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [submitted, setSubmitted] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  const assign = useCallback((id: string, side: "for" | "against") => {
    if (submitted) return;
    setAssignments(prev => ({
      ...prev,
      [id]: prev[id] === side ? null : side,
    }));
  }, [submitted]);

  const allAssigned = statements.every(s => assignments[s.id] !== undefined && assignments[s.id] !== null);

  const handleSubmit = useCallback(() => {
    if (!allAssigned) return;
    setSubmitted(true);
    const allCorrect = statements.every(s => assignments[s.id] === s.side);
    if (allCorrect && !completionFired) {
      setCompletionFired(true);
      onComplete?.();
    }
  }, [allAssigned, statements, assignments, completionFired, onComplete]);

  const handleReset = useCallback(() => {
    setAssignments({});
    setSubmitted(false);
    setCompletionFired(false);
    onReplay?.();
  }, [onReplay]);

  const score = submitted
    ? statements.filter(s => assignments[s.id] === s.side).length
    : null;
  const perfect = score === statements.length;

  const forStatements = submitted ? statements.filter(s => assignments[s.id] === "for") : [];
  const againstStatements = submitted ? statements.filter(s => assignments[s.id] === "against") : [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {data.title && <h3 className="font-bold text-lg">{data.title}</h3>}
        <div className="rounded-xl bg-primary/8 border border-primary/20 px-4 py-3">
          <p className="text-sm font-semibold text-primary">Debate topic:</p>
          <p className="text-base font-medium mt-0.5">{data.topic}</p>
        </div>
        <p className="text-xs text-muted-foreground italic">
          For each statement, click whether it argues <strong>For</strong> or <strong>Against</strong> the topic.
        </p>
      </div>

      {submitted && score !== null && (
        <Card className={cn("border", perfect ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30")}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            {perfect ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <span className="text-xl">🎯</span>}
            <span className="text-sm font-medium">
              {perfect
                ? `Debate mastered! All ${statements.length} statements correctly sorted.`
                : `${score} of ${statements.length} correct.`}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Statement cards */}
      <div className="space-y-3">
        {statements.map((stmt) => {
          const assignment = assignments[stmt.id];
          const isCorrect = submitted && assignment === stmt.side;
          const isWrong = submitted && assignment !== null && assignment !== stmt.side;

          return (
            <div
              key={stmt.id}
              className={cn(
                "rounded-xl border p-4 transition-all",
                !submitted && "bg-card border-border",
                isCorrect && "bg-emerald-500/8 border-emerald-500/30",
                isWrong && "bg-red-500/5 border-red-400/30",
              )}
            >
              <p className="text-sm leading-relaxed mb-3">
                {submitted && (
                  <span className={cn("mr-2 font-bold", isCorrect ? "text-emerald-500" : "text-red-500")}>
                    {isCorrect ? "✓" : "✗"}
                  </span>
                )}
                {stmt.text}
              </p>

              {/* For / Against buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => assign(stmt.id, "for")}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                    assignment === "for" && !submitted && "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/40",
                    assignment !== "for" && !submitted && "bg-muted/40 border-border hover:bg-emerald-500/8 hover:border-emerald-500/30 hover:text-emerald-700",
                    submitted && assignment === "for" && isCorrect && "bg-emerald-500/15 border-emerald-500/40 text-emerald-700",
                    submitted && assignment === "for" && isWrong && "bg-red-500/10 border-red-400/40 text-red-600",
                    submitted && assignment !== "for" && "opacity-40",
                  )}
                >
                  ✅ {forLabel}
                </button>
                <button
                  onClick={() => assign(stmt.id, "against")}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                    assignment === "against" && !submitted && "bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300 ring-2 ring-red-500/40",
                    assignment !== "against" && !submitted && "bg-muted/40 border-border hover:bg-red-500/8 hover:border-red-500/30 hover:text-red-700",
                    submitted && assignment === "against" && isCorrect && "bg-emerald-500/15 border-emerald-500/40 text-emerald-700",
                    submitted && assignment === "against" && isWrong && "bg-red-500/10 border-red-400/40 text-red-600",
                    submitted && assignment !== "against" && "opacity-40",
                  )}
                >
                  ❌ {againstLabel}
                </button>
              </div>

              {submitted && stmt.explanation && (
                <p className="text-xs text-muted-foreground mt-2 leading-snug border-t border-border/50 pt-2">
                  {stmt.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {submitted && data.key_insight && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-3 px-4 flex gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm">{data.key_insight}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        {!submitted ? (
          <Button onClick={handleSubmit} disabled={!allAssigned} className="min-w-[140px]">
            Submit Debate
          </Button>
        ) : (
          <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Completed
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Replay
        </Button>
        {!submitted && (
          <span className="text-xs text-muted-foreground ml-auto">
            {Object.values(assignments).filter(Boolean).length}/{statements.length} assigned
          </span>
        )}
      </div>
    </div>
  );
}
