import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, ArrowRight } from "lucide-react";

type Item = {
  name: string;
  correct_category: string;
  hint?: string;
};

type Category = {
  name: string;
  emoji: string;
  description: string;
};

type ClassificationData = {
  title: string;
  description: string;
  categories: Category[];
  items: Item[];
};

export default function ClassificationLab({ data }: { data: ClassificationData }) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [currentItem, setCurrentItem] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const item = data.items[currentItem];
  const allAssigned = Object.keys(assignments).length === data.items.length;

  const assignToCategory = (category: string) => {
    setAssignments((prev) => ({ ...prev, [item.name]: category }));
    if (currentItem + 1 < data.items.length) {
      setCurrentItem(currentItem + 1);
    }
  };

  const score = submitted
    ? data.items.filter((it) => assignments[it.name] === it.correct_category).length
    : 0;

  const reset = () => {
    setAssignments({});
    setCurrentItem(0);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-display font-bold text-lg mb-2">
              Results: {score}/{data.items.length} correct
            </h3>
            <div className="w-full bg-secondary rounded-full h-3 mb-4">
              <div
                className="bg-primary h-3 rounded-full transition-all"
                style={{ width: `${(score / data.items.length) * 100}%` }}
              />
            </div>
            <div className="space-y-2">
              {data.items.map((it) => {
                const isCorrect = assignments[it.name] === it.correct_category;
                return (
                  <div key={it.name} className={`flex items-center justify-between p-3 rounded-lg text-sm ${isCorrect ? "bg-green-500/10" : "bg-destructive/10"}`}>
                    <div className="flex items-center gap-2">
                      {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
                      <span className="font-medium">{it.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {!isCorrect && (
                        <span>Your answer: {assignments[it.name]} → </span>
                      )}
                      <span className="font-medium text-foreground">{it.correct_category}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" /> Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.description}</p>

      <div className="flex items-center justify-between">
        <Badge variant="secondary">Item {Math.min(currentItem + 1, data.items.length)} of {data.items.length}</Badge>
        <span className="text-xs text-muted-foreground">{Object.keys(assignments).length} classified</span>
      </div>

      {!allAssigned && (
        <Card className="border-primary/20">
          <CardContent className="p-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">Classify this item:</p>
            <h3 className="font-display font-bold text-xl mb-1">{item.name}</h3>
            {item.hint && <p className="text-xs text-muted-foreground italic">{item.hint}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {data.categories.map((cat) => {
          const count = Object.values(assignments).filter((a) => a === cat.name).length;
          return (
            <button
              key={cat.name}
              onClick={() => !allAssigned && assignToCategory(cat.name)}
              disabled={allAssigned}
              className={`p-4 rounded-lg border text-left transition-all ${
                allAssigned
                  ? "border-border opacity-70"
                  : "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{cat.emoji}</span>
                <span className="font-medium text-sm">{cat.name}</span>
                {count > 0 && <Badge variant="secondary" className="text-[10px] ml-auto">{count}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{cat.description}</p>
            </button>
          );
        })}
      </div>

      {allAssigned && (
        <Button variant="hero" onClick={() => setSubmitted(true)}>
          <ArrowRight className="w-4 h-4 mr-1" /> Check Answers
        </Button>
      )}
    </div>
  );
}
