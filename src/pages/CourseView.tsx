import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import InteractiveLab from "@/components/labs/InteractiveLab";
import LessonSlides from "@/components/courses/LessonSlides";
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
  quiz: any[];
  completed: boolean;
};

type Course = {
  id: string;
  title: string;
  description: string | null;
};

type ContentType = "lesson" | "lab" | "quiz";

const PASS_THRESHOLD = 0.7;

export default function CourseView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { progress, completeSection, uncompleteSection, justCompleted, dismissCompletion } = useCourseProgress(id);

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [activeModule, setActiveModule] = useState(0);
  const [activeContent, setActiveContent] = useState<ContentType>("lesson");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

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
    setModules((modulesRes.data || []).map((m: any) => ({ ...m, quiz: Array.isArray(m.quiz) ? m.quiz : [] })));
    setLoading(false);
  };

  const mod = modules[activeModule];
  const completedCount = progress.completedLessons.length;
  const progressPct = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;

  // Section status helpers
  const getSectionDone = (moduleId: string, section: "lesson" | "lab" | "quiz") => {
    return progress.sectionStatus[moduleId]?.[section] ?? false;
  };

  // Lesson auto-complete
  const handleLessonComplete = useCallback(() => {
    if (!mod) return;
    completeSection(mod.id, "lesson", modules.length);
  }, [mod, completeSection, modules.length]);

  // Lab completion callback
  const handleLabComplete = useCallback(() => {
    if (!mod) return;
    completeSection(mod.id, "lab", modules.length);
  }, [mod, completeSection, modules.length]);

  // Quiz submit
  const handleQuizSubmit = async () => {
    if (!mod) return;
    setQuizSubmitted(true);

    const quizQuestions = mod.quiz as any[];
    const score = quizQuestions.filter((q: any, i: number) => quizAnswers[i] === q.correct).length;
    const total = quizQuestions.length;
    const pct = total > 0 ? score / total : 0;
    const passed = pct >= PASS_THRESHOLD;

    // Save quiz attempt
    if (user) {
      await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        module_id: mod.id,
        answers: quizAnswers,
        score,
        total,
      });
    }

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

  const resetQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    // Uncomplete quiz section on retry
    if (mod) uncompleteSection(mod.id, "quiz");
  };

  const selectItem = (moduleIndex: number, content: ContentType) => {
    setActiveModule(moduleIndex);
    setActiveContent(content);
    if (content !== "quiz") resetQuizState();
  };

  const resetQuizState = () => { setQuizAnswers({}); setQuizSubmitted(false); };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const quizScore = mod ? (mod.quiz as any[]).filter((q: any, i: number) => quizAnswers[i] === q.correct).length : 0;
  const quizTotal = mod?.quiz?.length || 0;
  const quizPct = quizTotal > 0 ? Math.round((quizScore / quizTotal) * 100) : 0;
  const quizPassed = quizPct >= PASS_THRESHOLD * 100;

  return (
    <DashboardLayout>
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

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <aside className="w-80 border-r border-border bg-card/50 backdrop-blur-sm flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-border">
            <Button variant="ghost" size="sm" onClick={() => navigate("/courses")} className="-ml-2 mb-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Courses
            </Button>
            <h2 className="font-display font-bold text-base line-clamp-2">{course?.title}</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{progressPct}%</span>
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
                  <AccordionItem key={m.id} value={`module-${i}`} className="border-b border-border/50">
                    <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline hover:bg-secondary/30">
                      <div className="flex items-center gap-2 text-left">
                        {isModuleDone ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
                            className={`flex items-center gap-2.5 pl-10 pr-4 py-2 text-sm transition-colors ${
                              activeModule === i && activeContent === key
                                ? "bg-primary/10 text-primary border-l-2 border-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Icon className="w-3.5 h-3.5" />
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
                  <Badge variant="secondary" className="mb-2">Module {mod.module_order}</Badge>
                  <h1 className="font-display text-2xl font-bold">{mod.title}</h1>
                </div>
                {progress.completedLessons.includes(mod.id) && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> All Complete
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
                  onComplete={handleLabComplete}
                  isCompleted={getSectionDone(mod.id, "lab")}
                />
              )}

              {/* Quiz */}
              {activeContent === "quiz" && (
                <div className="space-y-4">
                  {getSectionDone(mod.id, "quiz") && !quizSubmitted && (
                    <Card className="border-green-500/30 bg-green-500/5">
                      <CardContent className="p-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-sm font-medium">Quiz passed! You can retake it if you'd like.</span>
                      </CardContent>
                    </Card>
                  )}

                  {(mod.quiz as any[])?.map((q: any, qi: number) => (
                    <Card key={qi}>
                      <CardContent className="p-6">
                        <p className="font-medium mb-3">{qi + 1}. {q.question}</p>
                        <div className="space-y-2">
                          {q.options?.map((opt: string, oi: number) => {
                            const selected = quizAnswers[qi] === oi;
                            const isCorrect = oi === q.correct;
                            let style = "border-border hover:border-primary/30";
                            if (quizSubmitted) {
                              if (isCorrect) style = "border-green-500 bg-green-500/10";
                              else if (selected && !isCorrect) style = "border-destructive bg-destructive/10";
                            } else if (selected) {
                              style = "border-primary bg-primary/10";
                            }
                            return (
                              <button
                                key={oi}
                                disabled={quizSubmitted}
                                onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${style}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {quizSubmitted && q.explanation && (
                          <p className="mt-3 text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                            💡 {q.explanation}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  <div className="flex items-center gap-3">
                    {!quizSubmitted ? (
                      <Button onClick={handleQuizSubmit} disabled={Object.keys(quizAnswers).length < (mod.quiz?.length || 0)}>
                        Submit Quiz
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={resetQuiz}>Retry Quiz</Button>
                    )}

                    {quizSubmitted && (
                      <div className="flex items-center gap-2">
                        <Badge variant={quizPassed ? "default" : "destructive"}>
                          {quizPct}% ({quizScore}/{quizTotal})
                        </Badge>
                        {!quizPassed && (
                          <span className="text-sm text-muted-foreground">Need 70% to pass</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </DashboardLayout>
  );
}
