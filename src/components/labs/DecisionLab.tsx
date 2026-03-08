import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, Brain, Target, RotateCcw, ChevronRight, Sparkles, ShieldAlert, Lightbulb, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/* ===== TYPES ===== */

interface DecisionLabData {
  scenario: string;
  constraints: string[];
  decision_prompt: string;
  twist: string;
  reflection_question: string;
  difficulty_tier?: number;
  variables?: Record<string, { label: string; value: string | number }>;
}

interface StudentResponse {
  strategy: string;
  core_assumption: string;
  biggest_risk: string;
}

interface Feedback {
  score: number;
  grade: string;
  strengths: string[];
  weaknesses: string[];
  critique: string;
  coaching_tip: string;
}

type Phase = "scenario" | "respond" | "feedback" | "twist" | "twist_feedback" | "reflection" | "final";

/* ===== COMPONENT ===== */

export default function DecisionLab({ data }: { data: DecisionLabData }) {
  const [phase, setPhase] = useState<Phase>("scenario");
  const [response, setResponse] = useState<StudentResponse>({ strategy: "", core_assumption: "", biggest_risk: "" });
  const [twistResponse, setTwistResponse] = useState("");
  const [reflectionResponse, setReflectionResponse] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [twistFeedback, setTwistFeedback] = useState<Feedback | null>(null);
  const [finalFeedback, setFinalFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const constraintsText = (data.constraints || []).map((c, i) => `${i + 1}. ${c}`).join("\n");

  const getAIFeedback = async (phaseType: string) => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("lab-feedback", {
        body: {
          scenario: data.scenario,
          constraints: constraintsText,
          decision_prompt: data.decision_prompt,
          student_response: response,
          twist: data.twist,
          twist_response: phaseType === "twist" || phaseType === "reflection" ? twistResponse : undefined,
          reflection_response: phaseType === "reflection" ? reflectionResponse : undefined,
        },
      });

      if (error) throw error;
      return result.feedback as Feedback;
    } catch (e: any) {
      toast({ title: "Feedback Error", description: e.message || "Could not get AI feedback", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!response.strategy.trim() || !response.core_assumption.trim() || !response.biggest_risk.trim()) {
      toast({ title: "Complete all fields", description: "Fill in Strategy, Core Assumption, and Biggest Risk", variant: "destructive" });
      return;
    }
    const fb = await getAIFeedback("initial");
    if (fb) { setFeedback(fb); setPhase("feedback"); }
  };

  const handleSubmitTwist = async () => {
    if (!twistResponse.trim()) {
      toast({ title: "Response required", description: "Describe how you'd adapt your strategy", variant: "destructive" });
      return;
    }
    const fb = await getAIFeedback("twist");
    if (fb) { setTwistFeedback(fb); setPhase("twist_feedback"); }
  };

  const handleSubmitReflection = async () => {
    if (!reflectionResponse.trim()) {
      toast({ title: "Response required", description: "Answer the reflection question", variant: "destructive" });
      return;
    }
    const fb = await getAIFeedback("reflection");
    if (fb) { setFinalFeedback(fb); setPhase("final"); }
  };

  const reset = () => {
    setPhase("scenario");
    setResponse({ strategy: "", core_assumption: "", biggest_risk: "" });
    setTwistResponse("");
    setReflectionResponse("");
    setFeedback(null);
    setTwistFeedback(null);
    setFinalFeedback(null);
  };

  const tierLabel = data.difficulty_tier === 3 ? "Strategic Tradeoffs" : data.difficulty_tier === 2 ? "Constrained" : "Core Clarity";
  const tierColor = data.difficulty_tier === 3 ? "text-red-400" : data.difficulty_tier === 2 ? "text-yellow-400" : "text-green-400";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="border-primary/40 text-primary">
          <Brain className="w-3 h-3 mr-1" /> Decision Lab
        </Badge>
        {data.difficulty_tier && (
          <Badge variant="outline" className={tierColor}>
            Tier {data.difficulty_tier}: {tierLabel}
          </Badge>
        )}
        {data.variables && Object.entries(data.variables).length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {Object.entries(data.variables).map(([key, v]) => (
              <Badge key={key} variant="secondary" className="text-xs">
                {v.label}: {v.value}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Phase: Scenario */}
      {phase === "scenario" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">Scenario</h3>
            </div>
            <p className="text-sm leading-relaxed">{data.scenario}</p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold text-sm">Constraints</span>
              </div>
              {data.constraints.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground pl-6">
                  <span className="text-yellow-500 font-bold">{i + 1}.</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-sm font-medium">{data.decision_prompt}</p>
            </div>

            <Button onClick={() => setPhase("respond")} className="w-full">
              Begin Response <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Respond */}
      {phase === "respond" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Your Strategy
            </h3>

            <div className="space-y-1">
              <label className="text-sm font-medium">Strategy <span className="text-muted-foreground">(max 3 sentences)</span></label>
              <Textarea
                placeholder="Describe your strategic approach..."
                value={response.strategy}
                onChange={(e) => setResponse({ ...response, strategy: e.target.value })}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Core Assumption <span className="text-muted-foreground">(1 sentence)</span></label>
              <Textarea
                placeholder="What is the one thing you're assuming to be true?"
                value={response.core_assumption}
                onChange={(e) => setResponse({ ...response, core_assumption: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Biggest Risk <span className="text-muted-foreground">(1 sentence)</span></label>
              <Textarea
                placeholder="What could go most wrong with your approach?"
                value={response.biggest_risk}
                onChange={(e) => setResponse({ ...response, biggest_risk: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>

            <Button onClick={handleSubmitResponse} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <>Submit for Critique <Sparkles className="w-4 h-4 ml-1" /></>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Feedback */}
      {phase === "feedback" && feedback && (
        <div className="space-y-4">
          <FeedbackCard feedback={feedback} title="Initial Strategy Critique" />
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold">🔄 TWIST</h3>
              </div>
              <p className="text-sm">{data.twist}</p>
              <p className="text-sm font-medium text-muted-foreground">Your original strategy may no longer work. How do you adapt?</p>
            </CardContent>
          </Card>
          <Button onClick={() => setPhase("twist")} className="w-full">
            Adapt Strategy <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Phase: Twist Response */}
      {phase === "twist" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Adapted Strategy
            </h3>
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <strong>Twist:</strong> {data.twist}
            </div>
            <Textarea
              placeholder="How do you adapt your strategy given this new constraint?"
              value={twistResponse}
              onChange={(e) => setTwistResponse(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <Button onClick={handleSubmitTwist} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <>Submit Adaptation <Sparkles className="w-4 h-4 ml-1" /></>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Twist Feedback */}
      {phase === "twist_feedback" && twistFeedback && (
        <div className="space-y-4">
          <FeedbackCard feedback={twistFeedback} title="Adaptation Critique" />
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold">Final Reflection</h3>
              </div>
              <p className="text-sm font-medium">{data.reflection_question}</p>
            </CardContent>
          </Card>
          <Button onClick={() => setPhase("reflection")} className="w-full">
            Reflect <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Phase: Reflection */}
      {phase === "reflection" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-500" />
              Reflection
            </h3>
            <p className="text-sm text-muted-foreground">{data.reflection_question}</p>
            <Textarea
              placeholder="Your reflection..."
              value={reflectionResponse}
              onChange={(e) => setReflectionResponse(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <Button onClick={handleSubmitReflection} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Final Analysis...</> : <>Complete Lab <Sparkles className="w-4 h-4 ml-1" /></>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase: Final */}
      {phase === "final" && finalFeedback && (
        <div className="space-y-4">
          <FeedbackCard feedback={finalFeedback} title="Overall Performance" isFinal />
          {feedback && twistFeedback && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Score Progression
                </h3>
                <div className="flex items-center gap-4">
                  <ScorePill label="Strategy" score={feedback.score} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <ScorePill label="Adaptation" score={twistFeedback.score} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <ScorePill label="Final" score={finalFeedback.score} />
                </div>
              </CardContent>
            </Card>
          )}
          <Button variant="outline" onClick={reset} className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" /> Replay Lab
          </Button>
        </div>
      )}
    </div>
  );
}

/* ===== SUB-COMPONENTS ===== */

function ScorePill({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "bg-green-500/20 text-green-400" : score >= 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400";
  return (
    <div className={`rounded-full px-3 py-1 text-sm font-medium ${color}`}>
      {label}: {score}
    </div>
  );
}

function FeedbackCard({ feedback, title, isFinal }: { feedback: Feedback; title: string; isFinal?: boolean }) {
  const gradeColor = feedback.score >= 70 ? "text-green-400 border-green-500/30" : feedback.score >= 50 ? "text-yellow-400 border-yellow-500/30" : "text-red-400 border-red-500/30";

  return (
    <Card className={isFinal ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{title}</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={gradeColor}>
              {feedback.grade}
            </Badge>
            <Badge variant="outline" className={gradeColor}>
              {feedback.score}/100
            </Badge>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{feedback.critique}</p>

        {feedback.strengths.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-green-400 uppercase">Strengths</span>
            {feedback.strengths.map((s, i) => (
              <p key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-green-500/30">{s}</p>
            ))}
          </div>
        )}

        {feedback.weaknesses.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-red-400 uppercase">Weaknesses</span>
            {feedback.weaknesses.map((w, i) => (
              <p key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-red-500/30">{w}</p>
            ))}
          </div>
        )}

        <div className="bg-muted/50 rounded-lg p-3">
          <span className="text-xs font-semibold text-primary uppercase">💡 Coaching Tip</span>
          <p className="text-sm mt-1">{feedback.coaching_tip}</p>
        </div>
      </CardContent>
    </Card>
  );
}
