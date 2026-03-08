import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePoints } from "@/hooks/usePoints";
import type { Challenge } from "@/hooks/useChallenges";

interface ChallengeCardProps {
  challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const navigate = useNavigate();
  const { completedChallenges } = usePoints();
  const isCompleted = completedChallenges.includes(challenge.id);

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group hover:border-primary/30"
      onClick={() => navigate(`/challenges/${challenge.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold line-clamp-2">{challenge.title}</CardTitle>
          {isCompleted && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 shrink-0">Done ✓</Badge>}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{challenge.description}</p>

        {/* Creator info */}
        <div className="flex items-center gap-2 pt-1">
          <Avatar className="w-5 h-5">
            <AvatarImage src={challenge.author_avatar_url || ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
              {(challenge.author_name || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {challenge.author_name || "Anonymous"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
