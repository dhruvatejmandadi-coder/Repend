# Simulation Lab Architecture – Topic-Based State Model

## Overview

Simulation labs use a deterministic `set_state` model.
Each decision sets topic-specific sliders to exact values (0–100).
This is NOT based on learner understanding, application, or confidence.
Sliders represent variables intrinsic to the topic being simulated.

---

## Core Principles

1. **Deterministic**
   - No deltas.
   - No additive effects.
   - Each decision sets the full state snapshot.

2. **Topic-Driven**
   - Slider names are derived from the course topic.
   - Example:
     - Economics → Inflation, Employment, GDP
     - Biology → Population, Resources, Predators
     - Programming → Performance, Readability, Memory Usage

3. **Strict Structure**
   - Every choice must include `set_state`.
   - `set_state` must define ALL sliders.
   - Values must be integers 0–100.
   - At least 2 sliders must change per choice.

---

## Simulation Lab Schema

Each simulation module must include:
- `parameters`: array of sliders
- `decisions`: array of decision scenarios

### Parameter Format

```json
{
  "name": "Inflation",
  "default": 50
}
```

### Decision Format

```json
{
  "prompt": "You increase interest rates.",
  "choices": [
    {
      "text": "Raise rates aggressively",
      "explanation": "This slows spending but stabilizes inflation.",
      "set_state": {
        "Inflation": 40,
        "Employment": 45,
        "GDP": 55
      }
    }
  ]
}
```

---

## AI Generation Rules

When generating a simulation lab:

- Derive 3–5 meaningful topic variables.
- Each variable must represent a measurable system dimension.
- **Avoid** abstract learning metrics (e.g., Understanding, Confidence).
- Decisions must reflect realistic cause-and-effect within the topic domain.
- All choices must:
  - Include `set_state`
  - Set ALL sliders
  - Use integer values 0–100

---

## Backend Validation

Before Zod validation:
- Ensure `lab_type === "simulation"` includes `parameters` + `decisions`.
- If a choice is missing `set_state`, generation fails.
- If a slider is missing from `set_state`, generation fails.
- Clamp values 0–100.
- No legacy `effects` support.

---

## Frontend Assumptions

Frontend expects:
- Fully populated `set_state`
- Complete slider coverage
- No partial states
- No deltas
- If a slider is missing, throw error.

---

## Example Topics

### Physics – Projectile Motion
Sliders: Velocity, Angle, Air Resistance

### Cybersecurity – Network Defense
Sliders: Vulnerability, Detection Speed, System Stability

### Climate Policy
Sliders: Carbon Emissions, Economic Output, Public Approval

---

## Why This Model

Topic-based sliders:
- Make labs feel real.
- Improve immersion.
- Create logical cause-and-effect.
- Avoid artificial "learning score" gamification.
- Produce consistent deterministic behavior.
