import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, ChevronDown, ArrowDown, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FlowchartNode = {
  id: string;
  type: "start" | "action" | "decision" | "outcome";
  label: string;
  /** For decision nodes — the user picks from dropdown options */
  options?: string[];
  /** Correct option text (for decision nodes) */
  correct_option?: string;
};

type FlowchartEdge = {
  from: string;
  to: string;
  condition?: string;
};

type DropZone = {
  id: string;
  label: string;
  correct_value: string;
  options: string[];
};

export type FlowchartLabData = {
  lab_type: "flowchart";
  title?: string;
  goal?: string;
  scenario?: string;
  nodes?: FlowchartNode[];
  edges?: FlowchartEdge[];
  /** Alternative: drop zones where user fills in correct steps */
  drop_zones?: DropZone[];
  key_insight?: string;
};

type Props = {
  data: FlowchartLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

const NODE_STYLES: Record<string, string> = {
  start: "bg-primary/10 border-primary/30 text-primary",
  action: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
  decision: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  outcome: "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400",
};

const NODE_SHAPES: Record<string, string> = {
  start: "rounded-full",
  action: "rounded-xl",
  decision: "rounded-xl rotate-0",
  outcome: "rounded-xl",
};

export default function FlowchartLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const dropZones = useMemo(() => data.drop_zones || [], [data]);
  const nodes = useMemo(() => data.nodes || [], [data]);
  const edges = useMemo(() => data.edges || [], [data]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  // Use drop_zones mode if available, else use nodes with decision dropdowns
  const useDropZones = dropZones.length > 0;
  const decisionNodes = useMemo(() => nodes.filter(n => n.type === "decision" && n.options?.length), [nodes]);

  const totalInteractive = useDropZones ? dropZones.length : decisionNodes.length;

  const allCorrect = useMemo(() => {
    if (useDropZones) {
      return dropZones.every(dz => answers[dz.id]?.toLowerCase().trim() === dz.correct_value.toLowerCase().trim());
    }
    return decisionNodes.every(n => answers[n.id]?.toLowerCase().trim() === n.correct_option?.toLowerCase().trim());
  }, [answers, dropZones, decisionNodes, useDropZones]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    if (allCorrect && !completionFired && onComplete) {
      onComplete();
      setCompletionFired(true);
    }
  }, [allCorrect, completionFired, onComplete]);

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
    setCompletionFired(false);
    onReplay?.();
  };

  const filledCount = useDropZones
    ? dropZones.filter(dz => answers[dz.id]).length
    : decisionNodes.filter(n => answers[n.id]).length;

  // Already completed
  if (isCompleted && !submitted) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h3 className="font-bold text-lg">Flowchart Lab Complete</h3>
          <p className="text-sm text-muted-foreground">You've completed this lab. Replay to try again.</p>
          <Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" /> Replay</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔀</span>
            <div>
              <h3 className="font-bold text-lg">{data.title || "Flowchart Lab"}</h3>
              <Badge variant="outline" className="text-[10px]">Flowchart</Badge>
            </div>
          </div>
          {data.goal && <p className="text-sm text-muted-foreground">{data.goal}</p>}
          {data.scenario && <p className="text-sm text-foreground/80">{data.scenario}</p>}
        </CardContent>
      </Card>

      {/* Flowchart visualization */}
      <Card>
        <CardContent className="p-6 space-y-2">
          {useDropZones ? (
            /* Drop zone mode — ordered steps with dropdowns */
            <div className="space-y-3">
              {dropZones.map((dz, idx) => {
                const isCorrect = submitted && answers[dz.id]?.toLowerCase().trim() === dz.correct_value.toLowerCase().trim();
                const isWrong = submitted && !isCorrect;
                return (
                  <div key={dz.id}>
                    <div className={`p-4 rounded-xl border-2 transition-all ${
                      isCorrect ? "border-green-500 bg-green-500/5" :
                      isWrong ? "border-red-500 bg-red-500/5" :
                      "border-border bg-card"
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium flex-1">{dz.label}</span>
                        <Select
                          value={answers[dz.id] || ""}
                          onValueChange={(val) => { if (!submitted) setAnswers(prev => ({ ...prev, [dz.id]: val })); }}
                          disabled={submitted}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {dz.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                        {isWrong && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
                      </div>
                      {isWrong && (
                        <p className="text-xs text-red-500 mt-2 ml-10">
                          Correct answer: <span className="font-medium">{dz.correct_value}</span>
                        </p>
                      )}
                    </div>
                    {idx < dropZones.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Node/edge mode — visual flowchart with decision dropdowns */
            <div className="space-y-3">
              {nodes.map((node, idx) => {
                const isDecision = node.type === "decision" && node.options?.length;
                const isCorrect = submitted && isDecision && answers[node.id]?.toLowerCase().trim() === node.correct_option?.toLowerCase().trim();
                const isWrong = submitted && isDecision && !isCorrect;

                return (
                  <div key={node.id}>
                    <div className={`p-4 rounded-xl border-2 transition-all ${
                      isCorrect ? "border-green-500 bg-green-500/5" :
                      isWrong ? "border-red-500 bg-red-500/5" :
                      `${NODE_STYLES[node.type] || NODE_STYLES.action} border`
                    }`}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0">{node.type}</Badge>
                        <span className="text-sm font-medium flex-1">{node.label}</span>
                        {isDecision && (
                          <Select
                            value={answers[node.id] || ""}
                            onValueChange={(val) => { if (!submitted) setAnswers(prev => ({ ...prev, [node.id]: val })); }}
                            disabled={submitted}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                              {node.options!.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                        {isWrong && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
                      </div>
                      {isWrong && (
                        <p className="text-xs text-red-500 mt-2 ml-10">
                          Correct: <span className="font-medium">{node.correct_option}</span>
                        </p>
                      )}
                    </div>
                    {idx < nodes.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit / Status */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filledCount} / {totalInteractive} steps filled
        </span>

        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={filledCount < totalInteractive}
            className="gap-1.5"
          >
            Check Flowchart {filledCount < totalInteractive && "🔒"}
          </Button>
        ) : allCorrect ? (
          <div className="flex items-center gap-3">
            <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" /> All Correct!
            </Badge>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" /> Replay
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">
              <AlertCircle className="w-3 h-3 mr-1" /> Some incorrect
            </Badge>
            <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); }}>
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Key insight */}
      {submitted && allCorrect && data.key_insight && (
        <Card className="border-primary/15 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-2">
            <span className="text-lg">💡</span>
            <p className="text-sm text-foreground/80">{data.key_insight}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
