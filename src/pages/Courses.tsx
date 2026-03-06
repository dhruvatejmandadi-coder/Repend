import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, Sparkles, Loader2, Trash2, ArrowRight, Paperclip, X, FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { GeneratingSignUpPrompt } from "@/components/survey/GeneratingSignUpPrompt";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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
    // Reset input so same file can be re-selected
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

  const handleGenerate = async () => {
    if (!topic.trim() || isGenerating) return;

    if (!user) {
      setIsGenerating(true);
      setTimeout(() => setShowSignUpPrompt(true), 1200);
      return;
    }

    setIsGenerating(true);
    try {
      let filePath: string | null = null;

      if (selectedFile) {
        filePath = await uploadFile();
        if (!filePath) {
          setIsGenerating(false);
          return;
        }
      }

      const body: Record<string, string> = { topic: topic.trim() };
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
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">AI-Powered Learning</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            {user ? (
              <>Learn <span className="gradient-text">Anything</span></>
            ) : (
              <>Try AI <span className="gradient-text">Course Generation</span></>
            )}
          </h1>
          <p className="text-muted-foreground mb-6">
            {user
              ? "Type any topic and our AI will create a full course with lessons, labs, quizzes, and curated YouTube videos."
              : "Enter any topic below and watch our AI build a personalized course"}
          </p>

          {/* Generate Form */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <div className="flex-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10"
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

            <Button variant="hero" onClick={handleGenerate} disabled={!topic.trim() || isGenerating}>
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
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border text-sm">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground max-w-[200px] truncate">{selectedFile.name}</span>
                <span className="text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Guest hint */}
          {!user && !isGenerating && (
            <p className="text-xs text-muted-foreground mt-3">
              Create an account to save your courses.
            </p>
          )}
        </div>

        {/* Courses List (authenticated only) */}
        {user && (
          <>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : courses.length > 0 ? (
              <div className="max-w-4xl mx-auto">
                <h2 className="font-display text-xl font-bold mb-4">Your Courses</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((course) => (
                    <Card
                      key={course.id}
                      className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
                      onClick={() => course.status === "ready" && navigate(`/courses/${course.id}`)}
                    >
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
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <h3 className="font-display font-semibold mb-1 line-clamp-2">{course.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
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
                          <div className="flex items-center gap-1 text-xs text-primary">
                            View Course <ArrowRight className="w-3 h-3" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No courses yet. Create your first one above!</p>
              </div>
            )}
          </>
        )}
      </div>

      <GeneratingSignUpPrompt open={showSignUpPrompt} onOpenChange={handleSignUpPromptClose} topic={topic} />
    </DashboardLayout>
  );
}
