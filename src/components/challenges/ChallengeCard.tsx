import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ChallengeComments } from "./ChallengeComments";
import { usePoints } from "@/hooks/usePoints";
import { useToast } from "@/hooks/use-toast";
import type { Challenge } from "@/hooks/useChallenges";

interface ChallengeCardProps {
  challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const { completeChallenge, completedChallenges } = usePoints();
  const { toast } = useToast();
  const isCompleted = completedChallenges.includes(challenge.id);

  const handleJoin = () => {
    if (!isJoined) {
      setIsJoined(true);
    } else if (!isCompleted) {
      completeChallenge(challenge.id, false);
      toast({ title: "Challenge completed! 🎉", description: "+50 points earned!" });
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {challenge.youtube_url && (
        <div className="aspect-video w-full bg-muted">
          <iframe src={challenge.youtube_url} title={challenge.title} className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold line-clamp-2">{challenge.title}</CardTitle>
          {isCompleted && <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Done ✓</Badge>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{challenge.description}</p>

        <div className="flex gap-2">
          <Button
            variant={isCompleted ? "secondary" : isJoined ? "default" : "default"}
            size="sm"
            className="flex-1"
            onClick={handleJoin}
            disabled={isCompleted}
          >
            {isCompleted ? "Completed ✓" : isJoined ? "Mark Complete" : "Join Challenge"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowComments(!showComments)}>
            {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {showComments && <ChallengeComments challengeId={challenge.id} />}
      </CardContent>
    </Card>
  );
}
