import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="py-24">
      <div className="container px-4 sm:px-6">
        <div className="relative max-w-4xl mx-auto text-center">
          {/* Background Glow */}
          <div className="absolute inset-0 gradient-primary opacity-10 blur-3xl rounded-full" />
          
          <div className="relative gradient-primary rounded-3xl p-12 sm:p-16 overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white/90">Start your journey</span>
              </div>
              
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-white">
                Ready to level up your skills?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                Join a community of creators taking on daily challenges and growing together.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="xl" className="bg-white text-primary hover:bg-white/90 font-semibold shadow-lg" asChild>
                  <Link to="/challenges">
                    Browse Challenges
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
                <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                  <Link to="/ai-tutor">
                    Try AI Tutor
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
