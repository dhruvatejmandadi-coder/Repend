

# Fix: Restore Decision Labs and Real Sorting Content

## Problem
The strict Zod lab validation added in the last edit is too aggressive. When ANY field is missing (e.g., a simulation lab missing `description` or `emoji`), the entire lab gets replaced with generic placeholder sorting data ("Concept 1: Introduction", "Concept 2: Core Principle"...). This effectively destroys all simulation/decision labs and replaces real sorting labs with useless placeholders.

## Root Cause
`SimulationLabSchema` requires every nested field (`title`, `description`, `emoji`, `explanation`, `set_state`). The AI often omits optional fields like `emoji` or `description`, causing validation to fail and the fallback to trigger for every single module.

## Fix (1 file)

### `supabase/functions/generate-course/index.ts`

1. Make non-critical fields optional in all lab Zod schemas:
   - `SimulationLabSchema`: make `title`, `description`, `emoji`, `explanation` optional
   - `SortingLabSchema`: make `title`, `description` optional
   - `ClassificationLabSchema`: make `title`, `description`, `hint` optional
   - `GraphLabSchema` (math): make `title`, `description`, `step` optional

2. Replace the "throw-away-and-use-placeholders" fallback with a **repair** approach:
   - If simulation lab_data has `parameters` and `thresholds`, keep it (fill missing fields with defaults)
   - If sorting lab_data has `items`, keep it (fill missing title/description)
   - Only fall back to placeholder sorting if the data is truly empty or completely wrong type

3. The fallback sorting data should at minimum reference the module title instead of "Concept 1" placeholders -- but the real fix is to stop triggering the fallback unnecessarily.

## Technical Details

### Schema changes (make non-critical fields optional):

```typescript
const SimulationLabSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  parameters: z.array(z.object({
    name: z.string(),
    icon: z.string().optional().default(""),
    unit: z.string().optional().default(""),
    min: z.number(),
    max: z.number(),
    default: z.number(),
    description: z.string().optional(),
  })).min(1),
  thresholds: z.array(z.object({
    label: z.string(),
    min_percent: z.number(),
    message: z.string(),
  })).min(1),
  decisions: z.array(z.object({
    question: z.string(),
    emoji: z.string().optional(),
    choices: z.array(z.object({
      text: z.string(),
      explanation: z.string().optional(),
      set_state: z.record(z.number()).optional(),
      effects: z.record(z.number()).optional(),
    })).min(2),
  })).optional(),
});
```

Similar `.optional()` additions for `SortingLabSchema`, `ClassificationLabSchema`, and `GraphLabSchema` on non-critical string fields.

### Repair logic (replace the current catch block):

```typescript
courseData.modules.forEach((mod, idx) => {
  try {
    switch (mod.lab_type) {
      case "simulation": SimulationLabSchema.parse(mod.lab_data); break;
      case "sorting":    SortingLabSchema.parse(mod.lab_data); break;
      case "classification": ClassificationLabSchema.parse(mod.lab_data); break;
      case "math":       GraphLabSchema.parse(mod.lab_data); break;
    }
  } catch (labErr) {
    console.warn(`Module ${idx} lab validation failed, attempting repair...`);
    
    // Try to salvage: if it has parameters/thresholds, treat as simulation
    if (mod.lab_data?.parameters?.length && mod.lab_data?.thresholds?.length) {
      mod.lab_type = "simulation";
      return;
    }
    // If it has items array, treat as sorting
    if (mod.lab_data?.items?.length) {
      mod.lab_type = "sorting";
      mod.lab_data.title = mod.lab_data.title || `Order: ${mod.title}`;
      mod.lab_data.description = mod.lab_data.description || `Arrange in correct order.`;
      return;
    }
    // If it has categories, treat as classification
    if (mod.lab_data?.categories?.length && mod.lab_data?.items?.length) {
      mod.lab_type = "classification";
      return;
    }
    // True fallback: generate sorting from lesson content headings
    mod.lab_type = "sorting";
    const headings = mod.lesson_content
      .split(/\n---\n/)
      .map(s => s.match(/^##\s*(.+)/m)?.[1])
      .filter(Boolean);
    mod.lab_data = {
      title: `Order the Key Concepts: ${mod.title}`,
      description: `Arrange these concepts from ${mod.title} in the correct logical order.`,
      items: (headings.length >= 2 ? headings : ["Introduction", "Core Concept", "Application", "Summary"])
        .map((text, i) => ({ text, correct_position: i + 1 })),
    };
  }
});
```

This ensures:
- Decision/simulation labs survive even with minor missing fields
- Sorting labs keep their real AI-generated content
- Only truly broken labs get a fallback, and even then it uses lesson headings instead of generic placeholders

