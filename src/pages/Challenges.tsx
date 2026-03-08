import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Loader2, Plus, Sparkles, Trash2, Search } from "lucide-react";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { DailyChallengeCard } from "@/components/challenges/DailyChallengeCard";
import { useChallenges } from "@/hooks/useChallenges";
import { usePoints } from "@/hooks/usePoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Challenges() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("my");
  const [searchQuery, setSearchQuery] = useState("");
  const { dailyChallenge, myChallenges, communityChallenges, loading, refetch } = useChallenges();
  const { completedChallenges } = usePoints();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    await supabase.from("challenges").delete().eq("id", id);
    toast({ title: "Challenge deleted" });
    refetch();
  };

  const filterBySearch = (challenges: typeof myChallenges) => {
    if (!searchQuery.trim()) return challenges;
    const q = searchQuery.toLowerCase();
    return challenges.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-8">
      {/* Header */}
      <div className="max-w-2xl mx-auto text-center pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/[0.08] border border-accent/15 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span className="text-[13px] font-medium text-accent/90">AI-Powered Challenges</span>
        </div>
        <h1 className="font-display text-3xl font-bold mb-3">
          Interactive <span className="gradient-text">Challenges</span>
        </h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
          Create custom AI-generated challenges, edit them, and practice hands-on skills.
        </p>

        <Button variant="hero" size="lg" onClick={() => navigate("/challenges/create")}>
          <Plus className="w-4 h-4 mr-2" />
          Create Challenge
        </Button>

        {!user && (
          <p className="text-xs text-muted-foreground/60 mt-3">Sign in to create and save challenges.</p>
        )}
      </div>

      {/* Search */}
      <div className="max-w-lg mx-auto relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search challenges by topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
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
          {filterBySearch(myChallenges).length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Sparkles className="w-10 h-10 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-sm mb-1">
                  {searchQuery ? "No matching challenges" : "No challenges yet"}
                </h3>
                <p className="text-muted-foreground text-[13px]">
                  {searchQuery ? "Try a different search term." : "Create your first challenge!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filterBySearch(myChallenges).map((challenge) => (
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
          {filterBySearch(communityChallenges).length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Trophy className="w-10 h-10 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-sm mb-1">No community challenges</h3>
                <p className="text-muted-foreground text-[13px]">Check back soon!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filterBySearch(communityChallenges).map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {(() => {
            const all = [...myChallenges, ...communityChallenges];
            const completed = filterBySearch(all.filter((c) => completedChallenges.includes(c.id)));
            return completed.length === 0 ? (
              <Card className="border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Star className="w-10 h-10 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-sm mb-1">No completed challenges</h3>
                  <p className="text-muted-foreground text-[13px]">Complete your first challenge!</p>
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
  );
}
