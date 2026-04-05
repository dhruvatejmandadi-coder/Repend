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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { lab_title, task_description, task_type, correct_answer, student_answer, concept_overview, scenario } = await req.json();

    if (!task_description || !student_answer) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert math tutor providing feedback on student work. Be encouraging but honest.

FEEDBACK RULES:
1. Evaluate mathematical correctness — check their work step by step
2. Identify conceptual understanding vs. procedural errors
3. If wrong, explain WHERE the mistake happened and WHY
4. If correct, confirm and note if their approach was efficient
5. Give a specific tip for improvement or a related concept to explore
6. For explanation-type tasks, evaluate clarity and mathematical reasoning

RESPONSE FORMAT (return via function call):
- score: 0-100 (mathematical accuracy + reasoning quality)
- is_correct: boolean (was the core answer right?)
- feedback: 2-3 sentences of specific feedback referencing their actual work
- correction: if wrong, show the correct approach (empty string if correct)
- tip: 1 sentence improvement or extension tip`;

    const userPrompt = `## Math Lab: ${lab_title || "Math Problem"}

## Concept
${concept_overview || "Not specified"}

## Scenario
${scenario || "Not specified"}

## Task
${task_description}
Type: ${task_type || "input"}

## Expected Answer
${correct_answer || "Open-ended"}

## Student's Answer
${student_answer}

Evaluate this student's math response. Return structured feedback via the function call.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_math_feedback",
              description: "Submit structured feedback on student math work",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Score 0-100" },
                  is_correct: { type: "boolean", description: "Whether the core answer is correct" },
                  feedback: { type: "string", description: "2-3 sentences of specific feedback" },
                  correction: { type: "string", description: "Correct approach if wrong, empty if correct" },
                  tip: { type: "string", description: "Improvement or extension tip" },
                },
                required: ["score", "is_correct", "feedback", "correction", "tip"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_math_feedback" } },
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

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("math-lab-feedback error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
