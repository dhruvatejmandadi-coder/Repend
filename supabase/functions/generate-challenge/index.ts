// v2 — picks up ANTHROPIC_API_KEY secret, improved error logging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── SINGLE CLAUDE CALL: metadata + lab in one shot ───

const challengeTool = {
  name: "create_challenge",
  description:
    "Create a complete interactive learning challenge. Pick the best lab format for the topic — no format is off-limits.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Challenge title (max 80 chars)" },
      description: {
        type: "string",
        description: "1-2 sentence summary shown on the challenge card",
      },
      topic: {
        type: "string",
        description:
          "Subject area tag (e.g. 'Microeconomics', 'Cybersecurity', 'World History')",
      },
      objective: {
        type: "string",
        description: "What skill or concept the student will practice (1-2 sentences)",
      },
      instructions: {
        type: "string",
        description: "Step-by-step instructions for completing the challenge",
      },
      problem: {
        type: "string",
        description: "The main challenge problem or scenario (detailed)",
      },
      hints: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 3,
        description: "2-3 progressive hints",
      },
      solution: { type: "string", description: "The expected answer or solution" },
      solution_explanation: {
        type: "string",
        description: "Explanation of why the solution is correct",
      },
      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
      lab_type: {
        type: "string",
        enum: [
          "simulation",
          "graph",
          "flowchart",
          "code_debugger",
          "matching",
          "ordering",
          "scenario_builder",
          "highlight_select",
          "debate_builder",
          "budget_allocator",
        ],
        description: "Pick the format that best teaches this topic",
      },
      lab_data: {
        type: "object",
        description:
          "Structured lab content — schema depends on lab_type (see system prompt)",
      },
    },
    required: [
      "title",
      "description",
      "topic",
      "objective",
      "instructions",
      "problem",
      "hints",
      "solution",
      "solution_explanation",
      "difficulty",
      "lab_type",
      "lab_data",
    ],
  },
};

