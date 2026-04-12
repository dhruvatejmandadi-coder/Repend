import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, RotateCcw, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type Blank = {
  id: string;           // e.g. "BLANK_0" — must match placeholder in narrative
  correct: string;
  options: string[];    // includes correct + distractors
  explanation?: string;
};

export type ScenarioBuilderLabData = {
  lab_type: "scenario_builder";
  title?: string;
  setup?: string;       // optional framing paragraph before the narrative
  narrative: string;    // text with [BLANK_0], [BLANK_1] etc. markers
  blanks: Blank[];
  key_insight?: string;
};

type Props = {
  data: ScenarioBuilderLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/** Split a narrative string into segments: plain text or blank IDs */
function parseNarrative(narrative: string): Array<{ type: "text"; content: string } | { type: "blank"; id: string }> {
  const parts: Array<{ type: "text"; content: string } | { type: "blank"; id: string }> = [];
  const regex = /\[([A-Z_0-9]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(narrative)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: narrative.slice(lastIndex, match.index) });
    }
    parts.push({ type: "blank", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < narrative.length) {
    parts.push({ type: "text", content: narrative.slice(lastIndex) });
  }
  return parts;
}

export default function ScenarioBuilderLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const blanks = useMemo(() => data.blanks || [], [data]);
  const shuffledOptions = useMemo(
    () => Object.fromEntries(blanks.map(b => [b.id, shuffle(b.options)])),
    [blanks]
  );
  const segments = useMemo(() => parseNarrative(data.narrative || ""), [data.narrative]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  const handleAnswer = useCallback((blankId: string, value: string) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [blankId]: value }));
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    if (blanks.some(b => !answers[b.id])) return;
    setSubmitted(true);
    const allCorrect = blanks.every(b => answers[b.id] === b.correct);
    if (allCorrect && !completionFired) {
      setCompletionFired(true);
      onComplete?.();
    }
  }, [blanks, answers, completionFired, onComplete]);

  const handleReset = useCallback(() => {
    setAnswers({});
    setSubmitted(false);
    setCompletionFired(false);
    onReplay?.();
  }, [onReplay]);

  const allAnswered = blanks.length > 0 && blanks.every(b => answers[b.id]);
  const score = submitted
    ? blanks.filter(b => answers[b.id] === b.correct).length
    : null;

  const blankMap = useMemo(() => Object.fromEntries(blanks.map(b => [b.id, b])), [blanks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        {data.title && <h3 className="font-bold text-lg">{data.title}</h3>}
        {data.setup && (
          <p className="text-sm text-muted-foreground leading-relaxed">{data.setup}</p>
        )}
        <p className="text-xs text-muted-foreground italic">
          Select the correct word or phrase for each blank to complete the scenario.
        </p>
      </div>

      {/* Score banner */}
      {submitted && score !== null && (
        <Card className={cn(
          "border",
          score === blanks.length
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        )}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            {score === blanks.length
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <span className="text-xl shrink-0">🎯</span>
            }
            <span className="text-sm font-medium">
              {score === blanks.length
                ? `Scenario complete! All ${blanks.length} choices correct.`
                : `${score} of ${blanks.length} correct. Review the highlighted blanks.`}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Narrative with inline blanks */}
      <Card className="bg-muted/20 border-border/60">
        <CardContent className="p-5">
          <p className="text-sm leading-loose">
            {segments.map((seg, i) => {
              if (seg.type === "text") {
                return <span key={i}>{seg.content}</span>;
              }

              const blank = blankMap[seg.id];
              if (!blank) return <span key={i} className="text-muted-foreground">[?]</span>;

              const answer = answers[seg.id];
              const isCorrect = submitted && answer === blank.correct;
              const isWrong = submitted && answer && answer !== blank.correct;

              return (
                <span key={i} className="inline-block align-middle mx-1 my-0.5">
                  <Select
                    value={answer || ""}
                    onValueChange={(v) => handleAnswer(seg.id, v)}
                    disabled={submitted}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 min-w-[120px] max-w-[200px] text-sm font-medium border-2 rounded-lg",
                        !answer && "border-dashed border-primary/40 bg-primary/5 text-muted-foreground",
                        answer && !submitted && "border-primary/60 bg-primary/10 text-foreground",
                        isCorrect && "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        isWrong && "border-red-400 bg-red-500/10 text-red-600 dark:text-red-400",
                      )}
                    >
                      <SelectValue placeholder="choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(shuffledOptions[seg.id] || blank.options).map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-sm">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Correct answer hint on wrong */}
                  {submitted && isWrong && (
                    <span className="ml-1 text-xs text-emerald-600 font-medium">
                      → {blank.correct}
                    </span>
                  )}
                </span>
              );
            })}
          </p>
        </CardContent>
      </Card>

      {/* Per-blank explanations after submit */}
      {submitted && blanks.some(b => b.explanation) && (
        <div className="space-y-2">
          {blanks
            .filter(b => b.explanation)
            .map(b => {
              const isCorrect = answers[b.id] === b.correct;
              return (
                <div
                  key={b.id}
                  className={cn(
                    "rounded-lg border px-4 py-2.5 text-sm",
                    isCorrect
                      ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-800 dark:text-emerald-200"
                      : "bg-amber-500/8 border-amber-500/25 text-amber-800 dark:text-amber-200"
                  )}
                >
                  <span className="font-semibold">{isCorrect ? "✓" : "✗"} {b.correct}:</span>{" "}
                  {b.explanation}
                </div>
              );
            })}
        </div>
      )}

      {/* Key insight */}
      {submitted && data.key_insight && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-3 px-4 flex gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm">{data.key_insight}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!submitted ? (
          <Button onClick={handleSubmit} disabled={!allAnswered} className="min-w-[140px]">
            Submit Scenario
          </Button>
        ) : (
          <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Completed
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Replay
        </Button>
        {!allAnswered && !submitted && (
          <span className="text-xs text-muted-foreground ml-auto">
            {Object.keys(answers).length}/{blanks.length} answered
          </span>
        )}
      </div>
    </div>
  );
}
