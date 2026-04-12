import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Trophy, Flame, Calendar, GraduationCap } from "lucide-react";
import { format } from "date-fns";

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  created_at: string;
}

interface CourseData {
  id: string;
  title: string;
  topic: string;
  status: string;
  completed?: boolean;
}

interface ChallengeParticipation {
  challenge_id: string;
  completed_at: string | null;
  created_at: string;
  challenges: { title: string; difficulty: string | null } | null;
}

export function UserProfileModal({ open, onOpenChange, userId }: UserProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [challenges, setChallenges] = useState<ChallengeParticipation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    const fetchAll = async () => {
      const [profileRes, coursesRes, challengesRes, progressRes] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, bio, role, created_at").eq("user_id", userId).single(),
        supabase.from("courses").select("id, title, topic, status").eq("user_id", userId).eq("status", "ready").order("created_at", { ascending: false }).limit(20),
        supabase.from("challenge_participations").select("challenge_id, completed_at, created_at, challenges(title, difficulty)").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("course_progress").select("course_id, completed").eq("user_id", userId).eq("completed", true),
      ]);

      const completedCourseIds = new Set(((progressRes.data as any) || []).map((p: any) => p.course_id));
      const coursesWithStatus = ((coursesRes.data as any) || []).map((c: any) => ({
        ...c,
        completed: completedCourseIds.has(c.id),
      }));

      setProfile(profileRes.data as any);
      setCourses(coursesWithStatus);
      setChallenges((challengesRes.data as any) || []);
      setLoading(false);
    };

    fetchAll();
  }, [open, userId]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), "MMMM yyyy")
    : "";

  const completedChallenges = challenges.filter((c) => c.completed_at);
  const completedCourses = courses.filter((c) => c.completed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-0">
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        ) : profile ? (
          <>
            {/* Header / Cover */}
            <div className="relative">
              <div className="h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 rounded-t-lg" />
              <div className="absolute -bottom-10 left-6">
                <Avatar className="w-20 h-20 border-4 border-background shadow-lg">
                  <AvatarImage src={profile.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {profile.full_name ? getInitials(profile.full_name) : "?"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div className="px-6 pt-12 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl font-bold">{profile.full_name || "Anonymous"}</h2>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {profile.role}
                </Badge>
              </div>
              {profile.bio && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{profile.bio}</p>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Calendar className="w-3 h-3" />
                Member since {memberSince}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 px-6 pb-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <BookOpen className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{courses.length}</p>
                <p className="text-[10px] text-muted-foreground">Courses</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <GraduationCap className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{completedCourses.length}</p>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <Trophy className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{completedChallenges.length}</p>
                <p className="text-[10px] text-muted-foreground">Challenges</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pb-6">
              <Tabs defaultValue="courses">
                <TabsList className="w-full">
                  <TabsTrigger value="courses" className="flex-1 text-xs">Courses</TabsTrigger>
                  <TabsTrigger value="completed" className="flex-1 text-xs">Completed</TabsTrigger>
                  <TabsTrigger value="challenges" className="flex-1 text-xs">Challenges</TabsTrigger>
                </TabsList>

                <TabsContent value="courses" className="mt-3 space-y-2">
                  {courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No courses yet</p>
                  ) : (
                    courses.map((c) => (
                      <Card key={c.id} className="bg-muted/30">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <BookOpen className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{c.title}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{c.topic}</p>
                            </div>
                          </div>
                          {c.completed && (
                            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary shrink-0">
                              ✓ Done
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="completed" className="mt-3 space-y-2">
                  {completedCourses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No completed courses yet</p>
                  ) : (
                    completedCourses.map((c) => (
                      <Card key={c.id} className="bg-muted/30">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.title}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{c.topic}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="challenges" className="mt-3 space-y-2">
                  {challenges.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No challenges yet</p>
                  ) : (
                    challenges.map((c) => (
                      <Card key={c.challenge_id} className="bg-muted/30">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                              <Trophy className="w-4 h-4 text-orange-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{c.challenges?.title || "Challenge"}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{c.challenges?.difficulty || "medium"}</p>
                            </div>
                          </div>
                          {c.completed_at ? (
                            <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600 shrink-0">
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] shrink-0">Active</Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          <div className="p-6 text-center text-muted-foreground">Profile not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
