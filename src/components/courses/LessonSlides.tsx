import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Youtube, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LessonSlidesProps {
  content: string;
  youtubeUrl?: string | null;
  youtubeTitle?: string | null;
  onComplete?: () => void;
  isCompleted?: boolean;
}

const SLIDE_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  concept: { label: "Concept", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  example: { label: "Example", className: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30" },
  case_study: { label: "Case Study", className: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  comparison: { label: "Comparison", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  quick_think: { label: "Quick Think", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30" },
  myth_vs_reality: { label: "Myth vs Reality", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  process: { label: "Process", className: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30" },
  interactive_predict: { label: "Predict", className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30" },
  key_takeaways: { label: "Key Takeaways", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
};

function parseSlide(raw: string) {
  const typeMatch = raw.match(/<!--\s*type:\s*(\w+)\s*-->/);
  const slideType = typeMatch?.[1] || null;
  let cleaned = raw.replace(/<!--\s*type:\s*\w+\s*-->\n?/, "").trim();
  const headingMatch = cleaned.match(/^##\s+(.+)$/m);
  const title = headingMatch?.[1]?.trim() || null;
  if (headingMatch) cleaned = cleaned.replace(/^##\s+.+$/m, "").trim();
  return { slideType, title, body: cleaned };
}

export default function LessonSlides({ content, youtubeUrl, youtubeTitle, onComplete, isCompleted }: LessonSlidesProps) {
  const slides = content.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
  const [current, setCurrent] = useState(0);
  const [visitedSlides, setVisitedSlides] = useState<Set<number>>(new Set([0]));
  const total = slides.length;
  const isLast = current === total - 1;

  const goNext = useCallback(() => {
    setCurrent((c) => {
      const next = Math.min(c + 1, total - 1);
      setVisitedSlides((prev) => new Set(prev).add(next));
      return next;
    });
  }, [total]);

  const goPrev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  // Track slide visits
  useEffect(() => {
    setVisitedSlides((prev) => new Set(prev).add(current));
  }, [current]);

  // Auto-complete when all slides visited
  useEffect(() => {
    if (visitedSlides.size >= total && !isCompleted && onComplete) {
      onComplete();
    }
  }, [visitedSlides.size, total, isCompleted, onComplete]);

  useEffect(() => {
    setCurrent(0);
    setVisitedSlides(new Set([0]));
  }, [content]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const progressPercent = total > 1 ? ((current + 1) / total) * 100 : 100;
  const { slideType, title, body } = parseSlide(slides[current] || "");
  const typeConfig = slideType ? SLIDE_TYPE_CONFIG[slideType] : null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <Progress value={progressPercent} className="h-1.5 rounded-none" />
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              {typeConfig && (
                <Badge variant="outline" className={`mb-2 text-xs font-medium ${typeConfig.className}`}>
                  {typeConfig.label}
                </Badge>
              )}
              {title && <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>}
            </div>
            {isCompleted && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
              </Badge>
            )}
          </div>

          <div
            key={current}
            className="prose prose-base dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-accent prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-li:text-foreground prose-img:rounded-lg prose-img:shadow-md prose-img:mx-auto prose-img:max-h-[400px] prose-table:border-collapse prose-th:bg-muted/50 prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:text-sm min-h-[300px] animate-fade-in"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                img: ({ node, ...props }) => (
                  <img {...props} loading="lazy" className="rounded-lg shadow-md mx-auto max-h-[400px] object-contain" />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-4 rounded-lg border border-border">
                    <table {...props} className="w-full" />
                  </div>
                ),
              }}
            >{body}</ReactMarkdown>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={current === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrent(i); setVisitedSlides((prev) => new Set(prev).add(i)); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === current ? "bg-primary scale-125" : visitedSlides.has(i) ? "bg-primary/40" : "bg-muted-foreground/30"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={goNext} disabled={isLast}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLast && youtubeUrl && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Youtube className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold">Recommended Video</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{youtubeTitle}</p>
            <Button variant="outline" size="sm" asChild>
              <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
                <Youtube className="w-4 h-4 mr-1" /> Search on YouTube
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
