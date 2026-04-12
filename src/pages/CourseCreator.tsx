import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, GripVertical, Save, ArrowLeft, Loader2,
  FileText, Beaker, ClipboardList, ChevronDown, ChevronUp,
  Globe, Lock, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ModuleEditor from "@/components/courses/creator/ModuleEditor";

export type CreatorModule = {
  id: string;
  title: string;
  lesson_content: string;
  lab_type: string | null;
  lab_data: any;
  lab_title: string | null;
  lab_description: string | null;
  quiz: QuizQuestion[];
  youtube_url: string | null;
  youtube_title: string | null;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

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

export default function CourseCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [modules, setModules] = useState<CreatorModule[]>([emptyModule()]);
  const [saving, setSaving] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  useEffect(() => {
    if (modules.length > 0 && !expandedModule) {
      setExpandedModule(modules[0].id);
    }
  }, []);

  const addModule = () => {
    const m = emptyModule();
    setModules((prev) => [...prev, m]);
    setExpandedModule(m.id);
  };

  const removeModule = (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
    if (expandedModule === id) setExpandedModule(null);
  };

  const updateModule = (id: string, updates: Partial<CreatorModule>) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const moveModule = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= modules.length) return;
    const updated = [...modules];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setModules(updated);
  };

  const handleSave = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      navigate("/login");
      return;
    }
    if (!title.trim()) {
      toast({ title: "Course title is required", variant: "destructive" });
      return;
    }
    if (modules.length === 0) {
      toast({ title: "Add at least one module", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Create course
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          topic: topic.trim() || "Custom",
          status: "ready",
          is_public: isPublic,
        })
        .select("id")
        .single();

      if (courseError) throw courseError;

      // Insert modules
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

      toast({ title: "Course created! 🎉" });
      navigate(`/courses/${course.id}`);
    } catch (error) {
      toast({
        title: "Error saving course",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/courses")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold">Course Creator</h1>
          <p className="text-sm text-muted-foreground">Build your own course with lessons, labs, and quizzes</p>
        </div>
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
              <Input
                placeholder="e.g. Introduction to Economics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input
                placeholder="e.g. Economics, Science, History"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="What will students learn in this course?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="w-5 h-5 text-green-500" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
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
              onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); moveModule(index, "up"); }}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveModule(index, "down"); }}
                  disabled={index === modules.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {mod.title || `Module ${index + 1}`}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {mod.lesson_content && <Badge variant="outline" className="text-[10px] px-1.5 py-0"><FileText className="w-2.5 h-2.5 mr-0.5" />Lesson</Badge>}
                  {mod.lab_type && <Badge variant="outline" className="text-[10px] px-1.5 py-0"><Beaker className="w-2.5 h-2.5 mr-0.5" />{mod.lab_type}</Badge>}
                  {mod.quiz.length > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0"><ClipboardList className="w-2.5 h-2.5 mr-0.5" />{mod.quiz.length} Q</Badge>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => { e.stopPropagation(); removeModule(mod.id); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              {expandedModule === mod.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>

            {expandedModule === mod.id && (
              <CardContent className="pt-0 pb-5 px-5 border-t border-border/30">
                <ModuleEditor
                  module={mod}
                  onChange={(updates) => updateModule(mod.id, updates)}
                />
              </CardContent>
            )}
          </Card>
        ))}

        <Button variant="outline" className="w-full" onClick={addModule}>
          <Plus className="w-4 h-4 mr-2" /> Add Module
        </Button>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 sticky bottom-6 bg-background/80 backdrop-blur-lg border border-border/50 rounded-xl p-4 shadow-lg">
        <div className="flex-1">
          <p className="text-sm font-medium">{title || "Untitled Course"}</p>
          <p className="text-xs text-muted-foreground">{modules.length} module{modules.length !== 1 && "s"} · {isPublic ? "Public" : "Private"}</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/courses")}>Cancel</Button>
        <Button variant="hero" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Saving..." : "Publish Course"}
        </Button>
      </div>
    </div>
  );
}
