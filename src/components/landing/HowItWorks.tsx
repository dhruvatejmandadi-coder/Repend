import { Bot, Calendar, Rocket } from "lucide-react";

const steps = [
  {
    icon: Bot,
    title: "Learn with AI",
    description: "Start with our AI tutor to understand concepts, ask questions, and prepare for your mentor session.",
    color: "accent",
  },
  {
    icon: Calendar,
    title: "Book a Mentor",
    description: "Choose an expert mentor in your field. Book a 30 or 60-minute session that fits your schedule.",
    color: "primary",
  },
  {
    icon: Rocket,
    title: "Level Up",
    description: "Get personalized feedback from your mentor. Apply insights and track your progress.",
    color: "accent",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="container px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A simple three-step process to accelerate your learning journey
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative group"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-px bg-gradient-to-r from-border via-primary/50 to-border" />
              )}
              
              <div className="relative bg-card border border-border rounded-2xl p-8 text-center transition-all duration-300 hover:border-primary/50 hover:shadow-lg group-hover:-translate-y-1">
                {/* Step Number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">{index + 1}</span>
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${
                  step.color === "primary" ? "gradient-primary" : "gradient-accent"
                }`}>
                  <step.icon className={`w-8 h-8 ${
                    step.color === "primary" ? "text-primary-foreground" : "text-accent-foreground"
                  }`} />
                </div>

                <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* AI vs Mentor Note */}
        <div className="mt-16 max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-card border border-border">
            <Bot className="w-5 h-5 text-accent" />
            <span className="text-sm text-muted-foreground">
              <span className="text-accent font-medium">AI helps you learn.</span>{" "}
              <span className="text-primary font-medium">Mentors help you improve.</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
