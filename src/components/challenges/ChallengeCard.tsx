import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { usePoints } from "@/hooks/usePoints";
import type { Challenge } from "@/hooks/useChallenges";

interface ChallengeCardProps {
  challenge: Challenge;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const navigate = useNavigate();
  const { completedChallenges } = usePoints();
  const isCompleted = completedChallenges.includes(challenge.id);

  const labTypeLabel = challenge.lab_type?.replace(/_/g, " ") ?? null;

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

      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2">{challenge.description}</p>
      </CardContent>
    </Card>
  );
}
