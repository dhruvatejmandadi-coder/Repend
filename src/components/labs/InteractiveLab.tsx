import React, { useState, useMemo, useEffect } from "react";

/* ===========================
   TYPES
=========================== */

type Parameter = {
  name: string;
  min: number;
  max: number;
  default: number;
  weight: number;
};

type Scenario = {
  id: string;
  question: string;
  impact: Record<string, number>;
};

type Threshold = {
  label: string;
  min_percent: number;
  message: string;
};

type LabData = {
  topic: string;
  parameters: Parameter[];
  scenarios: Scenario[];
  thresholds: Threshold[];
};

type Props = {
  labData: LabData;
};

/* ===========================
   COMPONENT
=========================== */

export default function InteractiveLab({ labData }: Props) {
  const { parameters, scenarios, thresholds } = labData;

  const [values, setValues] = useState<Record<string, number>>({});
  const [scenarioIndex, setScenarioIndex] = useState<number>(0);
  const [answered, setAnswered] = useState<number[]>([]);

  /* ===========================
     INIT DEFAULT VALUES
  =========================== */

  useEffect(() => {
    const initial: Record<string, number> = {};
    parameters.forEach((p) => {
      initial[p.name] = p.default;
    });
    setValues(initial);
  }, [parameters]);

  /* ===========================
     WEIGHTED TOTAL
  =========================== */

  const totalPercent = useMemo(() => {
    let weightedScore = 0;
    let totalWeight = 0;

    parameters.forEach((p) => {
      const value = values[p.name] ?? p.default;
      const normalized = (value - p.min) / (p.max - p.min);

      weightedScore += normalized * p.weight;
      totalWeight += p.weight;
    });

    if (totalWeight === 0) return 0;
    return Math.round((weightedScore / totalWeight) * 100);
  }, [values, parameters]);

  /* ===========================
     OUTCOME
  =========================== */

  const outcome = useMemo(() => {
    const sorted = [...thresholds].sort((a, b) => b.min_percent - a.min_percent);

    return sorted.find((t) => totalPercent >= t.min_percent) ?? sorted[sorted.length - 1];
  }, [totalPercent, thresholds]);

  /* ===========================
     APPLY SCENARIO
  =========================== */

  const applyScenario = (scenario: Scenario) => {
    setValues((prev) => {
      const updated = { ...prev };

      Object.entries(scenario.impact).forEach(([key, delta]) => {
        const current = prev[key] ?? 50;
        const newValue = Math.max(0, Math.min(100, current + delta));
        updated[key] = newValue;
      });

      return updated;
    });

    setAnswered((prev) => [...prev, scenarioIndex]);
  };

  /* ===========================
     RENDER
  =========================== */

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
      {/* ===== SCENARIO ===== */}

      {scenarioIndex < scenarios.length && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: 16,
            marginBottom: 20,
            borderRadius: 8,
          }}
        >
          <h3>
            Scenario {scenarioIndex + 1} of {scenarios.length}
          </h3>

          <p>{scenarios[scenarioIndex].question}</p>

          <button
            onClick={() => applyScenario(scenarios[scenarioIndex])}
            disabled={answered.includes(scenarioIndex)}
            style={{ marginRight: 10 }}
          >
            Apply Decision
          </button>

          {answered.includes(scenarioIndex) && scenarioIndex < scenarios.length - 1 && (
            <button onClick={() => setScenarioIndex((prev) => prev + 1)}>Next →</button>
          )}
        </div>
      )}

      {/* ===== PARAMETERS ===== */}

      {parameters.map((param) => {
        const value = values[param.name] ?? param.default;

        return (
          <div
            key={param.name}
            style={{
              marginBottom: 20,
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{param.name}</strong>
              <span>{value}</span>
            </div>

            <input
              type="range"
              min={param.min}
              max={param.max}
              value={value}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [param.name]: Number(e.target.value),
                }))
              }
              style={{ width: "100%" }}
            />
          </div>
        );
      })}

      {/* ===== OUTCOME ===== */}

      <div
        style={{
          padding: 16,
          border: "2px solid #000",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>{outcome?.label ?? "Outcome"}</strong>
          <strong>{totalPercent}%</strong>
        </div>

        <div
          style={{
            height: 10,
            background: "#eee",
            borderRadius: 5,
            marginTop: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${totalPercent}%`,
              height: "100%",
              background: "black",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <p style={{ marginTop: 10 }}>{outcome?.message}</p>
      </div>
    </div>
  );
}
