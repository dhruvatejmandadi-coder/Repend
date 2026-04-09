import { useState, useEffect, useCallback } from "react";
import { Loader2, BookOpen, FlaskConical, HelpCircle, CheckCircle2, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface CourseGeneratingScreenProps {
  topic: string;
  isVisible: boolean;
  courseId?: string | null;
  onComplete?: (courseId: string) => void;
}

type GenerationPhase = "outline" | "lessons" | "labs" | "quizzes" | "finalizing" | "complete";

interface ModuleStatus {
  id: string;
  title: string;
  hasLesson: boolean;
  hasQuiz: boolean;
  labStatus: string;
}

const PHASE_CONFIG: Record<GenerationPhase, { icon: any; label: string; baseWeight: number }> = {
  outline: { icon: Sparkles, label: "Analyzing your topic", baseWeight: 10 },
  lessons: { icon: BookOpen, label: "Generating lessons", baseWeight: 40 },
  quizzes: { icon: HelpCircle, label: "Creating quizzes", baseWeight: 15 },
  labs: { icon: FlaskConical, label: "Building interactive labs", baseWeight: 30 },
  finalizing: { icon: CheckCircle2, label: "Finalizing your course", baseWeight: 5 },
  complete: { icon: CheckCircle2, label: "Course ready!", baseWeight: 0 },
};

const PHASE_ORDER: GenerationPhase[] = ["outline", "lessons", "quizzes", "labs", "finalizing", "complete"];

export function CourseGeneratingScreen({ topic, isVisible, courseId, onComplete }: CourseGeneratingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<GenerationPhase>("outline");
  const [statusText, setStatusText] = useState("Analyzing your topic...");
  const [moduleStatuses, setModuleStatuses] = useState<ModuleStatus[]>([]);

  const computeProgress = useCallback((modules: ModuleStatus[]): { pct: number; phase: GenerationPhase; text: string } => {
    if (modules.length === 0) {
      return { pct: 5, phase: "outline", text: "Generating course outline..." };
    }

    const total = modules.length;
    const lessonsReady = modules.filter(m => m.hasLesson).length;
    const quizzesReady = modules.filter(m => m.hasQuiz).length;
    const labsReady = modules.filter(m => m.labStatus === "ready" || m.labStatus === "done").length;
    const labsGenerating = modules.filter(m => m.labStatus === "generating").length;

    // Outline done = 10%
    // Lessons = 40% (proportional)
    // Quizzes = 15% (proportional)
    // Labs = 30% (proportional)
    // Finalizing = 5%
    let pct = 10; // outline done since we have modules
    pct += (lessonsReady / total) * 40;
    pct += (quizzesReady / total) * 15;
    pct += (labsReady / total) * 30;

    let phase: GenerationPhase;
    let text: string;

    if (lessonsReady < total) {
      const current = modules.find(m => !m.hasLesson);
      phase = "lessons";
      text = `Generating lesson: ${current?.title || "Module"}...`;
    } else if (quizzesReady < total) {
      phase = "quizzes";
      text = `Creating quiz questions...`;
    } else if (labsReady < total) {
      phase = "labs";
      const generating = modules.find(m => m.labStatus !== "ready" && m.labStatus !== "done" && m.labStatus !== "failed");
      text = labsGenerating > 0
        ? `Building lab: ${generating?.title || "Module"}...`
        : `Waiting for lab generation...`;
    } else {
      phase = "finalizing";
      pct = 95;
      text = "Finalizing your course...";
    }

    return { pct: Math.min(Math.round(pct), 99), phase, text };
  }, []);

  // Poll for module statuses
  useEffect(() => {
    if (!isVisible || !courseId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { data: modules } = await supabase
          .from("course_modules")
          .select("id, title, lesson_content, quiz, lab_generation_status")
          .eq("course_id", courseId)
          .order("module_order");

        if (cancelled || !modules) return;

        const statuses: ModuleStatus[] = modules.map((m: any) => ({
          id: m.id,
          title: m.title,
          hasLesson: !m.lesson_content?.startsWith("⏳"),
          hasQuiz: Array.isArray(m.quiz) && m.quiz.length > 0,
          labStatus: m.lab_generation_status || "pending",
        }));

        setModuleStatuses(statuses);

        const { pct, phase, text } = computeProgress(statuses);
        setProgress(pct);
        setCurrentPhase(phase);
        setStatusText(text);

        // Check if everything is done
        const allDone = statuses.length > 0 &&
          statuses.every(m => m.hasLesson && m.hasQuiz) &&
          statuses.every(m => m.labStatus === "ready" || m.labStatus === "done" || m.labStatus === "failed");

        if (allDone) {
          setProgress(100);
          setCurrentPhase("complete");
          setStatusText("Course ready!");
          setTimeout(() => {
            if (!cancelled && onComplete) onComplete(courseId);
          }, 1200);
          return;
        }
      } catch (e) {
        console.error("Poll error:", e);
      }

      if (!cancelled) {
        setTimeout(poll, 3000);
      }
    };

    // Start polling after a small delay (outline generation)
    const initial = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
    };
  }, [isVisible, courseId, computeProgress, onComplete]);

  if (!isVisible) return null;

  const phaseIndex = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="max-w-md w-full mx-auto px-6 text-center space-y-8">
        {/* Animated orb */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            {currentPhase === "complete" ? (
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            ) : (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            )}
          </div>
        </div>

        {/* Topic */}
        <div>
          <h2 className="font-display text-2xl font-bold mb-2">Generating Your Course</h2>
          <p className="text-muted-foreground text-sm">
            Creating a personalized course about{" "}
            <span className="text-accent font-medium">{topic || "your topic"}</span>
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium transition-all duration-300">{statusText}</span>
            <span className="tabular-nums font-semibold text-foreground">{progress}%</span>
          </div>
        </div>

        {/* Phase steps */}
        <div className="space-y-2.5 text-left max-w-xs mx-auto">
          {PHASE_ORDER.filter(p => p !== "complete").map((phase, i) => {
            const config = PHASE_CONFIG[phase];
            const Icon = config.icon;
            const isActive = phase === currentPhase;
            const isDone = phaseIndex > i;

            return (
              <div
                key={phase}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-500 ${
                  isActive
                    ? "bg-primary/10 border border-primary/20"
                    : isDone
                    ? "opacity-60"
                    : "opacity-30"
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
                  isDone ? "bg-green-500/20" : isActive ? "bg-primary/20" : "bg-muted/50"
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/60"
                }`}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Module breakdown */}
        {moduleStatuses.length > 0 && (
          <div className="text-xs text-muted-foreground/60 space-y-1">
            {moduleStatuses.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                {m.hasLesson && m.hasQuiz && (m.labStatus === "ready" || m.labStatus === "failed") ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-primary/50" />
                )}
                <span className="truncate">{m.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Subtle tip */}
        <p className="text-xs text-muted-foreground/50">
          This usually takes 30–60 seconds
        </p>
      </div>
    </div>
  );
}
