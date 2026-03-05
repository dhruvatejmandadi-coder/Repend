import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      setIsAdmin(!!(data && data.length > 0));
      setLoading(false);
    };

    check();
  }, [user]);

  const inviteAdmin = async (email: string) => {
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email },
    });
    if (error) throw error;
    return data;
  };

  return { isAdmin, loading, inviteAdmin };
}
