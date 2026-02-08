import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
export function Hero() {
  return <section className="relative min-h-[90vh] flex items-center justify-center pt-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/30 via-background to-background" />
      <div className="absolute top-20 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="container relative z-10 px-4 sm:px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              AI-Powered Learning + Expert Mentorship
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 animate-fade-in-up text-foreground">
            Learn smarter with{" "}
            <span className="gradient-text">AI</span>
            <br />
            Grow faster with{" "}
            <span className="text-accent">mentors</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up leading-relaxed" style={{
          animationDelay: '0.2s'
        }}>
            Whether it's coding, creative skills, or professional growth — get personalized guidance from human experts while AI helps you prepare and practice.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-in-up" style={{
          animationDelay: '0.3s'
        }}>
            <Button variant="hero" size="xl" asChild>
              <Link to="/ai-tutor">
                Try AI Tutor Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link to="/waitlist">
                Join Waitlist
              </Link>
            </Button>
          </div>

        </div>
      </div>
    </section>;
}