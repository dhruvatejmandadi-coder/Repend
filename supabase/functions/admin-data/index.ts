import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, data } = await req.json();

    // Handle different admin actions
    switch (action) {
      case "get_users": {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
        const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
        const { data: userRoles } = await supabaseAdmin.from("user_roles").select("*");
        
        const users = (authUsers?.users || []).map((u: any) => {
          const profile = profiles?.find((p: any) => p.user_id === u.id);
          const role = userRoles?.find((r: any) => r.user_id === u.id);
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            full_name: profile?.full_name || "",
            avatar_url: profile?.avatar_url || "",
            role: role?.role || "user",
          };
        });

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_surveys": {
        const { data: surveys } = await supabaseAdmin
          .from("user_surveys")
          .select("*")
          .order("created_at", { ascending: false });

        // Get emails for user_ids
        const userIds = [...new Set((surveys || []).map((s: any) => s.user_id).filter(Boolean))];
        let emailMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
          for (const u of authUsers?.users || []) {
            if (userIds.includes(u.id)) {
              emailMap[u.id] = u.email || "";
            }
          }
        }

        const enriched = (surveys || []).map((s: any) => ({
          ...s,
          email: s.user_id ? emailMap[s.user_id] || "Unknown" : "Guest",
        }));

        return new Response(JSON.stringify({ surveys: enriched }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_sales": {
        const { data: subscriptions } = await supabaseAdmin
          .from("subscriptions")
          .select("*")
          .order("created_at", { ascending: false });

        // Get emails
        const userIds = [...new Set((subscriptions || []).map((s: any) => s.user_id))];
        let emailMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
          for (const u of authUsers?.users || []) {
            if (userIds.includes(u.id)) {
              emailMap[u.id] = u.email || "";
            }
          }
        }

        const enriched = (subscriptions || []).map((s: any) => ({
          ...s,
          email: emailMap[s.user_id] || "Unknown",
        }));

        return new Response(JSON.stringify({ sales: enriched }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_challenges": {
        const { data: challenges } = await supabaseAdmin
          .from("challenges")
          .select("*")
          .order("created_at", { ascending: false });

        return new Response(JSON.stringify({ challenges: challenges || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_challenge": {
        const { data: challenge, error } = await supabaseAdmin
          .from("challenges")
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ challenge }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_challenge": {
        const { id, ...updateData } = data;
        const { data: challenge, error } = await supabaseAdmin
          .from("challenges")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ challenge }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_challenge": {
        const { error } = await supabaseAdmin
          .from("challenges")
          .delete()
          .eq("id", data.id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
