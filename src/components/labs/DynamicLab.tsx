import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  CheckCircle2, ChevronRight, ChevronLeft, RotateCcw, Lightbulb,
  MessageCircleQuestion, TrendingUp, TrendingDown, Minus, ImageIcon,
  Zap, Activity, Target, Shuffle, AlertTriangle, Trophy, Star, Flame
} from "lucide-react";
import LabIntro from "./LabIntro";
import DiagramBlock from "./DiagramBlock";
import type { DiagramData } from "./DiagramBlock";
import type { LabIntroData } from "./LabIntro";
import { useLabSimulation } from "@/hooks/useLabSimulation";
import { evaluateFormula, checkAnswer } from "@/lib/labSimulationEngine";
import { cn } from "@/lib/utils";

/** Convert snake_case/camelCase variable names to readable labels */
function formatVarName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Ensure icon is a single emoji, not a text string like "price_tag" */
function sanitizeIcon(icon: string | undefined): string {
  if (!icon) return "📊";
  const trimmed = icon.trim();
  if (trimmed.length <= 2) return trimmed;
  const emojiMatch = trimmed.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
  if (emojiMatch) return emojiMatch[0];
  return "📊";
}

/** Interpolate ${variable_name} and {variable_name} references with current values */
function interpolateVars(text: string, vals: Record<string, number>): string {
  if (!text) return text;
  return text
    .replace(/\$\{(\w+)\}/g, (_, key) => vals[key] !== undefined ? String(vals[key]) : key)
    .replace(/\{(\w+)\}/g, (_, key) => vals[key] !== undefined ? String(vals[key]) : `{${key}}`);
}

type Variable = {
  name: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  description?: string;
};

type Choice = {
  text: string;
  feedback?: string;
  effects?: Record<string, number>;
  is_best?: boolean;
};

type Block =
  | { type: "text"; content: string }
  | { type: "choice_set"; question: string; emoji?: string; choices: Choice[] }
  | { type: "slider"; variable: string; prompt?: string; interactive?: boolean }
  | { type: "control_panel"; variables: string[]; prompt?: string }
  | { type: "table"; title?: string; headers: string[]; rows: string[][] }
  | { type: "step_task"; tasks: TaskItem[] }
  | { type: "chart"; chart_type?: string; title?: string; x_label?: string; y_label?: string; datasets?: any[] }
  | { type: "insight"; content: string }
  | { type: "image"; image_prompt?: string; image_caption?: string; image_url?: string; diagram_type?: string }
  | { type: "diagram"; diagram_type?: string; diagram_nodes?: any[]; diagram_edges?: any[]; diagram_caption?: string; image_prompt?: string; image_caption?: string; image_url?: string }
  | { type: "output_display"; outputs: string[]; prompt?: string };

type TaskItem = {
  id: string;
  prompt: string;
  type: "input" | "choice";
  correct_answer?: string;
  options?: string[];
  hint?: string;
  explanation?: string;
};

type LabBlueprint = {
  title?: string;
  kind?: string;
  scenario?: string;
  learning_goal?: string;
  variables?: Variable[];
  blocks?: Block[];
  completion_rule?: string;
  intro?: LabIntroData;
  repend_intro?: LabIntroData;
  key_insight?: string;
  goal?: { description: string; condition?: string };
  random_events?: Array<{ probability: number; effects: Record<string, string | number>; message: string }>;
  rules?: any[];
  formulas?: Record<string, string>;
};

