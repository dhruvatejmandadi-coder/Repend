import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2, RotateCcw, Lightbulb, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  recommended_min?: number;   // % floor for "good" allocation
  recommended_max?: number;   // % ceiling for "good" allocation
  explanation?: string;
};

export type BudgetAllocatorLabData = {
  lab_type: "budget_allocator";
  title?: string;
  scenario: string;            // "You are a city mayor with a $10M budget..."
  total_label?: string;        // "Total Budget" — defaults to "Total"
  unit?: string;               // "%" default
  categories: Category[];
  reflection?: string;         // question shown after submit
  key_insight?: string;
};

type Props = {
  data: BudgetAllocatorLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

const CATEGORY_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-cyan-500", "bg-yellow-500", "bg-rose-500",
];

export default function BudgetAllocatorLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const categories = useMemo(() => data.categories || [], [data]);
  const unit = data.unit || "%";
  const totalTarget = 100;

  const initialAlloc = useMemo(() => {
    const even = Math.floor(totalTarget / categories.length);
    const rem = totalTarget - even * categories.length;
    return Object.fromEntries(categories.map((c, i) => [c.id, even + (i === 0 ? rem : 0)]));
  }, [categories]);

  const [allocations, setAllocations] = useState<Record<string, number>>(initialAlloc);
  const [submitted, setSubmitted] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  const total = Object.values(allocations).reduce((s, v) => s + v, 0);
  const isBalanced = Math.abs(total - totalTarget) <= 1;

  const handleSlider = useCallback((id: string, value: number) => {
    if (submitted) return;
    setAllocations(prev => ({ ...prev, [id]: value }));
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    if (!isBalanced) return;
    setSubmitted(true);
    if (!completionFired) {
      setCompletionFired(true);
      onComplete?.();
    }
  }, [isBalanced, completionFired, onComplete]);

  const handleReset = useCallback(() => {
    setAllocations(initialAlloc);
    setSubmitted(false);
    setCompletionFired(false);
    onReplay?.();
  }, [initialAlloc, onReplay]);

  const getCategoryStatus = (cat: Category) => {
    const val = allocations[cat.id] ?? 0;
    if (cat.recommended_min !== undefined && val < cat.recommended_min) return "low";
    if (cat.recommended_max !== undefined && val > cat.recommended_max) return "high";
    return "ok";
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {data.title && <h3 className="font-bold text-lg">{data.title}</h3>}
        <Card className="bg-muted/30 border-border/60">
          <CardContent className="py-3 px-4">
            <p className="text-sm leading-relaxed">{data.scenario}</p>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground italic">
          Adjust the sliders to allocate {unit === "%" ? "100%" : `the full ${unit}`} across categories.
        </p>
      </div>

      {/* Total indicator */}
      <div className={cn(
        "flex items-center justify-between rounded-xl border px-4 py-2.5",
        isBalanced ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"
      )}>
        <span className="text-sm font-medium">Total allocated</span>
        <span className={cn("text-lg font-bold", isBalanced ? "text-emerald-600" : "text-amber-600")}>
          {total}{unit}
          {!isBalanced && <span className="text-xs font-normal ml-2">({total > totalTarget ? "+" : ""}{total - totalTarget})</span>}
        </span>
      </div>

      {/* Stacked bar visualization */}
      <div className="rounded-xl overflow-hidden h-5 flex">
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            style={{ width: `${(allocations[cat.id] ?? 0)}%`, transition: "width 0.2s ease" }}
            className={cn(CATEGORY_COLORS[i % CATEGORY_COLORS.length], "h-full")}
            title={`${cat.name}: ${allocations[cat.id]}${unit}`}
          />
        ))}
      </div>

      {/* Sliders */}
      <div className="space-y-5">
        {categories.map((cat, i) => {
          const val = allocations[cat.id] ?? 0;
          const status = submitted ? getCategoryStatus(cat) : null;

          return (
            <div key={cat.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full shrink-0", CATEGORY_COLORS[i % CATEGORY_COLORS.length])} />
                  <span className="text-sm font-medium">
                    {cat.icon && <span className="mr-1">{cat.icon}</span>}
                    {cat.name}
                  </span>
                  {submitted && status === "low" && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-400/40 bg-amber-500/10 h-5">underfunded</Badge>
                  )}
                  {submitted && status === "high" && (
                    <Badge variant="outline" className="text-xs text-red-600 border-red-400/40 bg-red-500/10 h-5">overfunded</Badge>
                  )}
                </div>
                <span className={cn(
                  "text-sm font-bold tabular-nums",
                  submitted && status === "ok" && "text-emerald-600",
                  submitted && status === "low" && "text-amber-600",
                  submitted && status === "high" && "text-red-600",
                )}>
                  {val}{unit}
                </span>
              </div>

              <Slider
                min={0}
                max={100}
                step={1}
                value={[val]}
                onValueChange={([v]) => handleSlider(cat.id, v)}
                disabled={submitted}
                className={cn(submitted && "opacity-70")}
              />

              {cat.description && (
                <p className="text-xs text-muted-foreground leading-snug">{cat.description}</p>
              )}

              {submitted && cat.explanation && (
                <p className={cn(
                  "text-xs leading-snug rounded-lg px-3 py-2 border",
                  status === "ok" ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-800 dark:text-emerald-200"
                    : "bg-amber-500/8 border-amber-500/25 text-amber-800 dark:text-amber-200"
                )}>
                  {cat.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Reflection question */}
      {submitted && data.reflection && (
        <Card className="bg-blue-500/8 border-blue-500/25">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Reflect:</p>
            <p className="text-sm">{data.reflection}</p>
          </CardContent>
        </Card>
      )}

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
          <Button onClick={handleSubmit} disabled={!isBalanced} className="min-w-[140px]">
            Lock In Budget
          </Button>
        ) : (
          <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Completed
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Replay
        </Button>
        {!isBalanced && !submitted && (
          <span className="text-xs text-amber-600 flex items-center gap-1 ml-auto">
            <AlertTriangle className="w-3 h-3" /> Must total exactly 100{unit}
          </span>
        )}
      </div>
    </div>
  );
}
