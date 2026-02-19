import { CheckCircle2 } from "lucide-react";

const benefits = [
  "AI-generated courses tailored to any topic you choose",
  "Interactive decision modules: simulations, scenarios, and classification tasks",
  "Daily challenges to keep your skills sharp",
  "Track your progress and see real improvement",
];

const categories = [
  { emoji: "💻", name: "Coding" },
  { emoji: "📚", name: "School" },
  { emoji: "🎨", name: "Creative" },
  { emoji: "💼", name: "Professional" },
  { emoji: "🎬", name: "Video" },
  { emoji: "✍️", name: "Writing" },
];

export function ValueProp() {
  return (
    <section className="py-24">
      <div className="container px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
          {/* Content */}
          <div>
            <span className="inline-block text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              The Repend Advantage
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-foreground">
              Why learn with{" "}
              <span className="gradient-text">Repend</span>?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Static tutorials only get you so far. Repend creates personalized courses with 
              interactive decision modules and quizzes — so you actually <span className="text-foreground font-medium">retain</span> what you learn.
            </p>
            
            <ul className="space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-2xl" />
            <div className="relative bg-card border border-border rounded-3xl p-8 overflow-hidden shadow-lg">
              {/* Categories */}
              <p className="text-sm font-medium text-foreground mb-4">Generate a course on anything:</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((cat) => (
                  <div 
                    key={cat.name}
                    className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors cursor-default"
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </div>
                ))}
              </div>

              {/* AI Course Card */}
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl p-5 mb-4 border border-accent/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-xs">AI</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">AI Course Generator</p>
                    <p className="text-xs text-muted-foreground">Instant personalized courses</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  "Generating your course on React hooks with 5 modules, quizzes, and a simulation lab..."
                </p>
              </div>

              {/* Challenge Card */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">🏆</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Daily Challenge</p>
                    <p className="text-xs text-muted-foreground">New every day</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  "Today's challenge: Build a responsive navbar using only CSS Grid..."
                </p>
              </div>

              {/* Decorative */}
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
