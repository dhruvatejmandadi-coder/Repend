import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, Lightbulb, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectItem = {
  id: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
};

export type HighlightSelectLabData = {
  lab_type: "highlight_select";
  title?: string;
  instruction: string;       // "Select ALL items that are examples of X"
  items: SelectItem[];
  key_insight?: string;
};

type Props = {
  data: HighlightSelectLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

export default function HighlightSelectLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const items = useMemo(() => data.items || [], [data]);
  const correctCount = items.filter(i => i.is_correct).length;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  const toggle = useCallback((id: string) => {
    if (submitted) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    if (selected.size === 0) return;
    setSubmitted(true);
    const allCorrect = items.every(item =>
      item.is_correct ? selected.has(item.id) : !selected.has(item.id)
    );
    if (allCorrect && !completionFired) {
      setCompletionFired(true);
      onComplete?.();
    }
  }, [selected, items, completionFired, onComplete]);

  const handleReset = useCallback(() => {
    setSelected(new Set());
    setSubmitted(false);
    setCompletionFired(false);
    onReplay?.();
  }, [onReplay]);

  const correctSelected = submitted ? items.filter(i => i.is_correct && selected.has(i.id)).length : 0;
  const wrongSelected = submitted ? items.filter(i => !i.is_correct && selected.has(i.id)).length : 0;
  const missed = submitted ? items.filter(i => i.is_correct && !selected.has(i.id)).length : 0;
  const perfect = submitted && wrongSelected === 0 && missed === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        {data.title && <h3 className="font-bold text-lg">{data.title}</h3>}
        <p className="text-sm font-medium">{data.instruction}</p>
        <p className="text-xs text-muted-foreground italic">
          Click all items that apply — there may be more than one correct answer.
        </p>
      </div>

      {submitted && (
        <Card className={cn("border", perfect ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30")}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            {perfect
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <span className="text-xl shrink-0">🎯</span>}
            <span className="text-sm font-medium">
              {perfect
                ? `Perfect! All ${correctCount} correct items selected.`
                : `${correctSelected}/${correctCount} correct items found. ${wrongSelected > 0 ? `${wrongSelected} incorrect selection${wrongSelected > 1 ? "s" : ""}.` : ""} ${missed > 0 ? `${missed} missed.` : ""}`}
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          const truePositive = submitted && item.is_correct && isSelected;
          const falsePositive = submitted && !item.is_correct && isSelected;
          const falseNegative = submitted && item.is_correct && !isSelected;

          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={cn(
                "text-left rounded-xl border px-4 py-3 text-sm transition-all active:scale-[0.98]",
                "hover:shadow-sm select-none",
                !submitted && !isSelected && "bg-muted/40 border-border hover:bg-muted/70",
                !submitted && isSelected && "ring-2 ring-primary bg-primary/10 border-primary/40 font-medium",
                truePositive && "ring-2 ring-emerald-500 bg-emerald-500/15 border-emerald-500/40",
                falsePositive && "ring-2 ring-red-400 bg-red-500/10 border-red-400/40",
                falseNegative && "ring-2 ring-amber-400 bg-amber-500/10 border-amber-400/40",
                submitted && !isSelected && !item.is_correct && "bg-muted/20 border-border/40 opacity-60",
              )}
            >
              <div className="flex items-start gap-2">
                <span className={cn(
                  "mt-0.5 text-base shrink-0",
                  truePositive && "text-emerald-500",
                  falsePositive && "text-red-500",
                  falseNegative && "text-amber-500",
                )}>
                  {submitted
                    ? truePositive ? "✓" : falsePositive ? "✗" : falseNegative ? "○" : ""
                    : isSelected ? "◉" : "○"}
                </span>
                <div>
                  <span className="leading-snug">{item.text}</span>
                  {submitted && item.explanation && (isSelected || item.is_correct) && (
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{item.explanation}</p>
                  )}
                </div>
              </div>
            </button>
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
          <Button onClick={handleSubmit} disabled={selected.size === 0} className="min-w-[140px]">
            Check Selections
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
          <span className="text-xs text-muted-foreground ml-auto">{selected.size} selected</span>
        )}
      </div>
    </div>
  );
}
