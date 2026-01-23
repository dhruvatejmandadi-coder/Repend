import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="py-24">
      <div className="container px-4 sm:px-6">
        <div className="relative max-w-4xl mx-auto text-center">
          {/* Background Glow */}
          <div className="absolute inset-0 gradient-primary opacity-10 blur-3xl rounded-full" />
          
          <div className="relative bg-card border border-border rounded-3xl p-12 sm:p-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Ready to level up your skills?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join creators who are learning faster with the power of AI + human mentorship.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/mentors">
                  Browse Mentors
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="accent" size="xl" asChild>
                <Link to="/ai-tutor">
                  Try AI Tutor
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
