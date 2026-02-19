import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Flame, Target, Trophy, Calendar, BookOpen, ClipboardCheck, Star } from "lucide-react";
import { usePoints } from "@/hooks/usePoints";

const ACHIEVEMENTS_ALL = [
  { id: "first_challenge", name: "First Steps", description: "Complete your first challenge", icon: "🏆" },
  { id: "five_challenges", name: "On a Roll", description: "Complete 5 challenges", icon: "🔥" },
  { id: "hundred_points", name: "Century", description: "Earn 100 points", icon: "💯" },
  { id: "five_hundred_points", name: "High Scorer", description: "Earn 500 points", icon: "⭐" },
  { id: "three_day_streak", name: "Consistent", description: "3-day streak", icon: "📅" },
  { id: "seven_day_streak", name: "Dedicated", description: "7-day streak", icon: "🌟" },
];

export default function ProgressPage() {
  const { totalPoints, streak, completedChallenges, achievements } = usePoints();

  const nextPointsMilestone = totalPoints < 100 ? 100 : totalPoints < 500 ? 500 : totalPoints < 1000 ? 1000 : 5000;
  const pointsProgress = Math.min((totalPoints / nextPointsMilestone) * 100, 100);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Your Progress</h1>
          <p className="text-muted-foreground mt-1">Track your learning journey and achievements</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{streak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPoints}</p>
                <p className="text-xs text-muted-foreground">Points</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedChallenges.length}</p>
                <p className="text-xs text-muted-foreground">Challenges</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{achievements.length}</p>
                <p className="text-xs text-muted-foreground">Badges</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Points Progress */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Points Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{totalPoints} points</span>
              <span className="text-muted-foreground">Next: {nextPointsMilestone}</span>
            </div>
            <Progress value={pointsProgress} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {nextPointsMilestone - totalPoints} points until next milestone
            </p>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ACHIEVEMENTS_ALL.map((badge) => {
                const unlocked = achievements.some((a) => a.id === badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      unlocked
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-secondary/30 opacity-50"
                    }`}
                  >
                    <span className="text-3xl">{badge.icon}</span>
                    <p className="font-semibold text-sm mt-2">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">{badge.description}</p>
                    {unlocked && (
                      <p className="text-xs text-primary mt-1 font-medium">✓ Unlocked</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* How to Earn */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              How to Earn Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Complete a course", pts: "+150 pts" },
                { label: "Complete daily challenge", pts: "+100 pts" },
                { label: "Complete a challenge", pts: "+50 pts" },
                { label: "Create a community post", pts: "+25 pts" },
                { label: "AI tutor session", pts: "+15 pts" },
                { label: "Daily streak bonus", pts: "+20 pts/day" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <span className="text-sm">{item.label}</span>
                  <span className="text-sm font-bold text-primary">{item.pts}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
