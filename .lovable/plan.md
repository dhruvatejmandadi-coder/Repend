
# Repend Lab System — Architecture Plan

## Lab Type Selection (Adaptive per Module)

The system uses **weighted keyword scoring** to select the best lab type for each module independently. No single lab type is forced across a course.

### Selection Flow
1. Combine topic + module title + lesson content
2. Score against each lab type's keyword profile (weighted 1-6)
3. Pick the highest-scoring type (minimum score threshold: 4)
4. Fallback to simulation if no strong match

### Supported Lab Types
| Type | Best For | Renderer |
|------|----------|----------|
| `graph` | Math, trig, polar, equations, functions | GraphLab.tsx |
| `code_debugger` | Programming, algorithms, debugging | CodeDebuggerLab.tsx |
| `flowchart` | Processes, workflows, lifecycles | FlowchartLab.tsx |
| `simulation` | Science, economics, business, general | DynamicLab.tsx |

### Key Rule
"Lab selection must be adaptive per topic, prioritizing the most relevant interactive representation (e.g., trig graphs for polar concepts), with graceful fallback if generation fails."

## Generation Pipeline

### Progress Tracking
- Real-time polling (3s) shows progress bar + status text
- Users gated on generating screen until 100% complete
- All components (lessons, quizzes, labs) must be generated before access

### Lab Blueprint Generation
- Phase 2 generates labs via `generate-lab-blueprint` edge function
- Each lab type has its own tool schema for structured output
- 3-attempt retry with validation per lab type
- Failed labs marked as `failed` (never silently empty)

## Blueprint Rules (from PDF)
- Deterministic logic, not generative AI hallucinations
- Every slider must affect outputs
- Animated transitions (numbers count, graphs smooth)
- Randomize experience, NOT concept
- Validate AI JSON before rendering, fallback if invalid
- "If a new lab requires new code, the system is built wrong"
