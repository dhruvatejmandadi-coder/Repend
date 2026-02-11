import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ProfileSetupModal } from "./ProfileSetupModal";
import { SurveyModal } from "@/components/survey/SurveyModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardList, ArrowRight } from "lucide-react";

const ONBOARDED_KEY = "repend_onboarded";

type Step = "profile" | "survey-prompt" | "survey" | "done";

export function OnboardingFlow() {
  const { user, isNewUser, setIsNewUser } = useAuth();
  const [step, setStep] = useState<Step>("profile");

  if (!isNewUser || !user) return null;

  const markComplete = () => {
    localStorage.setItem(`${ONBOARDED_KEY}_${user.id}`, "true");
    setIsNewUser(false);
  };

  if (step === "profile") {
    return (
      <ProfileSetupModal
        open
        onComplete={() => setStep("survey-prompt")}
      />
    );
  }

  if (step === "survey-prompt") {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mb-2">
              <ClipboardList className="w-7 h-7 text-accent" />
            </div>
            <DialogTitle className="text-xl font-display">Personalize Your Experience</DialogTitle>
            <DialogDescription>
              Take a quick survey so we can match you with the right mentors and challenges.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pt-2">
            <Button variant="hero" className="w-full gap-2" onClick={() => setStep("survey")}>
              Take the Survey <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" className="w-full" onClick={markComplete}>
              Skip for now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "survey") {
    return (
      <SurveyModal
        open
        onOpenChange={(open) => {
          if (!open) {
            markComplete();
          }
        }}
      />
    );
  }

  return null;
}
