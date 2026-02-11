import { CheckCircle2 } from "lucide-react";

const benefits = [
  "Personal feedback that videos and courses can't provide",
  "AI preparation before every mentor session",
  "Expert mentors across any skill you want to learn",
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
              <span className="gradient-text">humans + AI</span>?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Tutorials and courses only get you so far. Real improvement comes from 
              personalized feedback on <span className="text-foreground font-medium">your</span> work, 
              from someone who's mastered the craft.
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
              <p className="text-sm font-medium text-foreground mb-4">Learn anything:</p>
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

              {/* AI Card */}
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl p-5 mb-4 border border-accent/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-xs">AI</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">AI Tutor</p>
                    <p className="text-xs text-muted-foreground">Available 24/7</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  "Let me explain the fundamentals before your mentor session..."
                </p>
              </div>

              {/* Mentor Card */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">👤</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Your Mentor</p>
                    <p className="text-xs text-muted-foreground">Expert in your field</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  "Great progress! Here's how to take it to the next level..."
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
