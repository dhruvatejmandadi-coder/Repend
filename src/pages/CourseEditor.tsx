import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Save, ArrowLeft, Loader2, Image as ImageIcon,
  FileText, Beaker, ClipboardList, ChevronDown, ChevronUp,
  Globe, Lock, Send, Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import ModuleEditor from "@/components/courses/creator/ModuleEditor";
import type { CreatorModule, QuizQuestion } from "@/pages/CourseCreator";

function generateId() {
  return crypto.randomUUID();
}

function emptyModule(): CreatorModule {
  return {
    id: generateId(),
    title: "",
    lesson_content: "",
    lab_type: null,
    lab_data: null,
    lab_title: null,
    lab_description: null,
    quiz: [],
    youtube_url: null,
    youtube_title: null,
  };
}

export default function CourseEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isElite } = useSubscription();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [modules, setModules] = useState<CreatorModule[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [originalCourseId, setOriginalCourseId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [activeTextarea, setActiveTextarea] = useState<string | null>(null);

  useEffect(() => {
    if (!isElite) {
      toast({ title: "Elite plan required", description: "Only Elite users can edit courses.", variant: "destructive" });
      navigate("/courses");
      return;
    }
    if (id) loadCourse();
  }, [id, isElite]);

  const loadCourse = async () => {
    const [courseRes, modulesRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", id!).maybeSingle(),
      supabase.from("course_modules").select("*").eq("course_id", id!).order("module_order"),
    ]);

    if (!courseRes.data) {
      toast({ title: "Course not found", variant: "destructive" });
      navigate("/courses");
      return;
    }

    const c = courseRes.data;
    setTitle(c.title);
    setDescription(c.description || "");
    setTopic(c.topic);
    setIsPublic(c.is_public);
    setOriginalCourseId(c.id);

    const parsed = (modulesRes.data || []).map((m: any) => ({
      id: generateId(),
      title: m.title,
      lesson_content: m.lesson_content,
      lab_type: m.lab_type,
      lab_data: m.lab_data,
      lab_title: m.lab_title,
      lab_description: m.lab_description,
      quiz: Array.isArray(m.quiz) ? m.quiz : [],
      youtube_url: m.youtube_url,
      youtube_title: m.youtube_title,
    }));

    setModules(parsed);
    if (parsed.length > 0) setExpandedModule(parsed[0].id);
    setLoading(false);
  };

  const addModule = () => {
    const m = emptyModule();
    setModules((prev) => [...prev, m]);
    setExpandedModule(m.id);
  };

  const removeModule = (mid: string) => {
    setModules((prev) => prev.filter((m) => m.id !== mid));
    if (expandedModule === mid) setExpandedModule(null);
  };

  const updateModule = (mid: string, updates: Partial<CreatorModule>) => {
    setModules((prev) => prev.map((m) => (m.id === mid ? { ...m, ...updates } : m)));
  };

  const moveModule = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= modules.length) return;
    const updated = [...modules];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setModules(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("course-uploads").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("course-uploads").getPublicUrl(path);
    const imageUrl = urlData.publicUrl;
    const markdown = `\n![${file.name}](${imageUrl})\n`;

    // Insert into active module's lesson content
    if (activeTextarea) {
      setModules((prev) =>
        prev.map((m) =>
          m.id === activeTextarea
            ? { ...m, lesson_content: m.lesson_content + markdown }
            : m
        )
      );
    }

    toast({ title: "Image uploaded! 📸", description: "Added to lesson content." });
    setUploading(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const saveAsNewVersion = async (publish: boolean) => {
    if (!user) return;
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }

    publish ? setPublishing(true) : setSaving(true);

    try {
      // Create new course as a version
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          topic: topic.trim() || "Custom",
          status: "ready",
          is_public: publish ? true : isPublic,
          is_published: publish,
          published_by: publish ? user.id : null,
          parent_course_id: originalCourseId,
          version: 2,
        } as any)
        .select("id")
        .single();

      if (courseError) throw courseError;

      const moduleInserts = modules.map((m, i) => ({
        course_id: course.id,
        module_order: i + 1,
        title: m.title || `Module ${i + 1}`,
        lesson_content: m.lesson_content || "No content yet.",
        lab_type: m.lab_type,
        lab_data: m.lab_data,
        lab_title: m.lab_title,
        lab_description: m.lab_description,
        quiz: m.quiz.length > 0 ? m.quiz : [],
        youtube_url: m.youtube_url,
        youtube_title: m.youtube_title,
      }));

      const { error: modulesError } = await supabase.from("course_modules").insert(moduleInserts);
      if (modulesError) throw modulesError;

      toast({
        title: publish ? "Course published! 🎉" : "Course saved! ✅",
        description: publish ? "Your course is now available to other users." : "New version saved.",
      });
      navigate(`/courses/${course.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-container max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/courses/${id}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Edit Course</h1>
          <p className="text-sm text-muted-foreground">
            Changes save as a new version — the original is preserved
          </p>
        </div>
        <Badge className="ml-auto bg-amber-500/10 text-amber-500 border-amber-500/20">
          <Crown className="w-3 h-3 mr-1" /> Elite
        </Badge>
      </div>

      {/* Course Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Course Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              {isPublic ? <Globe className="w-5 h-5 text-green-500" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{isPublic ? "Public Course" : "Private Course"}</p>
                <p className="text-xs text-muted-foreground">
                  {isPublic ? "Anyone can find and take this course" : "Only you can access this course"}
                </p>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </CardContent>
      </Card>

      {/* Image Upload */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
              Upload Image
            </Button>
            <p className="text-xs text-muted-foreground">
              Upload an image to insert into the currently expanded module's lesson. Click a module first.
            </p>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Modules</h2>
          <Badge variant="secondary" className="text-xs">{modules.length} module{modules.length !== 1 && "s"}</Badge>
        </div>

        {modules.map((mod, index) => (
          <Card key={mod.id} className="border-border/50">
            <div
              className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => {
                const next = expandedModule === mod.id ? null : mod.id;
                setExpandedModule(next);
                setActiveTextarea(next);
              }}
            >
              <div className="flex flex-col gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); moveModule(index, "up"); }} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); moveModule(index, "down"); }} disabled={index === modules.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{mod.title || `Module ${index + 1}`}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {mod.lesson_content && <Badge variant="outline" className="text-[10px] px-1.5 py-0"><FileText className="w-2.5 h-2.5 mr-0.5" />Lesson</Badge>}
                  {mod.lab_type && <Badge variant="outline" className="text-[10px] px-1.5 py-0"><Beaker className="w-2.5 h-2.5 mr-0.5" />{mod.lab_type}</Badge>}
                  {mod.quiz.length > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0"><ClipboardList className="w-2.5 h-2.5 mr-0.5" />{mod.quiz.length} Q</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); removeModule(mod.id); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              {expandedModule === mod.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>

            {expandedModule === mod.id && (
              <CardContent className="pt-0 pb-5 px-5 border-t border-border/30">
                <ModuleEditor module={mod} onChange={(updates) => updateModule(mod.id, updates)} />
              </CardContent>
            )}
          </Card>
        ))}

        <Button variant="outline" className="w-full" onClick={addModule}>
          <Plus className="w-4 h-4 mr-2" /> Add Module
        </Button>
      </div>

      {/* Save / Publish Bar */}
      <div className="flex items-center gap-3 sticky bottom-6 bg-background/80 backdrop-blur-lg border border-border/50 rounded-xl p-4 shadow-lg">
        <div className="flex-1">
          <p className="text-sm font-medium">{title || "Untitled Course"}</p>
          <p className="text-xs text-muted-foreground">{modules.length} module{modules.length !== 1 && "s"} · v2</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/courses/${id}`)}>Cancel</Button>
        <Button variant="outline" onClick={() => saveAsNewVersion(false)} disabled={saving || publishing}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Draft
        </Button>
        <Button variant="hero" onClick={() => saveAsNewVersion(true)} disabled={saving || publishing}>
          {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          Publish
        </Button>
      </div>
    </div>
  );
}
