

# Fix Lab Generation: Topic-Locked Prompts

## Problem
The current system prompt in the course generation edge function is too loose. The AI drifts off-topic, producing generic labs (e.g., "Understanding/Practice/Application" sliders) instead of labs that directly test knowledge of each module's specific subject matter.

## Solution
Apply the user's prompt engineering strategy directly into the edge function. The key changes:

1. **Restructured system prompt** -- Each module's lab generation will be explicitly anchored to the course title, module title, and the lesson content that was just generated. The prompt will include the "restate the topic internally before generating" instruction.

2. **Lower temperature** -- Set `temperature: 0.4` to reduce creative drift and keep outputs tightly on-topic.

3. **Lesson-content anchoring** -- The prompt will instruct the AI: "All lab data MUST be based only on the module's lesson_content. If information is not present in the lesson, do not invent it."

4. **Stricter fallback in the edge function** -- When validation fails, the server-side fallback will extract key terms from the module's `lesson_content` (not just the title) to build a more relevant simulation.

## Technical Details

### File: `supabase/functions/generate-course/index.ts`

**Change 1: Add `temperature: 0.4`** to the API request body (alongside `model` and `messages`).

**Change 2: Rewrite the system prompt** to:
- Explicitly state: "You are an educational lab generator. For each module, the lab MUST be strictly and only about that module's topic."
- Add the "restate" instruction: "Before generating lab_data for each module, internally restate the module title and ensure every parameter/scenario/item directly tests knowledge of that exact topic. Do NOT output the restatement."
- Add the drift-prevention rule: "All lab parameters, scenarios, and classification items MUST reference real concepts from the module's lesson_content. Do NOT introduce unrelated subtopics. If unsure, stay narrower -- never broader."
- Keep all existing schema rules about never returning empty `{}` objects.

**Change 3: Improve server-side fallback** (lines 255-275) -- Instead of always falling back to generic "Conceptual Grasp / Practical Skills / Critical Thinking" sliders, extract 2-3 key noun phrases from `mod.lesson_content` (first 200 chars) and use those as parameter names. This ensures even fallbacks feel topic-relevant.

### File: `src/components/labs/InteractiveLab.tsx`

No changes needed. The frontend fallback already does keyword matching on the title, which is a reasonable last resort. The real fix is making the AI generate proper data in the first place.

### No new API key needed
This uses the existing Lovable AI gateway with `LOVABLE_API_KEY`. No OpenAI key required -- the fix is in prompt engineering and temperature tuning, not switching models.

