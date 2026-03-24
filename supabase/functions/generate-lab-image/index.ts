import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { prompt, context, moduleId } = await req.json();
    if (!prompt) throw new Error("prompt is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Generate image using Gemini image model
    const imagePrompt = `Educational diagram for a learning lab: ${prompt}${context ? `. Context: ${context}` : ""}. Style: clean, scientific, labeled, educational illustration on white background. No text watermarks.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const text = await response.text();
      console.error("Image generation error:", response.status, text);
      throw new Error("Image generation failed");
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const caption = data.choices?.[0]?.message?.content || "";

    if (!imageUrl) {
      throw new Error("No image returned from AI");
    }

    // If moduleId provided, upload to storage for persistence
    let storedUrl = imageUrl;
    if (moduleId) {
      try {
        // Extract base64 data
        const base64Match = imageUrl.match(/^data:image\/(\w+);base64,(.+)/);
        if (base64Match) {
          const ext = base64Match[1];
          const base64Data = base64Match[2];
          const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const fileName = `lab-visuals/${moduleId}/${crypto.randomUUID()}.${ext}`;

          const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          const { error: uploadError } = await serviceClient.storage
            .from("course-uploads")
            .upload(fileName, bytes, { contentType: `image/${ext}`, upsert: true });

          if (!uploadError) {
            const { data: urlData } = serviceClient.storage
              .from("course-uploads")
              .getPublicUrl(fileName);
            storedUrl = urlData.publicUrl;
          }
        }
      } catch (e) {
        console.warn("Storage upload failed, using base64:", e);
      }
    }

    return new Response(JSON.stringify({ imageUrl: storedUrl, caption }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("LAB IMAGE ERROR:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
