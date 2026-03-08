import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { scenario, constraints, decision_prompt, student_response, twist, twist_response, reflection_response } = await req.json();

    if (!scenario || !student_response) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which phase we're critiquing
    let phase = "initial";
    if (twist_response) phase = "twist";
    if (reflection_response) phase = "reflection";

    const systemPrompt = `You are a sharp, direct reasoning coach. Your job is to critique a student's strategic thinking — not praise it.

CRITIQUE FRAMEWORK:
1. **Constraint Awareness** — Did they account for all constraints, or ignore some?
2. **Assumption Quality** — Is their core assumption defensible or shallow?
3. **Risk Assessment** — Did they identify a real risk or state something obvious?
4. **Strategic Depth** — Is the strategy specific and actionable, or vague platitudes?
5. **Adaptability** — After the twist, did they actually adapt or just repeat their original strategy?

SCORING (0-100):
- 90-100: Exceptional strategic reasoning with nuanced tradeoff awareness
- 70-89: Solid thinking with minor blind spots
- 50-69: Surface-level reasoning, missed constraints or weak assumptions
- 30-49: Significant gaps in logic or constraint awareness
- 0-29: No meaningful engagement with the scenario

TONE: Direct, professional, like a mentor who respects the student enough to be honest. Never condescending. Use specific references to their actual words.

RESPONSE FORMAT (return as JSON):
{
  "score": <number 0-100>,
  "grade": "<letter grade A-F>",
  "strengths": ["<specific strength from their response>"],
  "weaknesses": ["<specific weakness>"],
  "critique": "<2-3 sentences of sharp, specific feedback>",
  "coaching_tip": "<1 sentence actionable improvement suggestion>"
}`;

    let userPrompt = `## Scenario
${scenario}

## Constraints
${constraints}

## Decision Prompt
${decision_prompt}

## Student's Strategy
${student_response.strategy || "Not provided"}

## Student's Core Assumption
${student_response.core_assumption || "Not provided"}

## Student's Biggest Risk
${student_response.biggest_risk || "Not provided"}`;

    if (phase === "twist" || phase === "reflection") {
      userPrompt += `

## TWIST (new constraint introduced)
${twist}

## Student's Adapted Response
${twist_response || "Not provided"}`;
    }

    if (phase === "reflection") {
      userPrompt += `

## Student's Final Reflection
${reflection_response || "Not provided"}`;
    }

    userPrompt += `

Critique this ${phase === "initial" ? "initial strategy" : phase === "twist" ? "adaptation to the twist" : "complete lab performance"}. Return JSON only.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_feedback",
              description: "Submit structured feedback on student reasoning",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Score 0-100" },
                  grade: { type: "string", description: "Letter grade A-F" },
                  strengths: { type: "array", items: { type: "string" } },
                  weaknesses: { type: "array", items: { type: "string" } },
                  critique: { type: "string" },
                  coaching_tip: { type: "string" },
                },
                required: ["score", "grade", "strengths", "weaknesses", "critique", "coaching_tip"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_feedback" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI feedback generation failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No structured feedback returned");
    }

    const feedback = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ feedback, phase }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lab-feedback error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