type Props = {
  data: LabBlueprint;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

function getParamLevel(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  if (pct >= 75) return { color: "text-emerald-500", trackColor: "bg-emerald-500", icon: TrendingUp, label: "High", zone: "high" };
  if (pct >= 35) return { color: "text-amber-500", trackColor: "bg-amber-500", icon: Minus, label: "Mid", zone: "mid" };
  return { color: "text-red-500", trackColor: "bg-red-500", icon: TrendingDown, label: "Low", zone: "low" };
}

const BLOCK_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  text: { label: "Context", emoji: "📖", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  choice_set: { label: "Decision", emoji: "🔮", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  slider: { label: "Adjust", emoji: "🎚️", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  control_panel: { label: "Control", emoji: "🎛️", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  table: { label: "Data", emoji: "📊", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  step_task: { label: "Challenge", emoji: "📋", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  chart: { label: "Chart", emoji: "📈", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20" },
  insight: { label: "Key Insight", emoji: "💡", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  image: { label: "Visual", emoji: "🖼️", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  diagram: { label: "Diagram", emoji: "📐", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" },
  output_display: { label: "Live Output", emoji: "📡", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
};

// ── Variable Metric Card ──────────────────────────────────────────────────────
function VariableCard({ v, value, isAnimating }: { v: Variable; value: number; isAnimating: boolean }) {
  const pct = Math.round(((value - v.min) / (v.max - v.min)) * 100);
  const { color, trackColor, icon: Icon, zone } = getParamLevel(value, v.min, v.max);
  return (
    <div className={cn(
      "rounded-2xl border bg-card px-4 py-3 space-y-2 transition-all duration-300",
      isAnimating
        ? "border-primary/60 shadow-[0_0_20px_hsl(var(--primary)/0.2)] scale-[1.03]"
        : zone === "high" ? "border-emerald-500/20" : zone === "low" ? "border-red-500/20" : "border-border/60"
    )}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-muted-foreground leading-tight">
          {sanitizeIcon(v.icon)} {formatVarName(v.name)}
        </span>
        <div className={cn("flex items-center gap-1", color)}>
          <Icon className="w-3 h-3" />
          <span className="text-xs font-semibold">{pct}%</span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className={cn("text-2xl font-black tabular-nums leading-none", color)}>{value}</span>
        <span className="text-xs text-muted-foreground mb-0.5">{v.unit}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", trackColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DynamicLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const variables = useMemo(() => data?.variables ?? [], [data]);
  const blocks = useMemo(() => (data?.blocks ?? []).filter((b: any) => b.type !== "step_task"), [data]);
  const introData = data?.intro || data?.repend_intro;

  const sim = useLabSimulation(data);

  const [showIntro, setShowIntro] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, number>>({});
  const [choiceAnswers, setChoiceAnswers] = useState<Record<number, number>>({});
  const [taskAnswers, setTaskAnswers] = useState<Record<string, string>>({});
  const [taskSubmitted, setTaskSubmitted] = useState<Record<string, boolean>>({});
  const [completionFired, setCompletionFired] = useState(false);
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [animatingVars, setAnimatingVars] = useState<Set<string>>(new Set());
  const [eventLog, setEventLog] = useState<string[]>([]);

  const totalSteps = blocks.length;

  useEffect(() => {
    if (sim.isSimulation && Object.keys(sim.variables).length > 0) {
      setValues(sim.variables);
    }
  }, [sim.isSimulation, sim.variables]);

  useEffect(() => {
    if (sim.lastFeedback) {
      setEventLog(prev => [...prev.slice(-9), sim.lastFeedback!]);
    }
  }, [sim.lastFeedback]);

  useEffect(() => {
    const initial = Object.fromEntries(variables.map(v => [v.name, v.default ?? 50]));
    setValues(initial);
    setChoiceAnswers({});
    setTaskAnswers({});
    setTaskSubmitted({});
    setCompletionFired(false);
    setShowIntro(true);
    setCurrentStep(0);
    setShowHint({});
    setEventLog([]);
  }, [data]);

  const isStepCompleted = useCallback((idx: number): boolean => {
    const block = blocks[idx];
    if (!block) return false;
    switch (block.type) {
      case "choice_set": return choiceAnswers[idx] !== undefined;
      case "step_task": {
        const tasks: TaskItem[] = (block as any).tasks || [];
        return tasks.length > 0 && tasks.every(t => taskSubmitted[t.id]);
      }
      default: return true;
    }
  }, [blocks, choiceAnswers, taskSubmitted]);

  const canAdvance = isStepCompleted(currentStep);
  const allDone = useMemo(() => blocks.every((_, i) => isStepCompleted(i)), [blocks, isStepCompleted]);

  useEffect(() => {
    if (allDone && currentStep === totalSteps - 1 && !completionFired && onComplete) {
      onComplete();
      setCompletionFired(true);
    }
  }, [allDone, currentStep, totalSteps, completionFired, onComplete]);

  const animateValues = useCallback((targetValues: Record<string, number>) => {
    const varNames = Object.keys(targetValues);
    setAnimatingVars(new Set(varNames));
    setValues(prev => {
      const startValues = { ...prev };
      const duration = 600;
      const startTime = performance.now();
      const tick = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const interpolated: Record<string, number> = { ...startValues };
        for (const name of varNames) {
          const start = startValues[name] ?? 50;
          const end = targetValues[name];
          interpolated[name] = Math.round(start + (end - start) * eased);
        }
        setValues(interpolated);
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setAnimatingVars(new Set());
        }
      };
      requestAnimationFrame(tick);
      return startValues;
    });
  }, []);

  const handleChoice = useCallback((blockIdx: number, choiceIdx: number) => {
    if (choiceAnswers[blockIdx] !== undefined) return;
    const block = blocks[blockIdx] as any;
    const choice = block?.choices?.[choiceIdx];
    if (!choice) return;
    if (sim.isSimulation) {
      const choiceSetIndex = blocks.slice(0, blockIdx + 1).filter(b => b.type === "choice_set").length - 1;
      sim.sendEvent(`CHOOSE_${choiceSetIndex}_${choiceIdx}`);
    } else if (choice.effects && typeof choice.effects === "object") {
      const targets: Record<string, number> = {};
      for (const v of variables) {
        if (typeof choice.effects[v.name] === "number") {
          targets[v.name] = Math.max(v.min, Math.min(v.max, choice.effects[v.name]));
        }
      }
      if (Object.keys(targets).length > 0) animateValues(targets);
    }
    setChoiceAnswers(prev => ({ ...prev, [blockIdx]: choiceIdx }));
  }, [choiceAnswers, blocks, variables, sim, animateValues]);

  const handleSliderChange = useCallback((varName: string, newValue: number) => {
    if (sim.isSimulation) {
      sim.updateVariable(varName, newValue);
    } else {
      setValues(prev => ({ ...prev, [varName]: newValue }));
    }
  }, [sim]);

  const submitTask = useCallback((taskId: string) => {
    setTaskSubmitted(prev => ({ ...prev, [taskId]: true }));
  }, []);

  const reset = () => {
    if (sim.isSimulation) sim.reset();
    const initial = Object.fromEntries(variables.map(v => {
      const jitter = 1 + (Math.random() * 0.4 - 0.2);
      const jittered = Math.round(Math.max(v.min, Math.min(v.max, (v.default ?? 50) * jitter)));
      return [v.name, jittered];
    }));
    setValues(initial);
    setChoiceAnswers({});
    setTaskAnswers({});
    setTaskSubmitted({});
    setCompletionFired(false);
    setShowIntro(true);
    setCurrentStep(0);
    setShowHint({});
    setEventLog([]);
    onReplay?.();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && canAdvance && currentStep < totalSteps - 1) setCurrentStep(s => s + 1);
      if (e.key === "ArrowLeft" && currentStep > 0) setCurrentStep(s => s - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canAdvance, currentStep, totalSteps]);

  // ── Already completed ────────────────────────────────────────────────────
  if (isCompleted && !allDone) {
    return (
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="font-bold text-lg">Lab Complete</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">You've already completed this lab. Replay to explore different outcomes.</p>
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Replay Lab
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Intro screen ─────────────────────────────────────────────────────────
  if (showIntro && introData) {
    return <LabIntro title={data.title || "Interactive Lab"} intro={introData} labType={data.kind || "dynamic"} onStart={() => { setShowIntro(false); if (sim.isSimulation) sim.sendEvent("START"); }} />;
  }

  if (showIntro && !introData) {
    return (
      <div className="rounded-2xl overflow-hidden border border-primary/20 shadow-lg">
        {/* Gradient hero header */}
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-500/10 px-6 pt-6 pb-5 border-b border-primary/15">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-xl">
              🧪
            </div>
            <div>
              <h3 className="font-black text-xl leading-tight">{data.title || "Interactive Lab"}</h3>
              {data.kind && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Activity className="w-3 h-3 text-primary" />
                  <span className="text-xs text-primary/80 font-medium capitalize">{data.kind.replace(/_/g, " ")} Simulation</span>
                </div>
              )}
            </div>
          </div>
          {data.scenario && (
            <p className="text-sm leading-relaxed text-foreground/80">{data.scenario}</p>
          )}
        </div>

        <div className="p-6 space-y-4 bg-card">
          {/* Objective banner */}
          {(data.goal?.description || data.learning_goal) && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Your Objective</p>
                <p className="text-sm text-foreground/80 leading-snug">{data.goal?.description || data.learning_goal}</p>
              </div>
            </div>
          )}

          {/* Variable preview */}
          {variables.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">System Variables You'll Control</p>
              <div className="grid grid-cols-2 gap-2">
                {variables.map(v => (
                  <div key={v.name} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                    <span className="text-xl leading-none">{sanitizeIcon(v.icon)}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{formatVarName(v.name)}</p>
                      <p className="text-[10px] text-muted-foreground">{v.min} – {v.max} {v.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Shuffle className="w-3 h-3" />
              <span>Randomized each run</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary" />
              <span>{totalSteps} steps</span>
            </div>
          </div>

          <Button
            onClick={() => { setShowIntro(false); if (sim.isSimulation) sim.sendEvent("START"); }}
            className="w-full h-12 text-base font-bold gap-2"
            size="lg"
          >
            Begin Simulation <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  if (totalSteps === 0) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No lab blocks available.</CardContent></Card>;
  }

  // ── Completion screen ────────────────────────────────────────────────────
  if (allDone && currentStep >= totalSteps) {
    const finalVarsWithData = variables.map(v => {
      const value = values[v.name] ?? v.default;
      const pct = ((value - v.min) / (v.max - v.min)) * 100;
      const { color, trackColor } = getParamLevel(value, v.min, v.max);
      return { v, value, pct, color, trackColor };
    });

    return (
      <div className="rounded-2xl overflow-hidden border border-emerald-500/30 shadow-lg">
        {/* Celebration header */}
        <div className="bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-primary/10 px-6 py-6 text-center border-b border-emerald-500/20">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="font-black text-2xl mb-1">Simulation Complete!</h3>
          {sim.goalReached && (
            <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 px-3 py-1 text-sm gap-1">
              <Star className="w-3.5 h-3.5 fill-current" /> Objective Achieved
            </Badge>
          )}
        </div>

        <div className="p-6 space-y-5 bg-card">
          {/* Key insight */}
          {data.key_insight && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Key Takeaway</p>
                <p className="text-sm leading-relaxed text-foreground/80">{data.key_insight}</p>
              </div>
            </div>
          )}

          {/* Derived values */}
          {Object.keys(sim.derivedValues).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Computed Outputs</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(sim.derivedValues).map(([key, val]) => (
                  <div key={key} className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{formatVarName(key)}</p>
                    <p className="text-xl font-black tabular-nums">{typeof val === "number" ? val.toFixed(1) : val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final variable states */}
          {finalVarsWithData.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Final State</p>
              <div className="grid grid-cols-2 gap-2">
                {finalVarsWithData.map(({ v, value, pct, color, trackColor }) => (
                  <div key={v.name} className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">{sanitizeIcon(v.icon)} {formatVarName(v.name)}</span>
                      <span className={cn("text-sm font-black tabular-nums", color)}>{value}{v.unit}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", trackColor)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event log */}
          {eventLog.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">System Events</p>
              <div className="max-h-28 overflow-y-auto space-y-1 p-3 rounded-xl bg-muted/30 border border-border/40">
                {eventLog.map((msg, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Zap className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    {msg}
                  </p>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" onClick={reset} className="w-full gap-2">
            <RotateCcw className="w-4 h-4" /> Replay (New Randomization)
          </Button>
        </div>
      </div>
    );
  }

  const block = blocks[currentStep];
  if (!block) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No lab content available for this step.</p>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reset Lab
          </Button>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = totalSteps > 1 ? ((currentStep + 1) / totalSteps) * 100 : 100;
  const meta = BLOCK_LABELS[block.type] || { label: block.type, emoji: "📄", color: "bg-muted text-muted-foreground border-border" };

  return (
    <div className="space-y-4">
      {/* ── Progress header ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground">
              Step {currentStep + 1} / {totalSteps}
            </span>
            <Badge variant="outline" className={cn("text-[10px] font-semibold", meta.color)}>
              {meta.emoji} {meta.label}
            </Badge>
            {sim.isSimulation && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
                <Activity className="w-2.5 h-2.5" /> Live
              </Badge>
            )}
          </div>
          <span className="text-xs font-bold text-primary tabular-nums">{Math.round(progressPercent)}%</span>
        </div>

        {/* Segmented progress dots */}
        <div className="flex items-center gap-1">
          {blocks.map((b, i) => (
            <button
              key={i}
              onClick={() => { if (i <= currentStep || isStepCompleted(i)) setCurrentStep(i); }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 flex-1",
                i === currentStep ? "bg-primary" :
                isStepCompleted(i) ? "bg-primary/30" : "bg-muted-foreground/15"
              )}
              title={`Step ${i + 1}: ${BLOCK_LABELS[b.type]?.label || b.type}`}
            />
          ))}
        </div>
      </div>

      {/* ── Objective tracker ───────────────────────────────────────── */}
      {data.goal?.description && (
        <div className={cn(
          "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm transition-all",
          sim.goalReached
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/8 border-amber-500/20 text-amber-700 dark:text-amber-300"
        )}>
          {sim.goalReached
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <Target className="w-4 h-4 shrink-0" />}
          <span className="text-xs font-bold uppercase tracking-wide mr-1">Goal:</span>
          <span className="text-xs truncate">{data.goal.description}</span>
        </div>
      )}

      {/* ── Variable dashboard ──────────────────────────────────────── */}
      {variables.length > 0 && (
        <div className={cn(
          "grid gap-2",
          variables.length <= 2 ? "grid-cols-2" : variables.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"
        )}>
          {variables.map(v => (
            <VariableCard
              key={v.name}
              v={v}
              value={values[v.name] ?? v.default}
              isAnimating={animatingVars.has(v.name)}
            />
          ))}
        </div>
      )}

      {/* ── Simulation feedback ─────────────────────────────────────── */}
      {sim.isSimulation && sim.lastFeedback && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/8 border border-primary/20 animate-fade-in">
          <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span className="text-sm text-foreground/80">{sim.lastFeedback}</span>
        </div>
      )}

      {/* ── Derived values bar ──────────────────────────────────────── */}
      {sim.isSimulation && Object.keys(sim.derivedValues).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(sim.derivedValues).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{formatVarName(key)}</span>
              <span className="text-sm font-black tabular-nums text-primary">{typeof val === "number" ? val.toFixed(1) : val}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Block card ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
        {/* Block type header strip */}
        <div className={cn("px-5 py-3 border-b border-border/40 flex items-center justify-between", meta.color.includes("blue") ? "bg-blue-500/5" : meta.color.includes("purple") ? "bg-purple-500/5" : meta.color.includes("cyan") ? "bg-cyan-500/5" : meta.color.includes("amber") ? "bg-amber-500/5" : meta.color.includes("emerald") ? "bg-emerald-500/5" : "bg-muted/30")}>
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{meta.emoji}</span>
            <span className="text-sm font-bold">{meta.label}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {block.type === "control_panel" && "Drag sliders to adjust"}
            {block.type === "choice_set" && "Select one option"}
            {block.type === "output_display" && "Values update live"}
            {block.type === "text" && "Read to continue"}
          </span>
        </div>

        <div className="p-6 min-h-[260px]">
          <div key={currentStep} className="animate-fade-in space-y-5">

            {/* ── TEXT ── */}
            {block.type === "text" && (
              <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">{(block as any).content}</p>
            )}

            {/* ── CHOICE SET ── */}
            {block.type === "choice_set" && (() => {
              const isAnswered = choiceAnswers[currentStep] !== undefined;
              const choiceBlock = block as any;
              return (
                <div className="space-y-4">
                  <p className="text-base font-bold leading-snug">
                    <span className="mr-2">{choiceBlock.emoji || "🔮"}</span>
                    {interpolateVars(choiceBlock.question, values)}
                  </p>
                  <div className="space-y-2">
                    {choiceBlock.choices.map((c: Choice, i: number) => {
                      const isChosen = choiceAnswers[currentStep] === i;
                      const isBest = c.is_best && isAnswered;
                      return (
                        <div key={i} className="space-y-1.5">
                          <button
                            onClick={() => handleChoice(currentStep, i)}
                            disabled={isAnswered}
                            className={cn(
                              "w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all duration-200",
                              isChosen && isBest && "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                              isChosen && !isBest && "border-primary bg-primary/10 ring-2 ring-primary/20",
                              isAnswered && !isChosen && "opacity-25 border-border cursor-not-allowed",
                              !isAnswered && "border-border/60 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md active:scale-[0.99]"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black shrink-0",
                                isChosen && isBest ? "bg-emerald-500 text-white" :
                                isChosen ? "bg-primary text-primary-foreground" :
                                "bg-muted text-muted-foreground"
                              )}>
                                {isChosen && isBest ? "✓" : isChosen ? "→" : String.fromCharCode(65 + i)}
                              </span>
                              <span>{interpolateVars(c.text, values)}</span>
                            </div>
                          </button>
                          {isChosen && c.feedback && (
                            <div className={cn(
                              "ml-10 text-xs px-4 py-3 rounded-xl animate-fade-in border",
                              isBest
                                ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-muted/50 border-border/30 text-muted-foreground"
                            )}>
                              {interpolateVars(c.feedback, values)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── SLIDER (single variable) ── */}
            {block.type === "slider" && (() => {
              const sliderBlock = block as any;
              const v = variables.find(vr => vr.name === sliderBlock.variable);
              if (!v) return <p className="text-sm text-muted-foreground">Variable not found.</p>;
              const value = values[v.name] ?? v.default;
              const pct = ((value - v.min) / (v.max - v.min)) * 100;
              const { color, trackColor } = getParamLevel(value, v.min, v.max);
              return (
                <div className="space-y-5">
                  {sliderBlock.prompt && (
                    <p className="text-sm font-semibold text-foreground/90">{interpolateVars(sliderBlock.prompt, values)}</p>
                  )}
                  <div className="p-6 rounded-2xl border border-border/60 bg-gradient-to-br from-muted/20 to-muted/5 space-y-5">
                    {/* Big value display */}
                    <div className="text-center space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {sanitizeIcon(v.icon)} {formatVarName(v.name)}
                      </p>
                      <div className="flex items-end justify-center gap-1">
                        <span className={cn("text-5xl font-black tabular-nums leading-none transition-all duration-200", color)}>{value}</span>
                        <span className="text-lg text-muted-foreground font-medium mb-1">{v.unit}</span>
                      </div>
                      {/* Zone indicator */}
                      <div className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                        pct >= 75 ? "bg-emerald-500/15 text-emerald-600" :
                        pct >= 35 ? "bg-amber-500/15 text-amber-600" :
                        "bg-red-500/15 text-red-600"
                      )}>
                        {pct >= 75 ? "🟢 High" : pct >= 35 ? "🟡 Medium" : "🔴 Low"}
                      </div>
                    </div>
                    <Slider
                      value={[value]}
                      min={v.min}
                      max={v.max}
                      step={1}
                      onValueChange={(val) => handleSliderChange(v.name, val[0])}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>{v.min} {v.unit}</span>
                      <span>{v.max} {v.unit}</span>
                    </div>
                  </div>
                  {v.description && (
                    <p className="text-xs text-muted-foreground italic leading-relaxed">{v.description}</p>
                  )}
                </div>
              );
            })()}

            {/* ── CONTROL PANEL ── */}
            {block.type === "control_panel" && (() => {
              const cpBlock = block as any;
              const controlVars = (cpBlock.variables || [])
                .map((name: string) => variables.find(v => v.name === name))
                .filter(Boolean);
              const displayVars = controlVars.length > 0 ? controlVars : variables;
              return (
                <div className="space-y-4">
                  {cpBlock.prompt && (
                    <p className="text-base font-bold text-foreground">{cpBlock.prompt}</p>
                  )}
                  <div className="space-y-3">
                    {displayVars.map((v: Variable) => {
                      const value = values[v.name] ?? v.default;
                      const pct = ((value - v.min) / (v.max - v.min)) * 100;
                      const { color, trackColor } = getParamLevel(value, v.min, v.max);
                      return (
                        <div key={v.name} className="p-4 rounded-xl border border-border/60 bg-gradient-to-r from-muted/20 to-transparent space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">{sanitizeIcon(v.icon)} {formatVarName(v.name)}</span>
                            <div className="flex items-center gap-2">
                              {/* Mini zone pill */}
                              <span className={cn(
                                "text-xs font-bold px-2 py-0.5 rounded-full",
                                pct >= 75 ? "bg-emerald-500/15 text-emerald-600" :
                                pct >= 35 ? "bg-amber-500/15 text-amber-600" :
                                "bg-red-500/15 text-red-600"
                              )}>
                                {pct >= 75 ? "High" : pct >= 35 ? "Mid" : "Low"}
                              </span>
                              <span className={cn("text-lg font-black tabular-nums", color)}>{value}</span>
                              <span className="text-xs text-muted-foreground">{v.unit}</span>
                            </div>
                          </div>
                          {v.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{v.description}</p>
                          )}
                          <Slider
                            value={[value]}
                            min={v.min}
                            max={v.max}
                            step={1}
                            onValueChange={(val) => handleSliderChange(v.name, val[0])}
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{v.min}</span>
                            <span>{v.max}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── OUTPUT DISPLAY ── */}
            {block.type === "output_display" && (() => {
              const outBlock = block as any;
              const outputKeys = outBlock.outputs || Object.keys(sim.derivedValues);
              return (
                <div className="space-y-4">
                  {outBlock.prompt && <p className="text-base font-bold text-foreground">{outBlock.prompt}</p>}
                  <p className="text-xs text-muted-foreground">
                    These values update in real time as you adjust the controls above.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {outputKeys.map((key: string) => {
                      const val = sim.derivedValues[key];
                      const varVal = values[key];
                      const displayVal = val !== undefined ? val : varVal;
                      if (displayVal === undefined) return null;
                      const formula = data.formulas?.[key];
                      return (
                        <div key={key} className="p-5 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 to-primary/3 space-y-2">
                          <p className="text-[10px] text-primary/70 font-bold uppercase tracking-widest">{formatVarName(key)}</p>
                          <p className="text-3xl font-black tabular-nums text-primary">{typeof displayVal === "number" ? displayVal.toFixed(1) : displayVal}</p>
                          {formula && (
                            <p className="text-[10px] text-muted-foreground/60 font-mono">= {formula}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── TABLE ── */}
            {block.type === "table" && (() => {
              const tableBlock = block as any;
              return (
                <div className="space-y-3">
                  {tableBlock.title && <h4 className="text-sm font-bold">{tableBlock.title}</h4>}
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {tableBlock.headers?.map((h: string, i: number) => (
                            <th key={i} className="text-left py-2.5 px-4 font-bold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableBlock.rows?.map((row: string[], i: number) => (
                          <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                            {row.map((cell: string, j: number) => (
                              <td key={j} className="py-2.5 px-4 text-sm">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* ── STEP TASK ── */}
            {block.type === "step_task" && (() => {
              const tasks: TaskItem[] = (block as any).tasks || [];
              return (
                <div className="space-y-4">
                  {tasks.map((task, idx) => {
                    const submitted = taskSubmitted[task.id];
                    const userAnswer = taskAnswers[task.id] || "";
                    const correct = String(task.correct_answer || "").toLowerCase().trim();
                    const isCorrect = userAnswer.toLowerCase().trim() === correct;
                    return (
                      <div key={task.id} className="space-y-4 p-5 rounded-xl border border-border bg-card">
                        <div className="flex items-start gap-3">
                          <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-primary/10 text-primary text-xs font-black shrink-0 mt-0.5">{idx + 1}</span>
                          <p className="text-sm font-medium leading-relaxed">{interpolateVars(task.prompt, values)}</p>
                        </div>
                        {!submitted && task.hint && (
                          <div className="ml-10">
                            <button
                              onClick={() => setShowHint(prev => ({ ...prev, [task.id]: !prev[task.id] }))}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              <Lightbulb className="w-3 h-3" />
                              {showHint[task.id] ? "Hide hint" : "Show hint"}
                            </button>
                            {showHint[task.id] && (
                              <p className="text-xs text-muted-foreground mt-1.5 pl-4 border-l-2 border-primary/20 animate-fade-in">{interpolateVars(task.hint, values)}</p>
                            )}
                          </div>
                        )}
                        <div className="ml-10">
                          {task.type === "choice" && Array.isArray(task.options) ? (
                            <div className="space-y-2">
                              {task.options.map((opt, i) => {
                                const isSelected = taskAnswers[task.id] === opt;
                                const optCorrect = opt.toLowerCase().trim() === correct;
                                return (
                                  <button
                                    key={i}
                                    onClick={() => { if (!submitted) setTaskAnswers(prev => ({ ...prev, [task.id]: opt })); }}
                                    disabled={submitted}
                                    className={cn(
                                      "w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                                      submitted && isSelected && optCorrect && "border-emerald-500 bg-emerald-500/10 text-emerald-700",
                                      submitted && isSelected && !optCorrect && "border-red-500 bg-red-500/10 text-red-700",
                                      submitted && !isSelected && optCorrect && "border-emerald-500/40 bg-emerald-500/5",
                                      submitted && !isSelected && !optCorrect && "opacity-30 border-border",
                                      isSelected && !submitted && "border-primary bg-primary/10 ring-1 ring-primary/20",
                                      !isSelected && !submitted && "border-border/60 hover:border-primary/40 hover:bg-primary/5"
                                    )}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <Input
                              placeholder="Type your answer..."
                              value={taskAnswers[task.id] || ""}
                              onChange={(e) => { if (!submitted) setTaskAnswers(prev => ({ ...prev, [task.id]: e.target.value })); }}
                              disabled={submitted}
                              className={cn("text-sm", submitted && isCorrect ? "border-emerald-500 bg-emerald-500/5" : submitted ? "border-red-500 bg-red-500/5" : "")}
                            />
                          )}
                          {!submitted && userAnswer && (
                            <Button size="sm" onClick={() => submitTask(task.id)} className="w-full mt-3">
                              Submit Answer
                            </Button>
                          )}
                          {submitted && (
                            <div className={cn(
                              "mt-3 text-sm p-3.5 rounded-xl animate-fade-in border",
                              isCorrect ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                            )}>
                              {isCorrect ? (
                                <p className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Correct!
                                </p>
                              ) : (
                                <p className="text-red-600 dark:text-red-400">
                                  Incorrect — answer: <span className="font-bold">{interpolateVars(String(task.correct_answer), values)}</span>
                                </p>
                              )}
                              {task.explanation && (
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{interpolateVars(task.explanation, values)}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── CHART ── */}
            {block.type === "chart" && (() => {
              const chartBlock = block as any;
              return (
                <div className="space-y-3">
                  {chartBlock.title && <h4 className="text-sm font-bold">{chartBlock.title}</h4>}
                  <div className="h-52 bg-gradient-to-br from-muted/20 to-muted/5 rounded-2xl flex items-center justify-center border border-border/50 p-4">
                    <div className="text-center space-y-2 w-full">
                      {chartBlock.x_label && chartBlock.y_label && (
                        <p className="text-xs text-muted-foreground font-semibold">{chartBlock.x_label} vs {chartBlock.y_label}</p>
                      )}
                      {chartBlock.datasets?.[0]?.data && (
                        <div className="flex items-end gap-1.5 justify-center h-28 px-4">
                          {chartBlock.datasets[0].data.slice(0, 10).map((d: any, i: number) => {
                            const maxY = Math.max(...chartBlock.datasets[0].data.map((p: any) => p.y || 0));
                            const h = maxY > 0 ? ((d.y || 0) / maxY) * 100 : 50;
                            return (
                              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                                <div
                                  className="bg-primary/70 rounded-t w-full min-w-[12px] transition-all hover:bg-primary"
                                  style={{ height: `${Math.max(6, h)}%` }}
                                  title={`${d.x}: ${d.y}`}
                                />
                                <span className="text-[9px] text-muted-foreground truncate max-w-[40px]">{d.x}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── INSIGHT ── */}
            {block.type === "insight" && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-sm font-bold">Key Insight</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/85">{(block as any).content}</p>
              </div>
            )}

            {/* ── IMAGE ── */}
            {block.type === "image" && (() => {
              const imgBlock = block as any;
              return (
                <div className="space-y-4">
                  {imgBlock.image_url ? (
                    <div className="rounded-2xl overflow-hidden border border-border bg-card">
                      <img src={imgBlock.image_url} alt={imgBlock.image_caption || "Lab visual"} className="w-full max-h-[400px] object-contain bg-background" />
                    </div>
                  ) : (
                    <div className="h-48 rounded-2xl border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center gap-2">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground text-center max-w-xs">{imgBlock.image_caption || "Visual for this step"}</p>
                    </div>
                  )}
                  {imgBlock.image_caption && <p className="text-xs text-muted-foreground text-center italic">{imgBlock.image_caption}</p>}
                </div>
              );
            })()}

            {/* ── DIAGRAM ── */}
            {block.type === "diagram" && (() => {
              const diagBlock = block as any;
              const hasStructuredData = Array.isArray(diagBlock.diagram_nodes) && diagBlock.diagram_nodes.length > 0;
              if (hasStructuredData) {
                const diagramData: DiagramData = {
                  diagram_type: diagBlock.diagram_type || "flowchart",
                  nodes: diagBlock.diagram_nodes,
                  edges: diagBlock.diagram_edges || [],
                  title: diagBlock.title,
                  caption: diagBlock.diagram_caption || diagBlock.image_caption,
                };
                return <DiagramBlock data={diagramData} />;
              }
              return (
                <div className="space-y-4">
                  {diagBlock.diagram_type && (
                    <Badge variant="outline" className="text-xs capitalize">📐 {diagBlock.diagram_type.replace(/_/g, " ")}</Badge>
                  )}
                  {diagBlock.image_url ? (
                    <div className="rounded-2xl overflow-hidden border border-border bg-card">
                      <img src={diagBlock.image_url} alt={diagBlock.image_caption || "Lab visual"} className="w-full max-h-[400px] object-contain bg-background" />
                    </div>
                  ) : (
                    <div className="h-48 rounded-2xl border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center gap-2">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground text-center max-w-xs">{diagBlock.image_caption || "Diagram"}</p>
                    </div>
                  )}
                  {diagBlock.image_caption && <p className="text-xs text-muted-foreground text-center italic">{diagBlock.image_caption}</p>}
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1 gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="gap-1.5 font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        {!canAdvance && (
          <span className="text-xs text-muted-foreground animate-pulse text-center flex-1">
            Complete this step to continue
          </span>
        )}

        {currentStep < totalSteps - 1 ? (
          <Button
            size="sm"
            onClick={() => setCurrentStep(s => s + 1)}
            disabled={!canAdvance}
            className="gap-1.5 font-bold"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => setCurrentStep(totalSteps)}
            disabled={!canAdvance}
            className="gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700"
          >
            Finish <CheckCircle2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
