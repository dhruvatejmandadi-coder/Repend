import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, CheckCircle, Sparkles } from "lucide-react";
import { usePoints } from "@/hooks/usePoints";
import { useToast } from "@/hooks/use-toast";

interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  youtube_url: string | null;
  expires_in: string;
  participants: number;
}

interface DailyChallengeCardProps {
  challenge: DailyChallenge;
}

export function DailyChallengeCard({ challenge }: DailyChallengeCardProps) {
  const { completeChallenge, completedChallenges, updateStreak } = usePoints();
  const { toast } = useToast();
  const isCompleted = completedChallenges.includes(challenge.id);

  const handleComplete = () => {
    if (isCompleted) return;
    completeChallenge(challenge.id, true);
    updateStreak();
    toast({ title: "Daily challenge done! 🔥", description: "+100 points earned! Streak updated!" });
  };

  return (
    <Card className="overflow-hidden border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5">
      <CardContent className="p-0">
        <div className="grid md:grid-cols-2 gap-0">
          {challenge.youtube_url && (
            <div className="aspect-video md:aspect-auto md:h-full bg-muted">
              <iframe src={challenge.youtube_url} title={challenge.title} className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}

          <div className="p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30">
                <Sparkles className="w-3 h-3 mr-1" />
                Daily Challenge
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                <Clock className="w-3 h-3 mr-1" />
                {challenge.expires_in} left
              </Badge>
              <Badge variant="outline" className="text-primary border-primary/30">
                +100 pts
              </Badge>
            </div>

            <h2 className="font-display text-xl md:text-2xl font-bold mb-2">{challenge.title}</h2>
            <p className="text-muted-foreground mb-4">{challenge.description}</p>

            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{challenge.participants} participating today</span>
              </div>
            </div>

            <Button
              variant={isCompleted ? "secondary" : "accent"}
              size="lg"
              onClick={handleComplete}
              disabled={isCompleted}
              className="w-full md:w-auto"
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Completed!
                </>
              ) : (
                "Mark as Done"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
