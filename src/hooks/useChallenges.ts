import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  topic: string | null;
  difficulty: string | null;
  youtube_url: string | null;
  is_daily: boolean;
  expires_at: string | null;
  created_at: string;
  user_id: string | null;
  lab_type: string | null;
  lab_data: any;
  author_name?: string | null;
  author_avatar_url?: string | null;
  attempts_count?: number;
  completions_count?: number;
}

export interface Participation {
  challenge_id: string;
  completed_at: string | null;
  created_at: string;
}

export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchChallenges = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("challenges")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Enrich with author profiles
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

      // Fetch attempt/completion counts per challenge
      const challengeIds = data.map((c: any) => c.id);
      let countMap: Record<string, { attempts: number; completions: number }> = {};
      if (challengeIds.length > 0) {
        const { data: parts } = await supabase
          .from("challenge_participations")
          .select("challenge_id, completed_at")
          .in("challenge_id", challengeIds);
        if (parts) {
          for (const p of parts) {
            if (!countMap[p.challenge_id]) countMap[p.challenge_id] = { attempts: 0, completions: 0 };
            countMap[p.challenge_id].attempts++;
            if (p.completed_at) countMap[p.challenge_id].completions++;
          }
        }
      }

      setChallenges(data.map((c: any) => ({
        ...c,
        author_name: c.user_id ? profileMap[c.user_id]?.name || null : null,
        author_avatar_url: c.user_id ? profileMap[c.user_id]?.avatar || null : null,
        attempts_count: countMap[c.id]?.attempts ?? 0,
        completions_count: countMap[c.id]?.completions ?? 0,
      })) as Challenge[]);
    }

    if (user) {
      const { data: parts } = await supabase
        .from("challenge_participations")
        .select("challenge_id, completed_at, created_at")
        .eq("user_id", user.id);

      if (parts) {
        setParticipations(parts as Participation[]);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchChallenges();
  }, [user]);

  const joinChallenge = useCallback(async (challengeId: string) => {
    if (!user) return false;
    const already = participations.find(p => p.challenge_id === challengeId);
    if (already) return true;

    const { error } = await supabase.from("challenge_participations").insert({
      challenge_id: challengeId,
      user_id: user.id,
    });

    if (error) return false;

    setParticipations(prev => [...prev, {
      challenge_id: challengeId,
      completed_at: null,
      created_at: new Date().toISOString(),
    }]);
    return true;
  }, [user, participations]);

  const completeChallenge = useCallback(async (challengeId: string) => {
    if (!user) return false;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("challenge_participations")
      .update({ completed_at: now })
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id);

    if (error) return false;

    setParticipations(prev => prev.map(p =>
      p.challenge_id === challengeId ? { ...p, completed_at: now } : p
    ));

    // Award server-side points to solver
    await supabase.from("user_points").insert({
      user_id: user.id,
      amount: 50,
      reason: "challenge_solved",
      challenge_id: challengeId,
    }).then(() => {});

    // Award server-side points to creator
    const challenge = challenges.find(c => c.id === challengeId);
    if (challenge?.user_id && challenge.user_id !== user.id) {
      await supabase.from("user_points").insert({
        user_id: challenge.user_id,
        amount: 25,
        reason: "challenge_creator_reward",
        challenge_id: challengeId,
      }).then(() => {});
    }

    return true;
  }, [user, challenges]);

  const isJoined = useCallback((challengeId: string) => {
    return participations.some(p => p.challenge_id === challengeId);
  }, [participations]);

  const isCompleted = useCallback((challengeId: string) => {
    return participations.some(p => p.challenge_id === challengeId && p.completed_at !== null);
  }, [participations]);

  const getCompletedDate = useCallback((challengeId: string) => {
    const p = participations.find(p => p.challenge_id === challengeId && p.completed_at);
    return p?.completed_at ?? null;
  }, [participations]);

  const activeChallengeIds = participations.filter(p => !p.completed_at).map(p => p.challenge_id);
  const completedChallengeIds = participations.filter(p => p.completed_at).map(p => p.challenge_id);

  const dailyChallenge = challenges.find((c) => c.is_daily);
  const joinedOrCompletedIds = new Set([...activeChallengeIds, ...completedChallengeIds]);
  const myChallenges = challenges.filter((c) => c.user_id && c.user_id === user?.id && !joinedOrCompletedIds.has(c.id));
  const activeChallenges = challenges.filter((c) => activeChallengeIds.includes(c.id));
  const completedChallenges = challenges.filter((c) => completedChallengeIds.includes(c.id));
  // Feed: all challenges not created by the current user (newest first)
  const feedChallenges = challenges.filter((c) => !c.is_daily && (!user || c.user_id !== user.id));

  return {
    challenges,
    feedChallenges,
    dailyChallenge,
    myChallenges,
    activeChallenges,
    completedChallenges,
    activeChallengeIds,
    completedChallengeIds,
    participations,
    loading,
    refetch: fetchChallenges,
    joinChallenge,
    completeChallenge,
    isJoined,
    isCompleted,
    getCompletedDate,
  };
}
