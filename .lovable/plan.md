
# Add Sorting Lab, Math Lab, and Intelligent Lab Selection

## Overview
Create two new interactive lab components and update the AI to intelligently pick the best lab type per module, with sorting as the universal fallback.

## New Files

### 1. `src/components/labs/SortingLab.tsx`
Reorder component -- users arrange shuffled items into correct sequence using up/down buttons.

- Items shuffled on mount
- Up/down arrow buttons to swap adjacent items
- "Check Order" button validates all positions
- Green/red highlights for correct/incorrect
- Score display and "Try Again" to re-shuffle

Data shape:
```json
{
  "items": [
    { "text": "Parentheses", "correct_position": 1 },
    { "text": "Exponents", "correct_position": 2 }
  ]
}
```

### 2. `src/components/labs/MathLab.tsx`
Numeric problem-solving -- type answers, get instant feedback with explanations.

- One problem at a time with numeric input
- Hint toggle button
- Check button with tolerance-based comparison
- Shows explanation after answering
- Final score at end, "Try Again" resets

Data shape:
```json
{
  "problems": [
    { "question": "Solve x^2 - 4 = 0. Positive root?", "answer": 2, "tolerance": 0.01, "hint": "Factor", "explanation": "(x-2)(x+2)=0" }
  ]
}
```

## Modified Files

### 3. `src/components/labs/InteractiveLab.tsx`
- Import SortingLab and MathLab
- Add routing for `labType === "sorting"` and `labType === "math"` with data validation
- Update empty state message to list all four lab types

### 4. `supabase/functions/generate-course/index.ts`

**Zod schema:** Change line 23 from:
```typescript
lab_type: z.enum(["simulation", "classification"]),
```
to:
```typescript
lab_type: z.enum(["simulation", "classification", "sorting", "math"]),
```

**System prompt:** Replace the minimal prompt with full deterministic lab selection rules:
- "math" for equations, calculations, numeric answers, algebra, calculus
- "sorting" for ordering, sequences, timelines, process flows -- AND as universal fallback
- "classification" for grouping/categorizing
- "simulation" only for cause-and-effect with tunable parameters
- Include strict data format specs and examples for all four types
- Include slide formatting rules (4-6 slides, `---` separators)
- Include simulation set_state rules

**Post-processing (lines 150-174):** Add validation for new lab types after the existing slide separator logic:
- Sorting: ensure `correct_position` values are unique and sequential from 1
- Math: ensure `answer` is a valid number, default `tolerance` to 0.01

## Technical Details

### SortingLab core:
```typescript
const moveItem = (index: number, direction: "up" | "down") => {
  const newOrder = [...userOrder];
  const swapIdx = direction === "up" ? index - 1 : index + 1;
  if (swapIdx < 0 || swapIdx >= newOrder.length) return;
  [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];
  setUserOrder(newOrder);
};

const checkOrder = () => {
  const score = userOrder.filter((item, idx) => item.correct_position === idx + 1).length;
  setScore(score);
  setChecked(true);
};
```

### MathLab answer checking:
```typescript
const isCorrect = Math.abs(parseFloat(userAnswer) - problem.answer) <= (problem.tolerance ?? 0.01);
```

### InteractiveLab routing additions (after classification branch):
```typescript
if (labType === "sorting") {
  if (!labData?.items?.length) return <LabEmptyState labType={labType} />;
  return <SortingLab data={labData} />;
}
if (labType === "math") {
  if (!labData?.problems?.length) return <LabEmptyState labType={labType} />;
  return <MathLab data={labData} />;
}
```

### Edge function post-processing additions:
```typescript
// Sorting: fix positions
if (mod.lab_type === "sorting" && mod.lab_data?.items) {
  mod.lab_data.items = mod.lab_data.items.map((item, idx) => ({
    ...item,
    correct_position: item.correct_position ?? idx + 1,
  }));
}
// Math: fix answer types
if (mod.lab_type === "math" && mod.lab_data?.problems) {
  mod.lab_data.problems = mod.lab_data.problems.map((p) => ({
    ...p,
    answer: typeof p.answer === "number" ? p.answer : parseFloat(p.answer) || 0,
    tolerance: p.tolerance ?? 0.01,
  }));
}
```

### Updated Zod schema:
```typescript
lab_type: z.enum(["simulation", "classification", "sorting", "math"]),
```
