import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ValueProp } from "@/components/landing/ValueProp";
import { CTA } from "@/components/landing/CTA";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { SurveyModal } from "@/components/survey/SurveyModal";

const Index = () => {
  const [surveyOpen, setSurveyOpen] = useState(false);

  const handleSurveyClick = () => {
    // Allow anonymous surveys - no login required
    setSurveyOpen(true);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      <Header />
      <main>
        <Hero />
        
        {/* Survey CTA Section */}
        <section className="py-16 bg-secondary/50">
          <div className="container max-w-4xl text-center">
            <span className="inline-block text-sm font-semibold text-accent uppercase tracking-wider mb-3">
              Personalized Matching
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Find Your Perfect Mentor Match
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              Take a quick survey so we can understand your goals, learning style, and challenges. 
              We'll use this to match you with the ideal mentor.
            </p>
            <Button 
              variant="hero" 
              size="lg" 
              onClick={handleSurveyClick}
              className="gap-2"
            >
              <ClipboardList className="w-5 h-5" />
              Take the Survey
            </Button>
          </div>
        </section>

        <HowItWorks />
        <ValueProp />
        <CTA />
      </main>
      <Footer />

      <SurveyModal open={surveyOpen} onOpenChange={setSurveyOpen} allowAnonymous={true} />
    </div>
  );
};

export default Index;
