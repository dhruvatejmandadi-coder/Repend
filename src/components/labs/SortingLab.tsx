import { useState, useMemo, useCallback } from "react";
import { ArrowUp, ArrowDown, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SortItem = {
  text: string;
  correct_position: number;
};

type Props = {
  data: {
    title?: string;
    description?: string;
    items: SortItem[];
  };
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SortingLab({ data }: Props) {
  const items = useMemo(() => data.items ?? [], [data]);

  const [userOrder, setUserOrder] = useState<SortItem[]>(() => shuffle(items));
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const moveItem = useCallback(
    (index: number, direction: "up" | "down") => {
      if (checked) return;
      const swapIdx = direction === "up" ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= userOrder.length) return;
      setUserOrder((prev) => {
        const next = [...prev];
        [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
        return next;
      });
    },
    [checked, userOrder.length],
  );

  const checkOrder = () => {
    const s = userOrder.filter((item, idx) => item.correct_position === idx + 1).length;
    setScore(s);
    setChecked(true);
  };

  const reset = () => {
    setUserOrder(shuffle(items));
    setChecked(false);
    setScore(0);
  };

  const allCorrect = checked && score === items.length;

  return (
    <div className="space-y-4">
      {(data.title || data.description) && (
        <div className="space-y-1">
          {data.title && <h3 className="font-bold text-lg">{data.title}</h3>}
          {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
        </div>
      )}

      <div className="space-y-2">
        {userOrder.map((item, idx) => {
          const isCorrect = checked && item.correct_position === idx + 1;
          const isWrong = checked && item.correct_position !== idx + 1;

          return (
            <Card
              key={item.text}
              className={`transition-colors ${
                isCorrect ? "border-green-500 bg-green-500/10" : isWrong ? "border-red-500 bg-red-500/10" : ""
              }`}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <Badge variant="outline" className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full">
                  {idx + 1}
                </Badge>

                <span className="flex-1 text-sm">{item.text}</span>

                {checked ? (
                  isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  )
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, "up")}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={idx === userOrder.length - 1}
                      onClick={() => moveItem(idx, "down")}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {checked && (
        <Card>
          <CardContent className="p-4 text-center space-y-2">
            <p className="font-bold text-lg">
              {allCorrect ? "🎉 Perfect!" : `${score} / ${items.length} correct`}
            </p>
            {!allCorrect && (
              <p className="text-sm text-muted-foreground">
                Items in red are in the wrong position. Try again!
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {!checked ? (
          <Button onClick={checkOrder}>Check Order</Button>
        ) : (
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" /> Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
