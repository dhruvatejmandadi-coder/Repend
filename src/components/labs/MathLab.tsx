import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  CheckCircle2, RotateCcw, Lightbulb, Eye, EyeOff,
  Send, FlaskConical, ChevronRight, BarChart3, SlidersHorizontal
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar,
  ReferenceDot, ReferenceLine
} from "recharts";

/* ═══════════════ TYPES ═══════════════ */

type MathPoint = { x: number; y: number; label?: string };

type InteractiveParam = {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

type GraphData = {
  type: "function" | "scatter" | "bar" | "histogram";
  equation?: string;
  points?: MathPoint[];
  x_label?: string;
  y_label?: string;
  x_range?: [number, number];
  y_range?: [number, number];
  key_points?: { x: number; y: number; label: string }[];
  data_labels?: string[];
  data_values?: number[];
};

type GeometryShape = {
  type: "triangle" | "rectangle" | "circle" | "polygon" | "line" | "angle";
  points?: { x: number; y: number; label?: string }[];
  center?: { x: number; y: number };
  radius?: number;
  labels?: Record<string, string>;
  measurements?: Record<string, string>;
};

type SolutionStep = {
  step: number;
  expression: string;
  explanation: string;
};

type Task = {
  id: number;
  description: string;
  type?: "input" | "choice" | "explanation";
  correct_answer?: string;
  options?: string[];
};

type MathLabData = {
  title: string;
  objective: string;
  concept_overview: string;
  visual_type: "graph" | "geometry" | "solution_steps" | "chart";
  graph_data?: GraphData;
  geometry?: GeometryShape[];
  solution_steps?: SolutionStep[];
  interactive_params?: InteractiveParam[];
  scenario?: string;
  instructions?: string;
  tasks: Task[];
  hints: string[];
  solution: string;
  solution_explanation: string;
};

type Props = {
  data: MathLabData;
  onComplete?: () => void;
  isCompleted?: boolean;
};

/* ═══════════════ EVALUATE EQUATION ═══════════════ */

function evaluateEquation(equation: string, x: number, params: Record<string, number>): number | null {
  try {
    let expr = equation.replace(/\^/g, "**");
    // Replace parameter variables with their values
    for (const [name, value] of Object.entries(params)) {
      // Replace standalone param names (not inside function names)
      expr = expr.replace(new RegExp(`(?<![a-zA-Z.])${name}(?![a-zA-Z(])`, "g"), `(${value})`);
    }
    expr = expr.replace(/(?<![a-zA-Z.])x(?![a-zA-Z(])/g, `(${x})`);
    const y = Function(`"use strict"; return (${expr})`)();
    if (typeof y === "number" && isFinite(y)) return Math.round(y * 100) / 100;
    return null;
  } catch {
    return null;
  }
}

/* ═══════════════ INTERACTIVE GRAPH ═══════════════ */

function MathGraph({ graphData, interactiveParams }: { graphData: GraphData; interactiveParams?: InteractiveParam[] }) {
  const hasSliders = interactiveParams && interactiveParams.length > 0;
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    if (interactiveParams) {
      for (const p of interactiveParams) {
        defaults[p.name] = p.default;
      }
    }
    return defaults;
  });

  const chartData = useMemo(() => {
    if (graphData.points && graphData.points.length > 0 && !hasSliders) {
      return graphData.points.map((p) => ({ x: p.x, y: p.y }));
    }

    if (graphData.equation) {
      const xMin = graphData.x_range?.[0] ?? -10;
      const xMax = graphData.x_range?.[1] ?? 10;
      const points: { x: number; y: number }[] = [];
      const step = (xMax - xMin) / 100;

      for (let x = xMin; x <= xMax; x += step) {
        const y = evaluateEquation(graphData.equation, x, paramValues);
        if (y !== null) {
          points.push({ x: Math.round(x * 100) / 100, y });
        }
      }
      return points;
    }

    return [];
  }, [graphData, paramValues, hasSliders]);

  // Recalculate key points with current params
  const dynamicKeyPoints = useMemo(() => {
    if (!graphData.key_points || !graphData.equation) return graphData.key_points ?? [];
    if (!hasSliders) return graphData.key_points;
    // Re-evaluate key point y values with current params
    return graphData.key_points.map(kp => {
      const y = evaluateEquation(graphData.equation!, kp.x, paramValues);
      return { ...kp, y: y ?? kp.y };
    });
  }, [graphData.key_points, graphData.equation, paramValues, hasSliders]);

  const handleParamChange = useCallback((name: string, value: number) => {
    setParamValues(prev => ({ ...prev, [name]: value }));
  }, []);

  // Build current equation display
  const displayEquation = useMemo(() => {
    if (!graphData.equation) return null;
    let eq = graphData.equation;
    for (const [name, value] of Object.entries(paramValues)) {
      eq = eq.replace(new RegExp(`(?<![a-zA-Z.])${name}(?![a-zA-Z(])`, "g"), String(value));
    }
    return eq;
  }, [graphData.equation, paramValues]);

  if (graphData.type === "bar" || graphData.type === "histogram") {
    const barData = (graphData.data_labels ?? []).map((label, i) => ({
      name: label,
      value: graphData.data_values?.[i] ?? 0,
    }));

    return (
      <div className="w-full h-72 bg-background rounded-lg border p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (graphData.type === "scatter") {
    return (
      <div className="w-full h-72 bg-background rounded-lg border p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="x" name={graphData.x_label || "x"} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis dataKey="y" name={graphData.y_label || "y"} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
            <Scatter data={chartData} fill="hsl(var(--accent))" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: Line chart (function graph) with optional sliders
  return (
    <div className="space-y-3">
      <div className="w-full h-72 bg-background rounded-lg border p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="x"
              label={{ value: graphData.x_label || "x", position: "bottom", fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              type="number"
              domain={graphData.x_range ? [graphData.x_range[0], graphData.x_range[1]] : ["auto", "auto"]}
            />
            <YAxis
              label={{ value: graphData.y_label || "y", angle: -90, position: "insideLeft", fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              domain={graphData.y_range ? [graphData.y_range[0], graphData.y_range[1]] : ["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
              formatter={(value: number) => [value.toFixed(2), "y"]}
              labelFormatter={(label: number) => `x = ${label}`}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="y"
              stroke="hsl(var(--accent))"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--accent))" }}
              isAnimationActive={false}
            />
            {dynamicKeyPoints.map((kp, i) => (
              <ReferenceDot
                key={i}
                x={kp.x}
                y={kp.y}
                r={5}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--primary-foreground))"
                strokeWidth={2}
                label={{ value: kp.label, position: "top", fontSize: 11, fill: "hsl(var(--primary))" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Equation display */}
      {displayEquation && (
        <p className="text-center text-sm font-mono text-accent">
          y = {displayEquation}
        </p>
      )}

      {/* Interactive Parameter Sliders */}
      {hasSliders && (
        <Card className="border-accent/20 bg-accent/[0.03]">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Adjust Parameters
            </div>
            {interactiveParams!.map((param) => (
              <div key={param.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">{param.label}</label>
                  <Badge variant="outline" className="text-xs font-mono tabular-nums">
                    {param.name} = {paramValues[param.name] ?? param.default}
                  </Badge>
                </div>
                <Slider
                  value={[paramValues[param.name] ?? param.default]}
                  onValueChange={([v]) => handleParamChange(param.name, v)}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{param.min}</span>
                  <span>{param.max}</span>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                const defaults: Record<string, number> = {};
                for (const p of interactiveParams!) defaults[p.name] = p.default;
                setParamValues(defaults);
              }}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset to defaults
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════ GEOMETRY RENDERER ═══════════════ */

function GeometryDiagram({ shapes }: { shapes: GeometryShape[] }) {
  const svgSize = 280;
  const pad = 30;

  return (
    <div className="w-full flex justify-center">
      <div className="bg-background rounded-lg border p-4">
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          {/* Grid */}
          <defs>
            <pattern id="mathgrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={svgSize} height={svgSize} fill="url(#mathgrid)" rx="8" />

          {shapes.map((shape, si) => {
            if (shape.type === "circle" && shape.center && shape.radius) {
              const cx = pad + (shape.center.x / 10) * (svgSize - 2 * pad);
              const cy = svgSize - pad - (shape.center.y / 10) * (svgSize - 2 * pad);
              const r = (shape.radius / 10) * (svgSize - 2 * pad);
              return (
                <g key={si}>
                  <circle cx={cx} cy={cy} r={r} fill="hsl(var(--accent) / 0.15)" stroke="hsl(var(--accent))" strokeWidth="2" />
                  <circle cx={cx} cy={cy} r={3} fill="hsl(var(--primary))" />
                  {shape.measurements?.radius && (
                    <text x={cx + r / 2} y={cy - 5} fontSize="11" fill="hsl(var(--foreground))" textAnchor="middle">
                      r = {shape.measurements.radius}
                    </text>
                  )}
                </g>
              );
            }

            if ((shape.type === "triangle" || shape.type === "rectangle" || shape.type === "polygon" || shape.type === "line") && shape.points) {
              const pts = shape.points.map((p) => ({
                x: pad + (p.x / 10) * (svgSize - 2 * pad),
                y: svgSize - pad - (p.y / 10) * (svgSize - 2 * pad),
                label: p.label,
              }));

              const pathStr = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") +
                (shape.type !== "line" ? " Z" : "");

              return (
                <g key={si}>
                  <path
                    d={pathStr}
                    fill={shape.type === "line" ? "none" : "hsl(var(--accent) / 0.1)"}
                    stroke="hsl(var(--accent))"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {pts.map((p, pi) => (
                    <g key={pi}>
                      <circle cx={p.x} cy={p.y} r={3.5} fill="hsl(var(--primary))" />
                      {p.label && (
                        <text
                          x={p.x}
                          y={p.y - 10}
                          fontSize="12"
                          fontWeight="600"
                          fill="hsl(var(--foreground))"
                          textAnchor="middle"
                        >
                          {p.label}
                        </text>
                      )}
                    </g>
                  ))}
                  {/* Side measurements */}
                  {shape.measurements && Object.entries(shape.measurements).map(([key, val], mi) => {
                    if (pts.length > mi + 1) {
                      const midX = (pts[mi].x + pts[(mi + 1) % pts.length].x) / 2;
                      const midY = (pts[mi].y + pts[(mi + 1) % pts.length].y) / 2;
                      return (
                        <text key={mi} x={midX + 8} y={midY} fontSize="10" fill="hsl(var(--muted-foreground))" textAnchor="middle">
                          {val}
                        </text>
                      );
                    }
                    return null;
                  })}
                </g>
              );
            }

            if (shape.type === "angle" && shape.points && shape.points.length >= 3) {
              const pts = shape.points.map((p) => ({
                x: pad + (p.x / 10) * (svgSize - 2 * pad),
                y: svgSize - pad - (p.y / 10) * (svgSize - 2 * pad),
                label: p.label,
              }));
              return (
                <g key={si}>
                  <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke="hsl(var(--accent))" strokeWidth="2" />
                  <line x1={pts[1].x} y1={pts[1].y} x2={pts[2].x} y2={pts[2].y} stroke="hsl(var(--accent))" strokeWidth="2" />
                  {pts.map((p, pi) => (
                    <g key={pi}>
                      <circle cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" />
                      {p.label && (
                        <text x={p.x} y={p.y - 10} fontSize="12" fontWeight="600" fill="hsl(var(--foreground))" textAnchor="middle">
                          {p.label}
                        </text>
                      )}
                    </g>
                  ))}
                  {shape.measurements?.angle && (
                    <text x={pts[1].x + 15} y={pts[1].y - 5} fontSize="10" fill="hsl(var(--muted-foreground))">
                      {shape.measurements.angle}
                    </text>
                  )}
                </g>
              );
            }

            return null;
          })}
        </svg>
      </div>
    </div>
  );
}

/* ═══════════════ SOLUTION STEPS ═══════════════ */

function SolutionStepsVisual({ steps }: { steps: SolutionStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.step} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
          <Badge variant="outline" className="shrink-0 mt-0.5 text-xs">{s.step}</Badge>
          <div className="space-y-1">
            <p className="font-mono text-sm text-accent">{s.expression}</p>
            <p className="text-xs text-muted-foreground">{s.explanation}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════ MAIN MATH LAB ═══════════════ */

export default function MathLab({ data, onComplete, isCompleted }: Props) {
  const [started, setStarted] = useState(false);
  const [currentTask, setCurrentTask] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [hintsRevealed, setHintsRevealed] = useState<number[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  const tasks = data.tasks ?? [];
  const hints = data.hints ?? [];
  const allTasksDone = tasks.length > 0 && Object.keys(submitted).length >= tasks.length;

  useEffect(() => {
    if (allTasksDone && !completionFired && onComplete) {
      onComplete();
      setCompletionFired(true);
    }
  }, [allTasksDone, completionFired, onComplete]);

  const reset = () => {
    setStarted(false);
    setCurrentTask(0);
    setAnswers({});
    setSubmitted({});
    setHintsRevealed([]);
    setShowSolution(false);
    setCompletionFired(false);
  };

  // Completed state
  if (isCompleted && !started) {
    return (
      <Card className="border-green-500/20 bg-green-500/[0.04]">
        <CardContent className="p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
          <h3 className="font-bold text-lg">Math Lab Complete</h3>
          <p className="text-sm text-muted-foreground">You've completed this math lab.</p>
          <Button variant="outline" onClick={() => { reset(); setStarted(true); }}>
            <RotateCcw className="w-4 h-4 mr-1" /> Redo Lab
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Start screen
  if (!started) {
    return (
      <Card className="border-accent/20 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent via-primary to-accent" />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{data.title || "Math Lab"}</h3>
              <p className="text-sm text-muted-foreground">{data.objective}</p>
            </div>
          </div>

          {data.concept_overview && (
            <div className="bg-muted/30 rounded-lg p-4 text-sm">
              <p className="font-semibold text-xs text-muted-foreground mb-1">📘 Concept Overview</p>
              <p>{data.concept_overview}</p>
            </div>
          )}

          {/* Visual preview */}
          {data.visual_type === "graph" && data.graph_data && (
            <MathGraph graphData={data.graph_data} interactiveParams={data.interactive_params} />
          )}
          {data.visual_type === "geometry" && data.geometry && (
            <GeometryDiagram shapes={data.geometry} />
          )}
          {data.visual_type === "chart" && data.graph_data && (
            <MathGraph graphData={data.graph_data} />
          )}
          {data.visual_type === "solution_steps" && data.solution_steps && (
            <SolutionStepsVisual steps={data.solution_steps} />
          )}

          {data.scenario && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 text-sm">
              <p className="font-semibold text-xs text-accent mb-1">🌍 Real-World Scenario</p>
              <p>{data.scenario}</p>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-3">{tasks.length} tasks to complete</p>
            <Button onClick={() => setStarted(true)} className="px-8">
              <FlaskConical className="w-4 h-4 mr-2" /> Start Lab
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active lab
  const task = tasks[currentTask];

  return (
    <div className="space-y-5">
      {/* Visual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> {data.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.visual_type === "graph" && data.graph_data && <MathGraph graphData={data.graph_data} />}
          {data.visual_type === "geometry" && data.geometry && <GeometryDiagram shapes={data.geometry} />}
          {data.visual_type === "chart" && data.graph_data && <MathGraph graphData={data.graph_data} />}
          {data.visual_type === "solution_steps" && data.solution_steps && <SolutionStepsVisual steps={data.solution_steps} />}
        </CardContent>
      </Card>

      {/* Instructions */}
      {data.instructions && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-1">📋 Instructions</p>
            <p className="text-sm whitespace-pre-wrap">{data.instructions}</p>
          </CardContent>
        </Card>
      )}

      {/* Task Progress */}
      <div className="flex items-center gap-2">
        {tasks.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              submitted[i] ? "bg-accent" : i === currentTask ? "bg-accent/40" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Current Task */}
      {task && !allTasksDone && (
        <Card className="border-accent/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Task {currentTask + 1}/{tasks.length}</Badge>
            </div>
            <p className="text-sm font-medium">{task.description}</p>

            {/* Choice options */}
            {task.type === "choice" && task.options && (
              <div className="space-y-2">
                {task.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setAnswers({ ...answers, [currentTask]: opt })}
                    disabled={!!submitted[currentTask]}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition ${
                      answers[currentTask] === opt
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/40"
                    } ${submitted[currentTask] ? "opacity-60" : ""}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Text workspace */}
            {(task.type === "input" || task.type === "explanation" || !task.type) && (
              <Textarea
                placeholder={task.type === "explanation" ? "Explain your reasoning..." : "Type your answer..."}
                value={answers[currentTask] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [currentTask]: e.target.value })}
                disabled={!!submitted[currentTask]}
                rows={3}
                className="font-mono"
              />
            )}

            {/* Feedback after submit */}
            {submitted[currentTask] && task.correct_answer && (
              <div className={`rounded-lg p-3 text-sm ${
                answers[currentTask]?.trim().toLowerCase() === task.correct_answer.trim().toLowerCase()
                  ? "bg-green-500/10 border border-green-500/20 text-green-400"
                  : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
              }`}>
                {answers[currentTask]?.trim().toLowerCase() === task.correct_answer.trim().toLowerCase()
                  ? "✅ Correct!"
                  : `💡 Expected: ${task.correct_answer}`}
              </div>
            )}

            <div className="flex gap-2">
              {!submitted[currentTask] && (
                <Button
                  onClick={() => {
                    setSubmitted({ ...submitted, [currentTask]: true });
                  }}
                  disabled={!answers[currentTask]?.trim()}
                  size="sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1" /> Submit
                </Button>
              )}
              {submitted[currentTask] && currentTask < tasks.length - 1 && (
                <Button size="sm" variant="outline" onClick={() => setCurrentTask(currentTask + 1)}>
                  Next Task <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All done */}
      {allTasksDone && (
        <Card className="border-green-500/20 bg-green-500/[0.04]">
          <CardContent className="p-5 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <h3 className="font-bold text-lg">Lab Complete!</h3>
            <p className="text-sm text-muted-foreground">You completed all {tasks.length} tasks.</p>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" /> Redo Lab
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Hints */}
      {hints.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5" /> Hints
            </p>
            {hints.map((hint, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-left text-sm"
                onClick={() => setHintsRevealed((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i])}
              >
                {hintsRevealed.includes(i)
                  ? <><Eye className="w-3.5 h-3.5 mr-2 shrink-0" /> {hint}</>
                  : <><EyeOff className="w-3.5 h-3.5 mr-2 shrink-0" /> Hint #{i + 1} — Click to reveal</>}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Solution */}
      <Card>
        <CardContent className="p-4">
          <Button variant="ghost" size="sm" onClick={() => setShowSolution(!showSolution)} className="w-full justify-start">
            <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
            {showSolution ? "Hide Solution" : "Show Solution"}
          </Button>
          {showSolution && (
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Answer</p>
                <p className="font-mono bg-muted/30 rounded p-2 whitespace-pre-wrap">{data.solution}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Explanation</p>
                <p className="whitespace-pre-wrap">{data.solution_explanation}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
