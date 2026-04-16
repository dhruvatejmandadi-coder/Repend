import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Trophy, CheckCircle2, Target, BookOpen, Lightbulb, FileText, Eye, EyeOff, Send, FlaskConical, UserPlus, Play, RefreshCw } from "lucide-react";
import InteractiveLab from "@/components/labs/InteractiveLab";
import { ChallengeComments } from "@/components/challenges/ChallengeComments";
import { usePoints } from "@/hooks/usePoints";
import { useChallenges } from "@/hooks/useChallenges";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ChallengeView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState<number[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { completeChallenge: completePoints, completedChallenges: localCompleted } = usePoints();
  const { joinChallenge, completeChallenge: dbComplete, isJoined, isCompleted, getCompletedDate, refetch } = useChallenges();
  const { user } = useAuth();
  const { toast } = useToast();

  const joined = id ? isJoined(id) : false;
  const completed = id ? isCompleted(id) : false;
  const completedDate = id ? getCompletedDate(id) : null;

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) setChallenge(data);
      setLoading(false);
    })();
  }, [id]);

  const handleRegenerateLab = async () => {
    if (!challenge || regenerating) return;
    setRegenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-challenge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          topic: challenge.topic || challenge.title,
          description: challenge.description || "",
          difficulty: challenge.difficulty || "medium",
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to regenerate");
      }
      const result = await resp.json();
      const { lab_type, lab_data } = result.challenge_data;
      await supabase.from("challenges").update({ lab_type, lab_data }).eq("id", challenge.id);
      setChallenge((prev: any) => ({ ...prev, lab_type, lab_data }));
      toast({ title: "Lab regenerated!", description: "A fresh interactive lab has been built." });
    } catch (error) {
      toast({ title: "Regeneration failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Create an account to join challenges.", variant: "destructive" });
      return;
    }
    if (!id) return;
    setJoining(true);
    const success = await joinChallenge(id);
    if (success) {
      toast({ title: "Joined! 🎯", description: "You're now participating in this challenge." });
    }
    setJoining(false);
  };

  const handleComplete = async () => {
    if (!challenge || !id || completed) return;
    await dbComplete(id);
    completePoints(challenge.id, challenge.is_daily);
    const pts = challenge.is_daily ? 100 : 50;
    const creatorNote = challenge.user_id && challenge.user_id !== user?.id
      ? " The creator earns +25 pts too!"
      : "";
    toast({ title: "Challenge completed! 🎉", description: `+${pts} points earned!${creatorNote}` });
  };

  const handleLabComplete = () => {
    handleComplete();
  };

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) return;
    setSubmitted(true);
    handleComplete();
  };

  const toggleHint = (i: number) => {
    setHintsRevealed((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="page-container text-center py-20">
        <h2 className="text-xl font-bold mb-2">Challenge not found</h2>
        <Button variant="outline" onClick={() => navigate("/challenges")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Challenges
        </Button>
      </div>
    );
  }

  const hints: string[] = Array.isArray(challenge.hints) ? challenge.hints : [];
  const hasLab = challenge.lab_data && challenge.lab_type;

  return (
    <div className="page-container space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/challenges")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-bold">{challenge.title}</h1>
            {completed && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
              </Badge>
            )}
            {joined && !completed && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Play className="w-3 h-3 mr-1" /> Active
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">{challenge.description}</p>
          {completed && completedDate && (
            <p className="text-xs text-green-400/70 mt-1">
              Completed on {format(new Date(completedDate), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {challenge.topic && (
            <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
              {challenge.topic}
            </Badge>
          )}
          {challenge.difficulty && (
            <Badge variant="outline" className={`capitalize text-xs ${
              challenge.difficulty === "easy" ? "text-green-400 border-green-400/30" :
              challenge.difficulty === "hard" ? "text-red-400 border-red-400/30" :
              "text-yellow-400 border-yellow-400/30"
            }`}>
              {challenge.difficulty}
            </Badge>
          )}
        </div>
      </div>

      {/* Join Banner */}
      {!joined && !completed && user && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Ready to take on this challenge?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Join to track your progress and earn points when you complete it.</p>
            </div>
            <Button onClick={handleJoin} disabled={joining}>
              {joining ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Join Challenge
            </Button>
          </CardContent>
        </Card>
      )}

      {!user && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Sign in to participate</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Create an account to join challenges, track progress, and earn points.</p>
            </div>
            <Button onClick={() => navigate("/signup")}>Sign Up</Button>
          </CardContent>
        </Card>
      )}

      {/* Objective */}
      {challenge.objective && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4" /> Objective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{challenge.objective}</p>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {challenge.instructions && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{challenge.instructions}</p>
          </CardContent>
        </Card>
      )}

      {/* Problem Statement */}
      {challenge.problem && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" /> Problem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{challenge.problem}</p>
          </CardContent>
        </Card>
      )}

      {/* Interactive Lab */}
      {hasLab ? (
        <Card className="border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FlaskConical className="w-4 h-4" /> Interactive Lab
              {user?.id === challenge.user_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 text-xs"
                  onClick={handleRegenerateLab}
                  disabled={regenerating}
                >
                  {regenerating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                  Regenerate
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InteractiveLab
              labType={challenge.lab_type}
              labData={challenge.lab_data}
              labTitle={challenge.title}
              labDescription={challenge.description}
              onComplete={handleLabComplete}
              isCompleted={completed}
              onRetryGeneration={user?.id === challenge.user_id ? handleRegenerateLab : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Send className="w-4 h-4" /> Your Answer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {submitted || completed ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <p className="font-semibold">Answer Submitted!</p>
                {userAnswer && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-left whitespace-pre-wrap">
                    {userAnswer}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Check the solution below to compare your answer.</p>
              </div>
            ) : (
              <>
                <Textarea
                  placeholder="Type your answer, explanation, or solution here..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  rows={5}
                  className="resize-y"
                />
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={!userAnswer.trim() || (!joined && !!user)}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" /> Submit Answer
                </Button>
                {!joined && user && (
                  <p className="text-xs text-muted-foreground text-center">Join the challenge first to submit your answer.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hints */}
      {hints.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> Hints
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hints.map((hint, i) => (
              <div key={i}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => toggleHint(i)}
                >
                  {hintsRevealed.includes(i) ? <Eye className="w-3.5 h-3.5 mr-2 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 mr-2 shrink-0" />}
                  {hintsRevealed.includes(i) ? hint : `Hint #${i + 1} — Click to reveal`}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Solution */}
      {(challenge.solution || challenge.solution_explanation) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Solution
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShowSolution(!showSolution)}>
                {showSolution ? "Hide" : "Show Solution"}
              </Button>
            </CardTitle>
          </CardHeader>
          {showSolution && (
            <CardContent className="space-y-3">
              {challenge.solution && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Answer</p>
                  <p className="text-sm whitespace-pre-wrap">{challenge.solution}</p>
                </div>
              )}
              {challenge.solution_explanation && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Explanation</p>
                  <p className="text-sm whitespace-pre-wrap">{challenge.solution_explanation}</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Comments */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Discussion</h2>
        <ChallengeComments challengeId={challenge.id} />
      </div>
    </div>
  );
}
