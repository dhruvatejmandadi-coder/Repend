import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, Globe, ArrowRight, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  created_at: string;
  user_id: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
};

export default function PublicCourses() {
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchPublicCourses();
  }, []);

  const fetchPublicCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, description, topic, created_at, user_id")
      .eq("is_public", true)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      // Fetch creator profiles
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      const enriched = data.map((c) => ({
        ...c,
        profiles: profileMap.get(c.user_id) || null,
      }));
      setCourses(enriched);
    }
    setLoading(false);
  };

  const filtered = search.trim()
    ? courses.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.topic.toLowerCase().includes(search.toLowerCase()) ||
          c.description?.toLowerCase().includes(search.toLowerCase())
      )
    : courses;

  return (
    <div className="page-container space-y-8">
      <div className="max-w-2xl mx-auto text-center pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/[0.08] border border-green-500/15 mb-6">
          <Globe className="w-3.5 h-3.5 text-green-500" />
          <span className="text-[13px] font-medium text-green-600 dark:text-green-400">Community Courses</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
          Explore <span className="gradient-text">Public Courses</span>
        </h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
          Browse courses created by the community. Learn from others' expertise.
        </p>
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => (
            <Card
              key={course.id}
              className="bg-card/80 border-border/50 hover:border-primary/20 transition-all cursor-pointer group hover:-translate-y-0.5"
              onClick={() => navigate(`/courses/${course.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-green-500" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{course.topic}</Badge>
                </div>
                <h3 className="font-display font-semibold text-[15px] mb-1 line-clamp-2">{course.title}</h3>
                <p className="text-[13px] text-muted-foreground line-clamp-2 mb-3">
                  {course.description || "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>Published by {course.profiles?.full_name || "Anonymous"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">
            {search ? "No courses match your search" : "No public courses yet. Be the first to create one!"}
          </p>
        </div>
      )}
    </div>
  );
}
