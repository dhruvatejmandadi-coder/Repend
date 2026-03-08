import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="py-24">
      <div className="container px-4 sm:px-6">
        <div className="relative max-w-3xl mx-auto">
          {/* Background Glow */}
          <div className="absolute inset-0 gradient-primary opacity-[0.06] blur-3xl rounded-full" />
          
          <div className="relative gradient-primary rounded-2xl p-10 sm:p-14 overflow-hidden">
            {/* Decorative */}
            <div className="absolute top-0 left-0 w-40 h-40 bg-white/[0.06] rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/[0.06] rounded-full blur-3xl" />
            
            <div className="relative z-10 text-center">
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 text-primary-foreground">
                Ready to start learning?
              </h2>
              <p className="text-primary-foreground/70 text-base mb-8 max-w-md mx-auto">
                Create your free account and generate your first AI-powered course in seconds.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold" asChild>
                  <Link to="/signup">
                    Sign Up Free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white/25 text-primary-foreground hover:bg-white/10" asChild>
                  <Link to="/login">
                    Sign In
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
