import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle2,
  Circle,
  ArrowLeft,
  Loader2,
  FileText,
  Beaker,
  ClipboardList,
  Pencil,
  Crown,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import { useSubscription } from "@/hooks/useSubscription";
import InteractiveLab from "@/components/labs/InteractiveLab";
import LessonSlides from "@/components/courses/LessonSlides";
import QuizSlides from "@/components/courses/QuizSlides";
import AiTutor from "@/components/courses/AiTutor";
import CourseCompletionScreen from "@/components/courses/CourseCompletionScreen";

type Module = {
  id: string;
  module_order: number;
  title: string;
  lesson_content: string;
  youtube_url: string | null;
  youtube_title: string | null;
  lab_title: string | null;
  lab_description: string | null;
  lab_type: string | null;
  lab_data: any;
  lab_generation_status: string | null;
  lab_error: string | null;
  quiz: any[];
  completed: boolean;
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  is_published?: boolean;
  published_by?: string | null;
  user_id?: string;
};

type ContentType = "lesson" | "lab" | "quiz";

const PASS_THRESHOLD = 0.7;

export default function CourseView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { progress, completeSection, uncompleteSection, justCompleted, dismissCompletion } = useCourseProgress(id);
  const { isElite } = useSubscription();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [activeModule, setActiveModule] = useState(0);
  const [activeContent, setActiveContent] = useState<ContentType>("lesson");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [generatingLabs, setGeneratingLabs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) fetchCourse();
  }, [id]);

  const fetchCourse = async () => {
    const [courseRes, modulesRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", id!).maybeSingle(),
      supabase.from("course_modules").select("*").eq("course_id", id!).order("module_order"),
    ]);
    if (courseRes.error || !courseRes.data) {
      toast({ title: "Course not found", variant: "destructive" });
      navigate("/courses");
      return;
    }
    setCourse(courseRes.data);
    const parsed = (modulesRes.data || []).map((m: any) => ({ ...m, quiz: Array.isArray(m.quiz) ? m.quiz : [] }));
    setModules(parsed);
    setLoading(false);

    // Trigger lab generation for any pending/generating modules
    for (const m of parsed) {
      if (m.lab_generation_status === "pending" || m.lab_generation_status === "generating") {
        triggerLabGeneration(m.id);
      }
    }
  };

  const triggerLabGeneration = async (moduleId: string) => {
    if (generatingLabs.has(moduleId)) return;
    setGeneratingLabs(prev => new Set(prev).add(moduleId));
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lab-blueprint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ moduleId }),
      });
      if (resp.ok) {
        // Refresh modules to get updated lab data
        const { data } = await supabase
          .from("course_modules")
          .select("*")
          .eq("id", moduleId)
          .single();
        if (data) {
          setModules(prev => prev.map(m => m.id === moduleId ? { ...data, quiz: Array.isArray(data.quiz) ? data.quiz : [] } : m));
        }
      }
    } catch (e) {
      console.error("Lab generation failed for module", moduleId, e);
    } finally {
      setGeneratingLabs(prev => {
        const next = new Set(prev);
        next.delete(moduleId);
        return next;
      });
    }
  };

  const mod = modules[activeModule];

  const totalSections = modules.length * 3;
  const completedSections = modules.reduce((sum, m) => {
    const s = progress.sectionStatus[m.id];
    if (!s) return sum;
    return sum + (s.lesson ? 1 : 0) + (s.lab ? 1 : 0) + (s.quiz ? 1 : 0);
  }, 0);
  const progressPct = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  const getSectionDone = (moduleId: string, section: "lesson" | "lab" | "quiz") => {
    return progress.sectionStatus[moduleId]?.[section] ?? false;
  };

  const handleLessonComplete = useCallback(() => {
    if (!mod) return;
    completeSection(mod.id, "lesson", modules.length);
  }, [mod, completeSection, modules.length]);

  const handleLabComplete = useCallback(() => {
    if (!mod) return;
    completeSection(mod.id, "lab", modules.length);
  }, [mod, completeSection, modules.length]);

  const handleQuizSubmit = async (answers: Record<number, number>, score: number, total: number) => {
    if (!mod || !user) return;
    const pct = total > 0 ? score / total : 0;
    const passed = pct >= PASS_THRESHOLD;

    await supabase.from("quiz_attempts").insert({
      user_id: user.id,
      module_id: mod.id,
      answers,
      score,
      total,
    });

    if (passed) {
      completeSection(mod.id, "quiz", modules.length);
      toast({ title: `Quiz passed! ${Math.round(pct * 100)}%`, description: `${score}/${total} correct` });
    } else {
      toast({
        title: `Score: ${Math.round(pct * 100)}% — Need 70% to pass`,
        description: "Review the material and try again.",
        variant: "destructive",
      });
    }
  };

  const selectItem = (moduleIndex: number, content: ContentType) => {
    setActiveModule(moduleIndex);
    setActiveContent(content);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {justCompleted && course && (
        <CourseCompletionScreen
          courseName={course.title}
          totalModules={modules.length}
          pointsAwarded={150}
          onDismiss={dismissCompletion}
          onViewCertificate={() => {
            dismissCompletion();
            navigate("/profile");
          }}
        />
      )}

      <div className="flex h-[calc(100vh-3rem)] relative">
        {/* Sidebar */}
        <aside className={`border-r border-border/50 bg-card/30 flex flex-col flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "w-72" : "w-0 overflow-hidden border-r-0"}`}>
          <div className="p-4 border-b border-border/40">
            <Button variant="ghost" size="sm" onClick={() => navigate("/courses")} className="-ml-2 mb-2 text-muted-foreground text-[13px]">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Button>
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm line-clamp-2">{course?.title}</h2>
              {isElite && course?.user_id === user?.id && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0" onClick={() => navigate(`/courses/${id}/edit`)} title="Edit Course (Elite)">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {course?.is_published && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                <User className="w-2.5 h-2.5" /> Published
              </div>
            )}
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium tabular-nums">{progressPct}%</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Accordion type="multiple" defaultValue={[`module-0`]} className="w-full">
              {modules.map((m, i) => {
                const isModuleDone = progress.completedLessons.includes(m.id);
                const lessonDone = getSectionDone(m.id, "lesson");
                const labDone = getSectionDone(m.id, "lab");
                const quizDone = getSectionDone(m.id, "quiz");

                return (
                  <AccordionItem key={m.id} value={`module-${i}`} className="border-b border-border/30">
                    <AccordionTrigger className="px-4 py-2.5 text-[13px] hover:no-underline hover:bg-secondary/20">
                      <div className="flex items-center gap-2 text-left">
                        {isModuleDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                        )}
                        <span className="line-clamp-1 font-medium">{m.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-1">
                      <div className="flex flex-col">
                        {[
                          { key: "lesson" as ContentType, icon: FileText, label: "Lesson", done: lessonDone },
                          { key: "lab" as ContentType, icon: Beaker, label: "Lab", done: labDone },
                          { key: "quiz" as ContentType, icon: ClipboardList, label: "Quiz", done: quizDone },
                        ].map(({ key, icon: Icon, label, done }) => (
                          <button
                            key={key}
                            onClick={() => selectItem(i, key)}
                            className={`flex items-center gap-2 pl-9 pr-4 py-1.5 text-[13px] transition-all duration-150 ${
                              activeModule === i && activeContent === key
                                ? "bg-primary/[0.08] text-primary border-l-2 border-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/20"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                            ) : (
                              <Icon className="w-3 h-3" />
                            )}
                            {label}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </aside>

        {/* Main Content */}
        {mod && (
          <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-1.5">Module {mod.module_order}</p>
                  <h1 className="font-display text-xl font-bold">{mod.title}</h1>
                </div>
                {progress.completedLessons.includes(mod.id) && (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[11px]">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                  </Badge>
                )}
              </div>

              {/* Lesson */}
              {activeContent === "lesson" && (
                <LessonSlides
                  content={mod.lesson_content}
                  youtubeUrl={mod.youtube_url}
                  youtubeTitle={mod.youtube_title}
                  onComplete={handleLessonComplete}
                  isCompleted={getSectionDone(mod.id, "lesson")}
                />
              )}

              {/* Lab */}
              {activeContent === "lab" && (
                <InteractiveLab
                  labType={mod.lab_type}
                  labData={mod.lab_data}
                  labTitle={mod.lab_title}
                  labDescription={mod.lab_description}
                  labGenerationStatus={mod.lab_generation_status}
                  labError={mod.lab_error}
                  onComplete={handleLabComplete}
                  isCompleted={getSectionDone(mod.id, "lab")}
                  onRetryGeneration={() => triggerLabGeneration(mod.id)}
                />
              )}

              {/* Quiz */}
              {activeContent === "quiz" && (
                <QuizSlides
                  questions={mod.quiz as any[]}
                  onSubmit={handleQuizSubmit}
                  isCompleted={getSectionDone(mod.id, "quiz")}
                />
              )}
            </div>

            {/* AI Tutor */}
            {activeContent === "lesson" && course && (
              <AiTutor moduleTitle={mod.title} courseTitle={course.title} />
            )}
          </main>
        )}
      </div>
    </>
  );
}
