import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Eye, Target, Gauge, ChevronRight, Sparkles } from "lucide-react";

export interface CoursePreferences {
  level: string;
  style: string;
  goal: string;
  pace: string;
}

const STEPS = [
  {
    key: "level",
    icon: GraduationCap,
    title: "What's your level on this topic?",
    subtitle: "This helps us calibrate lesson depth and lab complexity",
    options: [
      { value: "beginner", label: "Beginner", desc: "New to this topic" },
      { value: "intermediate", label: "Intermediate", desc: "Know the basics" },
      { value: "advanced", label: "Advanced", desc: "Looking for depth" },
    ],
  },
  {
    key: "style",
    icon: Eye,
    title: "How do you prefer to learn?",
    subtitle: "We'll adjust lessons and labs to match your style",
    options: [
      { value: "visual", label: "Visual", desc: "Charts, diagrams, examples" },
      { value: "hands-on", label: "Hands-on", desc: "Interactive labs & tasks" },
      { value: "conceptual", label: "Conceptual", desc: "Theory & explanations" },
      { value: "mixed", label: "Mixed", desc: "A bit of everything" },
    ],
  },
  {
    key: "goal",
    icon: Target,
    title: "What's your goal?",
    subtitle: "This shapes the focus of your course",
    options: [
      { value: "basics", label: "Understand Basics", desc: "Build a solid foundation" },
      { value: "test-prep", label: "Prepare for Test", desc: "Exam-focused content" },
      { value: "real-world", label: "Real-world Application", desc: "Practical, applied learning" },
      { value: "mastery", label: "Deep Mastery", desc: "Expert-level understanding" },
    ],
  },
  {
    key: "pace",
    icon: Gauge,
    title: "What pace do you prefer?",
    subtitle: "Optional — we'll default to balanced",
    options: [
      { value: "fast", label: "Fast", desc: "Key points, less detail" },
      { value: "balanced", label: "Balanced", desc: "Standard depth" },
      { value: "detailed", label: "Detailed", desc: "Thorough explanations" },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (prefs: CoursePreferences) => void;
  topic: string;
}

export default function PersonalizationModal({ open, onClose, onSubmit, topic }: Props) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<CoursePreferences>({ level: "", style: "", goal: "", pace: "balanced" });

  const current = STEPS[step];
  const key = current.key as keyof CoursePreferences;
  const selected = prefs[key];
  const isLast = step === STEPS.length - 1;
  const canContinue = !!selected;

  const handleSelect = (value: string) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (isLast) {
      onSubmit(prefs);
      setStep(0);
      setPrefs({ level: "", style: "", goal: "", pace: "balanced" });
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    if (isLast) {
      onSubmit({ ...prefs, pace: prefs.pace || "balanced" });
      setStep(0);
      setPrefs({ level: "", style: "", goal: "", pace: "balanced" });
    } else {
      setStep(s => s + 1);
    }
  };

  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary">Personalize Your Course</span>
          </div>
          <DialogTitle className="text-lg">{current.title}</DialogTitle>
          <DialogDescription className="text-sm">{current.subtitle}</DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 justify-center py-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted-foreground/20"}`} />
          ))}
        </div>

        <div className="space-y-2 py-2">
          {current.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-150 ${
                selected === opt.value
                  ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                  : "border-border/50 hover:border-primary/30 hover:bg-primary/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-foreground">{opt.label}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{opt.desc}</span>
                </div>
                {selected === opt.value && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Selected</Badge>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          {step === STEPS.length - 1 ? (
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Skip
            </Button>
          ) : (
            <div />
          )}
          <Button size="sm" onClick={handleNext} disabled={!canContinue && step < 3} className="gap-1.5">
            {isLast ? "Generate Course" : "Continue"} <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
