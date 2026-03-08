import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Loader2 } from "lucide-react";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { DailyChallengeCard } from "@/components/challenges/DailyChallengeCard";
import { useChallenges } from "@/hooks/useChallenges";
import { usePoints } from "@/hooks/usePoints";

export default function Challenges() {
  const [activeTab, setActiveTab] = useState("all");
  const { dailyChallenge, regularChallenges, loading } = useChallenges();
  const { completedChallenges } = usePoints();

  const activeChallenges = regularChallenges.filter(
    (c) => !completedChallenges.includes(c.id) 
  );
  const completed = regularChallenges.filter(
    (c) => completedChallenges.includes(c.id)
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-accent" />
            Challenges
          </h1>
          <p className="text-muted-foreground mt-1">
            Take on challenges, grow with the community
          </p>
        </div>

        {dailyChallenge && <DailyChallengeCard challenge={dailyChallenge} />}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all">All Challenges</TabsTrigger>
            <TabsTrigger value="active">My Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {regularChallenges.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No challenges yet</h3>
                  <p className="text-muted-foreground text-sm">Check back soon for new challenges!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {regularChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            {activeChallenges.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No active challenges</h3>
                  <p className="text-muted-foreground text-sm mb-4">Join a challenge to start tracking your progress!</p>
                  <Button variant="outline" onClick={() => setActiveTab("all")}>Browse Challenges</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {completed.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Star className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No completed challenges yet</h3>
                  <p className="text-muted-foreground text-sm">Complete your first challenge to see it here!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {completed.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
