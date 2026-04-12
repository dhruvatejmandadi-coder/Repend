import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Cache admin status to prevent flicker on route changes
let cachedAdminStatus: { userId: string; isAdmin: boolean } | null = null;

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(() => {
    if (user && cachedAdminStatus?.userId === user.id) return cachedAdminStatus.isAdmin;
    return false;
  });
  const [loading, setLoading] = useState(() => {
    if (user && cachedAdminStatus?.userId === user.id) return false;
    return true;
  });

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      cachedAdminStatus = null;
      return;
    }

    // If we already have a cached result for this user, skip the query
    if (cachedAdminStatus?.userId === user.id) {
      setIsAdmin(cachedAdminStatus.isAdmin);
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      const admin = !!(data && data.length > 0);
      cachedAdminStatus = { userId: user.id, isAdmin: admin };
      setIsAdmin(admin);
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
