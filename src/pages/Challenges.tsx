import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2, Plus, Sparkles, Trash2, Search, Play,
  Zap, ArrowRight, CheckCircle2, Clock, Trophy,
  Users, Target, Flame,
} from "lucide-react";
import { DailyChallengeCard } from "@/components/challenges/DailyChallengeCard";
import { Leaderboard } from "@/components/challenges/Leaderboard";
import { useChallenges } from "@/hooks/useChallenges";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Challenge } from "@/hooks/useChallenges";
import { formatDistanceToNow, format } from "date-fns";

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "text-green-400 border-green-400/30 bg-green-400/10",
  medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  hard: "text-red-400 border-red-400/30 bg-red-400/10",
};

const POINTS_REWARD = 50;

function FeedCard({
  challenge,
  isJoined,
  isCompleted,
  onJoin,
}: {
  challenge: Challenge;
  isJoined: boolean;
  isCompleted: boolean;
  onJoin: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);

  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(challenge.created_at), { addSuffix: true }); }
    catch { return ""; }
  })();

  const handleJoin = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setJoining(true);
    await onJoin(challenge.id);
    setJoining(false);
    navigate(`/challenges/${challenge.id}`);
  };

  return (
    <Card
      className="overflow-hidden transition-all duration-300 cursor-pointer group hover:border-primary/30"
      style={{ transformStyle: "preserve-3d", perspective: "800px" }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        e.currentTarget.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(8px)`;
        e.currentTarget.style.boxShadow = `${-x * 16}px ${y * 16}px 32px rgba(0,0,0,0.25)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "rotateY(0deg) rotateX(0deg) translateZ(0px)";
        e.currentTarget.style.boxShadow = "";
      }}
      onClick={() => navigate(`/challenges/${challenge.id}`)}
    >
      <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-accent/60 to-primary/40" />

      <CardContent className="p-5 space-y-3">
        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          {challenge.topic && (
            <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-accent/10 text-accent border-accent/20">
              {challenge.topic}
            </Badge>
          )}
          {challenge.difficulty && (
            <Badge variant="outline" className={`capitalize text-[11px] px-2 py-0.5 ${DIFFICULTY_STYLES[challenge.difficulty] ?? ""}`}>
              {challenge.difficulty}
            </Badge>
          )}
          {isCompleted && (
            <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[11px] px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Done
            </Badge>
          )}
          {isJoined && !isCompleted && (
            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25 text-[11px] px-2 py-0.5">
              <Play className="w-3 h-3 mr-1" /> Active
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

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {challenge.attempts_count ?? 0} attempts
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {challenge.completions_count ?? 0} completed
          </span>
          <span className="flex items-center gap-1 text-accent/80 font-medium ml-auto">
            <Zap className="w-3 h-3" />
            +{POINTS_REWARD} pts
          </span>
        </div>

        {/* Footer: author + time + CTA */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Avatar className="w-5 h-5">
              <AvatarImage src={challenge.author_avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                {(challenge.author_name || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">
              {challenge.author_name || "Anonymous"}
            </span>
            <span className="text-[11px] text-muted-foreground/40">·</span>
            <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />{timeAgo}
            </span>
          </div>

          {isCompleted ? (
            <span className="text-[11px] text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Completed
            </span>
          ) : isJoined ? (
            <span className="text-[11px] text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Continue <ArrowRight className="w-3 h-3" />
            </span>
          ) : (
            <Button
              size="sm"
              className="h-7 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Attempt <ArrowRight className="w-3 h-3 ml-1" /></>}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MyCard({
  challenge,
  onDelete,
  isJoined,
  isCompleted,
  completedDate,
}: {
  challenge: Challenge;
  onDelete: (id: string) => void;
  isJoined: boolean;
  isCompleted: boolean;
  completedDate: string | null;
}) {
  const navigate = useNavigate();
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(challenge.created_at), { addSuffix: true }); }
    catch { return ""; }
  })();

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-all cursor-pointer group hover:border-primary/30 hover:-translate-y-0.5 relative"
      onClick={() => navigate(`/challenges/${challenge.id}`)}
    >
      <div className="h-1 w-full bg-gradient-to-r from-primary/50 to-accent/50" />
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {challenge.topic && (
            <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-accent/10 text-accent border-accent/20">
              {challenge.topic}
            </Badge>
          )}
          {challenge.difficulty && (
            <Badge variant="outline" className={`capitalize text-[11px] px-2 py-0.5 ${DIFFICULTY_STYLES[challenge.difficulty] ?? ""}`}>
              {challenge.difficulty}
            </Badge>
          )}
          {isCompleted && (
            <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[11px] px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Done
            </Badge>
          )}
        </div>

        <h3 className="font-display font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {challenge.title}
        </h3>
        <p className="text-[12px] text-muted-foreground line-clamp-2">{challenge.description}</p>

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {challenge.attempts_count ?? 0}</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {challenge.completions_count ?? 0}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo}</span>
          </div>
          {isCompleted && completedDate && (
            <span className="text-[11px] text-green-400/70">
              {format(new Date(completedDate), "MMM d")}
            </span>
          )}
        </div>
      </CardContent>

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive z-10"
        onClick={(e) => { e.stopPropagation(); onDelete(challenge.id); }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <Card className="border-dashed border-border/40 bg-card/50">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-muted-foreground/30" />
        </div>
        <h3 className="font-display font-semibold text-sm mb-1">{title}</h3>
        <p className="text-muted-foreground text-[13px] max-w-xs">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function Challenges() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const {
    feedChallenges, dailyChallenge, myChallenges, activeChallenges, completedChallenges,
    loading, refetch, joinChallenge, isJoined, isCompleted, getCompletedDate,
  } = useChallenges();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    await supabase.from("challenges").delete().eq("id", id);
    toast({ title: "Challenge deleted" });
    refetch();
  };

  const handleJoin = async (challengeId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Create an account to attempt challenges.", variant: "destructive" });
      return;
    }
    await joinChallenge(challengeId);
  };

  const filterBySearch = (items: Challenge[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.topic || "").toLowerCase().includes(q)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabCount = (items: Challenge[]) => filterBySearch(items).length;

  return (
    <div className="page-container space-y-8 pb-12">
      {/* Hero */}
      <div className="relative max-w-3xl mx-auto text-center pt-4">
        <div className="absolute inset-0 -top-8 bg-gradient-to-b from-primary/5 via-transparent to-transparent rounded-3xl blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/[0.08] border border-accent/15 mb-5">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="text-[13px] font-medium text-accent/90">Community Challenges</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
            Challenge Each Other.{" "}
            <span className="gradient-text">Learn Together.</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-8 max-w-lg mx-auto leading-relaxed">
            Post a challenge on any topic — Claude builds a unique interactive lab.
            Solve others' challenges and earn points.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="hero" size="lg" onClick={() => navigate("/challenges/create")} className="px-8">
              <Plus className="w-4 h-4 mr-2" />
              Post a Challenge
            </Button>
            <Button variant="outline" size="lg" onClick={() => setShowLeaderboard(!showLeaderboard)}>
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </div>
          {!user && (
            <p className="text-xs text-muted-foreground/50 mt-4">Sign in to post and attempt challenges.</p>
          )}
        </div>
      </div>

      {/* Leaderboard (collapsible) */}
      {showLeaderboard && (
        <div className="max-w-md mx-auto">
          <Leaderboard />
        </div>
      )}

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-4 mx-auto">
          <TabsTrigger value="feed" className="text-[13px]">
            <Flame className="w-3 h-3 mr-1.5" /> Feed
          </TabsTrigger>
          <TabsTrigger value="my" className="text-[13px]">
            <Sparkles className="w-3 h-3 mr-1.5" /> Created
          </TabsTrigger>
          <TabsTrigger value="active" className="text-[13px]">
            <Play className="w-3 h-3 mr-1.5" /> Active
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-[13px]">
            <CheckCircle2 className="w-3 h-3 mr-1.5" /> Done
          </TabsTrigger>
        </TabsList>

        {/* ── FEED ── */}
        <TabsContent value="feed" className="mt-6">
          {tabCount(feedChallenges) === 0 ? (
            <EmptyState
              icon={Flame}
              title={searchQuery ? "No matching challenges" : "No challenges posted yet"}
              description={
                searchQuery
                  ? "Try a different search term."
                  : "Be the first to post a challenge! It takes about 30 seconds."
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filterBySearch(feedChallenges).map((c) => (
                <FeedCard
                  key={c.id}
                  challenge={c}
                  isJoined={isJoined(c.id)}
                  isCompleted={isCompleted(c.id)}
                  onJoin={handleJoin}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── MY CREATED ── */}
        <TabsContent value="my" className="mt-6">
          {!user ? (
            <EmptyState
              icon={Sparkles}
              title="Sign in to see your challenges"
              description="Create an account to post challenges and track who has solved them."
            />
          ) : tabCount(myChallenges) === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={searchQuery ? "No matching challenges" : "No challenges created yet"}
              description={
                searchQuery
                  ? "Try a different search term."
                  : "Post a challenge and earn points every time someone solves it."
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filterBySearch(myChallenges).map((c) => (
                <MyCard
                  key={c.id}
                  challenge={c}
                  onDelete={handleDelete}
                  isJoined={isJoined(c.id)}
                  isCompleted={isCompleted(c.id)}
                  completedDate={getCompletedDate(c.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ACTIVE ── */}
        <TabsContent value="active" className="mt-6">
          {tabCount(activeChallenges) === 0 ? (
            <EmptyState
              icon={Play}
              title="No active challenges"
              description="Browse the Feed and attempt a challenge to track your progress here."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filterBySearch(activeChallenges).map((c) => (
                <FeedCard
                  key={c.id}
                  challenge={c}
                  isJoined={true}
                  isCompleted={false}
                  onJoin={handleJoin}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── COMPLETED ── */}
        <TabsContent value="completed" className="mt-6">
          {tabCount(completedChallenges) === 0 ? (
            <EmptyState
              icon={Target}
              title="No completed challenges"
              description="Solve a challenge to see it here and earn points!"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filterBySearch(completedChallenges).map((c) => (
                <FeedCard
                  key={c.id}
                  challenge={c}
                  isJoined={true}
                  isCompleted={true}
                  onJoin={handleJoin}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
