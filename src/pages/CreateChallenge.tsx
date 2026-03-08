import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft, ArrowRight, Loader2, Sparkles, Save,
  RefreshCw, PenLine, Target, BookOpen, Lightbulb,
  CheckCircle2, FileText, Search, Plus
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePoints } from "@/hooks/usePoints";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GeneratedChallenge {
  title: string;
  description: string;
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

const CHALLENGE_TYPES = [
  { value: "problem_solving", label: "Problem Solving", icon: "🧩" },
  { value: "coding", label: "Coding", icon: "💻" },
  { value: "explanation", label: "Explanation", icon: "📝" },
  { value: "multiple_choice", label: "Multiple Choice", icon: "✅" },
  { value: "lab_interactive", label: "Lab / Interactive", icon: "🔬" },
];

const DIFFICULTIES = [
  { value: "easy", label: "Easy", color: "text-green-400" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "hard", label: "Hard", color: "text-red-400" },
];

const TOPIC_SUGGESTIONS = [
  "Medical Ethics", "Data Structures", "Climate Change Policy", "Supply Chain Management",
  "Machine Learning Basics", "Financial Planning", "Public Health Systems", "Cybersecurity",
  "Constitutional Law", "Microeconomics", "Neuroscience", "Urban Planning",
];

export default function CreateChallenge() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addPoints } = usePoints();
  const { toast } = useToast();

  // Step tracking
  const [step, setStep] = useState<"input" | "generating" | "edit">("input");

  // Step 1 — Input form
  const [topic, setTopic] = useState("");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [challengeType, setChallengeType] = useState("lab_interactive");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2/3 — Generated & editable challenge
  const [challenge, setChallenge] = useState<GeneratedChallenge | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredSuggestions = searchQuery
    ? TOPIC_SUGGESTIONS.filter((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
    : TOPIC_SUGGESTIONS;

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (!user) {
      toast({ title: "Sign in required", description: "Create an account to generate challenges.", variant: "destructive" });
      return;
    }

    setStep("generating");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-challenge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          topic: topic.trim(),
          skill: skill.trim(),
          difficulty,
          challenge_type: challengeType,
          extra_prompt: extraPrompt.trim(),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate challenge");
      }

      const result = await resp.json();
      setChallenge(result.challenge_data);
      setStep("edit");
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate challenge",
        variant: "destructive",
      });
      setStep("input");
    }
  };

  const handleRegenerate = () => {
    setChallenge(null);
    handleGenerate();
  };

  const updateField = (field: keyof GeneratedChallenge, value: any) => {
    if (!challenge) return;
    setChallenge({ ...challenge, [field]: value });
  };

  const updateHint = (index: number, value: string) => {
    if (!challenge) return;
    const hints = [...challenge.hints];
    hints[index] = value;
    setChallenge({ ...challenge, hints });
  };

  const handleSave = async () => {
    if (!challenge || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("challenges").insert({
        title: challenge.title,
        description: challenge.description,
        objective: challenge.objective,
        instructions: challenge.instructions,
        problem: challenge.problem,
        hints: challenge.hints,
        solution: challenge.solution,
        solution_explanation: challenge.solution_explanation,
        lab_type: challenge.lab_type,
        lab_data: challenge.lab_data,
        difficulty: challenge.difficulty,
        challenge_type: challenge.challenge_type,
        user_id: user.id,
        is_daily: false,
      });

      if (error) throw error;

      addPoints(50, "create_challenge");
      toast({ title: "Challenge saved! 🎯", description: "+50 points earned for creating a challenge!" });
      navigate("/challenges");
    } catch (error) {
      toast({ title: "Save failed", description: "Could not save the challenge.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── STEP: INPUT ───
  if (step === "input") {
    return (
      <div className="page-container max-w-3xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/challenges")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Create a Challenge</h1>
            <p className="text-muted-foreground text-sm">Describe what you want — AI will generate it for you.</p>
          </div>
        </div>

        {/* Topic search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-accent" /> Search Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search for a topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent/20 hover:border-accent/40 transition-colors text-xs"
                  onClick={() => { setTopic(s); setSearchQuery(""); }}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main form */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="topic">Challenge Topic *</Label>
              <Input
                id="topic"
                placeholder="e.g. Medical Ethics in Emergency Triage"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill">Skill or Concept Being Tested</Label>
              <Input
                id="skill"
                placeholder="e.g. Decision-making under pressure, ethical reasoning"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Difficulty Level</Label>
              <RadioGroup value={difficulty} onValueChange={setDifficulty} className="flex gap-4">
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

            <div className="space-y-2">
              <Label>Challenge Type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CHALLENGE_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setChallengeType(ct.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all text-left ${
                      challengeType === ct.value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <span className="text-lg">{ct.icon}</span>
                    <span className="font-medium">{ct.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra">Additional Instructions (Optional)</Label>
              <Textarea
                id="extra"
                placeholder="e.g. Focus on real-world scenarios, include a case study..."
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                rows={3}
              />
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
              <p className="text-xs text-muted-foreground/60 text-center">Sign in to create and save challenges.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── STEP: GENERATING ───
  if (step === "generating") {
    return (
      <div className="page-container flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-accent animate-pulse" />
        </div>
        <h2 className="font-display text-xl font-bold">Generating Your Challenge...</h2>
        <p className="text-muted-foreground text-sm max-w-sm text-center">
          AI is crafting an interactive challenge about <span className="text-accent font-medium">{topic}</span>
        </p>
      </div>
    );
  }

  // ─── STEP: EDIT ───
  if (!challenge) return null;

  return (
    <div className="page-container max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep("input")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Edit Challenge</h1>
            <p className="text-muted-foreground text-sm">Review and customize your AI-generated challenge.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="capitalize">{challenge.difficulty}</Badge>
          <Badge variant="outline" className="capitalize">{challenge.challenge_type.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      {/* Title & Description */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <PenLine className="w-4 h-4" /> Title & Description
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={challenge.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="text-lg font-semibold"
            placeholder="Challenge title"
          />
          <Textarea
            value={challenge.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={2}
            placeholder="Short description"
          />
        </CardContent>
      </Card>

      {/* Objective */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <Target className="w-4 h-4" /> Objective
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={challenge.objective}
            onChange={(e) => updateField("objective", e.target.value)}
            rows={2}
            placeholder="What the learner should practice"
          />
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={challenge.instructions}
            onChange={(e) => updateField("instructions", e.target.value)}
            rows={3}
            placeholder="Step-by-step instructions"
          />
        </CardContent>
      </Card>

      {/* Problem Statement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" /> Problem Statement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={challenge.problem}
            onChange={(e) => updateField("problem", e.target.value)}
            rows={4}
            placeholder="The actual challenge problem"
          />
        </CardContent>
      </Card>

      {/* Difficulty (editable) */}
      <Card>
        <CardContent className="pt-6">
          <Label className="mb-3 block">Difficulty</Label>
          <RadioGroup value={challenge.difficulty} onValueChange={(v) => updateField("difficulty", v)} className="flex gap-4">
            {DIFFICULTIES.map((d) => (
              <div key={d.value} className="flex items-center gap-2">
                <RadioGroupItem value={d.value} id={`edit-diff-${d.value}`} />
                <Label htmlFor={`edit-diff-${d.value}`} className={`cursor-pointer ${d.color}`}>{d.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Hints */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Hints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {challenge.hints.map((hint, i) => (
            <div key={i} className="flex items-start gap-2">
              <Badge variant="outline" className="mt-2 shrink-0 text-xs">#{i + 1}</Badge>
              <Textarea
                value={hint}
                onChange={(e) => updateHint(i, e.target.value)}
                rows={1}
                className="min-h-[40px]"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Solution & Explanation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Solution & Explanation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Expected Answer / Solution</Label>
            <Textarea
              value={challenge.solution}
              onChange={(e) => updateField("solution", e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Explanation</Label>
            <Textarea
              value={challenge.solution_explanation}
              onChange={(e) => updateField("solution_explanation", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lab preview info */}
      {challenge.lab_type && challenge.lab_data && (
        <Card className="border-accent/20 bg-accent/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <span className="text-2xl">🔬</span>
            <div>
              <p className="font-semibold text-sm">Interactive Lab Attached</p>
              <p className="text-xs text-muted-foreground capitalize">
                Type: {challenge.lab_type.replace(/_/g, " ")} — This lab will be playable when users open the challenge.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button variant="hero" className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Challenge
        </Button>
        <Button variant="outline" onClick={handleRegenerate}>
          <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
        </Button>
      </div>
    </div>
  );
}
