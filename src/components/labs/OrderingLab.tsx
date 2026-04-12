import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, Lightbulb, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type OrderItem = {
  id: string;
  text: string;
  correct_position: number; // 1-indexed
};

export type OrderingLabData = {
  lab_type: "ordering";
  title?: string;
  context?: string;
  items: OrderItem[];
  key_insight?: string;
};

type Props = {
  data: OrderingLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function OrderingLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const items = useMemo(() => data.items || [], [data]);
  const total = items.length;

  // Bank = unplaced items (shuffled at start)
  const [bank, setBank] = useState<OrderItem[]>(() => shuffle(items));
  // Placed = ordered sequence slots (null = empty)
  const [placed, setPlaced] = useState<(OrderItem | null)[]>(() => Array(total).fill(null));
  // selectedBankId = item chosen from bank awaiting slot click
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  // selectedSlotIdx = slot chosen from placed area awaiting swap
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  const handleBankClick = useCallback((itemId: string) => {
    if (submitted) return;
    if (selectedBankId === itemId) {
      setSelectedBankId(null);
      return;
    }
    setSelectedBankId(itemId);
    setSelectedSlotIdx(null);
  }, [submitted, selectedBankId]);

  const handleSlotClick = useCallback((slotIdx: number) => {
    if (submitted) return;

    // Case 1: a bank item is selected → place it in this slot
    if (selectedBankId !== null) {
      const item = bank.find(b => b.id === selectedBankId);
      if (!item) return;

      setPlaced(prev => {
        const next = [...prev];
        // If slot already occupied, return existing item to bank
        const displaced = next[slotIdx];
        next[slotIdx] = item;
        if (displaced) {
          setBank(prevBank => [...prevBank, displaced]);
        }
        return next;
      });
      setBank(prev => prev.filter(b => b.id !== selectedBankId));
      setSelectedBankId(null);
      return;
    }

    // Case 2: a placed slot is already selected → swap them
    if (selectedSlotIdx !== null) {
      if (selectedSlotIdx === slotIdx) {
        setSelectedSlotIdx(null);
        return;
      }
      setPlaced(prev => {
        const next = [...prev];
        [next[selectedSlotIdx], next[slotIdx]] = [next[slotIdx], next[selectedSlotIdx]];
        return next;
      });
      setSelectedSlotIdx(null);
      return;
    }

    // Case 3: clicking an occupied slot with nothing selected → select it (for swap)
    if (placed[slotIdx] !== null) {
      setSelectedSlotIdx(slotIdx);
      return;
    }
  }, [submitted, selectedBankId, selectedSlotIdx, bank, placed]);

  const handleReturnToBank = useCallback((slotIdx: number) => {
    if (submitted) return;
    const item = placed[slotIdx];
    if (!item) return;
    setBank(prev => [...prev, item]);
    setPlaced(prev => { const next = [...prev]; next[slotIdx] = null; return next; });
    setSelectedSlotIdx(null);
    setSelectedBankId(null);
  }, [submitted, placed]);

  const handleSubmit = useCallback(() => {
    if (placed.some(p => p === null)) return;
    setSubmitted(true);
    const allCorrect = placed.every((item, idx) => item?.correct_position === idx + 1);
    if (allCorrect && !completionFired) {
      setCompletionFired(true);
      onComplete?.();
    }
  }, [placed, completionFired, onComplete]);

  const handleReset = useCallback(() => {
    setBank(shuffle(items));
    setPlaced(Array(total).fill(null));
    setSelectedBankId(null);
    setSelectedSlotIdx(null);
    setSubmitted(false);
    setCompletionFired(false);
    onReplay?.();
  }, [items, total, onReplay]);

  const placedCount = placed.filter(Boolean).length;
  const allPlaced = placedCount === total;

  const score = submitted
    ? placed.filter((item, idx) => item?.correct_position === idx + 1).length
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        {data.title && <h3 className="font-bold text-lg">{data.title}</h3>}
        {data.context && (
          <p className="text-sm text-muted-foreground leading-relaxed">{data.context}</p>
        )}
        <p className="text-sm text-muted-foreground italic">
          Click an item from the pool, then click a numbered slot to place it. Click a placed item to swap or return it.
        </p>
      </div>

      {/* Score banner */}
      {submitted && score !== null && (
        <Card className={cn(
          "border",
          score === total
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        )}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            {score === total
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <span className="text-xl shrink-0">🎯</span>
            }
            <span className="text-sm font-medium">
              {score === total
                ? `Correct order! All ${total} steps in the right place.`
                : `${score} of ${total} in the correct position.`}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Bank (unplaced items) */}
      {bank.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item Pool</p>
          <div className="flex flex-wrap gap-2">
            {bank.map((item) => (
              <button
                key={item.id}
                onClick={() => handleBankClick(item.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm text-left transition-all active:scale-[0.97]",
                  selectedBankId === item.id
                    ? "ring-2 ring-primary bg-primary/10 border-primary/40 font-medium"
                    : "bg-muted/50 border-border hover:bg-muted/80 hover:shadow-sm",
                )}
              >
                {item.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {bank.length > 0 && (
        <div className="flex justify-center">
          <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
        </div>
      )}

      {/* Sequence slots */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sequence {allPlaced ? "" : `(${placedCount}/${total} placed)`}
        </p>
        <div className="space-y-2">
          {placed.map((item, idx) => {
            const isSelected = selectedSlotIdx === idx;
            const isCorrect = submitted && item?.correct_position === idx + 1;
            const isWrong = submitted && item !== null && item?.correct_position !== idx + 1;

            return (
              <div
                key={idx}
                onClick={() => item ? handleSlotClick(idx) : handleSlotClick(idx)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all",
                  item === null && selectedBankId && "ring-2 ring-dashed ring-primary/50 bg-primary/5 border-primary/20",
                  item === null && !selectedBankId && "bg-muted/20 border-dashed border-border/50 hover:bg-muted/40",
                  item !== null && !submitted && !isSelected && "bg-card border-border hover:shadow-sm",
                  item !== null && !submitted && isSelected && "ring-2 ring-primary bg-primary/10 border-primary/40",
                  isCorrect && "bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500",
                  isWrong && "bg-red-500/5 border-red-500/30 ring-2 ring-red-400",
                )}
              >
                {/* Step number badge */}
                <span className={cn(
                  "flex-none w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border",
                  item === null ? "bg-muted/30 border-border/40 text-muted-foreground/50" : "bg-primary/10 border-primary/30 text-primary",
                  isCorrect && "bg-emerald-500/20 border-emerald-500/50 text-emerald-600",
                  isWrong && "bg-red-500/15 border-red-400/40 text-red-600",
                )}>
                  {idx + 1}
                </span>

                {item ? (
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{item.text}</span>
                    <div className="flex items-center gap-2">
                      {submitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {submitted && isWrong && (
                        <span className="text-xs text-red-500 font-medium">
                          Should be #{item.correct_position}
                        </span>
                      )}
                      {!submitted && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReturnToBank(idx); }}
                          className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded hover:bg-muted"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground/40 italic">
                    {selectedBankId ? "Click to place here" : "Empty slot"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Key insight */}
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
          <Button onClick={handleSubmit} disabled={!allPlaced} className="min-w-[140px]">
            Check Order
          </Button>
        ) : (
          <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Completed
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Replay
        </Button>
      </div>
    </div>
  );
}
