import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Info } from "lucide-react";
import type { CreatorModule } from "@/pages/CourseCreator";

const LAB_TYPES = [
  { value: "simulation", label: "Simulation", description: "Students adjust parameters and see outcomes" },
  { value: "classification", label: "Classification", description: "Students sort items into categories" },
  { value: "policy_optimization", label: "Policy Optimization", description: "Students reach targets within constraints" },
  { value: "ethical_dilemma", label: "Ethical Dilemma", description: "Tradeoff decisions with no perfect answer" },
  { value: "decision_lab", label: "Decision Lab", description: "Multi-phase scenario-based decisions" },
];

interface Props {
  module: CreatorModule;
  onChange: (updates: Partial<CreatorModule>) => void;
}

export default function LabEditor({ module, onChange }: Props) {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(module.lab_data ? JSON.stringify(module.lab_data, null, 2) : "");

  const handleTypeChange = (type: string) => {
    onChange({ lab_type: type, lab_data: getDefaultLabData(type) });
    setJsonText(JSON.stringify(getDefaultLabData(type), null, 2));
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      onChange({ lab_data: parsed });
    } catch {
      // Invalid JSON, don't update
    }
  };

  const clearLab = () => {
    onChange({ lab_type: null, lab_data: null, lab_title: null, lab_description: null });
    setJsonText("");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Lab Type</Label>
          <Select value={module.lab_type || ""} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select lab type..." />
            </SelectTrigger>
            <SelectContent>
              {LAB_TYPES.map((lt) => (
                <SelectItem key={lt.value} value={lt.value}>
                  <div>
                    <span className="font-medium">{lt.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{lt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Lab Title</Label>
          <Input
            placeholder="e.g. Market Equilibrium Simulator"
            value={module.lab_title || ""}
            onChange={(e) => onChange({ lab_title: e.target.value || null })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Lab Description</Label>
        <Textarea
          placeholder="Describe what students will do in this lab..."
          value={module.lab_description || ""}
          onChange={(e) => onChange({ lab_description: e.target.value || null })}
          rows={2}
        />
      </div>

      {module.lab_type && (
        <>
          <div className="flex items-center justify-between">
            <Label>Lab Data (JSON)</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                const template = getDefaultLabData(module.lab_type!);
                setJsonText(JSON.stringify(template, null, 2));
                onChange({ lab_data: template });
              }}>
                Load Template
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={clearLab}>
                Remove Lab
              </Button>
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
            <div className="flex items-start gap-2 mb-2">
              <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Edit the JSON below to customize your lab. Use the template as a starting point.
              </p>
            </div>
            <Textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              rows={15}
              className="font-mono text-xs"
              placeholder='{"parameters": [], "decisions": [], ...}'
            />
          </div>
        </>
      )}
    </div>
  );
}

function getDefaultLabData(type: string): any {
  switch (type) {
    case "simulation":
      return {
        parameters: [
          { name: "Parameter 1", icon: "📊", unit: "%", min: 0, max: 100, default: 50 },
          { name: "Parameter 2", icon: "📈", unit: "%", min: 0, max: 100, default: 50 },
          { name: "Parameter 3", icon: "📉", unit: "%", min: 0, max: 100, default: 50 },
        ],
        thresholds: [
          { label: "Excellent", min_percent: 75, message: "Outstanding performance!" },
          { label: "Good", min_percent: 50, message: "Good progress." },
          { label: "Needs Work", min_percent: 0, message: "Try different strategies." },
        ],
        decisions: [
          {
            question: "What strategy do you choose?",
            emoji: "🤔",
            choices: [
              { text: "Option A", explanation: "This increases Parameter 1", set_state: { "Parameter 1": 80, "Parameter 2": 40, "Parameter 3": 60 } },
              { text: "Option B", explanation: "This balances all parameters", set_state: { "Parameter 1": 55, "Parameter 2": 55, "Parameter 3": 55 } },
            ],
          },
        ],
      };
    case "classification":
      return {
        categories: ["Category A", "Category B"],
        items: [
          { name: "Item 1", correct: "Category A", explanation: "Because..." },
          { name: "Item 2", correct: "Category B", explanation: "Because..." },
        ],
      };
    case "policy_optimization":
      return {
        parameters: [
          { name: "Budget", icon: "💰", unit: "%", min: 0, max: 100, default: 50 },
          { name: "Satisfaction", icon: "😊", unit: "%", min: 0, max: 100, default: 50 },
        ],
        constraints: [
          { parameter: "Budget", operator: ">=", value: 30, label: "Keep budget above 30%" },
          { parameter: "Satisfaction", operator: ">=", value: 60, label: "Maintain satisfaction above 60%" },
        ],
        decisions: [
          {
            question: "Choose your approach",
            choices: [
              { text: "Option A", set_state: { Budget: 70, Satisfaction: 45 } },
              { text: "Option B", set_state: { Budget: 40, Satisfaction: 75 } },
            ],
          },
        ],
        max_decisions: 3,
      };
    case "ethical_dilemma":
      return {
        dimensions: [
          { name: "Ethics", icon: "⚖️", default: 50 },
          { name: "Profit", icon: "💰", default: 50 },
        ],
        decisions: [
          {
            question: "You face a dilemma...",
            choices: [
              { text: "Ethical choice", impacts: { Ethics: 15, Profit: -10 } },
              { text: "Profit choice", impacts: { Ethics: -10, Profit: 15 } },
            ],
          },
        ],
      };
    case "decision_lab":
      return {
        concept_knowledge: {
          definition: "Define the concept here.",
          key_ideas: ["Key idea 1", "Key idea 2"],
          examples: ["Example 1"],
        },
        real_world_relevance: {
          domain: "Economics",
          explanation: "Why this matters in the real world...",
          examples: ["Real-world example 1"],
        },
        scenario: {
          title: "Scenario Title",
          description: "Describe the scenario...",
          context: "Additional context...",
        },
        decision_challenge: {
          question: "What would you do?",
          options: [
            { label: "Option A", description: "Description...", consequence: "What happens...", is_best: true },
            { label: "Option B", description: "Description...", consequence: "What happens...", is_best: false },
          ],
        },
        best_decision_explanation: "Why Option A is best...",
        constraints: ["Constraint 1"],
        decision_prompt: "Make your decision.",
      };
    default:
      return {};
  }
}
