import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2 } from "lucide-react";
import type { QuizQuestion } from "@/pages/CourseCreator";

interface Props {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}

function emptyQuestion(): QuizQuestion {
  return {
    question: "",
    options: ["", "", "", ""],
    correct: 0,
    explanation: "",
  };
}

export default function QuizEditor({ questions, onChange }: Props) {
  const addQuestion = () => onChange([...questions, emptyQuestion()]);

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    onChange(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    if (updated[qIndex].options.length < 6) {
      updated[qIndex].options.push("");
      onChange(updated);
    }
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const updated = [...questions];
    if (updated[qIndex].options.length > 2) {
      updated[qIndex].options.splice(oIndex, 1);
      if (updated[qIndex].correct >= updated[qIndex].options.length) {
        updated[qIndex].correct = 0;
      }
      onChange(updated);
    }
  };

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <p className="text-sm">No quiz questions yet</p>
          <p className="text-xs mt-1">Add questions to test student understanding</p>
        </div>
      )}

      {questions.map((q, qi) => (
        <Card key={qi} className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Question {qi + 1}</Label>
                <Textarea
                  placeholder="Enter your question..."
                  value={q.question}
                  onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                  rows={2}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 mt-5"
                onClick={() => removeQuestion(qi)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Options (select the correct one)</Label>
              <RadioGroup
                value={String(q.correct)}
                onValueChange={(v) => updateQuestion(qi, { correct: parseInt(v) })}
              >
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <RadioGroupItem value={String(oi)} id={`q${qi}-o${oi}`} />
                    <Input
                      placeholder={`Option ${oi + 1}`}
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    {q.options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeOption(qi, oi)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </RadioGroup>
              {q.options.length < 6 && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => addOption(qi)}>
                  <Plus className="w-3 h-3 mr-1" /> Add Option
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Explanation (shown after answer)</Label>
              <Input
                placeholder="Why is this the correct answer?"
                value={q.explanation}
                onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" className="w-full" onClick={addQuestion}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Question
      </Button>
    </div>
  );
}
