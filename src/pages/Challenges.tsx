import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Star, Loader2, Plus, Sparkles, Trash2, Search, Play,
  Zap, ArrowRight, CheckCircle2, Clock
} from "lucide-react";
import { DailyChallengeCard } from "@/components/challenges/DailyChallengeCard";
import { useChallenges } from "@/hooks/useChallenges";
import { usePoints } from "@/hooks/usePoints";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Challenge } from "@/hooks/useChallenges";
import { formatDistanceToNow } from "date-fns";

function ChallengeCardEnhanced({ challenge, onDelete, showDelete }: { challenge: Challenge; onDelete?: (id: string) => void; showDelete?: boolean }) {
  const navigate = useNavigate();
  const { completedChallenges } = usePoints();
  const isCompleted = completedChallenges.includes(challenge.id);
  const labLabel = challenge.lab_type?.replace(/_/g, " ") ?? null;

  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(challenge.created_at), { addSuffix: true }); }
    catch { return ""; }
  })();

  const labColors: Record<string, string> = {
    simulation: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    classification: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    ethical_dilemma: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    policy_optimization: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    decision_lab: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  };

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group hover:border-primary/30 hover:-translate-y-0.5 relative"
      onClick={() => navigate(`/challenges/${challenge.id}`)}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/60 to-accent/60" />

      <CardContent className="p-5 space-y-3">
        {/* Top row: badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {labLabel && (
            <Badge variant="outline" className={`capitalize text-[11px] px-2 py-0.5 ${labColors[challenge.lab_type || ""] || "bg-muted text-muted-foreground"}`}>
              {labLabel}
            </Badge>
          )}
          {isCompleted && (
            <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[11px] px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Done
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {challenge.title}
        </h3>

        {/* Description */}
        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
          {challenge.description}
        </p>

        {/* Footer: author + time */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Avatar className="w-5 h-5">
              <AvatarImage src={challenge.author_avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                {(challenge.author_name || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
              {challenge.author_name || "Anonymous"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          {isCompleted ? "View challenge" : "Start challenge"} <ArrowRight className="w-3 h-3" />
        </div>
      </CardContent>

      {/* Delete button */}
      {showDelete && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive z-10"
          onClick={(e) => { e.stopPropagation(); onDelete(challenge.id); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <Card className="border-dashed border-border/40 bg-card/50">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted-foreground/30" />
        </div>
        <h3 className="font-display font-semibold text-sm mb-1">{title}</h3>
        <p className="text-muted-foreground text-[13px] max-w-xs">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function Challenges() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("my");
  const [searchQuery, setSearchQuery] = useState("");
  const { dailyChallenge, myChallenges, activeChallenges, loading, refetch } = useChallenges();
  const { completedChallenges } = usePoints();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    await supabase.from("challenges").delete().eq("id", id);
    toast({ title: "Challenge deleted" });
    refetch();
  };

  const filterBySearch = (challenges: Challenge[]) => {
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

  const allForCompleted = [...myChallenges, ...activeChallenges];
  const completedList = filterBySearch(allForCompleted.filter((c) => completedChallenges.includes(c.id)));

  return (
    <div className="page-container space-y-8 pb-12">
      {/* Hero Header */}
      <div className="relative max-w-3xl mx-auto text-center pt-4">
        {/* Glow effect */}
        <div className="absolute inset-0 -top-8 bg-gradient-to-b from-primary/5 via-transparent to-transparent rounded-3xl blur-2xl pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/[0.08] border border-accent/15 mb-5">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="text-[13px] font-medium text-accent/90">AI-Powered Challenges</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
            Test Your Skills with{" "}
            <span className="gradient-text">Interactive Challenges</span>
          </h1>

          <p className="text-muted-foreground text-sm mb-8 max-w-lg mx-auto leading-relaxed">
            Generate AI-crafted challenges on any topic — from ethical dilemmas to policy simulations.
            Practice, learn, and earn points.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="hero" size="lg" onClick={() => navigate("/challenges/create")} className="px-8">
              <Sparkles className="w-4 h-4 mr-2" />
              Create a Challenge
            </Button>
            <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> +50 pts per challenge</span>
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> 5 lab types</span>
            </div>
          </div>

          {!user && (
            <p className="text-xs text-muted-foreground/50 mt-4">Sign in to create and save challenges.</p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md mx-auto relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <Input
          placeholder="Search by topic, title, or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card/60 border-border/40"
        />
      </div>

      {/* Daily Challenge */}
      {dailyChallenge && <DailyChallengeCard challenge={dailyChallenge} />}

      {/* Stats bar */}
      {user && (myChallenges.length > 0 || activeChallenges.length > 0) && (
        <div className="flex items-center justify-center gap-6 text-[13px]">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-semibold text-foreground">{myChallenges.length}</span> Created
          </div>
          <div className="w-px h-4 bg-border/40" />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-semibold text-foreground">{activeChallenges.length}</span> Active
          </div>
          <div className="w-px h-4 bg-border/40" />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-semibold text-foreground">{completedList.length}</span> Completed
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-3 mx-auto">
          <TabsTrigger value="my" className="text-[13px]">Created</TabsTrigger>
          <TabsTrigger value="active" className="text-[13px]">Active</TabsTrigger>
          <TabsTrigger value="completed" className="text-[13px]">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-6">
          {filterBySearch(myChallenges).length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={searchQuery ? "No matching challenges" : "No challenges created yet"}
              description={searchQuery ? "Try a different search term." : "Create your first AI-powered challenge and start practicing!"}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filterBySearch(myChallenges).map((c) => (
                <ChallengeCardEnhanced key={c.id} challenge={c} onDelete={handleDelete} showDelete />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          {filterBySearch(activeChallenges).length === 0 ? (
            <EmptyState
              icon={Play}
              title="No active challenges"
              description="Join a challenge to track your progress here!"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filterBySearch(activeChallenges).map((c) => (
                <ChallengeCardEnhanced key={c.id} challenge={c} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedList.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No completed challenges"
              description="Complete your first challenge to earn points and see it here!"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completedList.map((c) => (
                <ChallengeCardEnhanced key={c.id} challenge={c} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
