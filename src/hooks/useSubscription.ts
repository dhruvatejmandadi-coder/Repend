import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type Plan = "starter" | "pro" | "elite";

// TODO: Replace these with real Stripe price IDs after creating products in Stripe dashboard
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
    price_id: "price_ELITE_PLACEHOLDER",
    product_id: "prod_ELITE_PLACEHOLDER",
    name: "Elite",
    price: 11.99,
    coursesPerMonth: Infinity,
    fileUploadsPerMonth: Infinity,
  },
} as const;

interface SubscriptionState {
  plan: Plan;
  subscribed: boolean;
  subscriptionEnd: string | null;
  loading: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
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
        else plan = "pro"; // fallback for any active subscription
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

  const isProOrAbove = state.plan === "pro" || state.plan === "elite";
  const isElite = state.plan === "elite";

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
    startCheckout,
    openPortal,
    refresh: checkSubscription,
  };
}
