import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, Sparkles, Loader2, Trash2, ArrowRight, Paperclip, X, FileText, Crown, PenTool, Globe } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { GeneratingSignUpPrompt } from "@/components/survey/GeneratingSignUpPrompt";
import { CourseGeneratingScreen } from "@/components/courses/CourseGeneratingScreen";
import { useSubscription, PLAN_CONFIG, STARTER_LIMITS } from "@/hooks/useSubscription";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp";

type Course = {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  status: string;
  created_at: string;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Courses() {
  const [topic, setTopic] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAttachClick = () => {
    if (!user) {
      toast({ title: "Sign up required", description: "Create an account to upload files for personalized courses.", variant: "destructive" });
      return;
    }
    fileInputRef.current?.click();
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!selectedFile || !user) return null;
    setIsUploading(true);
    const path = `${user.id}/${Date.now()}_${selectedFile.name}`;
    const { error } = await supabase.storage.from("course-uploads").upload(path, selectedFile);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setIsUploading(false);
      return null;
    }
    setIsUploading(false);
    return path;
  };

  const { plan, getCoursesLimit, getFileUploadsLimit } = useSubscription();

  const handleGenerate = async () => {
    const hasInput = topic.trim() || selectedFile;
    if (!hasInput || isGenerating) return;

    if (!user) {
      setIsGenerating(true);
      setTimeout(() => setShowSignUpPrompt(true), 1200);
      return;
    }

    // Check course generation limits
    const coursesLimit = getCoursesLimit();
    if (courses.length >= coursesLimit) {
      toast({
        title: "Course limit reached",
        description: `Your ${plan} plan allows ${coursesLimit} courses/month. Upgrade for more!`,
        variant: "destructive",
      });
      navigate("/pricing");
      return;
    }

    // Check file upload limits
    if (selectedFile && getFileUploadsLimit() === 0) {
      toast({
        title: "File uploads not available",
        description: "Upgrade to Pro or Elite to generate courses from uploaded files.",
        variant: "destructive",
      });
      navigate("/pricing");
      return;
    }

    setIsGenerating(true);
    try {
      let filePath: string | null = null;
      if (selectedFile) {
        filePath = await uploadFile();
        if (!filePath) { setIsGenerating(false); return; }
      }

      const body: Record<string, string> = { topic: topic.trim() || selectedFile?.name?.replace(/\.[^/.]+$/, "") || "Uploaded Document" };
      if (filePath) body.filePath = filePath;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-course`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate course");
      }

      const { courseId } = await resp.json();
      setTopic("");
      setSelectedFile(null);
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
    <>
      <div className="page-container space-y-10">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/[0.08] border border-primary/15 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[13px] font-medium text-primary/90">AI-Powered Learning</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
            {user ? (
              <>Learn <span className="gradient-text">Anything</span></>
            ) : (
              <>Try AI <span className="gradient-text">Course Generation</span></>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">
            {user
              ? "Type any topic and our AI will create a full course with lessons, labs, quizzes, and curated videos."
              : "Enter any topic below and watch our AI build a personalized course"}
          </p>

          {/* Generate Form */}
          <div className="flex flex-col sm:flex-row gap-2.5 max-w-lg mx-auto">
            <div className="flex-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10 border-border/60"
                onClick={handleAttachClick}
                disabled={isGenerating}
                title="Attach a file (PDF, image, text) for personalized course generation"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={handleFileSelect}
              />
              <Input
                placeholder="e.g. React Hooks, Machine Learning, Guitar..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                disabled={isGenerating}
                className="flex-1"
              />
            </div>

            <Button variant="hero" onClick={handleGenerate} disabled={(!topic.trim() && !selectedFile) || isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isUploading ? "Uploading..." : "Generating..."}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {user ? "Create Course" : "Try It Free"}
                </>
              )}
            </Button>
          </div>

          {/* File chip */}
          {selectedFile && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/50 text-[13px]">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground max-w-[200px] truncate">{selectedFile.name}</span>
                <span className="text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                <button onClick={() => setSelectedFile(null)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Guest hint */}
          {!user && !isGenerating && (
            <p className="text-xs text-muted-foreground/60 mt-4">
              Create an account to save your courses.
            </p>
          )}

          {/* Creator + Explore buttons */}
          {user && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => navigate("/courses/create")} className="gap-2">
                <PenTool className="w-4 h-4" /> Course Creator
              </Button>
              <Button variant="outline" onClick={() => navigate("/courses/explore")} className="gap-2">
                <Globe className="w-4 h-4" /> Explore Public
              </Button>
            </div>
          )}
        </div>

        {/* Courses List */}
        {user && (
          <>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : courses.length > 0 ? (
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-lg font-semibold text-foreground">Your Courses</h2>
                  <span className="text-xs text-muted-foreground">{courses.length} course{courses.length !== 1 && 's'}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((course) => (
                    <Card
                      key={course.id}
                      className="bg-card/80 border-border/50 hover:border-primary/20 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
                      onClick={() => course.status === "ready" && navigate(`/courses/${course.id}`)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-primary-foreground" />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(course.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <h3 className="font-display font-semibold text-[15px] mb-1 line-clamp-2">{course.title}</h3>
                        <p className="text-[13px] text-muted-foreground line-clamp-2 mb-4">
                          {course.description || course.topic}
                        </p>
                        {course.status === "generating" ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Generating...
                          </div>
                        ) : course.status === "failed" ? (
                          <span className="text-xs text-destructive">Generation failed</span>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-primary font-medium">
                            Continue <ArrowRight className="w-3 h-3" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No courses yet. Create your first one above!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Course generation loading screen */}
      <CourseGeneratingScreen topic={topic || selectedFile?.name || ""} isVisible={isGenerating && !!user} />

      <GeneratingSignUpPrompt open={showSignUpPrompt} onOpenChange={handleSignUpPromptClose} topic={topic} />
    </>
  );
}
