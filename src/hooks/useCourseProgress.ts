import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePoints } from "@/hooks/usePoints";
import { useToast } from "@/hooks/use-toast";

export interface CourseProgressData {
  id?: string;
  completedLessons: string[];
  completed: boolean;
  completedAt: string | null;
}

export function useCourseProgress(courseId: string | undefined) {
  const { user } = useAuth();
  const { addPoints, POINTS_VALUES } = usePoints();
  const { toast } = useToast();
  const [progress, setProgress] = useState<CourseProgressData>({
    completedLessons: [],
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
        setProgress({
          id: data.id,
          completedLessons: Array.isArray(data.completed_lessons) ? data.completed_lessons as string[] : [],
          completed: data.completed ?? false,
          completedAt: data.completed_at,
        });
      }
      setLoading(false);
    })();
  }, [user, courseId]);

  // Toggle a lesson as complete/incomplete
  const toggleLesson = useCallback(
    async (moduleId: string, totalModules: number) => {
      if (!user || !courseId) return;

      setProgress((prev) => {
        const alreadyDone = prev.completedLessons.includes(moduleId);
        const newLessons = alreadyDone
          ? prev.completedLessons.filter((id) => id !== moduleId)
          : [...prev.completedLessons, moduleId];

        const allDone = !alreadyDone && newLessons.length >= totalModules;

        // Persist async
        (async () => {
          try {
            const upsertData: any = {
              user_id: user.id,
              course_id: courseId,
              completed_lessons: newLessons,
              completed: allDone,
              completed_at: allDone ? new Date().toISOString() : null,
            };

            if (prev.id) {
              await supabase
                .from("course_progress")
                .update({
                  completed_lessons: newLessons,
                  completed: allDone,
                  completed_at: allDone ? new Date().toISOString() : null,
                })
                .eq("id", prev.id);
            } else {
              const { data } = await supabase
                .from("course_progress")
                .insert(upsertData)
                .select("id")
                .single();
              if (data) {
                setProgress((p) => ({ ...p, id: data.id }));
              }
            }

            if (allDone) {
              // Award points
              addPoints(POINTS_VALUES.COURSE_COMPLETION, "course_completion");

              // Create badge for this course
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

              // Generate certificate
              const certId = `REPEND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
              await supabase.from("certificates").insert({
                user_id: user.id,
                course_id: courseId,
                certificate_id: certId,
              });

              setJustCompleted(true);
            }
          } catch (err) {
            console.error("Failed to save progress:", err);
          }
        })();

        return {
          ...prev,
          completedLessons: newLessons,
          completed: !alreadyDone && newLessons.length >= totalModules,
          completedAt:
            !alreadyDone && newLessons.length >= totalModules
              ? new Date().toISOString()
              : prev.completedAt,
        };
      });
    },
    [user, courseId, addPoints, POINTS_VALUES]
  );

  const dismissCompletion = useCallback(() => setJustCompleted(false), []);

  return {
    progress,
    loading,
    toggleLesson,
    justCompleted,
    dismissCompletion,
  };
}
