import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Trophy, CheckCircle2, Target, BookOpen, Lightbulb, FileText, Eye, EyeOff } from "lucide-react";
import InteractiveLab from "@/components/labs/InteractiveLab";
import { ChallengeComments } from "@/components/challenges/ChallengeComments";
import { usePoints } from "@/hooks/usePoints";
import { useToast } from "@/hooks/use-toast";

export default function ChallengeView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState<number[]>([]);
  const { completeChallenge, completedChallenges } = usePoints();
  const { toast } = useToast();

  const isCompleted = challenge ? completedChallenges.includes(challenge.id) : false;

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

  const handleLabComplete = () => {
    if (!challenge || isCompleted) return;
    completeChallenge(challenge.id, challenge.is_daily);
    toast({ title: "Challenge completed! 🎉", description: `+${challenge.is_daily ? 100 : 50} points earned!` });
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
            {isCompleted && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">{challenge.description}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {challenge.difficulty && (
            <Badge variant="outline" className={`capitalize text-xs ${
              challenge.difficulty === "easy" ? "text-green-400 border-green-400/30" :
              challenge.difficulty === "hard" ? "text-red-400 border-red-400/30" :
              "text-yellow-400 border-yellow-400/30"
            }`}>
              {challenge.difficulty}
            </Badge>
          )}
          {challenge.lab_type && (
            <Badge variant="outline" className="capitalize text-xs">
              {challenge.lab_type.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
      </div>

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
      {challenge.lab_data && challenge.lab_type ? (
        <InteractiveLab
          labType={challenge.lab_type}
          labData={challenge.lab_data}
          labTitle={challenge.title}
          labDescription={challenge.description}
          onComplete={handleLabComplete}
          isCompleted={isCompleted}
        />
      ) : (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Trophy className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Text-based challenge — complete it below.</p>
            {!isCompleted && (
              <Button onClick={handleLabComplete}>Mark as Complete (+50 pts)</Button>
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
