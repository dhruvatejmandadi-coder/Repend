import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Sparkles, BookOpen, ArrowRight } from "lucide-react";
import { LabMetrics, LabDefinition } from "@/data/labs";
import { useNavigate } from "react-router-dom";

interface LabCompletionScreenProps {
  lab: LabDefinition;
  metrics: LabMetrics;
  decisions: { scenarioIndex: number; choiceIndex: number }[];
  onRestart: () => void;
  pointsAwarded: number;
}

function computeDecisionStyle(lab: LabDefinition, metrics: LabMetrics): string {
  for (const style of lab.decisionStyles) {
    if (style.condition(metrics)) return style.label;
  }
  return "Adaptive Thinker";
}

function clampMetric(val: number) {
  return Math.max(0, Math.min(100, val));
}

export function LabCompletionScreen({ lab, metrics, decisions, onRestart, pointsAwarded }: LabCompletionScreenProps) {
  const navigate = useNavigate();
  const style = computeDecisionStyle(lab, metrics);
  const [animatedMetrics, setAnimatedMetrics] = useState<LabMetrics>({ growth: 0, skill: 0, stress: 0, confidence: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedMetrics({
        growth: clampMetric(metrics.growth),
        skill: clampMetric(metrics.skill),
        stress: clampMetric(metrics.stress),
        confidence: clampMetric(metrics.confidence),
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [metrics]);

  const metricLabels = [
    { key: "growth" as const, label: "Growth", color: "bg-green-500" },
    { key: "skill" as const, label: "Skill", color: "bg-blue-500" },
    { key: "confidence" as const, label: "Confidence", color: "bg-amber-500" },
    { key: "stress" as const, label: "Stress", color: "bg-red-500" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-5xl mb-2">{lab.icon}</div>
        <h2 className="font-display text-2xl font-bold text-foreground">Lab Complete!</h2>
        <p className="text-muted-foreground">{lab.title}</p>
      </div>

      {/* Decision Style Badge */}
      <Card className="p-6 text-center border-primary/20 bg-primary/5">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Decision Style</span>
        </div>
        <h3 className="font-display text-3xl font-bold text-primary">{style}</h3>
      </Card>

      {/* Points */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="font-medium">Points Earned</span>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-1">+{pointsAwarded}</Badge>
      </Card>

      {/* Metrics */}
      <Card className="p-6 space-y-4">
        <h4 className="font-semibold text-foreground">Performance Metrics</h4>
        {metricLabels.map(({ key, label, color }) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{clampMetric(metrics[key])}/100</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`}
                style={{ width: `${animatedMetrics[key]}%` }}
              />
            </div>
          </div>
        ))}
      </Card>

      {/* Recommended Topics */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-foreground">Recommended Courses</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {lab.recommendedTopics.map((topic) => (
            <Button
              key={topic}
              variant="outline"
              size="sm"
              onClick={() => navigate("/courses")}
              className="gap-1"
            >
              {topic}
              <ArrowRight className="w-3 h-3" />
            </Button>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-2">
        <Button variant="outline" onClick={onRestart}>Try Again</Button>
        <Button variant="hero" onClick={() => navigate("/labs")}>Back to Labs</Button>
      </div>
    </div>
  );
}
