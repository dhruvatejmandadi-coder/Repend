import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CheckCircle2, RotateCcw, Target } from "lucide-react";

export type GraphSlider = {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  description?: string;
};

export type GraphTarget = {
  description: string;
  /** Parameter values that match the target (within tolerance) */
  params: Record<string, number>;
  tolerance?: number;
};

export type GraphLabData = {
  lab_type: "graph";
  title?: string;
  goal?: string;
  graph_type: "linear" | "quadratic" | "exponential" | "trig" | "custom";
  /** The equation template: e.g. "m * x + b", "a * (x - h)^2 + k", "A * sin(B * (x - C)) + D" */
  equation: string;
  /** Display equation: e.g. "f(x) = mx + b" */
  display_equation?: string;
  sliders: GraphSlider[];
  target?: GraphTarget;
  x_range?: [number, number];
  y_range?: [number, number];
  key_insight?: string;
};

type Props = {
  data: GraphLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
  onReplay?: () => void;
};

const GRAPH_W = 500;
const GRAPH_H = 400;
const PADDING = 50;

function evaluateEquation(equation: string, x: number, params: Record<string, number>): number {
  try {
    let expr = equation;
    // Replace params
    for (const [key, val] of Object.entries(params)) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, "g"), String(val));
    }
    expr = expr.replace(/\bx\b/g, `(${x})`);
    // Handle ^ as **
    expr = expr.replace(/\^/g, "**");
    // Handle sin, cos, tan, abs, sqrt, log, exp, pi
    expr = expr.replace(/\bsin\b/g, "Math.sin");
    expr = expr.replace(/\bcos\b/g, "Math.cos");
    expr = expr.replace(/\btan\b/g, "Math.tan");
    expr = expr.replace(/\babs\b/g, "Math.abs");
    expr = expr.replace(/\bsqrt\b/g, "Math.sqrt");
    expr = expr.replace(/\blog\b/g, "Math.log");
    expr = expr.replace(/\bexp\b/g, "Math.exp");
    expr = expr.replace(/\bpi\b/g, String(Math.PI));
    expr = expr.replace(/π/g, String(Math.PI));
    
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === "number" && isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

function drawGraph(
  canvas: HTMLCanvasElement,
  equation: string,
  params: Record<string, number>,
  xRange: [number, number],
  yRange: [number, number],
  targetParams?: Record<string, number>,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = GRAPH_W * dpr;
  canvas.height = GRAPH_H * dpr;
  ctx.scale(dpr, dpr);

  const plotW = GRAPH_W - PADDING * 2;
  const plotH = GRAPH_H - PADDING * 2;
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  // Clear
  const isDark = document.documentElement.classList.contains("dark");
  ctx.fillStyle = isDark ? "#1a1a2e" : "#fafafa";
  ctx.fillRect(0, 0, GRAPH_W, GRAPH_H);

  // Grid
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const gx = PADDING + (plotW / 10) * i;
    const gy = PADDING + (plotH / 10) * i;
    ctx.beginPath(); ctx.moveTo(gx, PADDING); ctx.lineTo(gx, PADDING + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PADDING, gy); ctx.lineTo(PADDING + plotW, gy); ctx.stroke();
  }

  // Axes
  const xAxisY = PADDING + plotH * (yMax / (yMax - yMin));
  const yAxisX = PADDING + plotW * (-xMin / (xMax - xMin));
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1.5;
  if (xAxisY >= PADDING && xAxisY <= PADDING + plotH) {
    ctx.beginPath(); ctx.moveTo(PADDING, xAxisY); ctx.lineTo(PADDING + plotW, xAxisY); ctx.stroke();
  }
  if (yAxisX >= PADDING && yAxisX <= PADDING + plotW) {
    ctx.beginPath(); ctx.moveTo(yAxisX, PADDING); ctx.lineTo(yAxisX, PADDING + plotH); ctx.stroke();
  }

  // Axis labels
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i <= 5; i++) {
    const val = xMin + (xMax - xMin) * (i / 5);
    const px = PADDING + (plotW / 5) * i;
    ctx.fillText(val.toFixed(1), px, PADDING + plotH + 18);
  }
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const val = yMax - (yMax - yMin) * (i / 5);
    const py = PADDING + (plotH / 5) * i;
    ctx.fillText(val.toFixed(1), PADDING - 8, py + 4);
  }

  // Helper to plot a curve
  function plotCurve(eq: string, p: Record<string, number>, color: string, lineW: number, dashed = false) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.setLineDash(dashed ? [6, 4] : []);
    ctx.beginPath();
    let started = false;
    const steps = 300;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (xMax - xMin) * (i / steps);
      const y = evaluateEquation(eq, x, p);
      if (isNaN(y) || !isFinite(y)) { started = false; continue; }
      const px = PADDING + ((x - xMin) / (xMax - xMin)) * plotW;
      const py = PADDING + ((yMax - y) / (yMax - yMin)) * plotH;
      if (py < PADDING - 20 || py > PADDING + plotH + 20) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw target curve (dashed)
  if (targetParams) {
    plotCurve(equation, targetParams, isDark ? "rgba(239,68,68,0.5)" : "rgba(239,68,68,0.4)", 2.5, true);
  }

  // Draw user's curve
  const primaryColor = isDark ? "#818cf8" : "#6366f1";
  plotCurve(equation, params, primaryColor, 3);
}

