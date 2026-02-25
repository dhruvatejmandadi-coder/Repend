import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ===============================
   🔒 ZOD SCHEMA VALIDATION
================================ */

const CourseSchema = z.object({
  title: z.string(),
  description: z.string(),
  modules: z.array(
    z.object({
      title: z.string(),
      lesson_content: z.string(),
      youtube_query: z.string().optional(),
      youtube_title: z.string().optional(),
      lab_type: z.enum(["simulation", "classification"]),
      lab_data: z.any(),
      quiz: z.array(
        z.object({
          question: z.string(),
          options: z.array(z.string()),
          correct: z.number(),
          explanation: z.string(),
        }),
      ),
    }),
  ),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Unauthorized");

    const { topic } = await req.json();
    if (!topic?.trim()) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Create course row
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content: `
You are an expert course architect specializing in creating comprehensive, progressive learning experiences.

CRITICAL REQUIREMENTS:

1. LESSON STRUCTURE:
   - Break each lesson into EXACTLY 4 concise slides
   - Separate slides with "\\n---\\n"
   - Write clearly for high school students
   - Build difficulty progressively across modules

2. INTERACTIVE LABS (choose one type per module):

   A. SIMULATION LAB (decision-based):
      - Include 3-5 adjustable parameters with realistic ranges (0-100)
      - Create 3-5 decision scenarios with meaningful choices
      - Each choice MUST use "set_state" (NOT "effects")
      - set_state maps ALL parameter names to exact values (0-100)
      - Provide clear thresholds for outcomes (success/failure/partial)
      - Ensure logical cause-and-effect relationships
      - Example structure:
        {
          "parameters": [
            {"name": "Understanding", "icon": "🧠", "unit": "%", "min": 0, "max": 100, "default": 50, "description": "Your grasp of concepts"},
            {"name": "Application", "icon": "🔧", "unit": "%", "min": 0, "max": 100, "default": 50, "description": "Ability to apply knowledge"}
          ],
          "decisions": [
            {
              "question": "How will you approach learning?",
              "emoji": "🎯",
              "choices": [
                {
                  "text": "Deep dive into theory first",
                  "explanation": "Build strong foundations",
                  "set_state": {"Understanding": 80, "Application": 40}
                },
                {
                  "text": "Jump into practice",
                  "explanation": "Learn by doing",
                  "set_state": {"Understanding": 45, "Application": 85}
                }
              ]
            }
          ],
          "thresholds": [
            {"label": "Expert", "min_percent": 80, "message": "Outstanding mastery!"},
            {"label": "Proficient", "min_percent": 60, "message": "Good understanding"},
            {"label": "Learning", "min_percent": 0, "message": "Keep practicing"}
          ]
        }

   B. CLASSIFICATION LAB:
      - Define 3-4 clear, distinct categories
      - Provide 8-12 items to classify
      - Include hints for challenging items
      - Ensure items have one correct category
      - Example structure:
        {
          "categories": [
            {"name": "Variables", "emoji": "📦", "description": "Store data values"},
            {"name": "Functions", "emoji": "⚙️", "description": "Reusable code blocks"}
          ],
          "items": [
            {"name": "let x = 5", "correct_category": "Variables", "hint": "Stores a number"},
            {"name": "function sum()", "correct_category": "Functions", "hint": "Performs a calculation"}
          ]
        }

3. QUIZ REQUIREMENTS:
   - 3-5 multiple choice questions per module
   - Test understanding, not memorization
   - Include explanations for correct answers
   - Avoid trick questions
   - Progressive difficulty within quiz

4. COURSE STRUCTURE:
   - Create as many modules as needed (typically 4-8)
   - Each module builds on previous knowledge
   - Start with foundations, end with advanced concepts
   - Include practical, scenario-driven examples

SIMULATION LAB REQUIREMENTS (CRITICAL):
- NEVER use "effects" - ONLY use "set_state"
- set_state must include ALL parameters
- Values must be integers 0-100
- Each choice should modify at least 2 parameters
- Changes should feel realistic and meaningful

Return clean, structured JSON via the function tool with NO extra commentary.
`,
          },
          {
            role: "user",
            content: `Create a structured course on "${topic}" with as many modules as necessary to fully teach the subject from foundational concepts to advanced understanding. Each module must include: (1) a lesson broken into exactly four concise slides separated by "\\n---\\n", written clearly for high school students, (2) one interactive lab that is either a decision-based simulation (with adjustable parameters, realistic scenarios, measurable outcomes, and logical cause-and-effect relationships) or a classification activity (with clear categories and accurate sortable examples), and (3) a short quiz with 3-5 multiple choice questions that test understanding rather than memorization. Lessons should build progressively in difficulty, labs must feel practical and scenario-driven, and all content must remain logically consistent and realistic.`
          },
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
    });

    const aiData = await response.json();

    if (!aiData.choices?.length) {
      throw new Error("Empty AI response");
    }

    const message = aiData.choices[0].message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No function call returned by AI");
    }

    // 🔥 PARSE RAW JSON
    const parsed = JSON.parse(toolCall.function.arguments);

    // 🔒 VALIDATE STRUCTURE (THIS IS THE NEW PART)
    const courseData = CourseSchema.parse(parsed);

    // If validation passes, continue safely
    await supabase
      .from("courses")
      .update({
        title: courseData.title,
        description: courseData.description,
        status: "ready",
      })
      .eq("id", course.id);

    /* ===============================
       🔥 POST PROCESSING (YOUR LOGIC)
    ================================= */

    const modules = courseData.modules.map((mod: any, index: number) => {
      let lessonContent = mod.lesson_content || "";

      // Force slide separators
      if (!lessonContent.includes("\n---\n")) {
        const sections = lessonContent.split(/(?=^## )/m).filter(Boolean);
        if (sections.length > 1) {
          lessonContent = sections.join("\n\n---\n\n");
        }
      }

      return {
        course_id: course.id,
        module_order: index + 1,
        title: mod.title,
        lesson_content: lessonContent,
        youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
          mod.youtube_query || mod.title,
        )}`,
        youtube_title: mod.youtube_title || mod.title,
        lab_type: mod.lab_type,
        lab_data: mod.lab_data,
        quiz: mod.quiz,
      };
    });

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
      { status: 500, headers: corsHeaders },
    );
  }
});
