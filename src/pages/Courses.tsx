import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, Sparkles, Loader2, Trash2, ArrowRight, Rocket } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { GeneratingSignUpPrompt } from "@/components/survey/GeneratingSignUpPrompt";

type Course = {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  status: string;
  created_at: string;
};

export default function Courses() {
  const [topic, setTopic] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchCourses();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchCourses = async () => {
    const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    if (!error && data) setCourses(data);
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!topic.trim() || isGenerating) return;

    // Guest flow: show generating animation + signup prompt
    if (!user) {
      setIsGenerating(true);
      // Show signup prompt after a brief delay to simulate generation start
      setTimeout(() => setShowSignUpPrompt(true), 1200);
      return;
    }

    setIsGenerating(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-course`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ topic: topic.trim() })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate course");
      }

      const { courseId } = await resp.json();
      setTopic("");
      toast({ title: "Course created! 🎉", description: "Your personalized course is ready." });
      navigate(`/courses/${courseId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate course",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("courses").delete().eq("id", id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Course deleted" });
  };

  const handleSignUpPromptClose = () => {
    setShowSignUpPrompt(false);
    setIsGenerating(false);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">AI-Powered Learning</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            {user ?
            <>
                Learn <span className="gradient-text">Anything</span>
              </> :

            <>
                Try AI <span className="gradient-text">Course Generation</span>
              </>
            }
          </h1>
          <p className="text-muted-foreground mb-6">
            {user ?
            "Type any topic and our AI will create a full course with lessons, labs, quizzes, and curated YouTube videos." :
            "Enter any topic below and watch our AI build a personalized course"}
          </p>

          {/* Generate Form */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <Input
              placeholder="e.g. React Hooks, Machine Learning, Guitar..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              disabled={isGenerating}
              className="flex-1" />

            <Button variant="hero" onClick={handleGenerate} disabled={!topic.trim() || isGenerating}>
              {isGenerating ?
              <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </> :

              <>
                  <Plus className="w-4 h-4" />
                  {user ? "Create Course" : "Try It Free"}
                </>
              }
            </Button>
          </div>

          {/* Guest hint */}
          {!user && !isGenerating &&
          <p className="text-xs text-muted-foreground mt-3">Create an account to save your courses.
            <Rocket className="w-3 h-3 inline mr-1" />
              No sign-up required to try — create an account to save your courses.
            </p>
          }
        </div>

        {/* Courses List (authenticated only) */}
        {user &&
        <>
            {loading ?
          <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div> :
          courses.length > 0 ?
          <div className="max-w-4xl mx-auto">
                <h2 className="font-display text-xl font-bold mb-4">Your Courses</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((course) =>
              <Card
                key={course.id}
                className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => course.status === "ready" && navigate(`/courses/${course.id}`)}>

                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-primary-foreground" />
                          </div>
                          <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(course.id);
                      }}>

                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <h3 className="font-display font-semibold mb-1 line-clamp-2">{course.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {course.description || course.topic}
                        </p>
                        {course.status === "generating" ?
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Generating...
                          </div> :
                  course.status === "failed" ?
                  <span className="text-xs text-destructive">Generation failed</span> :

                  <div className="flex items-center gap-1 text-xs text-primary">
                            View Course <ArrowRight className="w-3 h-3" />
                          </div>
                  }
                      </CardContent>
                    </Card>
              )}
                </div>
              </div> :

          <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No courses yet. Create your first one above!</p>
              </div>
          }
          </>
        }
      </div>

      {/* Signup prompt shown to guests during "generation" */}
      <GeneratingSignUpPrompt open={showSignUpPrompt} onOpenChange={handleSignUpPromptClose} topic={topic} />
    </DashboardLayout>);

}