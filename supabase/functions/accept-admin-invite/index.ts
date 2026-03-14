import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// This function is called on signup to check if the new user has a pending admin invite
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user?.email) {
      return new Response(JSON.stringify({ accepted: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for pending invite
    const { data: invite } = await supabaseAdmin
      .from("admin_invites")
      .select("id")
      .eq("email", user.email)
      .eq("accepted", false)
      .maybeSingle();

    if (!invite) {
      return new Response(JSON.stringify({ accepted: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grant admin role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: user.id, role: "admin" },
      { onConflict: "user_id,role" }
    );
    await supabaseAdmin
      .from("admin_invites")
      .update({ accepted: true })
      .eq("id", invite.id);

    return new Response(JSON.stringify({ accepted: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
