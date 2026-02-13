import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { topic } = await req.json();
    if (!topic?.trim()) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Create course record
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({ user_id: user.id, title: topic.trim(), topic: topic.trim(), status: "generating" })
      .select()
      .single();

    if (courseError) throw courseError;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a course creator AI for Repend AI. Generate a structured course with 4-6 modules.

Return ONLY valid JSON with this exact structure:
{
  "title": "Course title",
  "description": "2-3 sentence course description",
  "modules": [
    {
      "title": "Module title",
      "lesson_content": "Detailed lesson in markdown (3-5 paragraphs with examples, code if relevant)",
      "youtube_query": "YouTube search query to find a relevant tutorial video",
      "youtube_title": "Suggested video title",
      "lab_type": "simulation OR decision OR classification",
      "lab_data": { ... structured lab object depending on lab_type ... },
      "quiz": [
        {
          "question": "Quiz question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct": 0
        }
      ]
    }
  ]
}

INTERACTIVE LAB TYPES - Choose the BEST type for each module's topic:

1. "simulation" - lab_data structure:
{
  "title": "Lab title",
  "description": "What students will learn",
  "equation_label": "The relationship being modeled",
  "equation_template": "X + Y -> Output",
  "output_label": "What the output represents",
  "parameters": [
    { "name": "Parameter Name", "icon": "emoji", "unit": "unit label", "min": 0, "max": 100, "default": 50, "description": "What this controls" }
  ],
  "thresholds": [
    { "label": "High Result", "min_percent": 80, "message": "Explanation of high output" },
    { "label": "Medium Result", "min_percent": 50, "message": "Explanation of medium output" },
    { "label": "Low Result", "min_percent": 0, "message": "Explanation of low output" }
  ]
}
Best for: economics, chemistry, physics, resource management, any topic with adjustable variables.

2. "decision" - lab_data structure:
{
  "title": "Lab title",
  "description": "Context for the decision scenarios",
  "scenarios": [
    {
      "title": "Scenario title",
      "description": "Detailed scenario description",
      "emoji": "relevant emoji",
      "choices": [
        { "text": "Choice description", "consequence": "What happens", "impact": "positive OR negative OR neutral" }
      ]
    }
  ],
  "summary_prompt": "Reflection prompt after all decisions"
}
Best for: history, ethics, social studies, business, any topic with moral/strategic dilemmas.

3. "classification" - lab_data structure:
{
  "title": "Lab title",
  "description": "Instructions for classification",
  "categories": [
    { "name": "Category Name", "emoji": "emoji", "description": "What belongs here" }
  ],
  "items": [
    { "name": "Item to classify", "correct_category": "Category Name", "hint": "Optional hint" }
  ]
}
Best for: biology (taxonomy), language (parts of speech), science (element types), any topic with categorization.

Each module MUST have a creative, educational interactive lab. Be creative with the parameters and scenarios!
Make the course progressive - start with basics, build to advanced.`
          },
          { role: "user", content: `Create a comprehensive course on: ${topic}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_course",
              description: "Create a structured learning course",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  modules: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        lesson_content: { type: "string" },
                        youtube_query: { type: "string" },
                        youtube_title: { type: "string" },
                        lab_type: { type: "string", enum: ["simulation", "decision", "classification"] },
                        lab_data: { type: "object" },
                        quiz: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              question: { type: "string" },
                              options: { type: "array", items: { type: "string" } },
                              correct: { type: "number" }
                            },
                            required: ["question", "options", "correct"]
                          }
                        }
                      },
                      required: ["title", "lesson_content", "youtube_query", "youtube_title", "lab_type", "lab_data", "quiz"]
                    }
                  }
                },
                required: ["title", "description", "modules"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_course" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      await supabase.from("courses").update({ status: "failed" }).eq("id", course.id);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI service temporarily unavailable");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      await supabase.from("courses").update({ status: "failed" }).eq("id", course.id);
      throw new Error("Failed to generate course structure");
    }

    const courseData = JSON.parse(toolCall.function.arguments);

    // Update course with generated title and description
    await supabase.from("courses").update({
      title: courseData.title,
      description: courseData.description,
      status: "ready"
    }).eq("id", course.id);

    // Insert modules
    const modules = courseData.modules.map((mod: any, index: number) => ({
      course_id: course.id,
      module_order: index + 1,
      title: mod.title,
      lesson_content: mod.lesson_content,
      youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.youtube_query)}`,
      youtube_title: mod.youtube_title,
      lab_title: mod.lab_data?.title || mod.title + " Lab",
      lab_description: null,
      lab_type: mod.lab_type,
      lab_data: mod.lab_data,
      quiz: mod.quiz,
    }));

    const { error: modulesError } = await supabase.from("course_modules").insert(modules);
    if (modulesError) {
      console.error("Modules insert error:", modulesError);
      await supabase.from("courses").update({ status: "failed" }).eq("id", course.id);
      throw modulesError;
    }

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate course error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
