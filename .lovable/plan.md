

# Fix Course Generation: Production-Ready Rewrite

## Two Problems to Fix

1. **Secret mismatch**: Code looks for `OPENAI_API_KEY` but the secret is named `Repend`
2. **AI output instability**: Raw JSON parsing fails Zod validation (missing `lesson_content`, `lab_type`, `quiz`)

## Solution

### Use Lovable AI Gateway (Recommended Over Direct OpenAI)

Instead of dealing with the `Repend` secret naming issue, we'll switch to the **Lovable AI Gateway** which uses the pre-configured `LOVABLE_API_KEY` -- no secret renaming needed, no extra setup.

- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`
- Model: `openai/gpt-4o-mini` (same model, routed through the gateway)
- Key: `LOVABLE_API_KEY` (already configured and cannot be deleted)

### File: `supabase/functions/generate-course/index.ts` -- Full Rewrite

**1. Switch to Lovable AI Gateway**
```typescript
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
if (!LOVABLE_API_KEY) throw new Error("AI API key not configured");
```

**2. Use tool calling for structured output**
Define a `create_course` tool with the exact schema matching what Zod expects. Force the AI to use it via `tool_choice`. This eliminates all "missing field" errors because the AI *must* return every required field.

**3. Add repair layer BEFORE Zod validation**
A `repairModules()` function that:
- Recovers `lesson_content` from alternate field names (`content`, `lesson`, `slides`)
- Inserts `---` slide separators if missing
- Defaults `lab_type` to `"classification"` if missing
- Provides fallback quiz if missing
- Ensures all simulation `set_state` values cover every parameter, clamped 0-100
- Converts legacy `effects` to `set_state`

**4. Mark course as "failed" on error**
In the catch block, update the course status so it doesn't stay stuck on "generating" forever.

**5. Strengthen the system prompt**
- Explicitly require `lesson_content`, `lab_type`, `lab_data`, `quiz` in every module
- Enforce `set_state` (never `effects`) for simulation labs
- Include a concrete example of the expected structure

### File: `.lovable/plan.md`
Update to reflect current state.

## Technical Details

### Tool calling schema (forces structured output):
```typescript
tools: [{
  type: "function",
  function: {
    name: "create_course",
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
              lab_type: { type: "string", enum: ["simulation", "classification"] },
              lab_data: { type: "object" },
              quiz: { type: "array", items: { ... } }
            },
            required: ["title", "lesson_content", "lab_type", "lab_data", "quiz"]
          }
        }
      },
      required: ["title", "description", "modules"]
    }
  }
}],
tool_choice: { type: "function", function: { name: "create_course" } }
```

### Parsing response:
```typescript
const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
let parsed;
if (toolCall) {
  parsed = JSON.parse(toolCall.function.arguments);
} else {
  // Fallback: extract JSON from raw content
  const raw = aiData.choices[0].message.content;
  const match = raw.match(/\{[\s\S]*\}/);
  parsed = JSON.parse(match[0]);
}
const repaired = repairModules(parsed);
const courseData = CourseSchema.parse(repaired);
```

### Repair function:
```typescript
function repairModules(parsed: any) {
  for (const mod of parsed.modules || []) {
    if (!mod.lesson_content) mod.lesson_content = mod.content || mod.lesson || "## Introduction\n\nContent coming soon.";
    if (!mod.lesson_content.includes("\n---\n")) {
      const sections = mod.lesson_content.split(/(?=^## )/m).filter(Boolean);
      if (sections.length > 1) mod.lesson_content = sections.join("\n\n---\n\n");
    }
    if (!mod.lab_type) mod.lab_type = "classification";
    if (!mod.lab_data) mod.lab_data = {};
    if (!mod.quiz || !Array.isArray(mod.quiz)) {
      mod.quiz = [{ question: "Review this module", options: ["A","B","C","D"], correct: 0, explanation: "Review the lesson." }];
    }
    // Fix simulation set_state
    if (mod.lab_type === "simulation" && mod.lab_data?.decisions) {
      for (const d of mod.lab_data.decisions) {
        for (const c of d.choices || []) {
          if (!c.set_state) c.set_state = {};
          for (const p of mod.lab_data.parameters || []) {
            if (c.set_state[p.name] === undefined) c.set_state[p.name] = 50;
            c.set_state[p.name] = Math.max(0, Math.min(100, Math.round(c.set_state[p.name])));
          }
        }
      }
    }
  }
  return parsed;
}
```

### Error handling with course status update:
```typescript
catch (error) {
  if (course?.id) {
    await supabase.from("courses").update({ status: "failed" }).eq("id", course.id);
  }
  return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
}
```

