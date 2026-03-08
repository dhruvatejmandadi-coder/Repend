import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePoints } from "@/hooks/usePoints";
import { useToast } from "@/hooks/use-toast";

// Section completion tracked per module: { [moduleId]: { lesson: bool, lab: bool, quiz: bool } }
export type SectionStatus = { lesson: boolean; lab: boolean; quiz: boolean };

export interface CourseProgressData {
  id?: string;
  completedLessons: string[]; // module IDs fully completed (all 3 sections)
  sectionStatus: Record<string, SectionStatus>;
  completed: boolean;
  completedAt: string | null;
}

export function useCourseProgress(courseId: string | undefined) {
  const { user } = useAuth();
  const { addPoints, POINTS_VALUES } = usePoints();
  const { toast } = useToast();
  const [progress, setProgress] = useState<CourseProgressData>({
    completedLessons: [],
    sectionStatus: {},
    completed: false,
    completedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [justCompleted, setJustCompleted] = useState(false);

  // Fetch progress from DB
  useEffect(() => {
    if (!user || !courseId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("course_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (data) {
        const completedLessons = Array.isArray(data.completed_lessons) ? data.completed_lessons as string[] : [];
        // Try to parse section status from completed_lessons JSON structure
        // We store section status in a special key within the JSON
        let sectionStatus: Record<string, SectionStatus> = {};
        const raw = data.completed_lessons as any;
        if (raw && typeof raw === "object" && !Array.isArray(raw) && raw._sections) {
          sectionStatus = raw._sections;
          // completedLessons are the keys where all 3 are true
          const moduleIds = Object.keys(sectionStatus).filter(
            (id) => sectionStatus[id]?.lesson && sectionStatus[id]?.lab && sectionStatus[id]?.quiz
          );
          setProgress({
            id: data.id,
            completedLessons: moduleIds,
            sectionStatus,
            completed: data.completed ?? false,
            completedAt: data.completed_at,
          });
        } else {
          // Legacy: array of module IDs
          const sections: Record<string, SectionStatus> = {};
          for (const id of completedLessons) {
            sections[id] = { lesson: true, lab: true, quiz: true };
          }
          setProgress({
            id: data.id,
            completedLessons,
            sectionStatus: sections,
            completed: data.completed ?? false,
            completedAt: data.completed_at,
          });
        }
      }
      setLoading(false);
    })();
  }, [user, courseId]);

  // Persist to DB
  const persistProgress = useCallback(
    async (newProgress: CourseProgressData) => {
      if (!user || !courseId) return;
      try {
        // Store section status + completed module IDs together
        const payload = {
          _sections: newProgress.sectionStatus,
        };

        if (newProgress.id) {
          await supabase
            .from("course_progress")
            .update({
              completed_lessons: payload as any,
              completed: newProgress.completed,
              completed_at: newProgress.completedAt,
            })
            .eq("id", newProgress.id);
        } else {
          const { data } = await supabase
            .from("course_progress")
            .insert({
              user_id: user.id,
              course_id: courseId,
              completed_lessons: payload as any,
              completed: newProgress.completed,
              completed_at: newProgress.completedAt,
            })
            .select("id")
            .single();
          if (data) {
            setProgress((p) => ({ ...p, id: data.id }));
          }
        }
      } catch (err) {
        console.error("Failed to save progress:", err);
      }
    },
    [user, courseId]
  );

  // Complete a specific section of a module
  const completeSection = useCallback(
    async (moduleId: string, section: keyof SectionStatus, totalModules: number) => {
      if (!user || !courseId) return;

      setProgress((prev) => {
        const currentStatus = prev.sectionStatus[moduleId] || { lesson: false, lab: false, quiz: false };
        const newStatus = { ...currentStatus, [section]: true };
        const newSections = { ...prev.sectionStatus, [moduleId]: newStatus };

        // Module is complete when all 3 sections are done
        const moduleComplete = newStatus.lesson && newStatus.lab && newStatus.quiz;
        const wasAlreadyComplete = prev.completedLessons.includes(moduleId);

        let newCompletedLessons = prev.completedLessons;
        if (moduleComplete && !wasAlreadyComplete) {
          newCompletedLessons = [...prev.completedLessons, moduleId];
        }

        const allDone = newCompletedLessons.length >= totalModules;

        const updated: CourseProgressData = {
          ...prev,
          sectionStatus: newSections,
          completedLessons: newCompletedLessons,
          completed: allDone,
          completedAt: allDone ? new Date().toISOString() : prev.completedAt,
        };

        // Persist async
        persistProgress(updated);

        // Handle course completion
        if (allDone && !prev.completed) {
          (async () => {
            addPoints(POINTS_VALUES.COURSE_COMPLETION, "course_completion");

            const { data: badge } = await supabase
              .from("badges")
              .insert({
                name: "Course Graduate",
                description: "Completed an entire course",
                icon: "graduation-cap",
                course_id: courseId,
              })
              .select("id")
              .single();

            if (badge) {
              await supabase.from("user_badges").insert({
                user_id: user.id,
                badge_id: badge.id,
              });
            }

            const certId = `REPEND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            await supabase.from("certificates").insert({
              user_id: user.id,
              course_id: courseId,
              certificate_id: certId,
            });

            setJustCompleted(true);
          })();
        }

        return updated;
      });
    },
    [user, courseId, persistProgress, addPoints, POINTS_VALUES]
  );

  // Uncomplete a section (e.g., quiz retry)
  const uncompleteSection = useCallback(
    (moduleId: string, section: keyof SectionStatus) => {
      setProgress((prev) => {
        const currentStatus = prev.sectionStatus[moduleId] || { lesson: false, lab: false, quiz: false };
        const newStatus = { ...currentStatus, [section]: false };
        const newSections = { ...prev.sectionStatus, [moduleId]: newStatus };

        const newCompletedLessons = prev.completedLessons.filter((id) => id !== moduleId);

        const updated: CourseProgressData = {
          ...prev,
          sectionStatus: newSections,
          completedLessons: newCompletedLessons,
        };

        persistProgress(updated);
        return updated;
      });
    },
    [persistProgress]
  );

  // Legacy toggle (kept for backward compat but not used anymore)
  const toggleLesson = useCallback(
    async (moduleId: string, totalModules: number) => {
      const isComplete = progress.completedLessons.includes(moduleId);
      if (isComplete) {
        uncompleteSection(moduleId, "lesson");
        uncompleteSection(moduleId, "lab");
        uncompleteSection(moduleId, "quiz");
      } else {
        await completeSection(moduleId, "lesson", totalModules);
        await completeSection(moduleId, "lab", totalModules);
        await completeSection(moduleId, "quiz", totalModules);
      }
    },
    [progress.completedLessons, completeSection, uncompleteSection]
  );

  const dismissCompletion = useCallback(() => setJustCompleted(false), []);

  return {
    progress,
    loading,
    toggleLesson,
    completeSection,
    uncompleteSection,
    justCompleted,
    dismissCompletion,
  };
}
