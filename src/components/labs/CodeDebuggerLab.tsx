import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RotateCcw, Play, AlertCircle, Terminal, Bug } from "lucide-react";

export type CodeDebuggerLabData = {
  lab_type: "code_debugger";
  title?: string;
  goal?: string;
  language?: string;
  starter_code: string;
  expected_output: string;
  initial_error?: string;
  hints?: string[];
  key_insight?: string;
};

type Props = {
  data: CodeDebuggerLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

/**
 * Simple code evaluation for common languages.
 * This runs a basic simulation — NOT real code execution for security reasons.
 * It checks if the user's code would produce the expected output.
 */
function simulateCodeRun(code: string, expectedOutput: string): { output: string; isCorrect: boolean; error?: string } {
  const trimmedExpected = expectedOutput.trim();
  
  // Try to extract print/console.log statements and evaluate simple expressions
  try {
    // Python-style: look for print() statements
    const printMatches = code.match(/print\s*\((.*?)\)/g);
    if (printMatches) {
      const outputs: string[] = [];
      for (const match of printMatches) {
        const inner = match.replace(/^print\s*\(/, "").replace(/\)$/, "").trim();
        try {
          // Handle ** operator (Python power)
          const jsExpr = inner.replace(/\*\*/g, "**");
          const result = Function(`"use strict"; return (${jsExpr})`)();
          outputs.push(String(result));
        } catch {
          outputs.push(inner.replace(/["']/g, ""));
        }
      }
      const output = outputs.join("\n");
      return { output, isCorrect: output.trim() === trimmedExpected };
    }

    // JS-style: look for console.log()
    const logMatches = code.match(/console\.log\s*\((.*?)\)/g);
    if (logMatches) {
      const outputs: string[] = [];
      for (const match of logMatches) {
        const inner = match.replace(/^console\.log\s*\(/, "").replace(/\)$/, "").trim();
        try {
          const result = Function(`"use strict"; return (${inner})`)();
          outputs.push(String(result));
        } catch {
          outputs.push(inner.replace(/["'`]/g, ""));
        }
      }
      const output = outputs.join("\n");
      return { output, isCorrect: output.trim() === trimmedExpected };
    }

    // Fallback: direct string comparison
    return { output: "No output detected", isCorrect: false, error: "Could not find print/console.log statements" };
  } catch (e: any) {
    return { output: "", isCorrect: false, error: e.message || "Runtime error" };
  }
}

export default function CodeDebuggerLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const [code, setCode] = useState(data.starter_code);
  const [output, setOutput] = useState(data.initial_error || "");
  const [hasRun, setHasRun] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  const handleRun = useCallback(() => {
    const result = simulateCodeRun(code, data.expected_output);
    setOutput(result.error ? `❌ Error: ${result.error}` : result.output);
    setIsCorrect(result.isCorrect);
    setHasRun(true);

    if (result.isCorrect && !completionFired && onComplete) {
      onComplete();
      setCompletionFired(true);
    }
  }, [code, data.expected_output, completionFired, onComplete]);

  const reset = () => {
    setCode(data.starter_code);
    setOutput(data.initial_error || "");
    setHasRun(false);
    setIsCorrect(false);
    setCompletionFired(false);
    setShowHint(false);
    setHintIndex(0);
    onReplay?.();
  };

  const nextHint = () => {
    if (data.hints && hintIndex < data.hints.length - 1) {
      setHintIndex(prev => prev + 1);
    }
    setShowHint(true);
  };

  if (isCompleted && !hasRun) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h3 className="font-bold text-lg">Code Debugger Complete</h3>
          <p className="text-sm text-muted-foreground">You've already fixed this code. Replay to try again.</p>
          <Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" /> Replay</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐛</span>
            <div>
              <h3 className="font-bold text-lg">{data.title || "Debug the Code"}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Code Debugger</Badge>
                {data.language && <Badge variant="secondary" className="text-[10px]">{data.language}</Badge>}
              </div>
            </div>
          </div>
          {data.goal && <p className="text-sm text-muted-foreground">{data.goal}</p>}
        </CardContent>
      </Card>

      {/* Expected output */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
        <span className="font-medium text-amber-600 dark:text-amber-400">Expected Output:</span>
        <code className="font-mono bg-amber-500/10 px-2 py-0.5 rounded">{data.expected_output}</code>
      </div>

      {/* Code editor */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Code Editor</span>
            </div>
            <div className="flex items-center gap-2">
              {data.hints && data.hints.length > 0 && !isCorrect && (
                <Button variant="ghost" size="sm" onClick={nextHint} className="text-xs h-7">
                  💡 Hint {showHint ? `(${hintIndex + 1}/${data.hints.length})` : ""}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={reset} className="text-xs h-7">
                <RotateCcw className="w-3 h-3 mr-1" /> Reset
              </Button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={isCorrect}
            className="w-full min-h-[180px] p-4 font-mono text-sm bg-background resize-y focus:outline-none leading-relaxed"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      {/* Hint */}
      {showHint && data.hints && data.hints[hintIndex] && (
        <div className="px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm animate-fade-in">
          <span className="text-blue-600 dark:text-blue-400 font-medium">💡 Hint:</span>{" "}
          <span className="text-foreground/80">{data.hints[hintIndex]}</span>
        </div>
      )}

      {/* Run button */}
      <Button
        onClick={handleRun}
        disabled={isCorrect}
        className="w-full gap-2"
        size="lg"
      >
        <Play className="w-4 h-4" /> Run Code ▶
      </Button>

      {/* Output console */}
      <Card className={`${isCorrect ? "border-green-500/30" : hasRun ? "border-red-500/20" : "border-border"}`}>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Output Console</span>
            {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
            {hasRun && !isCorrect && <AlertCircle className="w-4 h-4 text-red-500 ml-auto" />}
          </div>
          <pre className={`p-4 font-mono text-sm min-h-[60px] whitespace-pre-wrap ${
            isCorrect ? "text-green-600 dark:text-green-400" :
            hasRun ? "text-red-500" : "text-muted-foreground"
          }`}>
            {output || "Click 'Run Code' to see output..."}
          </pre>
        </CardContent>
      </Card>

      {/* Success state */}
      {isCorrect && (
        <Card className="border-green-500/20 bg-green-500/[0.04] animate-fade-in">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="font-bold text-green-600 dark:text-green-400">Code Fixed! ✅</span>
            </div>
            {data.key_insight && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <span className="text-sm">💡</span>
                <p className="text-sm text-foreground/80">{data.key_insight}</p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" /> Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
