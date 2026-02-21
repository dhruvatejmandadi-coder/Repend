

# Improve Lesson Slides and Lab Scenario Generation

## Problem
1. **Lessons** sometimes come back as a single wall of text instead of multiple slides separated by `---`
2. **Scenario decisions** in simulation labs sometimes have empty or missing `effects`, so sliders don't move when you answer
3. The AI prompt isn't strict enough about these requirements

## Changes

### 1. Strengthen the AI Prompt (Edge Function)
**File:** `supabase/functions/generate-course/index.ts`

Update the system prompt to be much more explicit:
- Require each slide to be wrapped between `---` separators with clear examples
- Add an explicit example of the `lesson_content` format showing `---` between slides
- Require 4-6 slides per module with mandatory `---` delimiters
- Require 2-3 scenario decisions per simulation lab with concrete numeric effects on every choice
- Add an inline example of the `decisions` and `effects` structure so the AI never returns empty objects

### 2. Post-Processing: Force Slide Splits
**File:** `supabase/functions/generate-course/index.ts`

After receiving AI data, add a post-processing step for `lesson_content`:
- If the content has zero `---` separators, automatically chunk it by splitting on `## ` headings and rejoining with `---`
- This guarantees multiple slides even if the AI ignores the separator instruction

### 3. Post-Processing: Guarantee Decision Effects
**File:** `supabase/functions/generate-course/index.ts`

The existing fallback logic already handles empty effects, but strengthen it:
- After fixing empty effects, validate that every choice has at least one non-zero numeric delta
- Log a warning if auto-repair was needed (for debugging)

### 4. No Frontend Changes Needed
- `LessonSlides.tsx` already splits on `\n---\n` and renders pagination -- it works correctly when slides are properly separated
- `InteractiveLab.tsx` already applies decision effects to slider values via the `handleDecision` function -- it works correctly when effects have numeric values

## Technical Details

The key prompt update will include an explicit example like:
```
LESSON FORMAT (CRITICAL):
- 4-6 slides per module
- Separate EVERY slide with a line containing ONLY "---"
- Example lesson_content:
  "## Slide 1 Title\n\nParagraph...\n\n---\n\n## Slide 2 Title\n\nParagraph...\n\n---\n\n## Slide 3 Title\n\nParagraph..."

SIMULATION DECISIONS (CRITICAL):
- 2-3 scenario questions per lab
- Every choice MUST have effects with numeric values
- Example: effects: {"Temperature": 15, "Pressure": -10}
- NEVER use effects: {}
```

The post-processing chunking logic:
```typescript
// If no --- separators found, split by headings
if (!mod.lesson_content.includes('\n---\n')) {
  const sections = mod.lesson_content.split(/(?=^## )/m).filter(Boolean);
  if (sections.length > 1) {
    mod.lesson_content = sections.join('\n\n---\n\n');
  }
}
```

