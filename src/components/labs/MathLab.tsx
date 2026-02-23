import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

type Parameter = {
  name: string;
  min: number;
  max: number;
  default: number;
  step?: number;
};

type Props = {
  data: {
    title?: string;
    description?: string;
    equationTemplate: string;
    // Example: "y = A * sin(Bx + C) + D"
    parameters: Parameter[];
    xMin?: number;
    xMax?: number;
  };
};

export default function GraphMathLab({ data }: Props) {
  const { title, description, equationTemplate, parameters, xMin = -10, xMax = 10 } = data;

  // State for parameters
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(parameters.map((p) => [p.name, p.default])),
  );

  // Generate equation string dynamically
  const equationString = useMemo(() => {
    let eq = equationTemplate;
    Object.entries(values).forEach(([key, val]) => {
      eq = eq.replaceAll(key, val.toString());
    });
    return eq;
  }, [equationTemplate, values]);

  // Generate graph data points
  const graphData = useMemo(() => {
    const points = [];
    for (let x = xMin; x <= xMax; x += 0.2) {
      let y = 0;

      // Safe dynamic evaluation
      try {
        const expr = equationTemplate
          .replaceAll("sin", "Math.sin")
          .replaceAll("cos", "Math.cos")
          .replaceAll("tan", "Math.tan");

        let evalExpr = expr;
        Object.entries(values).forEach(([key, val]) => {
          evalExpr = evalExpr.replaceAll(key, val.toString());
        });

        const fn = new Function("x", `return ${evalExpr.split("=")[1]}`);
        y = fn(x);
      } catch {
        y = 0;
      }

      points.push({ x, y });
    }
    return points;
  }, [equationTemplate, values, xMin, xMax]);

  return (
    <div className="space-y-6">
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="font-bold text-lg">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      <Badge variant="outline">{equationString}</Badge>

      <Card>
        <CardContent className="p-4 h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={graphData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" type="number" domain={[xMin, xMax]} />
              <YAxis />
              <Line type="monotone" dataKey="y" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {parameters.map((param) => (
          <div key={param.name} className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>{param.name}</span>
              <span>{values[param.name]}</span>
            </div>
            <Slider
              min={param.min}
              max={param.max}
              step={param.step ?? 0.1}
              value={[values[param.name]]}
              onValueChange={(val) =>
                setValues((prev) => ({
                  ...prev,
                  [param.name]: val[0],
                }))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
