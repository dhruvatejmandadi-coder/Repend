import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Lock, Trophy, RotateCcw, Clock,
  Lightbulb, Zap, ChevronRight, Star
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Metric = { id: string; label: string; icon: string; value: number; max: number };

type BaseAct = {
  id: string;
  title: string;
  context: string;
  metric_effects: Record<string, number>;
};

type ClassifySortAct = BaseAct & {
  type: "classify_sort";
  categories: string[];
  items: { id: string; text: string; category: string; explanation: string }[];
};

type BranchChainAct = BaseAct & {
  type: "branch_chain";
  decisions: {
    id: string;
    prompt: string;
    hint?: string;
    options: { text: string; consequence: string; is_best: boolean }[];
  }[];
};

type BuildOrderAct = BaseAct & {
  type: "build_order";
  steps: { id: string; text: string; position: number }[];
  par_time?: number;
};

type MatchChainAct = BaseAct & {
  type: "match_chain";
  pairs: { left: string; right: string }[];
};

type FillLabAct = BaseAct & {
  type: "fill_lab";
  template: string;
  blanks: { id: string; options: string[]; correct: string; explanation?: string }[];
};

type CActivity = ClassifySortAct | BranchChainAct | BuildOrderAct | MatchChainAct | FillLabAct;

export type CohesiveLabData = {
  lab_type: "cohesive";
  title: string;
  narrative: string;
  metrics: Metric[];
  activities: CActivity[];
  verdict_tiers: { grade: "S" | "A" | "B" | "C" | "D"; threshold: number; title: string; description: string }[];
};

