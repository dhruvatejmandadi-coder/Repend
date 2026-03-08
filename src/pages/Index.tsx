import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ValueProp } from "@/components/landing/ValueProp";
import { CTA } from "@/components/landing/CTA";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { SurveyModal } from "@/components/survey/SurveyModal";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [surveyOpen, setSurveyOpen] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to /courses immediately
  if (!loading && user) {
    navigate("/courses", { replace: true });
    return null;
  }

  const handleSurveyClick = () => {
    setSurveyOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        
        {/* Survey CTA Section */}
        <section className="py-20 relative">
          <div className="absolute inset-0 bg-secondary/20" />
          <div className="container max-w-3xl text-center relative">
            <p className="text-[13px] font-semibold text-accent uppercase tracking-wider mb-3">
              Personalize Your Experience
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-4 text-foreground">
              Tell us what you want to learn
            </h2>
            <p className="text-muted-foreground text-base mb-8 max-w-lg mx-auto">
              Take a quick survey so we can tailor your course recommendations and challenge suggestions.
            </p>
            <Button 
              variant="hero" 
              size="lg" 
              onClick={handleSurveyClick}
              className="gap-2"
            >
              <ClipboardList className="w-4 h-4" />
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
