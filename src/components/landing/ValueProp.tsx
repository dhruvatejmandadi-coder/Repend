import { CheckCircle2 } from "lucide-react";

const benefits = [
  "AI-generated courses tailored to any topic you choose",
  "Interactive simulations, decision labs, and classification tasks",
  "Daily challenges to keep your skills sharp",
  "Detailed progress tracking and certificates",
];

const categories = [
  { emoji: "💻", name: "Coding" },
  { emoji: "📚", name: "Academic" },
  { emoji: "🎨", name: "Creative" },
  { emoji: "💼", name: "Business" },
  { emoji: "🔬", name: "Science" },
  { emoji: "✍️", name: "Writing" },
];

export function ValueProp() {
  return (
    <section className="py-24">
      <div className="container px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-6xl mx-auto">
          {/* Content */}
          <div>
            <p className="text-[13px] font-semibold text-primary uppercase tracking-wider mb-3">
              Why Repend
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-5 text-foreground leading-tight">
              Learning that actually{" "}
              <span className="gradient-text">sticks</span>
            </h2>
            <p className="text-muted-foreground text-base mb-8 leading-relaxed">
              Static tutorials only get you so far. Repend creates personalized courses with 
              interactive decision modules — so you genuinely retain what you learn.
            </p>
            
            <ul className="space-y-3.5">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4.5 h-4.5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/90 text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="relative bg-card border border-border/60 rounded-2xl p-7 overflow-hidden">
              {/* Categories */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Generate a course on anything</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((cat) => (
                  <div 
                    key={cat.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/60 rounded-lg text-[13px] font-medium transition-colors cursor-default border border-transparent hover:border-border/40"
                  >
                    <span>{cat.emoji}</span>
                    <span className="text-foreground/80">{cat.name}</span>
                  </div>
                ))}
              </div>

              {/* AI Course Card */}
              <div className="bg-gradient-to-br from-accent/[0.06] to-transparent rounded-xl p-5 mb-3 border border-accent/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-[11px]">AI</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[13px] text-foreground">AI Course Generator</p>
                    <p className="text-[11px] text-muted-foreground">Instant personalized courses</p>
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground/80 italic">
                  "Generating your course on React hooks with 5 modules, quizzes, and a simulation lab..."
                </p>
              </div>

              {/* Challenge Card */}
              <div className="bg-gradient-to-br from-primary/[0.06] to-transparent rounded-xl p-5 border border-primary/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">🏆</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[13px] text-foreground">Daily Challenge</p>
                    <p className="text-[11px] text-muted-foreground">New every day</p>
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground/80 italic">
                  "Today's challenge: Build a responsive navbar using only CSS Grid..."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
