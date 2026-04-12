import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Pair = {
  id: string;
  left: string;
  right: string;
};

export type MatchingLabData = {
  lab_type: "matching";
  title?: string;
  instructions?: string;
  pairs: Pair[];
  key_insight?: string;
};

type Props = {
  data: MatchingLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

const PAIR_COLORS = [
  "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300",
  "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  "bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300",
  "bg-pink-500/15 border-pink-500/40 text-pink-700 dark:text-pink-300",
  "bg-cyan-500/15 border-cyan-500/40 text-cyan-700 dark:text-cyan-300",
  "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300",
  "bg-yellow-500/15 border-yellow-500/40 text-yellow-700 dark:text-yellow-300",
  "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300",
];

const RING_COLORS = [
  "ring-2 ring-indigo-500",
  "ring-2 ring-emerald-500",
  "ring-2 ring-orange-500",
  "ring-2 ring-pink-500",
  "ring-2 ring-cyan-500",
  "ring-2 ring-purple-500",
  "ring-2 ring-yellow-500",
  "ring-2 ring-rose-500",
];

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function MatchingLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const pairs = useMemo(() => data.pairs || [], [data]);
  const shuffledRight = useMemo(() => shuffle(pairs), [pairs]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  // matches: left_id → right_id
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  const getColorIndex = (leftId: string): number => {
    const entries = Object.keys(matches);
    return entries.indexOf(leftId) % PAIR_COLORS.length;
  };

  const getRightMatchedTo = (rightId: string): string | null => {
    const entry = Object.entries(matches).find(([, r]) => r === rightId);
    return entry ? entry[0] : null;
  };

  const handleLeftClick = useCallback((id: string) => {
    if (submitted) return;
    if (selectedLeft === id) {
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft(id);
  }, [submitted, selectedLeft]);

  const handleRightClick = useCallback((rightId: string) => {
    if (submitted) return;
    if (!selectedLeft) {
      // Deselect any existing match containing this right item
      const existingLeft = getRightMatchedTo(rightId);
      if (existingLeft) {
        setMatches(prev => {
          const next = { ...prev };
          delete next[existingLeft];
          return next;
        });
      }
      return;
    }

    setMatches(prev => {
      const next = { ...prev };
      // Remove any prior match for this left item
      delete next[selectedLeft];
      // Remove any prior match for this right item
      const prevLeft = Object.entries(next).find(([, r]) => r === rightId)?.[0];
      if (prevLeft) delete next[prevLeft];
      next[selectedLeft] = rightId;
      return next;
    });
    setSelectedLeft(null);
  }, [submitted, selectedLeft, matches]);

  const handleUnmatch = useCallback((leftId: string) => {
    if (submitted) return;
    setMatches(prev => {
      const next = { ...prev };
      delete next[leftId];
      return next;
    });
    setSelectedLeft(null);
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    if (Object.keys(matches).length < pairs.length) return;
    setSubmitted(true);
    const allCorrect = pairs.every(p => matches[p.id] === p.id);
    if (allCorrect && !completionFired) {
      setCompletionFired(true);
      onComplete?.();
    }
  }, [matches, pairs, completionFired, onComplete]);

  const handleReset = useCallback(() => {
    setMatches({});
    setSelectedLeft(null);
    setSubmitted(false);
    setCompletionFired(false);
    onReplay?.();
  }, [onReplay]);

  const score = submitted
    ? pairs.filter(p => matches[p.id] === p.id).length
    : null;

  const allMatched = Object.keys(matches).length === pairs.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        {data.title && <h3 className="font-bold text-lg">{data.title}</h3>}
        <p className="text-sm text-muted-foreground">
          {data.instructions || "Click an item on the left, then click its match on the right."}
        </p>
      </div>

      {/* Score banner */}
      {submitted && score !== null && (
        <Card className={cn(
          "border",
          score === pairs.length
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        )}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            {score === pairs.length
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <span className="text-xl shrink-0">🎯</span>
            }
            <span className="text-sm font-medium">
              {score === pairs.length
                ? `Perfect! All ${pairs.length} pairs correct.`
                : `${score} of ${pairs.length} correct. Check the highlighted mismatches.`}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Matching grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left column — terms */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Terms</p>
          {pairs.map((pair) => {
            const isMatched = matches[pair.id] !== undefined;
            const isSelected = selectedLeft === pair.id;
            const colorIdx = isMatched ? getColorIndex(pair.id) : -1;
            const isCorrect = submitted && matches[pair.id] === pair.id;
            const isWrong = submitted && isMatched && matches[pair.id] !== pair.id;

            return (
              <div
                key={pair.id}
                onClick={() => isMatched && !submitted ? handleUnmatch(pair.id) : handleLeftClick(pair.id)}
                className={cn(
                  "relative rounded-xl border px-4 py-3 text-sm cursor-pointer transition-all select-none",
                  "hover:shadow-sm active:scale-[0.98]",
                  isSelected && "ring-2 ring-primary bg-primary/10 border-primary/40",
                  isMatched && !isSelected && colorIdx >= 0 && PAIR_COLORS[colorIdx],
                  isMatched && !isSelected && colorIdx >= 0 && RING_COLORS[colorIdx],
                  !isMatched && !isSelected && "bg-muted/40 border-border hover:bg-muted/70",
                  isCorrect && "ring-2 ring-emerald-500 bg-emerald-500/15 border-emerald-500/40",
                  isWrong && "ring-2 ring-red-500 bg-red-500/10 border-red-500/30",
                )}
              >
                <span className="font-medium leading-snug">{pair.left}</span>
                {isMatched && !submitted && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnmatch(pair.id); }}
                    className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {submitted && isCorrect && (
                  <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-emerald-500" />
                )}
                {submitted && isWrong && (
                  <span className="absolute top-2 right-2 text-red-500 text-xs font-bold">✗</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right column — definitions (shuffled) */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Definitions</p>
          {shuffledRight.map((pair) => {
            const matchedLeftId = getRightMatchedTo(pair.id);
            const isMatched = matchedLeftId !== null;
            const colorIdx = isMatched ? getColorIndex(matchedLeftId!) : -1;
            const isCorrect = submitted && isMatched && matchedLeftId === pair.id;
            const isWrong = submitted && isMatched && matchedLeftId !== pair.id;

            return (
              <div
                key={pair.id}
                onClick={() => handleRightClick(pair.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm cursor-pointer transition-all select-none",
                  "hover:shadow-sm active:scale-[0.98]",
                  isMatched && colorIdx >= 0 && PAIR_COLORS[colorIdx],
                  isMatched && colorIdx >= 0 && RING_COLORS[colorIdx],
                  !isMatched && selectedLeft && "ring-2 ring-dashed ring-primary/40 bg-primary/5 border-primary/20",
                  !isMatched && !selectedLeft && "bg-muted/40 border-border hover:bg-muted/70",
                  isCorrect && "ring-2 ring-emerald-500 bg-emerald-500/15 border-emerald-500/40",
                  isWrong && "ring-2 ring-red-500 bg-red-500/10 border-red-500/30",
                )}
              >
                <span className="leading-snug">{pair.right}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key insight (after submit) */}
      {submitted && data.key_insight && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-3 px-4 flex gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm">{data.key_insight}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={!allMatched}
            className="min-w-[140px]"
          >
            Check Answers
          </Button>
        ) : (
          <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Completed
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Replay
        </Button>
        {!allMatched && !submitted && (
          <span className="text-xs text-muted-foreground ml-auto">
            {Object.keys(matches).length}/{pairs.length} matched
          </span>
        )}
      </div>
    </div>
  );
}
