import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { DailyChallengeCard } from "@/components/challenges/DailyChallengeCard";
import { useChallenges } from "@/hooks/useChallenges";
import { usePoints } from "@/hooks/usePoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Challenges() {
  const [activeTab, setActiveTab] = useState("my");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const { dailyChallenge, myChallenges, communityChallenges, loading, refetch } = useChallenges();
  const { completedChallenges } = usePoints();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;

    if (!user) {
      toast({ title: "Sign in required", description: "Create an account to generate challenges.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-challenge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate challenge");
      }

      setPrompt("");
      toast({ title: "Challenge created! 🎯", description: "Your personalized challenge is ready." });
      refetch();
      setActiveTab("my");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate challenge",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("challenges").delete().eq("id", id);
    toast({ title: "Challenge deleted" });
    refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="page-container space-y-8">
        {/* Header + Generator */}
        <div className="max-w-2xl mx-auto text-center pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/[0.08] border border-accent/15 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-[13px] font-medium text-accent/90">AI-Powered Challenges</span>
          </div>
          <h1 className="font-display text-3xl font-bold mb-3">
            Create Your <span className="gradient-text">Challenge</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Tell the AI what you want to practice — it'll generate a personalized, hands-on challenge for you.
          </p>

          {/* Generator */}
          <div className="flex flex-col sm:flex-row gap-2.5 max-w-lg mx-auto">
            <Input
              placeholder="e.g. Build a REST API, CSS animations, data structures..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              disabled={generating}
              className="flex-1"
            />
            <Button variant="hero" onClick={handleGenerate} disabled={!prompt.trim() || generating}>
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Generate
                </>
              )}
            </Button>
          </div>

          {!user && (
            <p className="text-xs text-muted-foreground/60 mt-3">Sign in to create and save challenges.</p>
          )}
        </div>

        {/* Daily Challenge */}
        {dailyChallenge && <DailyChallengeCard challenge={dailyChallenge} />}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mx-auto">
            <TabsTrigger value="my" className="text-[13px]">My Challenges</TabsTrigger>
            <TabsTrigger value="community" className="text-[13px]">Community</TabsTrigger>
            <TabsTrigger value="completed" className="text-[13px]">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="my" className="mt-6">
            {myChallenges.length === 0 ? (
              <Card className="border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="w-10 h-10 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-sm mb-1">No challenges yet</h3>
                  <p className="text-muted-foreground text-[13px]">Generate your first personalized challenge above!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myChallenges.map((challenge) => (
                  <div key={challenge.id} className="relative group">
                    <ChallengeCard challenge={challenge} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(challenge.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="community" className="mt-6">
            {communityChallenges.length === 0 ? (
              <Card className="border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Trophy className="w-10 h-10 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-sm mb-1">No community challenges</h3>
                  <p className="text-muted-foreground text-[13px]">Check back soon for community challenges!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {communityChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {(() => {
              const allChallenges = [...myChallenges, ...communityChallenges];
              const completed = allChallenges.filter((c) => completedChallenges.includes(c.id));
              return completed.length === 0 ? (
                <Card className="border-dashed border-border/50">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Star className="w-10 h-10 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-sm mb-1">No completed challenges</h3>
                    <p className="text-muted-foreground text-[13px]">Complete your first challenge to see it here!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completed.map((challenge) => (
                    <ChallengeCard key={challenge.id} challenge={challenge} />
                  ))}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
