# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run build:dev    # Dev-mode build
npm run preview      # Preview production build

# Quality
npm run lint         # ESLint

# Tests
npm run test         # Run tests once (Vitest)
npm run test:watch   # Watch mode

# Run a single test file
npx vitest run src/path/to/file.test.ts
```

Tests use `jsdom` + `@testing-library/react`. Setup file: `src/test/setup.ts`.

## Architecture

**Repend** is an AI-powered learning platform built with React 18 + TypeScript + Vite, using Supabase as the backend and shadcn/ui + Tailwind for UI.

### Routing & Layout

`App.tsx` defines all routes via React Router v6. Two layout tiers:
- **Standalone pages** (`/`, `/login`, `/signup`, `/courses/:id`, etc.) — no sidebar
- **Dashboard pages** — wrapped in `<DashboardLayout>` which renders `AppSidebar` + a persistent sidebar via shadcn's sidebar primitives

### Auth & Context

- `useAuth` (Context) — wraps Supabase auth; exposes `user`, `session`, `loading`, `isNewUser`. New users trigger `<OnboardingFlow>` (rendered at the root in `App.tsx`).
- `useTheme` (Context) — light/dark theming via `next-themes`.
- React Query (`@tanstack/react-query`) is the data-fetching layer; the `QueryClient` is provisioned at the root.

### Supabase Integration

- Client: `src/integrations/supabase/client.ts`
- Types auto-generated: `src/integrations/supabase/types.ts` — do not edit by hand
- Edge Functions live in `supabase/functions/` (Deno runtime). Key ones:
  - `generate-course` — calls OpenAI (GPT-4o) to scaffold course outline + module content
  - `generate-lab-blueprint` — calls **Claude API** (`claude-opus-4-6`) to generate interactive labs; requires `ANTHROPIC_API_KEY` in Supabase secrets
  - `ai-tutor` — streaming AI tutor chat
  - `generate-challenge` — creates daily challenges
  - `check-subscription` / `create-checkout` / `customer-portal` — Stripe integration
- Migrations: `supabase/migrations/` (timestamped SQL files)

### Course & Lab System

The core learning loop in `CourseView.tsx` cycles through three content types per module: **lesson → lab → quiz**.

Labs are AI-generated activities powered by a custom engine. There are **7 lab types**, selected automatically based on the module topic:

| Lab type | Component | Best for |
|---|---|---|
| `simulation` | `DynamicLab` | Slider-driven systems (physics, economics, cyber) |
| `graph` | `GraphLab` | Math equation plotting with slider params |
| `flowchart` | `FlowchartLab` | Fill-in-the-blank process flows |
| `code_debugger` | `CodeDebuggerLab` | Find-and-fix bugs |
| `matching` | `MatchingLab` | Connect terms ↔ definitions, causes ↔ effects |
| `ordering` | `OrderingLab` | Arrange steps/events in correct sequence |
| `scenario_builder` | `ScenarioBuilderLab` | Fill blanks in a real-world narrative |

`InteractiveLab.tsx` is the routing entry point that picks the right component from `lab_type`.

For simulation labs: `src/lib/labSimulationEngine.ts` is an XState + mathjs runtime that executes AI-generated `SimulationConfig` (states, transitions, variables, rules) client-side.

### Path Alias

`@/` maps to `src/`. Used throughout — always import with `@/` rather than relative paths from `src/`.

### Key Data Hooks

| Hook | Purpose |
|---|---|
| `useCourseProgress` | Tracks module completion, quiz scores per user |
| `usePoints` | Gamification point system |
| `useSubscription` | Stripe subscription status |
| `useChallenges` | Daily challenge fetch/submit |
| `useCommunityPosts` / `usePostComments` | Social feed |
| `useLabSimulation` / `useLabResults` | Lab state + result persistence |
