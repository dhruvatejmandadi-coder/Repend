import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Lightbulb } from "lucide-react";

type Parameter = {
  name: string;
  icon: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  description: string;
};

type SimulationData = {
  title: string;
  description: string;
  equation_label: string;
  equation_template: string;
  output_label: string;
  parameters: Parameter[];
  thresholds: { label: string; min_percent: number; message: string }[];
};

function getParamLevel(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  if (pct >= 75) return { level: "high", color: "text-green-500", icon: TrendingUp };
  if (pct >= 35) return { level: "mid", color: "text-yellow-500", icon: Minus };
  return { level: "low", color: "text-red-500", icon: TrendingDown };
}

export default function SimulationLab({ data }: { data: SimulationData }) {
  const parameters = data?.parameters ?? [];
  const thresholds = data?.thresholds ?? [];

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(parameters.map((p) => [p.name, p.default]))
  );

  const totalCapacity = useMemo(() => {
    if (!parameters.length) return 0;
    const total = parameters.reduce((sum, p) => {
      const pct = ((values[p.name] ?? p.min) - p.min) / (p.max - p.min);
      return sum + pct;
    }, 0);
    return Math.round((total / parameters.length) * 100);
  }, [values, parameters]);

  const threshold = useMemo(() => {
    if (!thresholds.length) return null;
    const sorted = [...thresholds].sort((a, b) => b.min_percent - a.min_percent);
    return sorted.find((t) => totalCapacity >= t.min_percent) || sorted[sorted.length - 1];
  }, [totalCapacity, thresholds]);

  if (!parameters.length) {
    return <Card><CardContent className="p-6 text-muted-foreground text-sm">No simulation data available.</CardContent></Card>;
  }

  const outcomeColor = totalCapacity >= 75
    ? "border-green-500/40 bg-green-500/5"
    : totalCapacity >= 40
    ? "border-yellow-500/40 bg-yellow-500/5"
    : "border-destructive/40 bg-destructive/5";

  return (
    <div className="space-y-5">
      {/* Scenario prompt */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-display font-bold text-base mb-1">Adjust the factors below</h3>
              <p className="text-sm text-muted-foreground">
                Each slider controls a key variable. Change them to see how different combinations affect the outcome.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parameter sliders */}
      {parameters.map((p) => {
        const { level, color, icon: StatusIcon } = getParamLevel(values[p.name], p.min, p.max);
        const pct = Math.round(((values[p.name] - p.min) / (p.max - p.min)) * 100);

        return (
          <Card key={p.name} className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.icon}</span>
                  <span className="font-medium text-sm">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${color}`} />
                  <Badge variant="outline" className="font-mono text-xs">
                    {values[p.name]} {p.unit}
                  </Badge>
                </div>
              </div>
              <Slider
                value={[values[p.name]]}
                min={p.min}
                max={p.max}
                step={1}
                onValueChange={([v]) => setValues((prev) => ({ ...prev, [p.name]: v }))}
                className="w-full"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex-1">{p.description}</p>
                <span className={`text-xs font-medium ${color} ml-2`}>
                  {level === "high" ? "Strong" : level === "mid" ? "Moderate" : "Weak"}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Outcome card */}
      <Card className={`border-2 ${outcomeColor}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display font-bold text-base">{threshold?.label || "Outcome"}</p>
            <Badge
              variant={totalCapacity >= 75 ? "default" : totalCapacity >= 40 ? "secondary" : "destructive"}
              className="font-mono"
            >
              {totalCapacity}%
            </Badge>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                totalCapacity >= 75 ? "bg-green-500" : totalCapacity >= 40 ? "bg-yellow-500" : "bg-destructive"
              }`}
              style={{ width: `${totalCapacity}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{threshold?.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
