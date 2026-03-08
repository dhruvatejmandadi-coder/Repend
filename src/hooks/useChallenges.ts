import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  youtube_url: string | null;
  is_daily: boolean;
  expires_at: string | null;
  created_at: string;
  user_id: string | null;
  lab_type: string | null;
  lab_data: any;
  author_name?: string | null;
  author_avatar_url?: string | null;
}

export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeChallengeIds, setActiveChallengeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchChallenges = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("challenges")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch author profiles
      const userIds = [...new Set(data.map((c: any) => c.user_id).filter(Boolean))] as string[];
      let profileMap: Record<string, { name: string | null; avatar: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = { name: p.full_name, avatar: p.avatar_url };
          }
        }
      }

      setChallenges(data.map((c: any) => ({
        ...c,
        author_name: c.user_id ? profileMap[c.user_id]?.name || null : null,
        author_avatar_url: c.user_id ? profileMap[c.user_id]?.avatar || null : null,
      })) as Challenge[]);
    }

    // Fetch participations for current user
    if (user) {
      const { data: participations } = await supabase
        .from("challenge_participations")
        .select("challenge_id")
        .eq("user_id", user.id);

      if (participations) {
        setActiveChallengeIds(participations.map((p) => p.challenge_id));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchChallenges();
  }, [user]);

  const dailyChallenge = challenges.find((c) => c.is_daily);
  const myChallenges = challenges.filter((c) => c.user_id && c.user_id === user?.id);
  const activeChallenges = challenges.filter((c) => activeChallengeIds.includes(c.id));

  return { challenges, dailyChallenge, myChallenges, activeChallenges, activeChallengeIds, loading, refetch: fetchChallenges };
}
