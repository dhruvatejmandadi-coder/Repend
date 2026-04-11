import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  ArrowLeft,
  Loader2,
  FileText,
  Beaker,
  ClipboardList,
  Pencil,
  Play,
  Download,
  MessageCircle,
  BookOpen,
  Users,
  BarChart3,
  Lock,
  ChevronRight,
  Quote,
  Layers,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
import rependLogo from "@/assets/repend-logo.png";
import { cn } from "@/lib/utils";

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

/* ─── Themed wrapper classes ─── */
const themeClasses = {
  page: "min-h-screen bg-[#FAFAF9] font-editorial text-[#1a1a2e] antialiased",
  nav: "fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 bg-white/70 backdrop-blur-xl border-b border-[#e8e8e4]",
  sidebar: "w-[280px] flex-shrink-0 border-r border-[#e8e8e4] bg-white/60 backdrop-blur-sm flex flex-col",
  card: "bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_20px_40px_rgba(0,0,0,0.06)] border border-[#f0f0ec]",
  cardInner: "bg-white rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.02),0_1px_3px_rgba(0,0,0,0.04)] border border-[#f0f0ec]",
  accent: "#6157FF",
  accentBg: "bg-[#6157FF]",
  accentText: "text-[#6157FF]",
  accentHover: "hover:bg-[#5147e5]",
  muted: "text-[#8a8a8a]",
  mutedBg: "bg-[#f5f5f2]",
};

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
  const [generatingLabs, setGeneratingLabs] = useState<Set<string>>(new Set());
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "resources" | "notes" | "discussions">("overview");

  useEffect(() => {
    if (id) fetchCourse();
  }, [id]);

  useEffect(() => {
    const hasGenerating = modules.some(m => m.lesson_content.startsWith("⏳"));
    const hasPendingLabs = modules.some(m =>
      !m.lesson_content.startsWith("⏳") &&
      (m.lab_generation_status === "pending" || m.lab_generation_status === "generating" ||
        (m.lab_generation_status === "done" && !m.lab_data))
    );

    if (!hasGenerating && !hasPendingLabs || !id) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", id)
        .order("module_order");
      if (data) {
        const parsed = data.map((m: any) => ({ ...m, quiz: Array.isArray(m.quiz) ? m.quiz : [] }));
        setModules(parsed);
        const stillGenerating = parsed.some((m: any) => m.lesson_content.startsWith("⏳"));
        if (!stillGenerating) {
          await supabase.from("courses").update({ status: "ready" }).eq("id", id);
          for (const m of parsed) {
            if (m.lab_generation_status === "pending" || m.lab_generation_status === "generating" ||
              (m.lab_generation_status === "done" && !m.lab_data)) {
              triggerLabGeneration(m.id);
            }
          }
        }
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [modules, id]);

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

    for (const m of parsed) {
      if (!m.lesson_content.startsWith("⏳") && (
        m.lab_generation_status === "pending" ||
        m.lab_generation_status === "generating" ||
        (m.lab_generation_status === "done" && !m.lab_data)
      )) {
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

  const handleLabReplay = useCallback(() => {
    if (!mod) return;
    uncompleteSection(mod.id, "lab");
  }, [mod, uncompleteSection]);

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

  /* ─── Loading skeleton ─── */
  if (loading) {
    return (
      <div className={themeClasses.page}>
        <div className={themeClasses.nav}>
          <div className="h-5 w-24 rounded bg-[#e8e8e4] animate-pulse" />
          <div className="h-5 w-32 rounded bg-[#e8e8e4] animate-pulse" />
        </div>
        <div className="pt-14 flex h-screen">
          <div className="w-[280px] border-r border-[#e8e8e4] p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-[#f0f0ec] animate-pulse" />
            ))}
          </div>
          <div className="flex-1 p-12">
            <div className="h-8 w-96 rounded bg-[#e8e8e4] animate-pulse mb-8" />
            <div className="aspect-video rounded-2xl bg-[#f0f0ec] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const contentTabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "resources" as const, label: "Resources" },
    { key: "notes" as const, label: "Notes" },
    { key: "discussions" as const, label: "Discussions" },
  ];

  const leftNavItems = [
    { icon: Layers, label: "Course Overview", action: () => setActiveContent("lesson") },
    { icon: BookOpen, label: "Learning Modules", action: () => {} },
    { icon: Users, label: "Community", action: () => navigate("/community") },
    { icon: BarChart3, label: "Progress", action: () => navigate("/progress") },
  ];

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

      <div className={themeClasses.page}>
        {/* ═══ Top Navigation ═══ */}
        <nav className={themeClasses.nav}>
          <div className="flex items-center gap-6">
            <Link to="/courses" className="flex items-center gap-2">
              <img src={rependLogo} alt="Repend" className="h-6 w-auto brightness-0 opacity-80" />
            </Link>
            <div className="h-5 w-px bg-[#e0e0dc]" />
            <span className="text-xs font-semibold tracking-wider uppercase text-[#8a8a8a]">
              Lumina Academy
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isElite && course?.user_id === user?.id && (
              <button
                onClick={() => navigate(`/courses/${id}/edit`)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#8a8a8a] hover:text-[#6157FF] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <div className="flex items-center gap-2 text-xs text-[#8a8a8a]">
              <div className="w-24 h-1.5 rounded-full bg-[#e8e8e4] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#6157FF] transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="font-semibold tabular-nums">{progressPct}%</span>
            </div>
            <button
              onClick={() => navigate("/courses")}
              className="ml-2 flex items-center gap-1.5 text-xs font-medium text-[#8a8a8a] hover:text-[#1a1a2e] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Courses
            </button>
          </div>
        </nav>

        {/* ═══ Main Layout ═══ */}
        <div className="pt-14 flex min-h-screen">
          {/* ─── Left Sidebar ─── */}
          <aside className={themeClasses.sidebar}>
            <div className="p-5 border-b border-[#e8e8e4]">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#b0b0a8] mb-1">
                Batch of 2024
              </p>
              <h3 className="text-sm font-bold text-[#1a1a2e] leading-snug line-clamp-2">
                {course?.title}
              </h3>
            </div>

            {/* Nav items */}
            <div className="p-3 space-y-0.5">
              {leftNavItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#6b6b6b] hover:bg-[#f5f5f2] hover:text-[#1a1a2e] transition-all"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mx-5 my-2 h-px bg-[#e8e8e4]" />

            {/* Module list */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-hide">
              <p className="px-3 pt-3 pb-2 text-[10px] font-bold tracking-[0.15em] uppercase text-[#b0b0a8]">
                Modules
              </p>
              {modules.map((m, i) => {
                const isActive = activeModule === i;
                const isModuleDone = progress.completedLessons.includes(m.id);
                const lessonDone = getSectionDone(m.id, "lesson");
                const labDone = getSectionDone(m.id, "lab");
                const quizDone = getSectionDone(m.id, "quiz");

                return (
                  <div key={m.id} className="mb-1">
                    <button
                      onClick={() => selectItem(i, "lesson")}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                        isActive
                          ? "bg-[#6157FF]/[0.06] text-[#6157FF] font-semibold"
                          : "text-[#6b6b6b] hover:bg-[#f5f5f2]"
                      )}
                    >
                      {isModuleDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : isActive ? (
                        <div className="w-4 h-4 rounded-full border-2 border-[#6157FF] flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#6157FF]" />
                        </div>
                      ) : (
                        <Circle className="w-4 h-4 text-[#d0d0cc] flex-shrink-0" />
                      )}
                      <span className="text-[13px] line-clamp-1">{m.title}</span>
                    </button>

                    {/* Sub-items when active */}
                    {isActive && (
                      <div className="ml-6 mt-0.5 space-y-0.5 animate-fade-in">
                        {[
                          { key: "lesson" as ContentType, icon: FileText, label: "Lesson", done: lessonDone },
                          { key: "lab" as ContentType, icon: Beaker, label: "Lab", done: labDone },
                          { key: "quiz" as ContentType, icon: ClipboardList, label: "Quiz", done: quizDone },
                        ].map(({ key, icon: Icon, label, done }) => (
                          <button
                            key={key}
                            onClick={() => selectItem(i, key)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] transition-all",
                              activeContent === key
                                ? "text-[#6157FF] font-semibold bg-[#6157FF]/[0.04]"
                                : "text-[#8a8a8a] hover:text-[#1a1a2e]"
                            )}
                          >
                            {done ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Icon className="w-3 h-3" />
                            )}
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ─── Center Content ─── */}
          {mod && (
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-[780px] mx-auto px-8 py-10">
                {/* Hero title */}
                <div className="mb-8">
                  <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#b0b0a8] mb-3">
                    Module {mod.module_order}
                  </p>
                  <h1 className="text-3xl md:text-[2.5rem] font-extrabold leading-[1.1] tracking-tight text-[#1a1a2e]">
                    The Architecture of{" "}
                    <em className="not-italic bg-gradient-to-r from-[#6157FF] to-[#8B7CFF] bg-clip-text text-transparent">
                      {mod.title}
                    </em>
                  </h1>
                  {progress.completedLessons.includes(mod.id) && (
                    <Badge className="mt-3 bg-emerald-50 text-emerald-600 border-emerald-200 text-[11px] font-semibold shadow-none">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                    </Badge>
                  )}
                </div>

                {/* Module still generating */}
                {mod.lesson_content.startsWith("⏳") ? (
                  <div className={cn(themeClasses.card, "flex flex-col items-center justify-center py-20 text-center")}>
                    <Loader2 className="w-8 h-8 animate-spin text-[#6157FF] mb-4" />
                    <h3 className="text-lg font-bold mb-2">Generating Module Content</h3>
                    <p className="text-sm text-[#8a8a8a] max-w-md">
                      Creating your lesson, quiz, and lab for "{mod.title}". This usually takes about 30 seconds.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Video / Content area */}
                    {activeContent === "lesson" && mod.youtube_url && (
                      <div className={cn(themeClasses.card, "aspect-video mb-8 overflow-hidden relative group")}>
                        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#2a2a4e] flex items-center justify-center">
                          <button className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:scale-105">
                            <Play className="w-8 h-8 text-white ml-1" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex items-center gap-1 mb-8 border-b border-[#e8e8e4]">
                      {contentTabs.map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={cn(
                            "px-4 py-3 text-[13px] font-semibold transition-all relative",
                            activeTab === tab.key
                              ? "text-[#6157FF]"
                              : "text-[#8a8a8a] hover:text-[#1a1a2e]"
                          )}
                        >
                          {tab.label}
                          {activeTab === tab.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6157FF] rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Content */}
                    <div className={cn(themeClasses.card, "p-8")}>
                      {activeContent === "lesson" && (
                        <LessonSlides
                          content={mod.lesson_content}
                          youtubeUrl={mod.youtube_url}
                          youtubeTitle={mod.youtube_title}
                          onComplete={handleLessonComplete}
                          isCompleted={getSectionDone(mod.id, "lesson")}
                          onSlideChange={(idx) => setCurrentSlideIndex(idx)}
                        />
                      )}

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
                          onReplay={handleLabReplay}
                        />
                      )}

                      {activeContent === "quiz" && (
                        <QuizSlides
                          questions={mod.quiz as any[]}
                          onSubmit={handleQuizSubmit}
                          isCompleted={getSectionDone(mod.id, "quiz")}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </main>
          )}

          {/* ─── Right Sidebar ─── */}
          <aside className="w-[300px] flex-shrink-0 border-l border-[#e8e8e4] bg-white/40 backdrop-blur-sm p-5 space-y-5 overflow-y-auto hidden xl:block">
            {/* Course Content Card */}
            <div className={themeClasses.card}>
              <div className="p-4 border-b border-[#f0f0ec]">
                <h4 className="text-xs font-bold tracking-wider uppercase text-[#8a8a8a]">
                  Course Content
                </h4>
              </div>
              <div className="p-2 max-h-[280px] overflow-y-auto scrollbar-hide">
                {modules.map((m, i) => {
                  const isDone = progress.completedLessons.includes(m.id);
                  const isCurrent = activeModule === i;
                  const isLocked = i > 0 && !progress.completedLessons.includes(modules[i - 1]?.id) && !isCurrent;

                  return (
                    <button
                      key={m.id}
                      onClick={() => selectItem(i, "lesson")}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-[12px]",
                        isCurrent && "bg-[#6157FF]/[0.06] font-semibold",
                        isLocked && "opacity-40"
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : isCurrent ? (
                        <Play className="w-4 h-4 text-[#6157FF] flex-shrink-0" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4 text-[#c0c0bc] flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#d0d0cc] flex-shrink-0" />
                      )}
                      <span className="line-clamp-1 flex-1">{m.title}</span>
                      <ChevronRight className="w-3 h-3 text-[#c0c0bc] flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Download Assets Card */}
            <div className={cn(themeClasses.card, "p-5")}>
              <h4 className="text-xs font-bold tracking-wider uppercase text-[#8a8a8a] mb-3">
                Download Assets
              </h4>
              <p className="text-[12px] text-[#8a8a8a] mb-4 leading-relaxed">
                Get the complete course workbook with exercises, notes, and reference materials.
              </p>
              <button className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[13px] font-semibold text-white transition-all",
                themeClasses.accentBg, themeClasses.accentHover,
                "shadow-[0_4px_12px_rgba(97,87,255,0.3)]"
              )}>
                <Download className="w-4 h-4" />
                PDF Workbook
              </button>
            </div>

            {/* Instructor Quote Card */}
            <div className={cn(themeClasses.card, "p-5 relative overflow-hidden")}>
              <Quote className="absolute top-3 right-3 w-8 h-8 text-[#6157FF]/10" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6157FF] to-[#8B7CFF] flex items-center justify-center text-white text-sm font-bold shadow-[0_4px_12px_rgba(97,87,255,0.25)]">
                  R
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#1a1a2e]">Repend AI</p>
                  <p className="text-[11px] text-[#8a8a8a]">Course Instructor</p>
                </div>
              </div>
              <p className="text-[12px] text-[#6b6b6b] leading-relaxed italic">
                "Every concept becomes clearer when you experience the tradeoffs firsthand. Engage with the labs — they're where real understanding happens."
              </p>
            </div>
          </aside>
        </div>

        {/* ═══ Floating Module Chat Button ═══ */}
        {course && mod && (
          <AiTutor
            moduleTitle={mod.title}
            courseTitle={course.title}
            currentSlideContent={activeContent === "lesson" ? (mod.lesson_content.split(/\n---\n/)[currentSlideIndex] || "") : undefined}
            slideIndex={currentSlideIndex}
            totalSlides={mod.lesson_content.split(/\n---\n/).length}
            activeSection={activeContent}
          />
        )}
      </div>
    </>
  );
}
