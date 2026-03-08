import { useState, useEffect } from "react";
import { Loader2, BookOpen, FlaskConical, HelpCircle, Video, CheckCircle2, Sparkles } from "lucide-react";

const GENERATION_STEPS = [
  { icon: Sparkles, label: "Analyzing your topic", duration: 3000 },
  { icon: BookOpen, label: "Creating lesson content", duration: 5000 },
  { icon: FlaskConical, label: "Building interactive labs", duration: 5000 },
  { icon: HelpCircle, label: "Generating quizzes", duration: 4000 },
  { icon: Video, label: "Finding relevant videos", duration: 3000 },
  { icon: CheckCircle2, label: "Finalizing your course", duration: 2000 },
];

interface CourseGeneratingScreenProps {
  topic: string;
  isVisible: boolean;
}

export function CourseGeneratingScreen({ topic, isVisible }: CourseGeneratingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      return;
    }

    let stepIndex = 0;
    const advanceStep = () => {
      stepIndex++;
      if (stepIndex < GENERATION_STEPS.length) {
        setCurrentStep(stepIndex);
        setTimeout(advanceStep, GENERATION_STEPS[stepIndex].duration);
      }
    };

    const timeout = setTimeout(advanceStep, GENERATION_STEPS[0].duration);
    return () => clearTimeout(timeout);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="max-w-md w-full mx-auto px-6 text-center space-y-8">
        {/* Animated orb */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
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

        {/* Steps */}
        <div className="space-y-3 text-left max-w-xs mx-auto">
          {GENERATION_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;

            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${
                  isActive
                    ? "bg-primary/10 border border-primary/20"
                    : isDone
                    ? "opacity-60"
                    : "opacity-30"
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
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
                <span className={`text-sm font-medium ${
                  isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/60"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Subtle tip */}
        <p className="text-xs text-muted-foreground/50">
          This usually takes 15–30 seconds
        </p>
      </div>
    </div>
  );
}