type Props = {
  data: CohesiveLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

// ── Classify Sort ─────────────────────────────────────────────────────────────

function ClassifySort({ act, onComplete }: { act: ClassifySortAct; onComplete: (e: Record<string, number>) => void }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone] = useState(false);

  const items = act.items;
  const current = items[idx];

  const handleCat = (cat: string) => {
    if (done || answers[current?.id]) return;
    const correct = cat === current.category;
    setFlash(correct ? "correct" : "wrong");
    setTimeout(() => setFlash(null), 700);
    setAnswers(prev => ({ ...prev, [current.id]: cat }));
    setStreak(s => correct ? s + 1 : 0);

    setTimeout(() => {
      if (idx + 1 >= items.length) {
        setDone(true);
        onComplete(act.metric_effects);
      } else {
        setIdx(i => i + 1);
      }
    }, 900);
  };

  const correctCount = items.filter(i => answers[i.id] === i.category).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{Math.min(idx + 1, items.length)} / {items.length}</span>
        {streak >= 2 && <span className="text-amber-500 font-bold">🔥 {streak} streak</span>}
      </div>

      {done ? (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="font-bold">{correctCount} / {items.length} correct</p>
        </div>
      ) : (
        <>
          <div className={cn(
            "p-5 rounded-xl border-2 text-center text-base font-medium transition-all duration-200 min-h-[80px] flex items-center justify-center",
            flash === "correct" && "border-emerald-500 bg-emerald-500/10 text-emerald-700",
            flash === "wrong" && "border-red-500 bg-red-500/10 text-red-700",
            !flash && "border-border/60 bg-card"
          )}>
            {current?.text}
          </div>

          {answers[current?.id] && current && (
            <p className="text-xs text-center text-muted-foreground italic animate-fade-in">
              {flash === null && current.explanation}
            </p>
          )}

          <div className={cn("grid gap-2", act.categories.length <= 2 ? "grid-cols-2" : act.categories.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {act.categories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCat(cat)}
                disabled={!!answers[current?.id]}
                className={cn(
                  "py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all active:scale-95",
                  answers[current?.id] === cat && cat === current?.category && "border-emerald-500 bg-emerald-500/15 text-emerald-700",
                  answers[current?.id] === cat && cat !== current?.category && "border-red-500 bg-red-500/10 text-red-700",
                  answers[current?.id] && answers[current?.id] !== cat && "opacity-30 border-border",
                  !answers[current?.id] && "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Branch Chain ──────────────────────────────────────────────────────────────

function BranchChain({ act, onComplete }: { act: BranchChainAct; onComplete: (e: Record<string, number>) => void }) {
  const [decIdx, setDecIdx] = useState(0);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  const dec = act.decisions[decIdx];
  const chosen = dec ? choices[dec.id] : undefined;
  const chosenOpt = chosen !== undefined ? dec?.options[chosen] : undefined;

  const handleChoice = (optIdx: number) => {
    if (chosen !== undefined || done) return;
    setChoices(prev => ({ ...prev, [dec.id]: optIdx }));
    setTimeout(() => {
      if (decIdx + 1 >= act.decisions.length) {
        setDone(true);
        onComplete(act.metric_effects);
      } else {
        setDecIdx(i => i + 1);
      }
    }, 1400);
  };

  if (done) return (
    <div className="space-y-3">
      <div className="text-center py-3">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
        <p className="font-bold text-sm">All decisions made</p>
      </div>
      <div className="space-y-2">
        {act.decisions.map(d => {
          const c = act.decisions.indexOf(d);
          const opt = d.options[choices[d.id]];
          return (
            <div key={d.id} className={cn("text-xs p-3 rounded-xl border", opt?.is_best ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
              <p className="font-semibold text-foreground/80">{d.prompt}</p>
              <p className="text-muted-foreground mt-0.5">→ {opt?.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Decision {decIdx + 1} of {act.decisions.length}</span>
        {dec?.hint && (
          <button
            onClick={() => setShowHint(p => ({ ...p, [dec.id]: !p[dec.id] }))}
            className="flex items-center gap-1 text-amber-600 hover:text-amber-700"
          >
            <Lightbulb className="w-3 h-3" />
            {showHint[dec.id] ? "Hide hint" : "Need a hint?"}
          </button>
        )}
      </div>

      {showHint[dec?.id] && dec?.hint && (
        <div className="text-xs px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700">
          💡 {dec.hint}
        </div>
      )}

      <p className="text-sm font-bold leading-snug">{dec?.prompt}</p>

      <div className="space-y-2">
        {dec?.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleChoice(i)}
            disabled={chosen !== undefined}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.99]",
              chosen === i && opt.is_best && "border-emerald-500 bg-emerald-500/10 text-emerald-700",
              chosen === i && !opt.is_best && "border-amber-500 bg-amber-500/10 text-amber-700",
              chosen !== undefined && chosen !== i && "opacity-25 border-border cursor-not-allowed",
              chosen === undefined && "border-border/60 hover:border-primary/40 hover:bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-6 h-6 rounded-lg text-xs font-black shrink-0 flex items-center justify-center",
                chosen === i ? (opt.is_best ? "bg-emerald-500 text-white" : "bg-amber-500 text-white") : "bg-muted text-muted-foreground"
              )}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt.text}
            </div>
          </button>
        ))}
      </div>

      {chosenOpt && (
        <div className={cn(
          "text-xs p-3 rounded-xl border animate-fade-in leading-relaxed",
          chosenOpt.is_best ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-amber-500/30 bg-amber-500/5 text-amber-700"
        )}>
          {chosenOpt.consequence}
        </div>
      )}
    </div>
  );
}

// ── Build Order ───────────────────────────────────────────────────────────────

function BuildOrder({ act, onComplete }: { act: BuildOrderAct; onComplete: (e: Record<string, number>) => void }) {
  const parTime = act.par_time ?? 90;
  const [timeLeft, setTimeLeft] = useState(parTime);
  const [timerActive, setTimerActive] = useState(true);
  const [placed, setPlaced] = useState<string[]>([]);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone] = useState(false);

  const shuffled = useMemo(() => [...act.steps].sort(() => Math.random() - 0.5), [act]);

  useEffect(() => {
    if (!timerActive || done) return;
    const t = setInterval(() => {
      setTimeLeft(s => {
        if (s <= 1) { clearInterval(t); setTimerActive(false); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerActive, done]);

  const handleStep = (stepId: string) => {
    if (done || placed.includes(stepId) || !timerActive) return;
    const step = act.steps.find(s => s.id === stepId)!;
    const nextPos = placed.length + 1;

    if (step.position === nextPos) {
      setFlash("correct");
      setTimeout(() => setFlash(null), 600);
      const next = [...placed, stepId];
      setPlaced(next);
      if (next.length === act.steps.length) {
        setDone(true);
        setTimerActive(false);
        onComplete(act.metric_effects);
      }
    } else {
      setFlash("wrong");
      setTimeout(() => setFlash(null), 600);
    }
  };

  const remaining = shuffled.filter(s => !placed.includes(s.id));
  const timerPct = (timeLeft / parTime) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={cn("w-4 h-4", timeLeft < 15 ? "text-red-500" : "text-amber-500")} />
          <span className={cn("text-sm font-black tabular-nums", timeLeft < 15 && "text-red-500")}>{timeLeft}s</span>
        </div>
        <span className="text-xs text-muted-foreground">{placed.length}/{act.steps.length} placed</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-1000", timerPct > 40 ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Placed */}
      <div className="space-y-1.5">
        {placed.map((sid, i) => {
          const step = act.steps.find(s => s.id === sid)!;
          return (
            <div key={sid} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/25 text-sm">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
              {step.text}
            </div>
          );
        })}
        {!done && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed transition-all",
            flash === "correct" && "border-emerald-500 bg-emerald-500/5",
            flash === "wrong" && "border-red-500 bg-red-500/5",
            !flash && "border-border/40"
          )}>
            <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">{placed.length + 1}</span>
            <span className="text-xs text-muted-foreground">
              {flash === "wrong" ? "❌ Wrong step — try again" : "Click the next correct step below"}
            </span>
          </div>
        )}
      </div>

      {/* Pool */}
      {!done && remaining.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available steps</p>
          {remaining.map(step => (
            <button
              key={step.id}
              onClick={() => handleStep(step.id)}
              disabled={!timerActive}
              className="w-full text-left text-sm px-3 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.99] disabled:opacity-40"
            >
              {step.text}
            </button>
          ))}
        </div>
      )}

      {done && (
        <div className="text-center py-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
          <p className="font-bold text-sm">{timeLeft > 0 ? `Done with ${timeLeft}s to spare!` : "Complete!"}</p>
        </div>
      )}
    </div>
  );
}

// ── Match Chain ───────────────────────────────────────────────────────────────

function MatchChain({ act, onComplete }: { act: MatchChainAct; onComplete: (e: Record<string, number>) => void }) {
  const [selLeft, setSelLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const shuffledRight = useMemo(() => [...act.pairs.map(p => p.right)].sort(() => Math.random() - 0.5), [act]);
  const matchedRights = new Set(Object.values(matches));

  const handleLeft = (left: string) => {
    if (done || matches[left]) return;
    setSelLeft(l => l === left ? null : left);
  };

  const handleRight = (right: string) => {
    if (done || !selLeft || matchedRights.has(right)) return;
    const pair = act.pairs.find(p => p.left === selLeft);
    if (pair?.right === right) {
      const next = { ...matches, [selLeft]: right };
      setMatches(next);
      setSelLeft(null);
      if (Object.keys(next).length === act.pairs.length) {
        setDone(true);
        onComplete(act.metric_effects);
      }
    } else {
      setWrongFlash(right);
      setTimeout(() => setWrongFlash(null), 600);
      setSelLeft(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Click a term, then its matching definition.</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Terms</p>
          {act.pairs.map(p => {
            const matched = !!matches[p.left];
            return (
              <button
                key={p.left}
                onClick={() => handleLeft(p.left)}
                disabled={matched || done}
                className={cn(
                  "w-full text-left text-xs px-3 py-2.5 rounded-xl border font-medium transition-all",
                  matched && "border-emerald-500/40 bg-emerald-500/8 text-emerald-700 opacity-60",
                  selLeft === p.left && !matched && "border-primary bg-primary/10 ring-2 ring-primary/20",
                  !matched && selLeft !== p.left && "border-border/60 hover:border-primary/30 hover:bg-primary/5"
                )}
              >
                {p.left}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Definitions</p>
          {shuffledRight.map(right => {
            const matched = matchedRights.has(right);
            return (
              <button
                key={right}
                onClick={() => handleRight(right)}
                disabled={matched || done}
                className={cn(
                  "w-full text-left text-xs px-3 py-2.5 rounded-xl border font-medium transition-all",
                  matched && "border-emerald-500/40 bg-emerald-500/8 text-emerald-700 opacity-60",
                  wrongFlash === right && "border-red-500 bg-red-500/10 text-red-700",
                  !matched && wrongFlash !== right && selLeft && "border-primary/40 hover:border-primary hover:bg-primary/5",
                  !matched && !selLeft && "border-border/60 opacity-50 cursor-not-allowed"
                )}
              >
                {right}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-center text-muted-foreground">{Object.keys(matches).length}/{act.pairs.length} matched</p>
      {done && (
        <div className="text-center py-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
          <p className="font-bold text-sm">All pairs matched!</p>
        </div>
      )}
    </div>
  );
}

// ── Fill Lab ──────────────────────────────────────────────────────────────────

function FillLab({ act, onComplete }: { act: FillLabAct; onComplete: (e: Record<string, number>) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const parts = useMemo(() => act.template.split(/(\[BLANK_\d+\])/g), [act]);
  const allAnswered = act.blanks.every(b => answers[b.id]);

  const handleSubmit = () => {
    setSubmitted(true);
    onComplete(act.metric_effects);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm leading-relaxed bg-muted/20 rounded-xl p-4 border border-border/40">
        {parts.map((part, i) => {
          const match = part.match(/\[BLANK_(\d+)\]/);
          if (match) {
            const blankNum = parseInt(match[1]);
            const blank = act.blanks[blankNum - 1];
            if (!blank) return <span key={i}>{part}</span>;
            const answer = answers[blank.id];
            const correct = submitted ? answer === blank.correct : null;
            return (
              <select
                key={i}
                value={answer || ""}
                onChange={e => { if (!submitted) setAnswers(p => ({ ...p, [blank.id]: e.target.value })); }}
                disabled={submitted}
                className={cn(
                  "inline-block mx-1 px-2 py-0.5 rounded-lg border text-sm font-semibold bg-background cursor-pointer",
                  submitted && correct && "border-emerald-500 bg-emerald-500/10 text-emerald-700",
                  submitted && correct === false && "border-red-500 bg-red-500/10 text-red-700",
                  !submitted && "border-primary/50 bg-primary/5"
                )}
              >
                <option value="">pick...</option>
                {blank.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>

      {submitted && (
        <div className="space-y-1.5">
          {act.blanks.map(blank => {
            const isCorrect = answers[blank.id] === blank.correct;
            return (
              <div key={blank.id} className={cn("text-xs p-2.5 rounded-xl border", isCorrect ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-700" : "border-red-500/25 bg-red-500/5 text-red-700")}>
                <span className="font-bold">{isCorrect ? "✓ " : "✗ "}</span>
                {isCorrect ? "Correct!" : `Answer: ${blank.correct}`}
                {blank.explanation && <span className="text-muted-foreground ml-1.5">— {blank.explanation}</span>}
              </div>
            );
          })}
        </div>
      )}

      {!submitted && (
        <Button onClick={handleSubmit} disabled={!allAnswered} className="w-full">
          Check Answers <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ── Main CohesiveLab ──────────────────────────────────────────────────────────

export default function CohesiveLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const initMetrics = useMemo(
    () => Object.fromEntries((data.metrics || []).map(m => [m.id, m.value])),
    [data]
  );

  const [metrics, setMetrics] = useState<Record<string, number>>(initMetrics);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [completionFired, setCompletionFired] = useState(false);

  const activities = data.activities || [];
  const allComplete = activities.length > 0 && activities.every(a => completed.has(a.id));

  useEffect(() => {
    if (allComplete && !completionFired) {
      onComplete?.();
      setCompletionFired(true);
    }
  }, [allComplete, completionFired, onComplete]);

  const handleActivityComplete = useCallback((actId: string, effects: Record<string, number>) => {
    setMetrics(prev => {
      const next = { ...prev };
      for (const [id, delta] of Object.entries(effects)) {
        const metric = data.metrics.find(m => m.id === id);
        if (metric) next[id] = Math.max(0, Math.min(metric.max, (next[id] ?? metric.value) + delta));
      }
      return next;
    });
    setCompleted(prev => {
      const next = new Set(prev);
      next.add(actId);
      return next;
    });
    const actIdx = activities.findIndex(a => a.id === actId);
    if (actIdx + 1 < activities.length) {
      const nextId = activities[actIdx + 1].id;
      setUnlocking(nextId);
      setTimeout(() => setUnlocking(null), 1500);
    }
  }, [activities, data.metrics]);

  const score = useMemo(() => {
    const totalMax = (data.metrics || []).reduce((s, m) => s + m.max, 0);
    const totalNow = (data.metrics || []).reduce((s, m) => s + (metrics[m.id] ?? m.value), 0);
    return totalMax > 0 ? Math.round((totalNow / totalMax) * 100) : 0;
  }, [metrics, data.metrics]);

  const verdict = allComplete
    ? (data.verdict_tiers || []).slice().sort((a, b) => b.threshold - a.threshold).find(t => score >= t.threshold)
    : null;

  const gradeColors: Record<string, string> = {
    S: "text-purple-600",
    A: "text-emerald-600",
    B: "text-blue-600",
    C: "text-amber-600",
    D: "text-red-600",
  };

  const reset = () => {
    setMetrics(initMetrics);
    setCompleted(new Set());
    setCompletionFired(false);
    onReplay?.();
  };

  return (
    <div className="space-y-5">

      {/* ── Sticky metrics header ─────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm rounded-2xl border border-border/60 p-4 shadow-sm">
        <div className={cn("grid gap-4", (data.metrics || []).length <= 3 ? "grid-cols-3" : "grid-cols-4")}>
          {(data.metrics || []).map(m => {
            const current = metrics[m.id] ?? m.value;
            const pct = (current / m.max) * 100;
            return (
              <div key={m.id} className="text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {m.icon} {m.label}
                </p>
                <p className="text-xl font-black tabular-nums leading-none">{current}</p>
                <div className="h-1 bg-secondary rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
          <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${activities.length > 0 ? (completed.size / activities.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium shrink-0">
            {completed.size}/{activities.length} complete
          </span>
        </div>
      </div>

      {/* ── Narrative intro ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-primary/3 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-black text-primary uppercase tracking-widest">Your Mission</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/85">{data.narrative}</p>
      </div>

      {/* ── Activity cards ────────────────────────────────────────── */}
      {activities.map((act, idx) => {
        const isDone = completed.has(act.id);
        const isLocked = idx > 0 && !completed.has(activities[idx - 1].id);
        const isUnlocking = unlocking === act.id;

        const typeLabel: Record<string, string> = {
          classify_sort: "🗂️ Sort & Classify",
          branch_chain: "🔀 Decision Chain",
          build_order: "⏱️ Build in Order",
          match_chain: "🔗 Match Pairs",
          fill_lab: "✍️ Fill in the Blanks",
        };

        return (
          <div
            key={act.id}
            className={cn(
              "rounded-2xl border overflow-hidden transition-all duration-300",
              isUnlocking && "border-emerald-500 shadow-[0_0_24px_hsl(142deg_72%_29%/0.25)]",
              isDone && !isUnlocking && "border-emerald-500/30",
              isLocked && "border-border/30 opacity-55",
              !isDone && !isLocked && !isUnlocking && "border-border/60"
            )}
          >
            {/* Card header */}
            <div className={cn(
              "px-5 py-3 flex items-center justify-between border-b",
              isDone ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/30 border-border/40"
            )}>
              <div className="flex items-center gap-2.5">
                <span className={cn(
                  "w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0",
                  isDone ? "bg-emerald-500 text-white" : isLocked ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                )}>
                  {isDone ? "✓" : idx + 1}
                </span>
                <div>
                  <p className="text-sm font-bold leading-tight">{act.title}</p>
                  <p className="text-[10px] text-muted-foreground">{typeLabel[act.type] || act.type}</p>
                </div>
                {isUnlocking && (
                  <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[10px] animate-pulse ml-1">
                    ✨ Unlocked!
                  </Badge>
                )}
              </div>
              {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : isLocked ? <Lock className="w-4 h-4 text-muted-foreground/50 shrink-0" /> : null}
            </div>

            {/* Card body */}
            <div className="p-5 bg-card">
              {isLocked ? (
                <div className="text-center py-8 space-y-2">
                  <Lock className="w-8 h-8 text-muted-foreground/25 mx-auto" />
                  <p className="text-sm text-muted-foreground">Complete the previous activity to unlock</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {act.context && (
                    <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-primary/20 pl-3">
                      {act.context}
                    </p>
                  )}
                  {!isDone && (
                    <div className="pt-1">
                      {act.type === "classify_sort" && (
                        <ClassifySort act={act} onComplete={e => handleActivityComplete(act.id, e)} />
                      )}
                      {act.type === "branch_chain" && (
                        <BranchChain act={act} onComplete={e => handleActivityComplete(act.id, e)} />
                      )}
                      {act.type === "build_order" && (
                        <BuildOrder act={act} onComplete={e => handleActivityComplete(act.id, e)} />
                      )}
                      {act.type === "match_chain" && (
                        <MatchChain act={act} onComplete={e => handleActivityComplete(act.id, e)} />
                      )}
                      {act.type === "fill_lab" && (
                        <FillLab act={act} onComplete={e => handleActivityComplete(act.id, e)} />
                      )}
                    </div>
                  )}
                  {isDone && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Activity complete
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Final verdict ─────────────────────────────────────────── */}
      {allComplete && verdict && (
        <div className="rounded-2xl border-2 border-primary/30 overflow-hidden shadow-lg">
          <div className="bg-gradient-to-br from-primary/15 via-purple-500/10 to-primary/5 px-6 py-7 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <div className={cn("text-5xl font-black mb-2", gradeColors[verdict.grade] || "text-primary")}>
              {verdict.grade}
            </div>
            <h3 className="text-xl font-black mb-2">{verdict.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">{verdict.description}</p>
          </div>
          <div className="bg-card px-6 py-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(data.metrics || []).map(m => (
                <div key={m.id} className="text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">{m.icon} {m.label}</p>
                  <p className="text-lg font-black tabular-nums">{metrics[m.id] ?? m.value}</p>
                  <p className="text-[10px] text-muted-foreground">/ {m.max}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={reset} className="w-full gap-2">
              <RotateCcw className="w-4 h-4" /> Replay
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
