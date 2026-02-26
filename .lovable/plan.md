

# Simulation Labs — Set-State Model (IMPLEMENTED)

## Summary
Decision choices set sliders to exact values (0-100) instead of adding/subtracting deltas. Slider parameter names are **topic-specific** — generated dynamically based on the course subject (e.g. "GDP Growth" for economics, "Cell Health" for biology). Never generic names like "Understanding" or "Confidence".

## Architecture

### Frontend: `src/components/labs/InteractiveLab.tsx`
- `ensureDecisionSetState()` converts any legacy `effects` data to absolute `set_state` values
- `handleDecision()` sets sliders to exact values from `choice.set_state`, clamped 0-100
- Parameters not in `set_state` keep their current value

### Backend: `supabase/functions/generate-course/index.ts`
- AI prompt explicitly requires **topic-relevant** parameter names (not generic)
- Prompt enforces `set_state` format with all parameters mapped to 0-100 integers
- `repairModules()` post-processor fixes missing fields, converts legacy `effects` → `set_state`, fills missing params with 50
- Forced tool_choice ensures structured output
- Zod validation catches malformed data

## Key Rules
1. Parameter names must match the course domain (never "Understanding/Application/Confidence")
2. Every choice must have `set_state` with ALL slider names → integer 0-100
3. 3 parameters per simulation, 2-3 decisions with 2 choices each
4. Frontend backward-compatible with old `effects`-based courses