const SYSTEM = `You are an expert interactive learning challenge designer. Given a topic and difficulty, you will create a complete challenge that includes both structured content and an interactive lab activity.

## Choosing the Lab Format

Pick the ONE format that makes the concept come alive. These 10 formats are available:

1. **simulation** — Students adjust 2-5 sliders (variables) and see live numeric outputs change via formulas. Best for: physics, economics, biology, systems with cause-and-effect. NOT for pure math equations.
2. **graph** — Students manipulate equation parameters via sliders and see a graph update in real-time. Use this for any topic involving a mathematical function: quadratics, linear equations, trig functions, exponential growth, polynomials, etc.
3. **flowchart** — Students fill blank process steps via dropdowns. Best for: biological cycles, algorithms, procedures, workflows.
4. **code_debugger** — Students find and fix bugs in real code. ONLY when the topic is literally about programming.
5. **matching** — Students connect terms ↔ definitions or causes ↔ effects. Best for: vocabulary-heavy topics, relationship mapping.
6. **ordering** — Students arrange scrambled steps/events in correct sequence. Best for: timelines, historical events, step-by-step processes.
7. **scenario_builder** — Students fill blanks in a real-world narrative. Best for: applied reasoning, business/legal/medical scenarios.
8. **highlight_select** — Students click ALL items matching a criterion. Best for: identifying examples vs non-examples, fact-checking.
9. **debate_builder** — Students sort statements into For/Against. Best for: ethics, policy debates, pros/cons analysis.
10. **budget_allocator** — Students distribute 100% across categories with sliders. Best for: resource allocation, finance, policy design.

## Format Selection Examples

- "quadratic equations" or "quadratics" → **graph** (plot y = ax² + bx + c with sliders for a, b, c)
- "linear functions" or "slope" → **graph**
- "trigonometry" or "sine/cosine" → **graph**
- "exponential growth/decay" → **graph**
- "supply and demand" or "economics" → **simulation**
- "DNA replication" or "photosynthesis" → **flowchart** or **ordering**
- "World War causes" or "historical events" → **ordering** or **matching**
- "climate policy" or "government budget" → **budget_allocator**
- "ethical dilemma" or "pros and cons" → **debate_builder**
- "vocabulary" or "terms and definitions" → **matching**
- "Python loops" or "debugging" → **code_debugger**
- When uncertain → **simulation**

## Lab Data Schemas

### simulation
\`\`\`json
{
  "lab_type": "simulation",
  "title": "...",
  "scenario": "2-3 sentence context",
  "kind": "exploration",
  "learning_goal": "...",
  "key_insight": "...",
  "goal": { "description": "What students should discover" },
  "variables": [
    { "name": "VarName", "icon": "📊", "unit": "%", "min": 0, "max": 100, "default": 50, "description": "..." }
  ],
  "blocks": [
    { "type": "text", "content": "Intro text" },
    { "type": "control_panel", "prompt": "Adjust variables:", "variables": ["VarName1", "VarName2"] },
    { "type": "output_display", "prompt": "Observe:", "outputs": ["Output1", "Output2"] },
    { "type": "choice_set", "question": "...", "emoji": "🤔", "choices": [
      { "text": "...", "feedback": "...", "effects": { "VarName": 70 }, "is_best": true }
    ]},
    { "type": "insight", "content": "Key takeaway" }
  ],
  "formulas": { "Output1": "VarName1 * 0.6 + VarName2 * 0.4" },
  "rules": [
    { "condition": "VarName1 > 80", "effects": {}, "message": "Warning message" }
  ],
  "completion_rule": "all_choices"
}
\`\`\`
CRITICAL: formula keys must EXACTLY match output_display output names. Variable names in formulas must EXACTLY match variable names. No special characters in variable or formula key names.

### graph
\`\`\`json
{
  "lab_type": "graph",
  "title": "...",
  "goal": "What students discover",
  "graph_type": "quadratic",
  "equation": "a*x^2 + b*x + c",
  "display_equation": "y = ax² + bx + c",
  "sliders": [
    { "name": "a", "label": "Coefficient a", "min": -5, "max": 5, "step": 0.5, "default": 1, "description": "..." }
  ],
  "target": { "description": "Reach a specific shape", "params": { "a": 1, "b": -2, "c": 3 }, "tolerance": 0.5 },
  "x_range": [-10, 10],
  "y_range": [-10, 20],
  "key_insight": "..."
}
\`\`\`

### flowchart
\`\`\`json
{
  "lab_type": "flowchart",
  "title": "...",
  "goal": "Complete the process flow",
  "scenario": "...",
  "key_insight": "...",
  "drop_zones": [
    { "id": "step_1", "label": "Step 1", "correct_value": "DNA Unwinds", "options": ["DNA Unwinds", "Protein Folds", "ATP Produced", "Cell Divides"] }
  ]
}
\`\`\`

### code_debugger
\`\`\`json
{
  "lab_type": "code_debugger",
  "title": "...",
  "goal": "Find and fix the bugs",
  "language": "python",
  "starter_code": "def add(a, b):\\n    return a - b",
  "expected_output": "5",
  "initial_error": "Returns wrong value",
  "hints": ["Check the operator", "Should it be + or -?"],
  "key_insight": "..."
}
\`\`\`

### matching
\`\`\`json
{
  "lab_type": "matching",
  "title": "...",
  "instructions": "Match each term to its definition",
  "pairs": [
    { "id": "1", "left": "Supply", "right": "The amount of a good producers are willing to sell at a given price" }
  ],
  "key_insight": "..."
}
\`\`\`
Include 4-8 pairs.

### ordering
\`\`\`json
{
  "lab_type": "ordering",
  "title": "...",
  "context": "Brief framing paragraph",
  "items": [
    { "id": "1", "text": "Step description (max 15 words)", "correct_position": 1 }
  ],
  "key_insight": "..."
}
\`\`\`
Include 4-8 items with correct_position from 1..N with no duplicates.

### scenario_builder
\`\`\`json
{
  "lab_type": "scenario_builder",
  "title": "...",
  "setup": "Optional framing sentence",
  "narrative": "A 3-6 sentence scenario with [BLANK_0] and [BLANK_1] placeholders.",
  "blanks": [
    {
      "id": "BLANK_0",
      "correct": "correct answer",
      "options": ["correct answer", "wrong option 1", "wrong option 2"],
      "explanation": "Why this answer is correct"
    }
  ],
  "key_insight": "..."
}
\`\`\`
Include 3-6 blanks. Every BLANK_N in narrative MUST have a matching entry in blanks array.

### highlight_select
\`\`\`json
{
  "lab_type": "highlight_select",
  "title": "...",
  "instruction": "Select ALL items that are examples of X",
  "items": [
    { "id": "1", "text": "Item text (max 20 words)", "is_correct": true, "explanation": "Why correct/incorrect" }
  ],
  "key_insight": "..."
}
\`\`\`
Include 5-10 items. At least 2 correct, at least 2 incorrect.

### debate_builder
\`\`\`json
{
  "lab_type": "debate_builder",
  "title": "...",
  "topic": "Should X be done?",
  "for_label": "For",
  "against_label": "Against",
  "statements": [
    { "id": "1", "text": "A clear argument statement", "side": "for", "explanation": "Why this is a FOR argument" }
  ],
  "key_insight": "..."
}
\`\`\`
Include 4-8 statements, balanced between for/against.

### budget_allocator
\`\`\`json
{
  "lab_type": "budget_allocator",
  "title": "...",
  "scenario": "2-3 sentence context placing student as decision-maker",
  "unit": "%",
  "categories": [
    {
      "id": "1",
      "name": "Category Name",
      "icon": "🏥",
      "description": "What this funds",
      "recommended_min": 10,
      "recommended_max": 35,
      "explanation": "Feedback shown after submission"
    }
  ],
  "reflection": "Open-ended question shown after submitting",
  "key_insight": "..."
}
\`\`\`
Include 3-7 categories. recommended_min/max should sum to roughly 100 across all categories.

## Quality Rules
- All content must be specific to the topic provided
- Activity should be completable in 3-7 minutes
- Use real domain language and realistic numbers
- The lab must genuinely teach the concept through interaction, not just display information`;

