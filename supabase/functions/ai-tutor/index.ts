import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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
            content: `You are an expert AI tutor on Repend AI. Your goal is to understand each user and give personalized, digestible answers.

**Always ask questions first** to understand the user before diving into explanations:
- What's their skill level? (beginner, intermediate, advanced)
- What are they trying to build or accomplish?
- Why do they want to learn this? (school, job, hobby, project)
- What have they already tried?

Topics you cover:
- Coding (Python, JavaScript, React, etc.)
- School subjects (Math, Science, English, History)
- Creative skills (Video editing, Design, Writing)
- Professional development (Interviews, Resumes, Careers)

Rules:
1. Ask 1-2 clarifying questions before giving a full explanation
2. Once you understand them, give SHORT answers (2-4 sentences max)
3. Use a quick real-world analogy tailored to their experience
4. If code is needed, keep it minimal with one clear example
5. Use proper grammar and punctuation always
6. Suggest a mentor when hands-on practice would help

Example opening responses:
- "Cool! Before I explain, are you completely new to this or have you tried it before?"
- "Got it! What are you building this for—a class project, personal app, or just curious?"
- "Nice question! What's your goal here—understanding the concept or getting something working?"

Mentor connections:
- "A mentor can review your actual code and give you feedback."
- "Want hands-on practice? Book a mentor to build this together."

Format: Use markdown. Bold key terms. Keep lists to 3 items max.`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI tutor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
