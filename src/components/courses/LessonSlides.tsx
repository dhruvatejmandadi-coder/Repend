import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Youtube, CheckCircle2, Send, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface LessonSlidesProps {
  content: string;
  youtubeUrl?: string | null;
  youtubeTitle?: string | null;
  onComplete?: () => void;
  isCompleted?: boolean;
  onSlideChange?: (slideIndex: number) => void;
}

const SLIDE_TYPE_CONFIG: Record<string, { label: string; className: string; accent: string }> = {
  concept:            { label: "🧠 Concept",        className: "bg-blue-500/15 text-blue-300 border-blue-500/30",    accent: "from-blue-500/8 via-transparent to-blue-600/4" },
  example:            { label: "📊 Example",        className: "bg-green-500/15 text-green-300 border-green-500/30",  accent: "from-green-500/8 via-transparent to-green-600/4" },
  case_study:         { label: "📋 Case Study",     className: "bg-purple-500/15 text-purple-300 border-purple-500/30", accent: "from-purple-500/8 via-transparent to-purple-600/4" },
  comparison:         { label: "⚖️ Comparison",     className: "bg-orange-500/15 text-orange-300 border-orange-500/30", accent: "from-orange-500/8 via-transparent to-orange-600/4" },
  quick_think:        { label: "🤔 Quick Think",    className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", accent: "from-yellow-500/8 via-transparent to-yellow-600/4" },
  myth_vs_reality:    { label: "🔍 Myth vs Reality",className: "bg-red-500/15 text-red-300 border-red-500/30",       accent: "from-red-500/8 via-transparent to-red-600/4" },
  process:            { label: "⚙️ Process",        className: "bg-teal-500/15 text-teal-300 border-teal-500/30",    accent: "from-teal-500/8 via-transparent to-teal-600/4" },
  interactive_predict:{ label: "🎯 Predict",        className: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", accent: "from-indigo-500/8 via-transparent to-indigo-600/4" },
  key_takeaways:      { label: "✅ Key Takeaways",  className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", accent: "from-emerald-500/8 via-transparent to-emerald-600/4" },
  challenge:          { label: "📋 Challenge",      className: "bg-amber-500/15 text-amber-300 border-amber-500/30",  accent: "from-amber-500/8 via-transparent to-amber-600/4" },
  objective:          { label: "🎯 Objective",      className: "bg-blue-500/15 text-blue-300 border-blue-500/30",     accent: "from-blue-500/8 via-transparent to-blue-600/4" },
  real_world:         { label: "🌎 Real World",     className: "bg-green-500/15 text-green-300 border-green-500/30",  accent: "from-green-500/8 via-transparent to-green-600/4" },
};

function detectChallenge(body: string): { isChallenge: boolean; questionText: string; answerHint: string | null } {
  const explicitMarkers = [/🧠.*challenge/i, /🧩.*challenge/i, /💡.*try/i, /\byour turn\b/i, /\btry it\b/i, /\bexercise\b/i];
  const hasDirectQuestion = /(?:calculate|solve|find|determine|compute|how many|how much|what is|what are)\b.+\?\s*$/im.test(body);
  const hasExplicitMarker = explicitMarkers.some((p) => p.test(body));
  const isChallenge = hasExplicitMarker || hasDirectQuestion;
  const hintMatch = body.match(/hint:\s*(.+)/i) || body.match(/\(hint:\s*(.+?)\)/i);
  const answerHint = hintMatch ? hintMatch[1].trim() : null;
  return { isChallenge, questionText: body, answerHint };
}

function cleanMathNotation(text: string): string {
  let result = text.replace(/\\\\\(/g, '$').replace(/\\\\\)/g, '$');
  result = result.replace(/\\\\\[/g, '$$').replace(/\\\\\]/g, '$$');
  return result;
}

function parseSlide(raw: string) {
  const typeMatch = raw.match(/<!--\s*type:\s*(\w+)\s*-->/);
  const slideType = typeMatch?.[1] || null;
  let cleaned = raw.replace(/<!--\s*type:\s*\w+\s*-->\n?/, "").trim();
  cleaned = cleanMathNotation(cleaned);
  const headingMatch = cleaned.match(/^##\s+(.+)$/m);
  const title = headingMatch?.[1]?.trim() || null;
  if (headingMatch) cleaned = cleaned.replace(/^##\s+.+$/m, "").trim();
  return { slideType, title, body: cleaned };
}

export default function LessonSlides({ content, youtubeUrl, youtubeTitle, onComplete, isCompleted, onSlideChange }: LessonSlidesProps) {
  const slides = content.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
  const [current, setCurrent] = useState(0);
  const [visitedSlides, setVisitedSlides] = useState<Set<number>>(new Set([0]));
  const [challengeAnswers, setChallengeAnswers] = useState<Record<number, string>>({});
  const [challengeResults, setChallengeResults] = useState<Record<number, "correct" | "incorrect" | null>>({});
  const [challengeSubmitted, setChallengeSubmitted] = useState<Set<number>>(new Set());
  const [animKey, setAnimKey] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const total = slides.length;
  const isLast = current === total - 1;

  const goTo = useCallback((next: number) => {
    if (next === current || next < 0 || next >= total) return;
    setAnimKey(k => k + 1);
    setCurrent(next);
    setVisitedSlides(prev => new Set(prev).add(next));
    // Scroll content area to top on slide change
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [current, total]);

  const goNext = useCallback(() => goTo(Math.min(current + 1, total - 1)), [current, total, goTo]);
  const goPrev = useCallback(() => goTo(Math.max(current - 1, 0)), [current, goTo]);

  useEffect(() => { onSlideChange?.(current); }, [current, onSlideChange]);
  useEffect(() => { if (visitedSlides.size >= total && !isCompleted && onComplete) onComplete(); }, [visitedSlides.size, total, isCompleted, onComplete]);
  useEffect(() => { setCurrent(0); setVisitedSlides(new Set([0])); setChallengeAnswers({}); setChallengeResults({}); setChallengeSubmitted(new Set()); setAnimKey(0); }, [content]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const handleChallengeSubmit = (slideIndex: number) => {
    const answer = (challengeAnswers[slideIndex] || "").trim();
    if (!answer) return;
    setChallengeSubmitted(prev => new Set(prev).add(slideIndex));
    setChallengeResults(prev => ({ ...prev, [slideIndex]: "correct" }));
  };

  const progressPercent = total > 1 ? ((current + 1) / total) * 100 : 100;
  const { slideType, title, body } = parseSlide(slides[current] || "");
  const typeConfig = slideType ? SLIDE_TYPE_CONFIG[slideType] : null;
  const challenge = detectChallenge(body);
  const isChallengeSlide = challenge.isChallenge || slideType === "challenge" || slideType === "quick_think" || slideType === "interactive_predict";
  const isSubmitted = challengeSubmitted.has(current);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/40 shadow-[var(--shadow-card)] bg-card/80 backdrop-blur-sm rounded-2xl">
        {/* Progress strip with glow */}
        <div className="relative h-1.5 bg-secondary/60 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <CardContent className="p-0">
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 sm:px-7 py-2.5 border-b border-border/20 bg-secondary/10">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-medium bg-muted/30 text-muted-foreground border-border/30 px-2 py-0.5 tabular-nums">
                {current + 1} / {total}
              </Badge>
              {typeConfig && (
                <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 ${typeConfig.className}`}>
                  {typeConfig.label}
                </Badge>
              )}
            </div>
            {isCompleted && (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[11px]">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
              </Badge>
            )}
          </div>

          {/* Slide content — scrollable with max height to prevent overflow */}
          <div
            ref={contentRef}
            className={`relative overflow-y-auto max-h-[65vh] px-6 sm:px-10 py-8 sm:py-10 ${typeConfig?.accent ? `bg-gradient-to-br ${typeConfig.accent}` : ""}`}
          >
            {/* Animated wrapper — re-mounts on slide change */}
            <div key={animKey} className="slide-enter">
              {/* Title */}
              {title && (
                <h2 className="font-display text-2xl sm:text-[1.75rem] font-bold text-foreground mb-5 leading-snug tracking-tight">
                  {title}
                </h2>
              )}

              {/* Body */}
              <div className="prose prose-base dark:prose-invert max-w-none text-foreground/90
                prose-headings:text-foreground prose-headings:mt-6 prose-headings:mb-3 prose-headings:font-display prose-headings:tracking-tight
                prose-p:text-foreground/85 prose-p:leading-[1.8] prose-p:mb-4
                prose-strong:text-foreground prose-strong:font-semibold
                prose-code:text-accent prose-code:bg-secondary/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                prose-pre:bg-secondary prose-pre:border prose-pre:border-border/40 prose-pre:rounded-xl prose-pre:overflow-x-auto
                prose-li:text-foreground/85 prose-li:mb-2 prose-ul:space-y-1.5 prose-ol:space-y-1.5
                prose-img:rounded-xl prose-img:shadow-lg prose-img:mx-auto prose-img:max-h-[320px] prose-img:my-6
                prose-table:border-collapse prose-table:my-5
                prose-th:bg-muted/40 prose-th:border prose-th:border-border/40 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:text-sm prose-th:font-semibold
                prose-td:border prose-td:border-border/40 prose-td:px-4 prose-td:py-3 prose-td:text-sm
                prose-blockquote:border-l-primary/40 prose-blockquote:bg-primary/[0.04] prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    img: ({ node, ...props }) => (
                      <img {...props} loading="lazy" className="rounded-xl shadow-lg mx-auto max-h-[320px] object-contain" />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4 rounded-xl border border-border/40 shadow-sm">
                        <table {...props} className="w-full" />
                      </div>
                    ),
                    th: ({ node, ...props }) => (
                      <th {...props} className="bg-muted/40 border border-border/40 px-4 py-2.5 text-left text-sm font-semibold text-foreground" />
                    ),
                    td: ({ node, ...props }) => (
                      <td {...props} className="border border-border/40 px-4 py-2.5 text-sm text-foreground/85" />
                    ),
                  }}
                >{body}</ReactMarkdown>
              </div>

              {/* Challenge Answer Box */}
              {isChallengeSlide && (
                <div className="mt-8 p-5 rounded-xl border border-primary/20 bg-primary/[0.04] space-y-3">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    Your Answer
                  </p>
                  {!isSubmitted ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your answer here..."
                        value={challengeAnswers[current] || ""}
                        onChange={(e) => setChallengeAnswers(prev => ({ ...prev, [current]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleChallengeSubmit(current)}
                        className="flex-1 bg-background/50"
                      />
                      <Button
                        onClick={() => handleChallengeSubmit(current)}
                        disabled={!(challengeAnswers[current] || "").trim()}
                        size="sm"
                        className="gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Submit
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-300">Answer submitted!</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your answer: <span className="font-medium text-foreground">{challengeAnswers[current]}</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {challenge.answerHint && !isSubmitted && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Lightbulb className="w-3 h-3" /> Hint: {challenge.answerHint}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom navigation */}
          <div className="flex items-center justify-between px-5 sm:px-7 py-3 border-t border-border/20 bg-card/60">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={current === 0} className="gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>

            {/* Dot navigation — scrollable for many slides */}
            <div className="flex items-center gap-1.5 max-w-[200px] overflow-x-auto py-1 scrollbar-hide">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all duration-300 flex-shrink-0 ${
                    i === current
                      ? "w-7 h-2.5 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                      : visitedSlides.has(i)
                      ? "w-2.5 h-2.5 bg-primary/40 hover:bg-primary/60"
                      : "w-2.5 h-2.5 bg-muted-foreground/20 hover:bg-muted-foreground/35"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <Button variant="ghost" size="sm" onClick={goNext} disabled={isLast} className="gap-1 text-muted-foreground hover:text-foreground transition-colors">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLast && youtubeUrl && (
        <Card className="border-border/40 rounded-2xl">
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
