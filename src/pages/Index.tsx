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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSurveyClick = async () => {
    setCheckingAuth(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCheckingAuth(false);

    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to take the survey.",
      });
      navigate("/login");
      return;
    }

    setSurveyOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        
        {/* Survey CTA Section */}
        <section className="py-16 bg-secondary/30">
          <div className="container max-w-4xl text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
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
              disabled={checkingAuth}
              className="gap-2"
            >
              <ClipboardList className="w-5 h-5" />
              {checkingAuth ? "Checking..." : "Take the Survey"}
            </Button>
          </div>
        </section>

        <HowItWorks />
        <ValueProp />
        <CTA />
      </main>
      <Footer />

      <SurveyModal open={surveyOpen} onOpenChange={setSurveyOpen} />
    </div>
  );
};

export default Index;
