import { Button } from "@/components/ui/button";
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
  const [loadingQuizAttempt, setLoadingQuizAttempt] = useState(false);

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

  const handleQuizSubmit = async () => {
    if (!mod) return;
    setQuizSubmitted(true);

    const quizQuestions = mod.quiz as any[];
    const score = quizQuestions.filter((q: any, i: number) => quizAnswers[i] === q.correct).length;
    const total = quizQuestions.length;
    const pct = total > 0 ? score / total : 0;
    const passed = pct >= PASS_THRESHOLD;

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
    if (mod) uncompleteSection(mod.id, "quiz");
  };

  const selectItem = (moduleIndex: number, content: ContentType) => {
    setActiveModule(moduleIndex);
    setActiveContent(content);
    if (content !== "quiz") {
      setQuizAnswers({});
      setQuizSubmitted(false);
    }
  };

  // Load last quiz attempt when switching to a completed quiz
  useEffect(() => {
    if (activeContent !== "quiz" || !mod || !user) return;
    const isQuizDone = getSectionDone(mod.id, "quiz");
    if (!isQuizDone) return;

    setLoadingQuizAttempt(true);
    (async () => {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("user_id", user.id)
        .eq("module_id", mod.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.answers && typeof data.answers === "object") {
        // Convert answers back to Record<number, number>
        const answers: Record<number, number> = {};
        for (const [key, value] of Object.entries(data.answers as Record<string, number>)) {
          answers[Number(key)] = value;
        }
        setQuizAnswers(answers);
        setQuizSubmitted(true);
      }
      setLoadingQuizAttempt(false);
    })();
  }, [activeContent, activeModule, mod?.id, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const quizScore = mod ? (mod.quiz as any[]).filter((q: any, i: number) => quizAnswers[i] === q.correct).length : 0;
  const quizTotal = mod?.quiz?.length || 0;
  const quizPct = quizTotal > 0 ? Math.round((quizScore / quizTotal) * 100) : 0;
  const quizPassed = quizPct >= PASS_THRESHOLD * 100;

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

      <div className="flex h-[calc(100vh-3rem)]">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border/50 bg-card/30 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-border/40">
            <Button variant="ghost" size="sm" onClick={() => navigate("/courses")} className="-ml-2 mb-2 text-muted-foreground text-[13px]">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Button>
            <h2 className="font-display font-semibold text-sm line-clamp-2">{course?.title}</h2>
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
                  onComplete={handleLabComplete}
                  isCompleted={getSectionDone(mod.id, "lab")}
                />
              )}

              {/* Quiz */}
              {activeContent === "quiz" && !loadingQuizAttempt && (
                <div className="space-y-4">
                  {getSectionDone(mod.id, "quiz") && !quizSubmitted && (
                    <Card className="border-green-500/20 bg-green-500/[0.04]">
                      <CardContent className="p-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-[13px] font-medium">Quiz passed! You can retake it if you'd like.</span>
                      </CardContent>
                    </Card>
                  )}

                  {(mod.quiz as any[])?.map((q: any, qi: number) => (
                    <Card key={qi} className="border-border/50">
                      <CardContent className="p-6">
                        <p className="font-medium mb-3 text-[15px]">{qi + 1}. {q.question}</p>
                        <div className="space-y-2">
                          {q.options?.map((opt: string, oi: number) => {
                            const selected = quizAnswers[qi] === oi;
                            const isCorrect = oi === q.correct;
                            let style = "border-border/50 hover:border-primary/20";
                            if (quizSubmitted) {
                              if (isCorrect) style = "border-green-500/40 bg-green-500/[0.06]";
                              else if (selected && !isCorrect) style = "border-destructive/40 bg-destructive/[0.06]";
                            } else if (selected) {
                              style = "border-primary/40 bg-primary/[0.06]";
                            }
                            return (
                              <button
                                key={oi}
                                disabled={quizSubmitted}
                                onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                                className={`w-full text-left px-4 py-3 rounded-lg border text-[13px] transition-all duration-150 ${style}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {quizSubmitted && q.explanation && (
                          <p className="mt-3 text-[13px] text-muted-foreground bg-secondary/30 p-3 rounded-lg">
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
                        <Badge variant={quizPassed ? "default" : "destructive"} className="text-[11px]">
                          {quizPct}% ({quizScore}/{quizTotal})
                        </Badge>
                        {!quizPassed && (
                          <span className="text-[13px] text-muted-foreground">Need 70% to pass</span>
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
    </>
  );
}
