import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ===============================
   🔒 SCHEMAS (TOLERANT)
================================ */

const ModuleSchema = z.object({
  title: z.string(),
  lesson_content: z.string(),
  youtube_query: z.string().optional(),
  youtube_title: z.string().optional(),
  lab_type: z.enum(["simulation", "classification", "sorting", "math"]),
  lab_data: z.any(),
  quiz: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correct: z.number(),
      explanation: z.string(),
    })
  ),
});

const CourseSchema = z.object({
  title: z.string(),
  description: z.string(),
  modules: z.array(ModuleSchema).min(1),
});

/* ===============================
   🚀 EDGE FUNCTION
================================ */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Unauthorized");

    const { topic } = await req.json();
    if (!topic?.trim()) throw new Error("Topic required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing API key");

    const { data: course } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        title: topic.trim(),
        topic: topic.trim(),
        status: "generating",
      })
      .select()
      .single();

    /* ===============================
       🤖 AI CALL
    ================================= */

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: `
Return structured JSON only.

4 modules.
Each module must have:
- lesson_content (4 slides separated by "\\n---\\n")
- lab_type
- lab_data
- quiz

Lab types allowed:
"simulation", "classification", "sorting", "math"

Use "math" for equations/graphs.
Use "simulation" for decision-based learning.
Use "sorting" only for ordering steps.
Use "classification" for grouping concepts.

Never return empty lab_data.
`,
            },
            { role: "user", content: `Create a course on: ${topic}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_course",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    modules: { type: "array" },
                  },
                  required: ["title", "description", "modules"],
                },
              },
            },
          ],
          tool_choice: "auto",
        }),
      }
    );

    const aiData = await response.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI failed");

    const parsed = JSON.parse(toolCall.function.arguments);
    const courseData = CourseSchema.parse(parsed);

    /* ===============================
       💾 SAVE COURSE
    ================================= */

    await supabase
      .from("courses")
      .update({
        title: courseData.title,
        description: courseData.description,
        status: "ready",
      })
      .eq("id", course.id);

    const modules = courseData.modules.map((mod, index) => ({
      course_id: course.id,
      module_order: index + 1,
      title: mod.title,
      lesson_content: mod.lesson_content,
      youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        mod.youtube_query || mod.title
      )}`,
      youtube_title: mod.youtube_title || mod.title,
      lab_type: mod.lab_type,
      lab_data: mod.lab_data,
      quiz: mod.quiz,
    }));

    await supabase.from("course_modules").insert(modules);

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("COURSE GENERATION ERROR:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
});
