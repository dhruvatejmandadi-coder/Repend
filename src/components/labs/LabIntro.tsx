import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Globe, Users, BarChart3, Brain } from "lucide-react";

/**
 * Repend Learning Formula Intro
 * Flow: 🌎 Relevance → 🎭 Scenario → 📊 Information → 🧠 Begin Lab
 */

export interface LabIntroData {
  relevance?: string;
  role?: string;
  scenario_context?: string;
  information?: string | string[];
  objective?: string;
  key_insight?: string;
}

interface LabIntroProps {
  title: string;
  intro?: LabIntroData;
  labType: string;
  onStart: () => void;
}

type IntroPhase = "relevance" | "scenario" | "information" | "ready";

export default function LabIntro({ title, intro, labType, onStart }: LabIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>("relevance");

  // If no intro data at all, skip straight to lab
  if (!intro || (!intro.relevance && !intro.scenario_context && !intro.role)) {
    return null;
  }

  const phases: { key: IntroPhase; label: string }[] = [
    { key: "relevance", label: "Why It Matters" },
    { key: "scenario", label: "Your Role" },
    { key: "information", label: "Key Info" },
    { key: "ready", label: "Start" },
  ];
  const phaseIndex = phases.findIndex((p) => p.key === phase);

  const labEmoji: Record<string, string> = {
    simulation: "🧪",
    classification: "🗂️",
    policy_optimization: "🎯",
    ethical_dilemma: "⚖️",
    decision_lab: "🧠",
  };

  return (
    <div className="space-y-4">
      {/* Phase Progress */}
      <div className="flex items-center gap-1">
        {phases.map((p, i) => (
          <div key={p.key} className="flex items-center gap-1">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                i <= phaseIndex ? "bg-primary" : "bg-muted"
              } ${i === phaseIndex ? "w-8" : "w-4"}`}
            />
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-2">
          {phases[phaseIndex]?.label}
        </span>
      </div>

      {/* 🌎 Phase 1: Why This Matters */}
      {phase === "relevance" && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-lg">🌎 Why This Matters</h3>
            </div>
            <p className="text-sm leading-relaxed">{intro.relevance}</p>
            {intro.objective && (
              <div className="bg-background/60 rounded-lg p-3 border border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🎯 Objective</span>
                <p className="text-sm mt-1">{intro.objective}</p>
              </div>
            )}
            <Button onClick={() => setPhase("scenario")} className="w-full">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 🎭 Phase 2: Your Role & Scenario */}
      {phase === "scenario" && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-lg">🎭 Your Role</h3>
            </div>
            {intro.role && (
              <div className="bg-background/60 rounded-lg p-3 border border-border">
                <Badge variant="outline" className="mb-2 text-xs">👤 You are...</Badge>
                <p className="text-sm font-medium">{intro.role}</p>
              </div>
            )}
            {intro.scenario_context && (
              <p className="text-sm leading-relaxed">{intro.scenario_context}</p>
            )}
            <Button onClick={() => setPhase(intro.information ? "information" : "ready")} className="w-full">
              {intro.information ? "See the Data" : "Start Lab"} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 📊 Phase 3: Key Information */}
      {phase === "information" && intro.information && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">📊 Key Information</h3>
            </div>
            {typeof intro.information === "string" ? (
              <p className="text-sm leading-relaxed">{intro.information}</p>
            ) : (
              <ul className="space-y-2">
                {intro.information.map((info, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">•</span>
                    <span>{info}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => setPhase("ready")} className="w-full">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 🧠 Phase 4: Ready to Begin */}
      {phase === "ready" && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-green-500" />
              <h3 className="font-bold text-lg">{labEmoji[labType] || "🧪"} Ready to Begin</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              You've reviewed the context. Now it's time to make your decisions and see the consequences.
            </p>
            <Button onClick={onStart} className="w-full">
              Start {title || "Lab"} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
