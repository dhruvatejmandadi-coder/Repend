import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { surveyQuestions, SurveyResponses, initialSurveyResponses } from "./SurveyData";
import { useToast } from "@/hooks/use-toast";
import { SignUpPromptModal } from "./SignUpPromptModal";

interface SurveyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowAnonymous?: boolean;
}

const steps = [
  "goals", "challenges", "subject_area", "skill_level", "help_types",
  "mentor_personality", "learning_styles", "time_commitment", "urgency", "success",
] as const;

export function SurveyModal({ open, onOpenChange, allowAnonymous = false }: SurveyModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<SurveyResponses>(initialSurveyResponses);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const { toast } = useToast();

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleMultiSelect = (field: keyof SurveyResponses, value: string) => {
    const current = responses[field] as string[];
    if (current.includes(value)) {
      setResponses({ ...responses, [field]: current.filter((v) => v !== value) });
    } else {
      setResponses({ ...responses, [field]: [...current, value] });
    }
  };

  const handleSingleSelect = (field: keyof SurveyResponses, value: string) => {
    setResponses({ ...responses, [field]: value });
  };

  const handleOtherChange = (field: keyof SurveyResponses, value: string) => {
    setResponses({ ...responses, [field]: value });
  };

  const handleNext = () => { if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1); };
  const handleBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      toast({ title: "Survey completed!", description: "Thanks for sharing your goals with us." });
      onOpenChange(false);
      setCurrentStep(0);
      setResponses(initialSurveyResponses);
      setIsSubmitting(false);

      if (allowAnonymous) {
        setTimeout(() => setShowSignUpPrompt(true), 500);
      }
    }, 500);
  };

  const renderStep = () => {
    const step = steps[currentStep];

    if (step === "success") {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Open Insight</h3>
          <p className="text-muted-foreground">In one sentence, what would "success" look like for you?</p>
          <Textarea value={responses.success_definition} onChange={(e) => handleOtherChange("success_definition", e.target.value)}
            placeholder="e.g., Getting my first internship, passing my calculus exam..." className="min-h-[100px]" />
        </div>
      );
    }

    const questionData = surveyQuestions[step as keyof typeof surveyQuestions];
    const isMulti = questionData.type === "multi";
    const fieldName = step as keyof SurveyResponses;
    const otherFieldName = `${step}_other` as keyof SurveyResponses;

    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs text-accent font-medium uppercase tracking-wide mb-1">{questionData.title}</p>
          <h3 className="text-lg font-semibold">{questionData.question}</h3>
          {isMulti && <p className="text-sm text-muted-foreground mt-1">Select all that apply</p>}
        </div>
        {isMulti ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {questionData.options.map((option) => (
              <label key={option} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
                <Checkbox checked={(responses[fieldName] as string[]).includes(option)} onCheckedChange={() => handleMultiSelect(fieldName, option)} />
                <span className="text-sm">{option}</span>
              </label>
            ))}
            <div className="pt-2">
              <Input placeholder="Other (please specify)" value={responses[otherFieldName] as string} onChange={(e) => handleOtherChange(otherFieldName, e.target.value)} />
            </div>
          </div>
        ) : (
          <RadioGroup value={responses[fieldName] as string} onValueChange={(value) => handleSingleSelect(fieldName, value)} className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {questionData.options.map((option) => (
              <label key={option} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
                <RadioGroupItem value={option} />
                <span className="text-sm">{option}</span>
              </label>
            ))}
            {otherFieldName in responses && (
              <div className="pt-2">
                <Input placeholder="Other (please specify)" value={responses[otherFieldName] as string} onChange={(e) => handleOtherChange(otherFieldName, e.target.value)} />
              </div>
            )}
          </RadioGroup>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Help Us Match You
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mb-4">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">Step {currentStep + 1} of {steps.length}</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">{renderStep()}</div>
        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {currentStep === steps.length - 1 ? (
            <Button variant="hero" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Complete"}
            </Button>
          ) : (
            <Button variant="hero" onClick={handleNext}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
      <SignUpPromptModal open={showSignUpPrompt} onOpenChange={setShowSignUpPrompt} />
    </Dialog>
  );
}
