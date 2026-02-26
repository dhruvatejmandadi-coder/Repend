
# Course Generation — Current State

## ✅ Completed

1. **Switched to Lovable AI Gateway** — uses `LOVABLE_API_KEY` (pre-configured), no external secrets needed
2. **Tool calling for structured output** — `create_course` function with forced `tool_choice` eliminates missing-field errors
3. **Repair layer** — `repairModules()` fixes slide separators, missing labs, legacy `effects` → `set_state`, quiz defaults
4. **Error handling** — courses marked `"failed"` on error; Zod errors surfaced with field paths; 429/402 handled
5. **set_state model** — all simulation choices use absolute 0-100 values per parameter; no deltas

## Architecture

- **Endpoint**: `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Model**: `openai/gpt-5-mini`
- **Edge function**: `supabase/functions/generate-course/index.ts`
- **Frontend**: `src/pages/Courses.tsx` calls the function; `src/components/labs/InteractiveLab.tsx` renders labs
