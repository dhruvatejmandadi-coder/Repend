import { CheckCircle2 } from "lucide-react";

const benefits = [
  "Personal feedback that videos can't provide",
  "AI preparation before every mentor session",
  "Expert mentors who've done what you want to do",
  "Structured learning path tailored to your goals",
];

export function ValueProp() {
  return (
    <section className="py-24">
      <div className="container px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Content */}
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6">
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
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-2xl" />
            <div className="relative bg-card border border-border rounded-3xl p-8 overflow-hidden">
              {/* AI Card */}
              <div className="bg-secondary/50 rounded-2xl p-6 mb-4 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
                    <span className="text-accent-foreground font-bold">AI</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">AI Tutor</p>
                    <p className="text-xs text-muted-foreground">Available 24/7</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  "Let me explain color grading fundamentals before your session with Alex..."
                </p>
              </div>

              {/* Mentor Card */}
              <div className="bg-secondary/50 rounded-2xl p-6 border border-primary/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">👤</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Alex Rivera</p>
                    <p className="text-xs text-muted-foreground">Video Editor • 8 years exp.</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  "Your cut timing is solid, but try adding J-cuts here for better flow..."
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