async function callClaude(apiKey: string, topic: string, description: string, difficulty: string): Promise<any> {
  const userMsg = `Create an interactive learning challenge about: "${topic}"
${description ? `Additional context: ${description}` : ""}
Difficulty: ${difficulty}

Choose the lab format that will most effectively teach this topic through hands-on interaction. Generate complete, playable content.`;

  let lastError = "";
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 3000));

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 8096,
          system: SYSTEM,
          tools: [challengeTool],
          tool_choice: { type: "tool", name: "create_challenge" },
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      if (resp.status === 429) { lastError = "Rate limit — try again in a moment."; continue; }
      const text = await resp.text();
      if (!resp.ok) {
        if (resp.status === 401) {
          lastError = "Invalid Anthropic API key. Check ANTHROPIC_API_KEY in Supabase secrets.";
          console.error(`[generate-challenge] 401 auth error from Claude API. Key may be wrong or missing.`);
          break; // no point retrying an auth error
        }
        lastError = `Claude API error (${resp.status}): ${text.slice(0, 300)}`;
        console.error(`[generate-challenge] Claude error ${resp.status}:`, text.slice(0, 300));
        continue;
      }
      const parsed = JSON.parse(text);
      const toolUse = parsed.content?.find((c: any) => c.type === "tool_use");
      if (!toolUse) {
        lastError = "Claude did not return a tool_use block.";
        console.error(`[generate-challenge] No tool_use in response:`, JSON.stringify(parsed).slice(0, 300));
        continue;
      }
      return toolUse.input;
    } catch (e: any) {
      lastError = e.message || "Network error reaching Claude API.";
      console.error(`[generate-challenge] Attempt ${attempt} threw:`, e.message);
    }
  }
  throw new Error(lastError || "Claude call failed after retries.");
}

// ─── MAIN HANDLER ───

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured in Supabase secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { topic, description, difficulty } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Please provide a topic." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const challengeData = await callClaude(
      ANTHROPIC_API_KEY,
      topic.trim(),
      (description || "").trim(),
      difficulty || "medium"
    );

    // Normalize
    if (!challengeData.hints || !Array.isArray(challengeData.hints)) {
      challengeData.hints = ["Think about the key concepts.", "Consider the tradeoffs."];
    }
    if (!challengeData.difficulty) challengeData.difficulty = difficulty || "medium";
    challengeData.challenge_type = "lab_interactive";

    console.log(`✅ Challenge generated: "${challengeData.title}" → lab_type: ${challengeData.lab_type}`);

    return new Response(JSON.stringify({ challenge_data: challengeData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-challenge error:", e.message);
    return new Response(JSON.stringify({ error: e.message || "Failed to generate challenge." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
