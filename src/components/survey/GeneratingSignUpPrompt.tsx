import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, BookOpen, TrendingUp, Save, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface GeneratingSignUpPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
}

export function GeneratingSignUpPrompt({ open, onOpenChange, topic }: GeneratingSignUpPromptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-4 relative">
            <Sparkles className="w-8 h-8 text-white" />
            <div className="absolute inset-0 rounded-full gradient-primary animate-ping opacity-20" />
          </div>
          <DialogTitle className="text-2xl font-display">
            Your course is almost ready!
          </DialogTitle>
          <DialogDescription className="text-base">
            Sign up to generate <span className="font-semibold text-foreground">"{topic}"</span> and unlock the full learning experience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <Save className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm">Save your generated courses forever</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <TrendingUp className="w-5 h-5 text-accent flex-shrink-0" />
            <span className="text-sm">Track your progress across modules</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm">Unlimited courses with labs, quizzes & videos</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="hero" size="lg" asChild>
            <Link to="/signup">Create Free Account</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">Already have an account? Sign In</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
