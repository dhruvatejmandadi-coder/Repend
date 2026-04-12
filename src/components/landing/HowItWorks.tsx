import { Bot, BookOpen, Trophy, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: BookOpen,
    title: "Generate a Course",
    description: "Tell the AI what you want to learn. It creates a full course with lessons, quizzes, and interactive labs — instantly.",
    step: "01",
  },
  {
    icon: Bot,
    title: "Learn Interactively",
    description: "Work through modules at your own pace with AI-powered simulations, decision labs, and real-time feedback.",
    step: "02",
  },
  {
    icon: Trophy,
    title: "Track & Challenge",
    description: "Complete daily challenges, earn certificates, and measure your growth with detailed progress analytics.",
    step: "03",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-secondary/30" />
      <div className="container px-4 sm:px-6 relative">
        <div className="text-center mb-16">
          <p className="text-[13px] font-semibold text-primary uppercase tracking-wider mb-3">
            How it works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4 text-foreground">
            Three steps to mastery
          </h2>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            A streamlined process designed for efficient, effective learning.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.title} className="relative group">
              {/* Connector */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex absolute top-12 -right-3 z-10">
                  <ArrowRight className="w-5 h-5 text-border/60" />
                </div>
              )}
              
              <div className="relative bg-card/80 border border-border/60 rounded-xl p-7 transition-all duration-300 hover:border-primary/20 hover:bg-card group-hover:-translate-y-1 h-full">
                {/* Step number */}
                <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-4 block">
                  Step {step.step}
                </span>

                {/* Icon */}
                <div className="w-11 h-11 rounded-lg gradient-primary flex items-center justify-center mb-5">
                  <step.icon className="w-5 h-5 text-primary-foreground" />
                </div>

                <h3 className="font-display text-lg font-semibold mb-2 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
