import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { topic, skill, difficulty, challenge_type, extra_prompt } = body;

    // Support legacy single-field "prompt"
    const mainTopic = topic || body.prompt;
    if (!mainTopic || typeof mainTopic !== "string" || mainTopic.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please provide a topic (at least 3 characters)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const labTypes = ["simulation", "classification", "ethical_dilemma", "policy_optimization", "decision_lab"];
    const diff = difficulty || "medium";
    const cType = challenge_type || "lab_interactive";
    const skillText = skill ? `\nSkill/concept: ${skill}` : "";
    const extraText = extra_prompt ? `\nAdditional instructions: ${extra_prompt}` : "";

    const userPrompt = `Create an interactive learning challenge about: ${mainTopic.trim()}
Difficulty: ${diff}
Challenge type preference: ${cType}${skillText}${extraText}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an interactive learning challenge generator. Given a topic, create an engaging challenge with full structured content AND an interactive lab experience.

You MUST generate ALL of these fields:
- title: Challenge title (max 80 chars)
- description: Short summary (max 300 chars)  
- objective: What the learner should practice (1-2 sentences)
- instructions: Step-by-step instructions for the challenge
- problem: The actual challenge problem statement (detailed)
- hints: Array of exactly 2 hint strings
- solution: The expected answer or solution
- solution_explanation: Detailed explanation of why this is the solution
- difficulty: "easy", "medium", or "hard"
- challenge_type: The type of challenge
- lab_type: Choose from ${labTypes.join(", ")}
- lab_data: Structured lab data matching the lab_type schema

Guidelines for lab type selection:
- "simulation": For causal/systemic topics. Uses 3 parameters (0-100), thresholds, and decision scenarios with set_state.
- "classification": For analytical/sorting topics. Uses items, categories, and correct_mapping.
- "ethical_dilemma": For moral/ethical topics. Uses dimensions and decisions with tradeoff impacts.
- "policy_optimization": For strategy/constraint topics. Uses parameters, constraints, targets, and max_moves.
- "decision_lab": For complex reasoning topics. Uses scenario, constraints, decision_prompt, and considerations.

CRITICAL RULES FOR LAB DATA:

For "simulation" type:
- Exactly 3 parameters with name, icon (emoji), unit, min (0), max (100), default (40-60)
- Exactly 3 thresholds with label, min_percent, message
- 2-4 decisions, each with a question, emoji, and 2-3 choices
- EVERY choice MUST have set_state with ALL 3 parameter names as keys and values 0-100

For "classification" type:
- 5-8 items with name, description
- 2-4 categories with name, description
- correct_mapping object mapping item names to category names

For "ethical_dilemma" type:
- 3-4 dimensions with name, icon (emoji), description, initial_value (40-60)
- 2-4 decisions with scenario, emoji, and 2-3 options
- Each option has label, description, and impacts (dimension name → number change)

For "policy_optimization" type:
- 3-4 parameters with name, icon (emoji), unit, min (0), max (100), default, step (5-10)
- 2-4 constraints with description
- 2-3 targets with name, operator (">=", "<="), value, unit
- max_moves: 3-5

For "decision_lab" type:
- scenario: detailed scenario text
- 3-4 constraints (strings)
- decision_prompt: what the user must decide
- considerations: 3-4 key factors

Return the result using the create_challenge_full function.`,
          },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_challenge_full",
              description: "Create a complete challenge with content and lab data",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  objective: { type: "string" },
                  instructions: { type: "string" },
                  problem: { type: "string" },
                  hints: { type: "array", items: { type: "string" } },
                  solution: { type: "string" },
                  solution_explanation: { type: "string" },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                  challenge_type: { type: "string" },
                  lab_type: { type: "string", enum: labTypes },
                  lab_data: { type: "object" },
                },
                required: ["title", "description", "objective", "instructions", "problem", "hints", "solution", "solution_explanation", "difficulty", "challenge_type", "lab_type", "lab_data"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_challenge_full" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit reached. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Failed to generate challenge");
    }

    const aiData = await aiResponse.json();

    let challengeData: any;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      challengeData = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      challengeData = JSON.parse(cleaned);
    }

    if (!challengeData.title || !challengeData.lab_type || !challengeData.lab_data) {
      throw new Error("AI returned incomplete challenge data");
    }

    // Defaults
    if (!labTypes.includes(challengeData.lab_type)) challengeData.lab_type = "simulation";
    if (!challengeData.hints || !Array.isArray(challengeData.hints)) challengeData.hints = ["Think about the key concepts.", "Consider the tradeoffs."];
    if (!challengeData.objective) challengeData.objective = challengeData.description || "";
    if (!challengeData.instructions) challengeData.instructions = "Complete the interactive lab below.";
    if (!challengeData.problem) challengeData.problem = challengeData.description || "";
    if (!challengeData.solution) challengeData.solution = "See the explanation.";
    if (!challengeData.solution_explanation) challengeData.solution_explanation = "Review the challenge to understand the solution.";
    challengeData.difficulty = challengeData.difficulty || diff;
    challengeData.challenge_type = challengeData.challenge_type || cType;

    // Repair simulation lab data
    if (challengeData.lab_type === "simulation" && challengeData.lab_data?.parameters) {
      const params = challengeData.lab_data.parameters;
      if (challengeData.lab_data.decisions) {
        for (const decision of challengeData.lab_data.decisions) {
          if (decision.choices) {
            for (const choice of decision.choices) {
              if (!choice.set_state) choice.set_state = {};
              for (const p of params) {
                if (typeof choice.set_state[p.name] !== "number") {
                  choice.set_state[p.name] = p.default ?? 50;
                }
              }
            }
          }
        }
      }
    }

    // Return the full challenge data for client-side editing (don't save yet)
    return new Response(JSON.stringify({ challenge_data: challengeData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-challenge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
