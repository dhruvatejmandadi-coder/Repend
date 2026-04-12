import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Sparkles } from "lucide-react";
import { usePoints } from "@/hooks/usePoints";
import { useToast } from "@/hooks/use-toast";
import type { Challenge } from "@/hooks/useChallenges";

interface DailyChallengeCardProps {
  challenge: Challenge;
}

export function DailyChallengeCard({ challenge }: DailyChallengeCardProps) {
  const { completeChallenge, completedChallenges, updateStreak } = usePoints();
  const { toast } = useToast();
  const isCompleted = completedChallenges.includes(challenge.id);

  const getTimeLeft = () => {
    if (!challenge.expires_at) return null;
    const diff = new Date(challenge.expires_at).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours}h left`;
  };

  const handleComplete = () => {
    if (isCompleted) return;
    completeChallenge(challenge.id, true);
    updateStreak();
    toast({ title: "Daily challenge done! 🔥", description: "+100 points earned! Streak updated!" });
  };

  const timeLeft = getTimeLeft();

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
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30">
                <Sparkles className="w-3 h-3 mr-1" />
                Daily Challenge
              </Badge>
              {timeLeft && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {timeLeft}
                </Badge>
              )}
              <Badge variant="outline" className="text-primary border-primary/30">+100 pts</Badge>
            </div>

            <h2 className="font-display text-xl md:text-2xl font-bold mb-2">{challenge.title}</h2>
            <p className="text-muted-foreground mb-4">{challenge.description}</p>

            <Button
              variant={isCompleted ? "secondary" : "default"}
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
