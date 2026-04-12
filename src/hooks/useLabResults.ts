import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type DecisionEntry = {
  decision_id: number;
  choice_selected: number;
  previous_state: Record<string, number>;
  new_state: Record<string, number>;
  timestamp: number;
};

export function useLabResults() {
  const { user } = useAuth();

  const saveLabResult = useCallback(
    async ({
      labId,
      decisions,
      metrics,
      decisionStyle,
    }: {
      labId: string;
      decisions: DecisionEntry[];
      metrics: Record<string, any>;
      decisionStyle?: string;
    }) => {
      if (!user) return;

      await supabase.from("lab_results").insert({
        user_id: user.id,
        lab_id: labId,
        decisions: decisions as any,
        metrics: metrics as any,
        decision_style: decisionStyle ?? null,
        completed_at: new Date().toISOString(),
      });
    },
    [user]
  );

  return { saveLabResult };
}
