import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  youtube_url: string | null;
  is_daily: boolean;
  expires_at: string | null;
  created_at: string;
}

export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("challenges")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setChallenges(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const dailyChallenge = challenges.find((c) => c.is_daily);
  const regularChallenges = challenges.filter((c) => !c.is_daily);

  return { challenges, dailyChallenge, regularChallenges, loading, refetch: fetchChallenges };
}
