import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Sparkles, Users, Zap } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }
    setSubmitted(true);
    toast({
      title: "You're on the list! 🎉",
      description: "We'll notify you when MentorAI launches.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                Early access coming soon
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-bold mb-6 animate-fade-in-up">
              Be the first to learn with{" "}
              <span className="gradient-text">AI + Mentors</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              Join our waitlist for early access to MentorAI. 
              We're starting with video editing and expanding to more skills soon.
            </p>

            {!submitted ? (
              <form 
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-12 animate-fade-in-up"
                style={{ animationDelay: "0.2s" }}
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button variant="hero" type="submit">
                  Join Waitlist
                </Button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-3 text-primary mb-12 animate-scale-in">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-semibold">You're on the list!</span>
              </div>
            )}

            {/* Stats */}
            <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <Users className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-3xl font-bold mb-1">500+</p>
                <p className="text-sm text-muted-foreground">Creators waiting</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <Zap className="w-8 h-8 text-accent mx-auto mb-3" />
                <p className="text-3xl font-bold mb-1">Q1 2025</p>
                <p className="text-sm text-muted-foreground">Expected launch</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
