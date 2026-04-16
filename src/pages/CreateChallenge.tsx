import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft, Loader2, Sparkles, Save, RefreshCw,
  CheckCircle2, FlaskConical, Eye, EyeOff,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePoints } from "@/hooks/usePoints";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import InteractiveLab from "@/components/labs/InteractiveLab";

interface GeneratedChallenge {
  title: string;
  description: string;
  topic: string;
  objective: string;
  instructions: string;
  problem: string;
  hints: string[];
  solution: string;
  solution_explanation: string;
  lab_type: string;
  lab_data: any;
  difficulty: string;
  challenge_type: string;
}

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "text-green-400 border-green-400/30 bg-green-400/10",
  medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  hard: "text-red-400 border-red-400/30 bg-red-400/10",
};

const DIFFICULTIES = [
  { value: "easy", label: "Easy", color: "text-green-400" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "hard", label: "Hard", color: "text-red-400" },
];

const TOPIC_SUGGESTIONS = [
  "Medical Ethics", "Supply & Demand", "Climate Policy", "Sorting Algorithms",
  "DNA Replication", "World War II", "Cybersecurity", "Personal Finance",
  "Constitutional Law", "Neuroscience", "Urban Planning", "Music Theory",
];

const GENERATION_STEPS = [
  "Analyzing topic",
  "Choosing activity format",
  "Building interactive lab",
  "Writing challenge content",
  "Finalizing",
];

export default function CreateChallenge() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addPoints } = usePoints();
  const { toast } = useToast();

  const [step, setStep] = useState<"input" | "generating" | "edit">("input");
  const [generationStep, setGenerationStep] = useState(0);

  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  const [challenge, setChallenge] = useState<GeneratedChallenge | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLabPreview, setShowLabPreview] = useState(true);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (!user) {
      toast({ title: "Sign in required", description: "Create an account to post challenges.", variant: "destructive" });
      return;
    }

    setStep("generating");
    setGenerationStep(0);

    const stepInterval = setInterval(() => {
      setGenerationStep((prev) => Math.min(prev + 1, GENERATION_STEPS.length - 1));
    }, 2500);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-challenge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          topic: topic.trim(),
          description: description.trim(),
          difficulty,
        }),
      });

      clearInterval(stepInterval);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate challenge");
      }

      const result = await resp.json();
      setChallenge(result.challenge_data);
      setStep("edit");
    } catch (error) {
      clearInterval(stepInterval);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate challenge",
        variant: "destructive",
      });
      setStep("input");
    }
  };

  const handleSave = async () => {
    if (!challenge || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("challenges").insert({
        title: challenge.title,
        description: challenge.description,
        topic: challenge.topic,
        objective: challenge.objective,
        instructions: challenge.instructions,
        problem: challenge.problem,
        hints: challenge.hints,
        solution: challenge.solution,
        solution_explanation: challenge.solution_explanation,
        lab_type: challenge.lab_type,
        lab_data: challenge.lab_data,
        difficulty: challenge.difficulty,
        challenge_type: challenge.challenge_type || "lab_interactive",
        user_id: user.id,
        is_daily: false,
      });

      if (error) throw error;

      addPoints(50, "create_challenge");
      toast({ title: "Challenge posted! 🎯", description: "+50 pts — earn more every time someone solves it!" });
      navigate("/challenges");
    } catch {
      toast({ title: "Save failed", description: "Could not save the challenge.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── INPUT ───
  if (step === "input") {
    return (
      <div className="page-container max-w-2xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/challenges")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Post a Challenge</h1>
            <p className="text-muted-foreground text-sm">
              Describe the topic — Claude builds the interactive lab automatically.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Topic suggestions */}
            <div className="space-y-2">
              <Label>Topic *</Label>
              <Input
                placeholder="e.g. Supply and Demand, DNA Replication, Sorting Algorithms..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TOPIC_SUGGESTIONS.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent/20 hover:border-accent/40 transition-colors text-[11px]"
                    onClick={() => setTopic(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="desc"
                placeholder="Give more context to help Claude build a better challenge..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <RadioGroup value={difficulty} onValueChange={setDifficulty} className="flex gap-5">
                {DIFFICULTIES.map((d) => (
                  <div key={d.value} className="flex items-center gap-2">
                    <RadioGroupItem value={d.value} id={`diff-${d.value}`} />
                    <Label htmlFor={`diff-${d.value}`} className={`cursor-pointer ${d.color}`}>
                      {d.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Button
              variant="hero"
              className="w-full"
              onClick={handleGenerate}
              disabled={!topic.trim()}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Challenge
            </Button>

            {!user && (
              <p className="text-xs text-muted-foreground/60 text-center">Sign in to post challenges.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── GENERATING ───
  if (step === "generating") {
    return (
      <div className="page-container flex flex-col items-center justify-center h-[60vh] gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
            <FlaskConical className="w-9 h-9 text-accent" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-accent animate-bounce" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="font-display text-xl font-bold">Building your challenge...</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Claude is picking the best interactive format for{" "}
            <span className="text-accent font-medium">{topic}</span>
          </p>
        </div>
        <div className="w-full max-w-sm space-y-2">
          {GENERATION_STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all duration-500 ${
                i < generationStep
                  ? "text-accent bg-accent/5"
                  : i === generationStep
                  ? "text-foreground bg-accent/10 font-medium"
                  : "text-muted-foreground/40"
              }`}
            >
              {i < generationStep ? (
                <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
              ) : i === generationStep ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-muted-foreground/20 shrink-0" />
              )}
              {s}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── EDIT ───
  if (!challenge) return null;

  const hasLab = challenge.lab_type && challenge.lab_data && Object.keys(challenge.lab_data).length > 0;

  return (
    <div className="page-container max-w-3xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep("input")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold">Review Challenge</h1>
            <p className="text-muted-foreground text-sm">
              Claude built a{" "}
              <span className="text-accent capitalize">{challenge.lab_type?.replace(/_/g, " ")}</span>
              {" "}lab for <span className="text-foreground font-medium">{topic}</span>
            </p>
          </div>
        </div>
        <Badge variant="outline" className={`capitalize ${DIFFICULTY_STYLES[challenge.difficulty] ?? ""}`}>
          {challenge.difficulty}
        </Badge>
      </div>

      {/* Lab Preview */}
      {hasLab && (
        <Card className="border-accent/20">
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-border/40 cursor-pointer"
            onClick={() => setShowLabPreview(!showLabPreview)}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className="w-4 h-4 text-accent" />
              Interactive Lab Preview
              <Badge variant="outline" className="capitalize text-[11px] ml-1">
                {challenge.lab_type?.replace(/_/g, " ")}
              </Badge>
            </span>
            <Button variant="ghost" size="sm">
              {showLabPreview ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              {showLabPreview ? "Hide" : "Show"}
            </Button>
          </div>
          {showLabPreview && (
            <CardContent className="pt-4">
              <InteractiveLab
                labType={challenge.lab_type}
                labData={challenge.lab_data}
                labTitle={challenge.title}
                labDescription={challenge.description}
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* Challenge info (read-only summary) */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Title</p>
            <p className="font-semibold">{challenge.title}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-muted-foreground">{challenge.description}</p>
          </div>
          {challenge.topic && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Topic tag</p>
              <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10 text-[11px]">
                {challenge.topic}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="hero" className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Post Challenge
        </Button>
        <Button variant="outline" onClick={() => { setChallenge(null); handleGenerate(); }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
        </Button>
      </div>
    </div>
  );
}
