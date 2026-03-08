import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center pt-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(hsl(214 80% 56%) 1px, transparent 1px), linear-gradient(90deg, hsl(214 80% 56%) 1px, transparent 1px)`,
        backgroundSize: '64px 64px'
      }} />
      
      {/* Ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/[0.06] rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-accent/[0.04] rounded-full blur-[100px]" />
      
      <div className="container relative z-10 px-4 sm:px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/[0.08] border border-primary/15 mb-10 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[13px] font-medium text-primary/90">
              AI-Powered Learning Platform
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-bold leading-[1.1] mb-6 animate-fade-in-up text-foreground">
            Master any skill with{" "}
            <span className="gradient-text">AI-generated</span>
            {" "}courses
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-10 animate-fade-in-up leading-relaxed" style={{ animationDelay: '0.15s' }}>
            Personalized courses with interactive simulations, daily challenges, and real-time progress tracking — all generated in seconds.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <Button variant="hero" size="lg" asChild>
              <Link to="/courses">
                Start Learning Free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="border-border/60">
              <Link to="/login">
                Sign In
              </Link>
            </Button>
          </div>

          {/* Social proof hint */}
          <p className="text-xs text-muted-foreground/60 mt-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            No credit card required · Courses generated in under 30 seconds
          </p>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
