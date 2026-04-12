import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";

interface SignUpPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignUpPromptModal({ open, onOpenChange }: SignUpPromptModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-display">
            Thanks for sharing!
          </DialogTitle>
          <DialogDescription className="text-base">
            Create an account to save your progress and unlock all features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <Trophy className="w-5 h-5 text-accent flex-shrink-0" />
            <span className="text-sm">Track your challenge progress</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <Users className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm">Join the community and connect with others</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
            <span className="text-sm">Get personalized recommendations</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="hero" size="lg" asChild>
            <Link to="/signup">Create Free Account</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
