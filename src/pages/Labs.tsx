import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { labDefinitions, LabDefinition } from "@/data/labs";
import { LabRunner } from "@/components/labs/LabRunner";
import { useNavigate } from "react-router-dom";

export default function Labs() {
  const { user } = useAuth();
  const [activeLab, setActiveLab] = useState<LabDefinition | null>(null);
  const navigate = useNavigate();

  // Adaptive: read survey data for sorting and hints
  const surveyData = useMemo(() => {
    try {
      const raw = localStorage.getItem("repend_survey_responses");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const showHints = !surveyData?.skill_level || surveyData.skill_level === "beginner" || surveyData.skill_level === "basic";

  // Sort labs by relevance to user interests
  const sortedLabs = useMemo(() => {
    if (!surveyData?.interests || !Array.isArray(surveyData.interests)) return labDefinitions;
    const interests = surveyData.interests.map((i: string) => i.toLowerCase());
    return [...labDefinitions].sort((a, b) => {
      const aMatch = interests.some((i: string) => a.category.toLowerCase().includes(i) || a.title.toLowerCase().includes(i));
      const bMatch = interests.some((i: string) => b.category.toLowerCase().includes(i) || b.title.toLowerCase().includes(i));
      return (bMatch ? 1 : 0) - (aMatch ? 1 : 0);
    });
  }, [surveyData]);

  if (activeLab) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-8">
          <LabRunner lab={activeLab} onExit={() => setActiveLab(null)} showHints={showHints} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Decision Labs</h1>
          </div>
          <p className="text-muted-foreground">
            Simulate real-life scenarios, make tough decisions, and discover your decision-making style.
          </p>
        </div>

        {/* Lab Cards */}
        {!user ? (
          <Card className="p-8 text-center space-y-4">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="font-display text-xl font-bold text-foreground">Sign in to access Labs</h3>
            <p className="text-muted-foreground">Create an account to track your progress and unlock all labs.</p>
            <Button variant="hero" onClick={() => navigate("/login")}>Sign In</Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedLabs.map((lab) => (
              <Card key={lab.id} className="p-6 flex flex-col justify-between hover:border-primary/50 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{lab.icon}</span>
                    <Badge variant="outline" className="text-xs">{lab.category}</Badge>
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">{lab.title}</h3>
                  <p className="text-muted-foreground text-sm">{lab.description}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4 gap-1"
                  onClick={() => setActiveLab(lab)}
                >
                  Start Lab <ArrowRight className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
