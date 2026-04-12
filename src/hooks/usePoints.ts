import { useState, useEffect, useCallback } from "react";

export interface PointsData {
  totalPoints: number;
  streak: number;
  lastActiveDate: string | null;
  completedChallenges: string[];
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

const POINTS_KEY = "repend_points";
const POINTS_VALUES = {
  COMPLETE_CHALLENGE: 50,
  DAILY_CHALLENGE: 100,
  COMMUNITY_POST: 25,
  AI_TUTOR_SESSION: 15,
  STREAK_BONUS: 20,
  
  COURSE_COMPLETION: 150,
};

const ACHIEVEMENTS_CONFIG = [
  { id: "first_challenge", name: "First Steps", description: "Complete your first challenge", icon: "🏆", threshold: 1, type: "challenges" },
  { id: "five_challenges", name: "On a Roll", description: "Complete 5 challenges", icon: "🔥", threshold: 5, type: "challenges" },
  { id: "hundred_points", name: "Century", description: "Earn 100 points", icon: "💯", threshold: 100, type: "points" },
  { id: "five_hundred_points", name: "High Scorer", description: "Earn 500 points", icon: "⭐", threshold: 500, type: "points" },
  { id: "three_day_streak", name: "Consistent", description: "3-day streak", icon: "📅", threshold: 3, type: "streak" },
  { id: "seven_day_streak", name: "Dedicated", description: "7-day streak", icon: "🌟", threshold: 7, type: "streak" },
];

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function loadPoints(): PointsData {
  try {
    const stored = localStorage.getItem(POINTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {
    totalPoints: 0,
    streak: 0,
    lastActiveDate: null,
    completedChallenges: [],
    achievements: [],
  };
}

function savePoints(data: PointsData) {
  try {
    localStorage.setItem(POINTS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function usePoints() {
  const [data, setData] = useState<PointsData>(loadPoints);

  useEffect(() => {
    savePoints(data);
  }, [data]);

  const updateStreak = useCallback(() => {
    setData((prev) => {
      const today = getToday();
      if (prev.lastActiveDate === today) return prev;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      let newStreak = prev.lastActiveDate === yesterdayStr ? prev.streak + 1 : 1;
      const streakBonus = newStreak > 1 ? POINTS_VALUES.STREAK_BONUS : 0;

      const updated = {
        ...prev,
        streak: newStreak,
        lastActiveDate: today,
        totalPoints: prev.totalPoints + streakBonus,
      };
      return checkAchievements(updated);
    });
  }, []);

  const addPoints = useCallback((amount: number, reason: string) => {
    setData((prev) => {
      const updated = {
        ...prev,
        totalPoints: prev.totalPoints + amount,
        lastActiveDate: getToday(),
      };
      return checkAchievements(updated);
    });
  }, []);

  const completeChallenge = useCallback((challengeId: string, isDaily: boolean) => {
    setData((prev) => {
      if (prev.completedChallenges.includes(challengeId)) return prev;

      const points = isDaily ? POINTS_VALUES.DAILY_CHALLENGE : POINTS_VALUES.COMPLETE_CHALLENGE;
      const updated = {
        ...prev,
        totalPoints: prev.totalPoints + points,
        completedChallenges: [...prev.completedChallenges, challengeId],
        lastActiveDate: getToday(),
      };
      return checkAchievements(updated);
    });
  }, []);

  const addCommunityPoints = useCallback(() => {
    addPoints(POINTS_VALUES.COMMUNITY_POST, "community_post");
  }, [addPoints]);

  const addTutorPoints = useCallback(() => {
    addPoints(POINTS_VALUES.AI_TUTOR_SESSION, "ai_tutor");
  }, [addPoints]);

  return {
    ...data,
    updateStreak,
    addPoints,
    completeChallenge,
    addCommunityPoints,
    addTutorPoints,
    POINTS_VALUES,
  };
}

function checkAchievements(data: PointsData): PointsData {
  const newAchievements = [...data.achievements];
  let changed = false;

  for (const config of ACHIEVEMENTS_CONFIG) {
    if (newAchievements.some((a) => a.id === config.id)) continue;

    let unlocked = false;
    if (config.type === "challenges" && data.completedChallenges.length >= config.threshold) unlocked = true;
    if (config.type === "points" && data.totalPoints >= config.threshold) unlocked = true;
    if (config.type === "streak" && data.streak >= config.threshold) unlocked = true;

    if (unlocked) {
      newAchievements.push({
        id: config.id,
        name: config.name,
        description: config.description,
        icon: config.icon,
        unlockedAt: new Date().toISOString(),
      });
      changed = true;
    }
  }

  return changed ? { ...data, achievements: newAchievements } : data;
}
