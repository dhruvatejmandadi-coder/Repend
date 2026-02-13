import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Bot, 
  TrendingUp,
  BookOpen,
  ArrowRight,
  Sparkles,
  Rocket
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const { toast } = useToast();

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email to join the waitlist.",
        variant: "destructive",
      });
      return;
    }
    setJoined(true);
    toast({
      title: "You're on the waitlist! 🎉",
      description: "We'll notify you when new features launch.",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <div>
          <h1 className="font-display text-2xl font-bold">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's your learning hub
          </p>
        </div>

        {/* Join Waitlist Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-accent/5 to-background border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Rocket className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="font-display text-xl font-bold mb-2">
                  Get Early Access to New Features
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Join the waitlist to be first in line for mentor marketplace, 
                  advanced courses, and premium AI features.
                </p>
                {!joined ? (
                  <form onSubmit={handleJoinWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      className="flex-1 bg-background"
                    />
                    <Button variant="hero" type="submit">
                      Join Waitlist
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">You're on the list! We'll be in touch.</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Grid */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center mb-2">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">AI Tutor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Get instant help with any topic from our AI-powered tutor.
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/ai-tutor">
                  Start Session
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                <BookOpen className="w-5 h-5 text-accent" />
              </div>
              <CardTitle className="text-lg">AI Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Generate personalized courses on any topic with AI.
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/courses">
                  Create Course
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <CardTitle className="text-lg">Track Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Monitor your learning journey and achievements.
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/progress">
                  View Progress
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
