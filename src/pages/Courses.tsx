import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, Sparkles, Loader2, Trash2, ArrowRight, Paperclip, X, FileText, Crown, PenTool, Globe, RotateCcw, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { GeneratingSignUpPrompt } from "@/components/survey/GeneratingSignUpPrompt";
import { CourseGeneratingScreen } from "@/components/courses/CourseGeneratingScreen";
import { useSubscription, PLAN_CONFIG, STARTER_LIMITS } from "@/hooks/useSubscription";
import PersonalizationModal, { type CoursePreferences } from "@/components/courses/PersonalizationModal";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
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
  const [deletedCourses, setDeletedCourses] = useState<(Course & { deleted_at?: string })[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchCourses();
      fetchDeletedCourses();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchCourses = async () => {
    const { data, error } = await supabase.from("courses").select("*").is("deleted_at" as any, null).order("created_at", { ascending: false });
    if (!error && data) setCourses(data);
    setLoading(false);
  };

  const fetchDeletedCourses = async () => {
    const { data } = await supabase.from("courses").select("*").not("deleted_at" as any, "is", null).order("created_at", { ascending: false });
    if (data) setDeletedCourses(data as any);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_FILES - selectedFiles.length;
    if (remaining <= 0) {
      toast({ title: "File limit reached", description: `Maximum ${MAX_FILES} files per course.`, variant: "destructive" });
      return;
    }

    const toAdd: File[] = [];
    for (const file of files.slice(0, remaining)) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB limit.`, variant: "destructive" });
        continue;
      }
      // Prevent duplicates by name
      if (selectedFiles.some(f => f.name === file.name)) continue;
      toAdd.push(file);
    }

    if (toAdd.length) setSelectedFiles(prev => [...prev, ...toAdd]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAttachClick = () => {
    if (!user) {
      toast({ title: "Sign up required", description: "Create an account to upload files for personalized courses.", variant: "destructive" });
      return;
    }
    if (selectedFiles.length >= MAX_FILES) {
      toast({ title: "File limit reached", description: `Maximum ${MAX_FILES} files per course.`, variant: "destructive" });
      return;
    }
    fileInputRef.current?.click();
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (!selectedFiles.length || !user) return [];
    setIsUploading(true);
    const paths: string[] = [];
    for (const file of selectedFiles) {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("course-uploads").upload(path, file);
      if (error) {
        toast({ title: "Upload failed", description: `${file.name}: ${error.message}`, variant: "destructive" });
        setIsUploading(false);
        return [];
      }
      paths.push(path);
    }
    setIsUploading(false);
    return paths;
  };

  const { plan, getCoursesLimit, getFileUploadsLimit } = useSubscription();

  const handleCreateClick = () => {
    const hasInput = topic.trim() || selectedFiles.length > 0;
    if (!hasInput || isGenerating) return;

    if (!user) {
      setIsGenerating(true);
      setTimeout(() => setShowSignUpPrompt(true), 1200);
      return;
    }

    const coursesLimit = getCoursesLimit();
    if (courses.length >= coursesLimit) {
      toast({ title: "Course limit reached", description: `Your ${plan} plan allows ${coursesLimit} courses/month. Upgrade for more!`, variant: "destructive" });
      navigate("/pricing");
      return;
    }

    if (selectedFiles.length > 0 && getFileUploadsLimit() === 0) {
      toast({ title: "File uploads not available", description: "Upgrade to Pro or Elite to generate courses from uploaded files.", variant: "destructive" });
      navigate("/pricing");
      return;
    }

    setShowPersonalization(true);
  };

  const handlePersonalizationSubmit = async (prefs: CoursePreferences) => {
    setShowPersonalization(false);
    setIsGenerating(true);

    try {
      let filePaths: string[] = [];
      if (selectedFiles.length > 0) {
        filePaths = await uploadFiles();
        if (selectedFiles.length > 0 && filePaths.length === 0) { setIsGenerating(false); return; }
      }

      const body: Record<string, any> = {
        topic: topic.trim() || selectedFiles[0]?.name?.replace(/\.[^/.]+$/, "") || "Uploaded Document",
        preferences: prefs,
      };
      // Support both single and multiple file paths
      if (filePaths.length === 1) {
        body.filePath = filePaths[0];
      } else if (filePaths.length > 1) {
        body.filePaths = filePaths;
      }

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
      setSelectedFiles([]);
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
    // Soft delete — mark with deleted_at timestamp
    await supabase.from("courses").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Course moved to trash", description: "You can restore it within 30 days." });
  };

  const handleRestore = async (id: string) => {
    await supabase.from("courses").update({ deleted_at: null } as any).eq("id", id);
    setDeletedCourses((prev) => prev.filter((c) => c.id !== id));
    fetchCourses();
    toast({ title: "Course restored!" });
  };

  const handlePermanentDelete = async (id: string) => {
    await supabase.from("courses").delete().eq("id", id);
    setDeletedCourses((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Course permanently deleted" });
  };

  const handleSignUpPromptClose = () => {
    setShowSignUpPrompt(false);
    setIsGenerating(false);
  };

  const firstFileName = selectedFiles[0]?.name || "";

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
                title={`Attach files (up to ${MAX_FILES}). PDF, image, text supported.`}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Input
                placeholder="e.g. React Hooks, Machine Learning, Guitar..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateClick()}
                disabled={isGenerating}
                className="flex-1"
              />
            </div>

            <Button variant="hero" onClick={handleCreateClick} disabled={(!topic.trim() && selectedFiles.length === 0) || isGenerating}>
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

          {/* File chips */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {selectedFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/50 text-[13px]">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span className="text-foreground max-w-[160px] truncate">{file.name}</span>
                  <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                  <button onClick={() => removeFile(idx)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {selectedFiles.length < MAX_FILES && (
                <button
                  onClick={handleAttachClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border/60 text-[13px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add more
                </button>
              )}
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

        {/* Recently Deleted */}
        {user && deletedCourses.length > 0 && (
          <div className="max-w-5xl mx-auto mt-10">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold text-muted-foreground">Recently Deleted</h2>
              <span className="text-xs text-muted-foreground/60">Auto-removed after 30 days</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deletedCourses.map((course) => {
                const deletedAt = course.deleted_at ? new Date(course.deleted_at) : new Date();
                const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)));
                return (
                  <Card key={course.id} className="bg-card/40 border-border/30 opacity-70">
                    <CardContent className="p-5">
                      <h3 className="font-display font-semibold text-[15px] mb-1 line-clamp-2">{course.title}</h3>
                      <p className="text-[13px] text-muted-foreground line-clamp-1 mb-3">{course.topic}</p>
                      <p className="text-[11px] text-muted-foreground/60 mb-3">{daysLeft} days until permanent deletion</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleRestore(course.id)}>
                          <RotateCcw className="w-3 h-3" /> Restore
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => handlePermanentDelete(course.id)}>
                          <Trash2 className="w-3 h-3" /> Delete Forever
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Personalization modal */}
      <PersonalizationModal
        open={showPersonalization}
        onClose={() => setShowPersonalization(false)}
        onSubmit={handlePersonalizationSubmit}
        topic={topic || firstFileName || ""}
      />

      {/* Course generation loading screen */}
      <CourseGeneratingScreen topic={topic || firstFileName || ""} isVisible={isGenerating && !!user} />

      <GeneratingSignUpPrompt open={showSignUpPrompt} onOpenChange={handleSignUpPromptClose} topic={topic} />
    </>
  );
}
