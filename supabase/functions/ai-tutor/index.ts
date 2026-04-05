import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, moduleTitle, courseTitle, currentSlideContent, slideIndex, totalSlides, activeSection } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // Build context-aware system prompt
    let contextBlock = "";
    if (currentSlideContent) {
      contextBlock = `\n\n## Current Slide (${slideIndex + 1}/${totalSlides})
\`\`\`
${currentSlideContent.slice(0, 1500)}
\`\`\``;
    }
    if (activeSection) {
      contextBlock += `\nThe student is in the ${activeSection} section.`;
    }

    const systemPrompt = `You are an expert AI tutor on the Repend learning platform.
You are helping a student with "${moduleTitle}" in the course "${courseTitle}".
${contextBlock}

## Response Rules

**Structure every response like this:**

### 📍 About This Slide
- Explain the current slide content first (2-3 bullet points max)
- Connect it to the bigger picture

### 💡 Your Question
- Answer the student's specific question
- Use bullet points and short sentences
- Include ONE clear example if helpful

## Formatting Rules
- Use **bold** for key terms
- Use bullet points, never long paragraphs
- Keep each section to 2-4 bullet points max
- Use emoji headers for visual separation
- If the question IS about the current slide, combine both sections into one
- Never give quiz/test answers directly — guide the student to think
- Stay on topic for this module`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
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
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-tutor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
