import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";

export type Plan = "starter" | "pro" | "elite";

export const PLAN_CONFIG = {
  pro: {
    price_id: "price_1T8uAkLHmfykQi0ZFinMH5Nq",
    product_id: "prod_U78RPaFsIiqpqq",
    name: "Pro",
    price: 5.99,
    coursesPerMonth: 10,
    fileUploadsPerMonth: 3,
  },
  elite: {
    price_id: "price_1T8vj4LHmfykQi0ZxUZWwUPf",
    product_id: "prod_U7A3vZ4alWsTvD",
    name: "Elite",
    price: 9.99,
    coursesPerMonth: 15,
    fileUploadsPerMonth: Infinity,
  },
} as const;

export const STARTER_LIMITS = {
  coursesPerMonth: 2,
  fileUploadsPerMonth: 0,
} as const;

interface SubscriptionState {
  plan: Plan;
  subscribed: boolean;
  subscriptionEnd: string | null;
  loading: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [state, setState] = useState<SubscriptionState>({
    plan: "starter",
    subscribed: false,
    subscriptionEnd: null,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({ plan: "starter", subscribed: false, subscriptionEnd: null, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      let plan: Plan = "starter";
      if (data.subscribed && data.product_id) {
        if (data.product_id === PLAN_CONFIG.pro.product_id) plan = "pro";
        else if (data.product_id === PLAN_CONFIG.elite.product_id) plan = "elite";
        // Legacy elite product ID support
        else if (data.product_id === "prod_U78StcFe4wAWI5") plan = "elite";
        else plan = "pro";
      }

      setState({
        plan,
        subscribed: data.subscribed ?? false,
        subscriptionEnd: data.subscription_end ?? null,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to check subscription:", err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const isProOrAbove = isAdmin || state.plan === "pro" || state.plan === "elite";
  const isElite = isAdmin || state.plan === "elite";

  const getCoursesLimit = () => {
    if (isAdmin || state.plan === "elite") return PLAN_CONFIG.elite.coursesPerMonth;
    if (state.plan === "pro") return PLAN_CONFIG.pro.coursesPerMonth;
    return STARTER_LIMITS.coursesPerMonth;
  };

  const getFileUploadsLimit = () => {
    if (isAdmin || state.plan === "elite") return PLAN_CONFIG.elite.fileUploadsPerMonth;
    if (state.plan === "pro") return PLAN_CONFIG.pro.fileUploadsPerMonth;
    return STARTER_LIMITS.fileUploadsPerMonth;
  };

  const startCheckout = async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) window.open(data.url, "_blank");
  };

  const openPortal = async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) throw error;
    if (data?.url) window.open(data.url, "_blank");
  };

  return {
    ...state,
    isProOrAbove,
    isElite,
    getCoursesLimit,
    getFileUploadsLimit,
    startCheckout,
    openPortal,
    refresh: checkSubscription,
  };
}