export default function GraphLab({ data, onComplete, isCompleted, onReplay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const s of data.sliders) initial[s.name] = s.default;
    return initial;
  });
  const [completionFired, setCompletionFired] = useState(false);

  const xRange: [number, number] = data.x_range || [-10, 10];
  const yRange: [number, number] = data.y_range || [-10, 10];

  const goalMatched = useMemo(() => {
    if (!data.target?.params) return false;
    const tol = data.target.tolerance ?? 0.3;
    return Object.entries(data.target.params).every(([key, targetVal]) => {
      return Math.abs((params[key] ?? 0) - targetVal) <= tol;
    });
  }, [params, data.target]);

  useEffect(() => {
    if (goalMatched && !completionFired && onComplete) {
      onComplete();
      setCompletionFired(true);
    }
  }, [goalMatched, completionFired, onComplete]);

  // Redraw on param change
  useEffect(() => {
    if (canvasRef.current) {
      drawGraph(canvasRef.current, data.equation, params, xRange, yRange, data.target?.params);
    }
  }, [params, data.equation, xRange, yRange, data.target]);

  const reset = () => {
    const initial: Record<string, number> = {};
    for (const s of data.sliders) initial[s.name] = s.default;
    setParams(initial);
    setCompletionFired(false);
    onReplay?.();
  };

  if (isCompleted && !completionFired) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h3 className="font-bold text-lg">Graph Lab Complete</h3>
          <Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" /> Replay</Button>
        </CardContent>
      </Card>
    );
  }

  // Build display equation with current values
  const displayEq = useMemo(() => {
    let eq = data.display_equation || data.equation;
    for (const [key, val] of Object.entries(params)) {
      eq = eq.replace(new RegExp(`\\b${key}\\b`, "g"), val.toFixed(1));
    }
    return eq;
  }, [data.display_equation, data.equation, params]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📈</span>
            <div>
              <h3 className="font-bold text-lg">{data.title || "Graph Lab"}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] capitalize">{data.graph_type}</Badge>
                <Badge variant="outline" className="text-[10px]">Graph Lab</Badge>
              </div>
            </div>
          </div>
          {data.goal && <p className="text-sm text-muted-foreground">{data.goal}</p>}
        </CardContent>
      </Card>

      {/* Live equation */}
      <div className="text-center py-2">
        <code className="text-lg font-mono font-semibold text-primary">{displayEq}</code>
      </div>

      {/* Target indicator */}
      {data.target && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
          goalMatched
            ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
            : "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400"
        }`}>
          <Target className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Goal:</span>
          <span>{data.target.description}</span>
          {goalMatched && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-auto" />}
        </div>
      )}

      {/* Graph + Sliders layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Canvas */}
        <Card>
          <CardContent className="p-3">
            <canvas
              ref={canvasRef}
              style={{ width: GRAPH_W, height: GRAPH_H, maxWidth: "100%" }}
              className="mx-auto rounded-lg"
            />
            {data.target && (
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-primary inline-block rounded" /> Your graph</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-red-400 inline-block rounded border-dashed" style={{ borderTop: "2px dashed" }} /> Target</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sliders */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Controls</span>
            {data.sliders.map(s => (
              <div key={s.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.label || s.name}</span>
                  <span className="text-sm font-bold tabular-nums">{params[s.name]?.toFixed(1)}</span>
                </div>
                {s.description && (
                  <p className="text-[10px] text-muted-foreground">{s.description}</p>
                )}
                <Slider
                  value={[params[s.name] ?? s.default]}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  onValueChange={(val) => setParams(prev => ({ ...prev, [s.name]: val[0] }))}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{s.min}</span>
                  <span>{s.max}</span>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={reset} className="w-full">
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Success */}
      {goalMatched && (
        <Card className="border-green-500/20 bg-green-500/[0.04] animate-fade-in">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="font-bold text-green-600 dark:text-green-400">Target Matched! ✅</span>
            </div>
            {data.key_insight && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <span className="text-sm">💡</span>
                <p className="text-sm text-foreground/80">{data.key_insight}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
