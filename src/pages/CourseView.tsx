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
  BookOpen,
  Youtube,
  FlaskConical,
  HelpCircle,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Loader2,
  FileText,
  Beaker,
  ClipboardList,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import InteractiveLab from "@/components/labs/InteractiveLab";

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

export default function CourseView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const toggleComplete = async (moduleId: string, completed: boolean) => {
    await supabase.from("course_modules").update({ completed: !completed }).eq("id", moduleId);
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, completed: !m.completed } : m))
    );
  };

  const mod = modules[activeModule];
  const progress = modules.length ? Math.round((modules.filter((m) => m.completed).length / modules.length) * 100) : 0;

  const handleQuizSubmit = () => setQuizSubmitted(true);
  const resetQuiz = () => { setQuizAnswers({}); setQuizSubmitted(false); };

  const selectItem = (moduleIndex: number, content: ContentType) => {
    setActiveModule(moduleIndex);
    setActiveContent(content);
    if (content !== "quiz") resetQuiz();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
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
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{progress}%</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Accordion type="multiple" defaultValue={[`module-0`]} className="w-full">
              {modules.map((m, i) => (
                <AccordionItem key={m.id} value={`module-${i}`} className="border-b border-border/50">
                  <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline hover:bg-secondary/30">
                    <div className="flex items-center gap-2 text-left">
                      {m.completed ? (
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
                        { key: "lesson" as ContentType, icon: FileText, label: "Lesson" },
                        { key: "lab" as ContentType, icon: Beaker, label: "Lab" },
                        { key: "quiz" as ContentType, icon: ClipboardList, label: "Quiz" },
                      ].map(({ key, icon: Icon, label }) => (
                        <button
                          key={key}
                          onClick={() => selectItem(i, key)}
                          className={`flex items-center gap-2.5 pl-10 pr-4 py-2 text-sm transition-colors ${
                            activeModule === i && activeContent === key
                              ? "bg-primary/10 text-primary border-l-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
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
                <Button variant="outline" size="sm" onClick={() => toggleComplete(mod.id, mod.completed)}>
                  {mod.completed ? (
                    <><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Completed</>
                  ) : (
                    <><Circle className="w-4 h-4 mr-1" /> Mark Complete</>
                  )}
                </Button>
              </div>

              {/* Lesson */}
              {activeContent === "lesson" && (
                <div className="space-y-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-accent prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-secondary prose-pre:border prose-pre:border-border">
                        <ReactMarkdown>{mod.lesson_content}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                  {mod.youtube_url && (
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <Youtube className="w-5 h-5 text-red-500" />
                          <h3 className="font-semibold">Recommended Video</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{mod.youtube_title}</p>
                        <Button variant="outline" size="sm" asChild>
                          <a href={mod.youtube_url} target="_blank" rel="noopener noreferrer">
                            <Youtube className="w-4 h-4 mr-1" /> Search on YouTube
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Lab */}
              {activeContent === "lab" && (
                <InteractiveLab
                  labType={mod.lab_type}
                  labData={mod.lab_data}
                  labTitle={mod.lab_title}
                  labDescription={mod.lab_description}
                />
              )}

              {/* Quiz */}
              {activeContent === "quiz" && (
                <div className="space-y-4">
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
                      </CardContent>
                    </Card>
                  ))}
                  <div className="flex gap-3">
                    {!quizSubmitted ? (
                      <Button variant="hero" onClick={handleQuizSubmit} disabled={Object.keys(quizAnswers).length < (mod.quiz?.length || 0)}>
                        Submit Quiz
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={resetQuiz}>Retry Quiz</Button>
                    )}
                  </div>
                  {quizSubmitted && (
                    <p className="text-sm font-medium">
                      Score: {(mod.quiz as any[]).filter((q: any, i: number) => quizAnswers[i] === q.correct).length} / {mod.quiz?.length}
                    </p>
                  )}
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </DashboardLayout>
  );
}
