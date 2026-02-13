import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Zap } from "lucide-react";

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

export default function SimulationLab({ data }: { data: SimulationData }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(data.parameters.map((p) => [p.name, p.default]))
  );

  const totalCapacity = useMemo(() => {
    const total = data.parameters.reduce((sum, p) => sum + values[p.name], 0);
    const maxTotal = data.parameters.reduce((sum, p) => sum + p.max, 0);
    return Math.round((total / maxTotal) * 100);
  }, [values, data.parameters]);

  const limiting = useMemo(() => {
    let minRatio = Infinity;
    let limitingParam = "";
    data.parameters.forEach((p) => {
      const ratio = values[p.name] / p.max;
      if (ratio < minRatio) {
        minRatio = ratio;
        limitingParam = p.name;
      }
    });
    return limitingParam;
  }, [values, data.parameters]);

  const threshold = useMemo(() => {
    const sorted = [...data.thresholds].sort((a, b) => b.min_percent - a.min_percent);
    return sorted.find((t) => totalCapacity >= t.min_percent) || sorted[sorted.length - 1];
  }, [totalCapacity, data.thresholds]);

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <h3 className="font-display font-bold text-lg">{data.equation_label}</h3>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm">
            {data.parameters.map((p, i) => (
              <span key={p.name}>
                <span className="text-primary font-bold">{values[p.name]}</span>{" "}
                <span className="text-muted-foreground">{p.name}</span>
                {i < data.parameters.length - 1 && <span className="text-muted-foreground"> + </span>}
              </span>
            ))}
            <span className="text-muted-foreground"> → </span>
            <span className="text-primary font-bold">{data.output_label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Adjust the sliders below to see how each factor affects the output!</p>
        </CardContent>
      </Card>

      {data.parameters.map((p) => (
        <div key={p.name} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{p.icon}</span>
              <span className="font-medium text-sm">{p.name}</span>
              {limiting === p.name && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  <AlertTriangle className="w-3 h-3 mr-0.5" /> LIMITING
                </Badge>
              )}
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {values[p.name]} / {p.max} {p.unit}
            </Badge>
          </div>
          <Slider
            value={[values[p.name]]}
            min={p.min}
            max={p.max}
            step={1}
            onValueChange={([v]) => setValues((prev) => ({ ...prev, [p.name]: v }))}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">{p.description}</p>
        </div>
      ))}

      <Card className={`border-2 ${totalCapacity >= 80 ? "border-green-500/50 bg-green-500/5" : totalCapacity >= 50 ? "border-yellow-500/50 bg-yellow-500/5" : "border-destructive/50 bg-destructive/5"}`}>
        <CardContent className="p-4 flex items-start gap-3">
          {totalCapacity >= 80 ? (
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold">{threshold?.label || "Result"}</p>
            <p className="text-sm text-muted-foreground">Capacity: <strong>{totalCapacity}%</strong></p>
            <p className="text-sm text-muted-foreground">{threshold?.message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
