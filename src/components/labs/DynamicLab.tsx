import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  CheckCircle2, ChevronRight, ChevronLeft, RotateCcw, Lightbulb,
  MessageCircleQuestion, TrendingUp, TrendingDown, Minus, ImageIcon, Loader2,
  Zap, Activity, Target, Shuffle, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LabIntro from "./LabIntro";
import DiagramBlock from "./DiagramBlock";
import type { DiagramData } from "./DiagramBlock";
import type { LabIntroData } from "./LabIntro";
import { useLabSimulation } from "@/hooks/useLabSimulation";
import { evaluateFormula, checkAnswer } from "@/lib/labSimulationEngine";

/** Convert snake_case/camelCase variable names to readable labels */
function formatVarName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase());
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
  if (pct >= 75) return { color: "text-green-500", icon: TrendingUp };
  if (pct >= 35) return { color: "text-yellow-500", icon: Minus };
  return { color: "text-red-500", icon: TrendingDown };
}

const BLOCK_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  text: { label: "Read", emoji: "📖", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  choice_set: { label: "Decide", emoji: "🔮", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
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

export default function DynamicLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const variables = useMemo(() => data?.variables ?? [], [data]);
  const blocks = useMemo(() => data?.blocks ?? [], [data]);
  const introData = data?.intro || data?.repend_intro;

  // ── Simulation Engine (XState + mathjs) ──
  const sim = useLabSimulation(data);

  const [showIntro, setShowIntro] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, number>>({});
  const [choiceAnswers, setChoiceAnswers] = useState<Record<number, number>>({});
  const [taskAnswers, setTaskAnswers] = useState<Record<string, string>>({});
  const [taskSubmitted, setTaskSubmitted] = useState<Record<string, boolean>>({});
  const [completionFired, setCompletionFired] = useState(false);
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const [eventLog, setEventLog] = useState<string[]>([]);

  const totalSteps = blocks.length;

  // Sync simulation engine variables with local state
  useEffect(() => {
    if (sim.isSimulation && Object.keys(sim.variables).length > 0) {
      setValues(sim.variables);
    }
  }, [sim.isSimulation, sim.variables]);

  // Track rule feedback in event log
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
      case "slider":
      case "control_panel":
      case "output_display":
      case "text":
      case "table":
      case "chart":
      case "insight":
      case "image":
      case "diagram":
        return true;
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

  const handleChoice = useCallback((blockIdx: number, choiceIdx: number) => {
    if (choiceAnswers[blockIdx] !== undefined) return;
    const block = blocks[blockIdx] as any;
    const choice = block?.choices?.[choiceIdx];
    if (!choice) return;

    if (sim.isSimulation) {
      const choiceSetIndex = blocks.slice(0, blockIdx + 1).filter(b => b.type === "choice_set").length - 1;
      sim.sendEvent(`CHOOSE_${choiceSetIndex}_${choiceIdx}`);
    } else if (choice.effects && typeof choice.effects === "object") {
      setValues(prev => {
        const next = { ...prev };
        for (const v of variables) {
          if (typeof choice.effects[v.name] === "number") {
            next[v.name] = Math.max(v.min, Math.min(v.max, choice.effects[v.name]));
          }
        }
        return next;
      });
    }
    setChoiceAnswers(prev => ({ ...prev, [blockIdx]: choiceIdx }));
  }, [choiceAnswers, blocks, variables, sim]);

  /** Handle slider change — triggers live rule evaluation */
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
    if (sim.isSimulation) {
      sim.reset();
    }
    const initial = Object.fromEntries(variables.map(v => [v.name, v.default ?? 50]));
    setValues(initial);
    setChoiceAnswers({});
    setTaskAnswers({});
    setTaskSubmitted({});
    setCompletionFired(false);
    setShowIntro(true);
    setCurrentStep(0);
    setShowHint({});
    setGeneratedImages({});
    setImageLoading({});
    setEventLog([]);
  };

  const generateImage = useCallback(async (blockIdx: number, prompt: string) => {
    if (generatedImages[blockIdx] || imageLoading[blockIdx]) return;
    setImageLoading(prev => ({ ...prev, [blockIdx]: true }));
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-lab-image", {
        body: { prompt, context: data.title || "" },
      });
      if (fnError) throw fnError;
      if (fnData?.imageUrl) {
        setGeneratedImages(prev => ({ ...prev, [blockIdx]: fnData.imageUrl }));
      }
    } catch (e) {
      console.error("Image generation failed:", e);
    } finally {
      setImageLoading(prev => ({ ...prev, [blockIdx]: false }));
    }
  }, [generatedImages, imageLoading, data.title]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && canAdvance && currentStep < totalSteps - 1) setCurrentStep(s => s + 1);
      if (e.key === "ArrowLeft" && currentStep > 0) setCurrentStep(s => s - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canAdvance, currentStep, totalSteps]);

  // ── Already completed state ──
  if (isCompleted && !allDone) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h3 className="font-bold text-lg">Lab Complete</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">You've already completed this lab. Replay to explore different outcomes.</p>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Replay Lab
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Intro screen ──
  if (showIntro && introData) {
    return <LabIntro title={data.title || "Interactive Lab"} intro={introData} labType={data.kind || "dynamic"} onStart={() => { setShowIntro(false); if (sim.isSimulation) sim.sendEvent("START"); }} />;
  }

  if (showIntro && !introData) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧪</span>
            <div>
              <h3 className="font-bold text-lg">{data.title || "Interactive Lab"}</h3>
              {data.kind && <p className="text-xs text-muted-foreground capitalize">{data.kind.replace(/_/g, " ")}</p>}
            </div>
          </div>
          {data.scenario && <p className="text-sm leading-relaxed text-foreground/80">{data.scenario}</p>}
          {data.learning_goal && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-sm mt-0.5">🎯</span>
              <p className="text-sm text-foreground/70">{data.learning_goal}</p>
            </div>
          )}
          {/* Goal display */}
          {data.goal?.description && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Target className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Your Objective</p>
                <p className="text-sm text-foreground/80 mt-1">{data.goal.description}</p>
              </div>
            </div>
          )}
          {variables.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">System Variables</span>
              <div className="grid grid-cols-2 gap-2">
                {variables.map(v => (
                  <div key={v.name} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2">
                    <span className="text-base">{v.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{formatVarName(v.name)}</p>
                      <p className="text-[10px] text-muted-foreground">{v.min}–{v.max} {v.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shuffle className="w-3 h-3" />
            <span>Randomized start · Each run is different</span>
            <span>·</span>
            <span>{totalSteps} steps</span>
          </div>
          <Button onClick={() => { setShowIntro(false); if (sim.isSimulation) sim.sendEvent("START"); }} className="w-full" size="lg">
            Start Simulation <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (totalSteps === 0) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No lab blocks available.</CardContent></Card>;
  }

  // ── Lab finished ──
  if (allDone && currentStep >= totalSteps) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-8 space-y-5">
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h3 className="font-bold text-xl">Simulation Complete!</h3>
            {sim.goalReached && (
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                <Target className="w-3 h-3 mr-1" /> Objective Achieved!
              </Badge>
            )}
          </div>
          {data.key_insight && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Key Takeaway</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">{data.key_insight}</p>
            </div>
          )}
          {/* Derived values summary */}
          {Object.keys(sim.derivedValues).length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Computed Outputs</span>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(sim.derivedValues).map(([key, val]) => (
                  <div key={key} className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-sm font-bold tabular-nums">{typeof val === "number" ? val.toFixed(1) : val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {variables.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Final State</span>
              <div className="grid grid-cols-2 gap-2">
                {variables.map(v => {
                  const value = values[v.name] ?? v.default;
                  const pct = ((value - v.min) / (v.max - v.min)) * 100;
                  const { color, icon: Icon } = getParamLevel(value, v.min, v.max);
                  return (
                    <div key={v.name} className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{v.icon} {formatVarName(v.name)}</span>
                        <div className="flex items-center gap-1">
                          <Icon className={`w-3.5 h-3.5 ${color}`} />
                          <span className="text-sm font-semibold">{value} {v.unit}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 75 ? "bg-green-500" : pct >= 35 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Event log */}
          {eventLog.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">System Events</span>
              <div className="max-h-32 overflow-y-auto space-y-1 p-3 rounded-lg bg-muted/30 border border-border/40">
                {eventLog.map((msg, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Zap className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    {msg}
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="text-center pt-2">
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" /> Replay (New Randomization)
            </Button>
          </div>
        </CardContent>
      </Card>
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
    <div className="space-y-5">
      {/* Progress header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Step {currentStep + 1} / {totalSteps}</span>
            <Badge variant="outline" className={`text-[10px] ${meta.color}`}>{meta.emoji} {meta.label}</Badge>
            {sim.isSimulation && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
                <Activity className="w-2.5 h-2.5" /> Live Simulation
              </Badge>
            )}
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
        <div className="flex items-center gap-1.5 justify-center">
          {blocks.map((b, i) => {
            const bMeta = BLOCK_LABELS[b.type];
            return (
              <button
                key={i}
                onClick={() => { if (i <= currentStep || isStepCompleted(i)) setCurrentStep(i); }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentStep ? "w-6 bg-primary" :
                  isStepCompleted(i) ? "w-2 bg-primary/40" : "w-2 bg-muted-foreground/20"
                }`}
                title={`Step ${i + 1}: ${bMeta?.label || b.type}`}
              />
            );
          })}
        </div>
      </div>

      {/* Goal tracker */}
      {data.goal?.description && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
          sim.goalReached 
            ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400" 
            : "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400"
        }`}>
          <Target className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Goal:</span>
          <span className="truncate">{data.goal.description}</span>
          {sim.goalReached && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-auto" />}
        </div>
      )}

      {/* Variable dashboard — compact, persistent */}
      {variables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {variables.map(v => {
            const value = values[v.name] ?? v.default;
            const pct = ((value - v.min) / (v.max - v.min)) * 100;
            const { color } = getParamLevel(value, v.min, v.max);
            return (
              <div key={v.name} className="rounded-lg border border-border bg-card px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium leading-tight">{v.icon} {formatVarName(v.name)}</span>
                  <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${color}`}>{value} {v.unit}</span>
                </div>
                {v.description && (
                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{v.description}</p>
                )}
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${pct >= 75 ? "bg-green-500" : pct >= 35 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simulation feedback toast */}
      {sim.isSimulation && sim.lastFeedback && (
        <div className="p-3 rounded-lg bg-accent/50 border border-accent text-sm text-foreground/80 animate-fade-in flex items-start gap-2">
          <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>{sim.lastFeedback}</span>
        </div>
      )}

      {/* Derived values from mathjs formulas */}
      {sim.isSimulation && Object.keys(sim.derivedValues).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(sim.derivedValues).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
              <span className="text-muted-foreground">{formatVarName(key)}:</span>
              <span className="font-semibold tabular-nums">{typeof val === "number" ? val.toFixed(1) : val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Current block card */}
      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-6 sm:p-8 min-h-[280px]">
          <div key={currentStep} className="animate-fade-in space-y-6">

            {/* Step instruction header */}
            {meta && (
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <span className="text-lg">{meta.emoji}</span>
                <span className="text-base font-semibold text-foreground">{meta.label}</span>
                {block.type === "control_panel" && <span className="text-xs text-muted-foreground ml-auto">Drag the sliders to adjust values</span>}
                {block.type === "choice_set" && <span className="text-xs text-muted-foreground ml-auto">Select one option to continue</span>}
                {block.type === "output_display" && <span className="text-xs text-muted-foreground ml-auto">Observe how outputs change</span>}
                {block.type === "step_task" && <span className="text-xs text-muted-foreground ml-auto">Complete all tasks to proceed</span>}
              </div>
            )}

            {/* TEXT */}
            {block.type === "text" && (
              <div className="space-y-3">
                <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">{(block as any).content}</p>
              </div>
            )}

            {/* CHOICE SET */}
            {block.type === "choice_set" && (() => {
              const isAnswered = choiceAnswers[currentStep] !== undefined;
              const choiceBlock = block as any;
              return (
                <div className="space-y-5">
                  <div>
                    <p className="text-base font-semibold">{choiceBlock.emoji || "🔬"} {choiceBlock.question}</p>
                  </div>
                  <div className="space-y-2.5">
                    {choiceBlock.choices.map((c: Choice, i: number) => {
                      const isChosen = choiceAnswers[currentStep] === i;
                      const isBest = c.is_best && isAnswered;
                      return (
                        <div key={i} className="space-y-1.5">
                          <button
                            onClick={() => handleChoice(currentStep, i)}
                            disabled={isAnswered}
                            className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-all duration-200 ${
                              isChosen
                                ? isBest
                                  ? "border-green-500 bg-green-500/10 ring-1 ring-green-500/20"
                                  : "border-primary bg-primary/10 ring-1 ring-primary/20"
                                : isAnswered
                                  ? "opacity-30 border-border cursor-not-allowed"
                                  : "border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full border border-border text-xs font-medium shrink-0">
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span>{c.text}</span>
                            </div>
                          </button>
                          {isChosen && c.feedback && (
                            <div className="ml-9 text-xs px-4 py-2.5 bg-muted/50 rounded-lg text-muted-foreground animate-fade-in border border-border/30">
                              {c.feedback}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* SLIDER — single variable, interactive with live updates */}
            {block.type === "slider" && (() => {
              const sliderBlock = block as any;
              const v = variables.find(vr => vr.name === sliderBlock.variable);
              if (!v) return <p className="text-sm text-muted-foreground">Variable not found.</p>;
              const value = values[v.name] ?? v.default;
              const pct = ((value - v.min) / (v.max - v.min)) * 100;
              return (
                <div className="space-y-5">
                  {sliderBlock.prompt && <p className="text-sm font-medium">{sliderBlock.prompt}</p>}
                  <div className="p-5 rounded-xl border border-border bg-card space-y-4">
                    <div className="text-center">
                      <span className="text-3xl font-bold tabular-nums">{value}</span>
                      <span className="text-sm text-muted-foreground ml-1">{v.unit}</span>
                    </div>
                    <Slider
                      value={[value]}
                      min={v.min}
                      max={v.max}
                      step={1}
                      onValueChange={(val) => handleSliderChange(v.name, val[0])}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{v.min} {v.unit}</span>
                      <span>{v.max} {v.unit}</span>
                    </div>
                  </div>
                  {v.description && <p className="text-xs text-muted-foreground italic">{v.description}</p>}
                </div>
              );
            })()}

            {/* CONTROL PANEL — multiple sliders for multiple variables */}
            {block.type === "control_panel" && (() => {
              const cpBlock = block as any;
              const controlVars = (cpBlock.variables || [])
                .map((name: string) => variables.find(v => v.name === name))
                .filter(Boolean);
              const displayVars = controlVars.length > 0 ? controlVars : variables;
              return (
                <div className="space-y-5">
                  {cpBlock.prompt && <p className="text-base font-semibold text-foreground">{cpBlock.prompt}</p>}
                  <div className="space-y-4">
                    {displayVars.map((v: Variable) => {
                      const value = values[v.name] ?? v.default;
                      return (
                        <div key={v.name} className="p-4 rounded-xl border border-border bg-card space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{v.icon} {formatVarName(v.name)}</span>
                            <span className="text-sm font-bold tabular-nums">{value} {v.unit}</span>
                          </div>
                          {v.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {v.description}
                            </p>
                          )}
                          <Slider
                            value={[value]}
                            min={v.min}
                            max={v.max}
                            step={1}
                            onValueChange={(val) => handleSliderChange(v.name, val[0])}
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{v.min} {v.unit}</span>
                            <span>{v.max} {v.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* OUTPUT DISPLAY — live computed values */}
            {block.type === "output_display" && (() => {
              const outBlock = block as any;
              const outputKeys = outBlock.outputs || Object.keys(sim.derivedValues);
              return (
                <div className="space-y-5">
                  {outBlock.prompt && <p className="text-base font-semibold text-foreground">{outBlock.prompt}</p>}
                  <p className="text-xs text-muted-foreground">These values update in real time as you adjust the sliders above. Watch how your changes affect the system.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {outputKeys.map((key: string) => {
                      const val = sim.derivedValues[key];
                      const varVal = values[key];
                      const displayVal = val !== undefined ? val : varVal;
                      if (displayVal === undefined) return null;
                      const formula = data.formulas?.[key];
                      return (
                        <div key={key} className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
                          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{formatVarName(key)}</p>
                          <p className="text-2xl font-bold tabular-nums">{typeof displayVal === "number" ? displayVal.toFixed(1) : displayVal}</p>
                          {formula && (
                            <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">= {formula}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* TABLE */}
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
                            <th key={i} className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
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

            {/* STEP TASK */}
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
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">{idx + 1}</span>
                          <p className="text-sm font-medium leading-relaxed">{task.prompt}</p>
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
                              <p className="text-xs text-muted-foreground mt-1.5 pl-4 border-l-2 border-primary/20 animate-fade-in">{task.hint}</p>
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
                                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                                      submitted && isSelected
                                        ? (optCorrect ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10")
                                        : submitted && optCorrect
                                          ? "border-green-500/50 bg-green-500/5"
                                          : isSelected
                                            ? "border-primary bg-primary/10"
                                            : submitted ? "opacity-30 border-border" : "border-border hover:border-primary/40"
                                    }`}
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
                              className={`text-sm ${submitted ? (isCorrect ? "border-green-500 bg-green-500/5" : "border-red-500 bg-red-500/5") : ""}`}
                            />
                          )}

                          {!submitted && userAnswer && (
                            <Button size="sm" onClick={() => submitTask(task.id)} className="w-full mt-3">
                              Submit Answer
                            </Button>
                          )}

                          {submitted && (
                            <div className={`mt-3 text-sm p-3.5 rounded-lg animate-fade-in ${isCorrect ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                              {isCorrect ? (
                                <p className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                  <span className="font-medium text-green-600 dark:text-green-400">Correct!</span>
                                </p>
                              ) : (
                                <p className="text-red-600 dark:text-red-400">
                                  Incorrect — the answer is: <span className="font-medium">{task.correct_answer}</span>
                                </p>
                              )}
                              {task.explanation && (
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{task.explanation}</p>
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

            {/* CHART */}
            {block.type === "chart" && (() => {
              const chartBlock = block as any;
              return (
                <div className="space-y-3">
                  {chartBlock.title && <h4 className="text-sm font-bold">{chartBlock.title}</h4>}
                  <div className="h-52 bg-muted/20 rounded-xl flex items-center justify-center border border-border/50 p-4">
                    <div className="text-center space-y-2 w-full">
                      {chartBlock.x_label && chartBlock.y_label && (
                        <p className="text-xs text-muted-foreground">{chartBlock.x_label} vs {chartBlock.y_label}</p>
                      )}
                      {chartBlock.datasets?.[0]?.data && (
                        <div className="flex items-end gap-1.5 justify-center h-24 px-4">
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

            {/* INSIGHT */}
            {block.type === "insight" && (
              <div className="p-5 rounded-xl bg-primary/5 border border-primary/15 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold">Key Insight</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80">{(block as any).content}</p>
              </div>
            )}

            {/* IMAGE */}
            {block.type === "image" && (() => {
              const imgBlock = block as any;
              const existingUrl = imgBlock.image_url || generatedImages[currentStep];
              const isLoading = imageLoading[currentStep];

              return (
                <div className="space-y-4">
                  {existingUrl ? (
                    <div className="rounded-xl overflow-hidden border border-border bg-card">
                      <img
                        src={existingUrl}
                        alt={imgBlock.image_caption || "Lab visual"}
                        className="w-full max-h-[400px] object-contain bg-background"
                      />
                    </div>
                  ) : isLoading ? (
                    <div className="h-64 rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Generating visual...</p>
                    </div>
                  ) : (
                    <div className="h-64 rounded-xl border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center gap-3">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground text-center max-w-xs">
                        {imgBlock.image_prompt || "Visual for this step"}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateImage(currentStep, imgBlock.image_prompt || imgBlock.image_caption || data.title || "educational diagram")}
                        className="gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Generate Visual
                      </Button>
                    </div>
                  )}

                  {imgBlock.image_caption && (
                    <p className="text-xs text-muted-foreground text-center italic">{imgBlock.image_caption}</p>
                  )}
                </div>
              );
            })()}

            {/* DIAGRAM */}
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

              const existingUrl = diagBlock.image_url || generatedImages[currentStep];
              const isLoading = imageLoading[currentStep];

              return (
                <div className="space-y-4">
                  {diagBlock.diagram_type && (
                    <Badge variant="outline" className="text-xs capitalize">
                      📐 {diagBlock.diagram_type.replace(/_/g, " ")}
                    </Badge>
                  )}

                  {existingUrl ? (
                    <div className="rounded-xl overflow-hidden border border-border bg-card">
                      <img
                        src={existingUrl}
                        alt={diagBlock.image_caption || "Lab visual"}
                        className="w-full max-h-[400px] object-contain bg-background"
                      />
                    </div>
                  ) : isLoading ? (
                    <div className="h-64 rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Generating visual...</p>
                    </div>
                  ) : (
                    <div className="h-64 rounded-xl border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center gap-3">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground text-center max-w-xs">
                        {diagBlock.image_prompt || "Diagram for this step"}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateImage(currentStep, diagBlock.image_prompt || diagBlock.image_caption || data.title || "educational diagram")}
                        className="gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Generate Visual
                      </Button>
                    </div>
                  )}

                  {diagBlock.image_caption && (
                    <p className="text-xs text-muted-foreground text-center italic">{diagBlock.image_caption}</p>
                  )}
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        {!canAdvance && (
          <span className="text-xs text-muted-foreground animate-pulse">Complete this step to continue</span>
        )}

        {currentStep < totalSteps - 1 ? (
          <Button
            size="sm"
            onClick={() => setCurrentStep(s => s + 1)}
            disabled={!canAdvance}
            className="gap-1.5"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => setCurrentStep(totalSteps)}
            disabled={!canAdvance}
            className="gap-1.5"
          >
            Finish Lab <CheckCircle2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
