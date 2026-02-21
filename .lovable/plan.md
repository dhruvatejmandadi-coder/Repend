

# Switch Simulation Labs from Delta Effects to Set-State Model

## What Changes
Decision choices will set sliders to exact values (0-100) instead of adding/subtracting deltas. When you click a decision, every slider jumps to a precise position immediately.

## Files to Modify

### 1. `src/components/labs/InteractiveLab.tsx` (Frontend)

**Type updates:**
- Change `Decision.choices` from `effects: Record<string, number>` to `set_state: Record<string, number>`
- Support legacy `effects` field as backward compatibility (convert to set_state on read)

**Remove `ensureDecisionEffects` function** -- replace with `ensureDecisionSetState` that:
- Checks for `set_state` on each choice
- If missing but `effects` exists, converts deltas to absolute values (backward compat for existing courses)
- If both missing, generates default set_state values (0-100) for all parameters

**Rewrite `handleDecision`:**
- Instead of `prev[key] + delta`, build new state from `choice.set_state`
- For any slider NOT in `set_state`, keep its current value
- Clamp all values between 0 and 100

### 2. `supabase/functions/generate-course/index.ts` (Backend)

**Update AI prompt:**
- Replace all mentions of `effects` with `set_state`
- Instruct AI: each choice must have `set_state` with ALL slider names mapped to integers 0-100
- Update example to use `set_state`

**Update fallback data:**
- All hardcoded fallback decisions use `set_state` instead of `effects`
- Each choice sets ALL three sliders (Understanding, Application, Confidence)

**Update post-processing repair logic:**
- Convert any `effects` found to `set_state` absolute values
- Ensure every choice has `set_state` with all parameter names
- Fill missing sliders with 50 (midpoint default)

## Technical Details

### InteractiveLab.tsx -- handleDecision rewrite:
```typescript
const handleDecision = (dIdx: number, cIdx: number) => {
  if (answered[dIdx] !== undefined) return;
  const choice = decisions[dIdx]?.choices[cIdx];
  if (!choice) return;

  setValues((prev) => {
    const next = { ...prev };
    const setState = choice.set_state || {};
    for (const p of parameters) {
      next[p.name] = Math.max(0, Math.min(100,
        setState[p.name] ?? prev[p.name] ?? p.default
      ));
    }
    return next;
  });

  setAnswered((prev) => ({ ...prev, [dIdx]: cIdx }));
};
```

### Edge function prompt change (key section):
```
SIMULATION LAB REQUIREMENTS:
- Every choice MUST have "set_state" (NOT "effects")
- set_state maps ALL slider names to exact integer values 0-100
- Example: {"set_state": {"Understanding": 85, "Application": 60, "Confidence": 70}}
- NEVER use delta values, NEVER use "effects"
- Each choice must set ALL sliders, modifying at least 2
```

### Edge function fallback decisions example:
```typescript
choices: [
  { text: "Deep dive into theory first",
    explanation: "Strong foundation approach.",
    set_state: { Understanding: 80, Application: 40, Confidence: 55 } },
  { text: "Jump into practice problems",
    explanation: "Hands-on learning approach.",
    set_state: { Understanding: 45, Application: 85, Confidence: 65 } },
]
```

### Backward compatibility for existing courses:
The frontend `ensureDecisionSetState` will detect old `effects`-based data and convert it:
```typescript
// If choice has effects but no set_state, convert
if (choice.effects && !choice.set_state) {
  const setState: Record<string, number> = {};
  for (const p of parameters) {
    const delta = choice.effects[p.name] ?? 0;
    setState[p.name] = Math.max(0, Math.min(100, p.default + delta));
  }
  choice.set_state = setState;
}
```

