## Plan: Clean CourseView + Fix Lab Generation Pipeline

### What's Wrong Now

1. **CourseView has unnecessary elements**: Video player (AI generated course only, when editing or creating a course allow to add a youtube video player or a video from files.) , 4 content tabs (Overview/Resources/Notes/Discussions), and 4 left sidebar nav items (Course Overview, Learning Modules, Community, Progress) that add clutter
2. **Lab generation uses OpenAI directly** (`api.openai.com`) instead of Lovable AI Gateway — inconsistent with platform architecture
3. **No validation layer**: AI output goes straight to DB without schema validation or normalization
4. **Cybersecurity labs fail silently**: Invalid formulas (spaces, percent signs) cause rendering crashes with no fallback triggered

### Changes

**1. CourseView Cleanup** (`src/pages/CourseView.tsx`)

- Remove the video player block (lines 459-467) — the `youtube_url` field stays in the data model for future use
- Remove the 4 content tabs (Overview/Resources/Notes/Discussions) and the `activeTab` state — content renders directly without tabs
- Remove the 4 left sidebar nav items (Course Overview, Learning Modules, Community, Progress) — keep only the module list in the sidebar
- Content area shows lesson/lab/quiz directly based on `activeContent` without the tab wrapper

**2. Switch Edge Function to Lovable AI Gateway** (`supabase/functions/generate-lab-blueprint/index.ts`)

- Replace `api.openai.com` calls with `https://ai.gateway.lovable.dev/v1/chat/completions`
- Use `LOVABLE_API_KEY` (already available as a secret) instead of `OPENAI_API_KEY`
- Use `google/gemini-2.5-flash` model (good balance of speed/quality for structured output)
- Keep the existing tool_calls schema approach — it works with the gateway

**3. Add Validation + Normalization Layer** (in the edge function, post-AI-response)

- **Formula validation**: Parse every formula key — reject keys with spaces, special chars; auto-fix by converting to snake_case
- **Variable range validation**: Ensure `min < max`, `default` within range, `step > 0`
- **Block validation**: Verify every `output_display` output has a matching formula; auto-add missing formulas as simple averages
- **Rule condition validation**: Regex-check that conditions only contain variable names, numbers, and operators (`>`, `<`, `>=`, `<=`, `+`, `-`, `*`, `/`); strip invalid conditions
- **Choice effects validation**: Clamp all effect values to variable min/max ranges

**4. Strengthen Fallback System** (in the edge function)

- If validation finds >3 critical errors, discard AI output and use `createFallbackSliderLab()` — but with improved domain-specific naming from the cybersecurity PDF blueprint templates
- Add a `_validation_warnings` array to the saved blueprint so we can debug what was fixed
- Ensure the fallback lab always has: 3 variables, 1 control_panel, 1 output_display, 1 choice_set, working formulas

**5. Cybersecurity-Specific Fixes**

- The domain templates already exist (phishing, server_hardening, etc.) — the issue is the AI generates invalid formula syntax
- The validation layer (step 3) catches this: formulas like `"Password Length > 50%"` get rejected and replaced with valid math expressions
- Add a post-processing step that specifically checks cybersecurity labs for common bad patterns

### Files Modified

- `src/pages/CourseView.tsx` — Remove video, tabs, left nav items
- `supabase/functions/generate-lab-blueprint/index.ts` — Switch to Lovable AI, add validation layer, improve fallback

### What Stays the Same

- All 4 lab types (simulation/graph/flowchart/code_debugger) and their renderers
- The keyword scoring engine and domain blocklists
- The `DynamicLab`, `GraphLab`, `FlowchartLab`, `CodeDebuggerLab` components
- Light/dark mode theming
- Manrope font