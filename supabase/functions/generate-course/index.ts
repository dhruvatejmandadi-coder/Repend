import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ===============================
   🔧 ZOD SCHEMAS
================================ */

const OutlineSchema = z.object({
  title: z.string(),
  description: z.string(),
  modules: z.array(z.object({
    title: z.string(),
    lesson_content: z.string(),
    youtube_query: z.string().optional(),
    youtube_title: z.string().optional(),
    lab_type: z.string(),
    lab_title: z.string().optional(),
    lab_description: z.string().optional(),
    quiz: z.array(z.object({
      question: z.string(),
      options: z.array(z.string()),
      correct: z.number(),
      explanation: z.string(),
    })),
  })),
});

/* ===============================
   🔧 AI CALL HELPER
================================ */

async function callAI(apiKey: string, body: any, retries = 2): Promise<any> {
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 3000;
      console.log(`[AI Retry] Attempt ${attempt + 1} after ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 429) { lastError = "Rate limit exceeded."; continue; }
      if (response.status === 402) throw new Error("AI credits exhausted. Please add funds in Settings > Workspace > Usage.");
      const text = await response.text();
      if (!response.ok) { lastError = `AI error (${response.status}).`; continue; }
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { lastError = "Invalid AI response."; continue; }
      if (!parsed.choices?.length) { lastError = "Empty AI response."; continue; }
      return parsed;
    } catch (e: any) {
      if (e.message?.includes("credits")) throw e;
      lastError = e.message || "Network error.";
    }
  }
  throw new Error(lastError || "AI call failed after retries.");
}

function extractToolArgs(aiData: any): any {
  const message = aiData.choices[0].message;
  const toolCall = message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error(`AI did not return structured data (reason: ${aiData.choices[0]?.finish_reason || "unknown"}).`);
  }
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    let raw = toolCall.function.arguments || "";
    raw = raw.replace(/,\s*$/, "");
    for (const closer of ["]}]}", "]}}", "]}", "}", "]"]) {
      try { return JSON.parse(raw + closer); } catch { /* next */ }
    }
    throw new Error("AI response was truncated. Try a simpler topic.");
  }
}

/* ===============================
   🔧 LAB NORMALIZATION
================================ */

function normalizeParameters(params: any[]): any[] {
  if (!Array.isArray(params)) return [];
  return params.map((p: any) => ({
    name: String(p.name || p.label || "Variable"),
    icon: String(p.icon || p.emoji || "📊"),
    unit: String(p.unit || "%"),
    min: typeof p.min === "number" ? p.min : 0,
    max: typeof p.max === "number" ? p.max : 100,
    default: Math.max(0, Math.min(100, typeof p.default === "number" ? p.default : (typeof p.initial === "number" ? p.initial : 50))),
    ...(p.description ? { description: p.description } : {}),
  }));
}

function normalizeSetState(setState: any, paramNames: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  if (!setState || typeof setState !== "object") {
    for (const pn of paramNames) result[pn] = 50;
    return result;
  }
  for (const pn of paramNames) {
    result[pn] = Math.max(0, Math.min(100, typeof setState[pn] === "number" ? setState[pn] : 50));
  }
  return result;
}

function normalizeDecisions(decisions: any[], paramNames: string[]): any[] {
  if (!Array.isArray(decisions)) return [];
  return decisions.map((d: any) => ({
    ...d,
    question: String(d.question || d.prompt || d.scenario || "What do you decide?"),
    emoji: d.emoji || "🔬",
    choices: Array.isArray(d.choices) ? d.choices.map((c: any) => {
      const choice: any = {
        text: String(c.text || c.label || c.option || "Choice"),
        explanation: String(c.explanation || c.result || c.outcome || c.feedback || ""),
      };
      const rawState = c.set_state || c.effects || c.impacts || c.state || c.outcomes;
      choice.set_state = normalizeSetState(rawState && typeof rawState === "object" ? rawState : null, paramNames);
      if (c.impacts && typeof c.impacts === "object") choice.impacts = c.impacts;
      if (typeof c.is_best === "boolean") choice.is_best = c.is_best;
      if (c.consequence) choice.consequence = c.consequence;
      return choice;
    }) : [],
  }));
}

function normalizeLab(ld: any, labType: string, title: string, moduleIndex: number): any {
  if (!ld || typeof ld !== "object" || Object.keys(ld).length === 0) return null;

  const normalized = { ...ld };
  normalized.title = normalized.title || title;

  // Auto-detect type from structure
  const lt = labType.toLowerCase().replace(/[\s-]/g, "_");

  if (lt.includes("simulation") || lt.includes("system") || lt.includes("model") ||
      (Array.isArray(normalized.parameters) && Array.isArray(normalized.decisions) && !Array.isArray(normalized.constraints))) {
    // Simulation-style
    normalized.parameters = normalizeParameters(normalized.parameters || normalized.variables || normalized.metrics || []);
    if (!normalized.thresholds || !Array.isArray(normalized.thresholds)) {
      normalized.thresholds = [
        { label: "Excellent", min_percent: 75, message: "Outstanding performance." },
        { label: "Good", min_percent: 50, message: "Solid understanding." },
        { label: "Needs Work", min_percent: 0, message: "Try a different strategy." },
      ];
    }
    const paramNames = normalized.parameters.map((p: any) => p.name);
    if (Array.isArray(normalized.decisions)) {
      normalized.decisions = normalizeDecisions(normalized.decisions, paramNames);
    }
    return normalized;
  }

  if (lt.includes("classification") || (Array.isArray(normalized.categories) && Array.isArray(normalized.items))) {
    if (Array.isArray(normalized.categories)) {
      normalized.categories = normalized.categories.map((cat: any) =>
        typeof cat === "string" ? { name: cat, description: "", color: "#4CAF50" } : { name: String(cat.name || "Category"), description: cat.description || "", color: cat.color || "#4CAF50" }
      );
    }
    if (Array.isArray(normalized.items)) {
      normalized.items = normalized.items.map((item: any) => ({
        content: String(item.content || item.name || item.text || "Item"),
        correctCategory: String(item.correctCategory || item.correct_category || item.correct || item.category || ""),
        explanation: String(item.explanation || item.reason || ""),
      }));
    }
    return normalized;
  }

  if (lt.includes("policy") || lt.includes("optimization") || (Array.isArray(normalized.constraints) && Array.isArray(normalized.parameters))) {
    normalized.parameters = normalizeParameters(normalized.parameters || normalized.variables || []);
    if (!Array.isArray(normalized.constraints)) normalized.constraints = [];
    normalized.constraints = normalized.constraints.map((c: any) => ({
      parameter: String(c.parameter || c.name || "Variable"),
      operator: String(c.operator || ">="),
      value: typeof c.value === "number" ? c.value : 50,
      label: String(c.label || c.description || `Constraint on ${c.parameter}`),
    }));
    if (typeof normalized.max_decisions !== "number") normalized.max_decisions = 3;
    const paramNames = normalized.parameters.map((p: any) => p.name);
    if (Array.isArray(normalized.decisions)) {
      normalized.decisions = normalizeDecisions(normalized.decisions, paramNames);
    }
    return normalized;
  }

  if (lt.includes("ethical") || lt.includes("dilemma") || Array.isArray(normalized.dimensions)) {
    if (Array.isArray(normalized.dimensions)) {
      normalized.dimensions = normalized.dimensions.map((dim: any) => ({
        name: String(dim.name || "Dimension"),
        icon: String(dim.icon || "⚖️"),
        description: String(dim.description || ""),
        default: typeof dim.default === "number" ? dim.default : 50,
      }));
      const dimNames = normalized.dimensions.map((d: any) => d.name);
      if (Array.isArray(normalized.decisions)) {
        for (const d of normalized.decisions) {
          if (!d.choices) d.choices = [];
          for (const c of d.choices) {
            if (!c.impacts) c.impacts = {};
            for (const dn of dimNames) {
              if (typeof c.impacts[dn] !== "number") c.impacts[dn] = 0;
            }
          }
        }
      }
    }
    return normalized;
  }

  if (lt.includes("decision") || normalized.decision_challenge || (normalized.scenario && normalized.choices)) {
    if (!normalized.concept_knowledge) {
      normalized.concept_knowledge = {
        definition: normalized.definition || `${title} concept.`,
        key_ideas: normalized.key_ideas || [`Key aspect of ${title}.`],
        examples: normalized.examples || [],
      };
    }
    if (!normalized.real_world_relevance) {
      normalized.real_world_relevance = { explanation: normalized.relevance || `${title} in practice.`, domain: normalized.domain || "General" };
    }
    if (!normalized.decision_challenge) {
      if (normalized.question && Array.isArray(normalized.options)) {
        normalized.decision_challenge = {
          question: normalized.question,
          options: normalized.options.map((opt: any, i: number) => ({
            id: String(opt.id || String.fromCharCode(97 + i)),
            text: String(opt.text || opt.label || `Option ${i + 1}`),
            consequence: String(opt.consequence || opt.result || ""),
            is_best: typeof opt.is_best === "boolean" ? opt.is_best : i === 0,
          })),
        };
      }
    }
    if (normalized.decision_challenge?.options) {
      normalized.decision_challenge.options = normalized.decision_challenge.options.map((opt: any, i: number) => ({
        id: String(opt.id || String.fromCharCode(97 + i)),
        text: String(opt.text || opt.label || `Option ${i + 1}`),
        consequence: String(opt.consequence || opt.result || ""),
        is_best: typeof opt.is_best === "boolean" ? opt.is_best : i === 0,
      }));
      if (!normalized.decision_challenge.options.some((o: any) => o.is_best) && normalized.decision_challenge.options.length > 0) {
        normalized.decision_challenge.options[0].is_best = true;
      }
    }
    if (typeof normalized.best_decision_explanation !== "string") {
      normalized.best_decision_explanation = normalized.explanation || `The best approach for ${title}.`;
    }
    return normalized;
  }

  if (lt.includes("math") || (Array.isArray(normalized.tasks) && normalized.visual_type)) {
    const MATH_VISUAL_TYPES = ["graph", "chart", "geometry", "solution_steps"];
    if (!MATH_VISUAL_TYPES.includes(normalized.visual_type)) {
      normalized.visual_type = MATH_VISUAL_TYPES[moduleIndex % MATH_VISUAL_TYPES.length];
    }
    if (!Array.isArray(normalized.tasks) || normalized.tasks.length === 0) {
      normalized.tasks = [{ id: "t1", description: `Solve the ${title} problem.`, type: "input", correct_answer: "See solution" }];
    } else {
      normalized.tasks = normalized.tasks.map((t: any, i: number) => ({
        id: t.id || `t${i + 1}`,
        description: String(t.description || t.question || "Solve"),
        type: t.type || "input",
        correct_answer: t.correct_answer || t.answer || "See solution",
        ...(t.options ? { options: t.options } : {}),
      }));
    }
    if (!normalized.hints) normalized.hints = [`Think about ${title} fundamentals.`];
    if (!normalized.solution) normalized.solution = normalized.answer || "See explanation.";
    if (!normalized.solution_explanation) normalized.solution_explanation = `Apply ${title} principles.`;
    if ((normalized.visual_type === "graph" || normalized.visual_type === "chart") && !normalized.graph_data) {
      normalized.graph_data = { type: "line", xLabel: "X", yLabel: "Y", datasets: [{ label: title, data: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 75 }] }] };
    }
    if (normalized.visual_type === "graph" && !Array.isArray(normalized.interactive_params)) {
      normalized.interactive_params = [{ name: "parameter", min: 0, max: 100, default: 50, step: 1 }];
    }
    return normalized;
  }

  // Generic fallback: if it has parameters+decisions, treat as simulation-like
  if (Array.isArray(normalized.parameters || normalized.variables) && Array.isArray(normalized.decisions)) {
    normalized.parameters = normalizeParameters(normalized.parameters || normalized.variables || []);
    const paramNames = normalized.parameters.map((p: any) => p.name);
    normalized.decisions = normalizeDecisions(normalized.decisions, paramNames);
    if (!normalized.thresholds) {
      normalized.thresholds = [
        { label: "Excellent", min_percent: 75, message: "Outstanding." },
        { label: "Good", min_percent: 50, message: "Good progress." },
        { label: "Needs Work", min_percent: 0, message: "Try again." },
      ];
    }
  }

  return normalized;
}

function detectRenderableLabType(ld: any, declaredType: string): string {
  if (!ld || typeof ld !== "object") return "simulation";
  if (Array.isArray(ld.categories) && Array.isArray(ld.items)) return "classification";
  if (Array.isArray(ld.dimensions) && Array.isArray(ld.decisions)) return "ethical_dilemma";
  if (Array.isArray(ld.constraints) && Array.isArray(ld.parameters)) return "policy_optimization";
  if (ld.decision_challenge || (ld.scenario && ld.choices)) return "decision_lab";
  if (Array.isArray(ld.tasks) && ld.visual_type) return "math_lab";
  if (Array.isArray(ld.parameters) && Array.isArray(ld.decisions)) return "simulation";
  // Map known aliases
  const lt = declaredType.toLowerCase().replace(/[\s-]/g, "_");
  const map: Record<string, string> = {
    simulation: "simulation", classification: "classification",
    policy_optimization: "policy_optimization", policy: "policy_optimization",
    ethical_dilemma: "ethical_dilemma", ethical: "ethical_dilemma",
    decision_lab: "decision_lab", decision: "decision_lab",
    math_lab: "math_lab", math: "math_lab",
  };
  return map[lt] || "simulation";
}

/* ===============================
   🔧 SLIDE REPAIR
================================ */

function repairLessonContent(content: string): string {
  if (!content) return "## Lesson\n\nContent is being prepared.";
  let repaired = content;

  if (!repaired.includes("\n---\n")) {
    const sections = repaired.split(/(?=^## )/m).filter(Boolean);
    if (sections.length > 1) repaired = sections.join("\n\n---\n\n");
  }

  const slides = repaired.split(/\n---\n/).map((s: string) => s.trim()).filter(Boolean);
  while (slides.length > 8) {
    let minLen = Infinity, minIdx = 0;
    for (let i = 0; i < slides.length - 1; i++) {
      const combined = slides[i].length + slides[i + 1].length;
      if (combined < minLen) { minLen = combined; minIdx = i; }
    }
    slides[minIdx] = slides[minIdx] + "\n" + slides[minIdx + 1];
    slides.splice(minIdx + 1, 1);
  }

  return slides.join("\n\n---\n\n");
}

/* ===============================
   📄 FILE CONTENT EXTRACTION
================================ */

async function extractFileContent(filePath: string, supabaseAdmin: any): Promise<{ text?: string; imageBase64?: string; mimeType?: string }> {
  const { data, error } = await supabaseAdmin.storage.from("course-uploads").download(filePath);
  if (error || !data) { console.error("Failed to download file:", error); return {}; }

  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const imageExts = ["png", "jpg", "jpeg", "webp"];
  const textExts = ["txt", "md", "csv"];

  if (imageExts.includes(ext)) {
    const buffer = await data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
    return { imageBase64: base64, mimeType: mimeMap[ext] || "image/png" };
  }
  if (textExts.includes(ext)) { return { text: (await data.text()).slice(0, 50000) }; }
  if (ext === "pdf") {
    try {
      const text = await data.text();
      const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").trim();
      if (cleaned.length > 100) return { text: cleaned.slice(0, 50000) };
      const buffer = await data.arrayBuffer();
      return { imageBase64: btoa(String.fromCharCode(...new Uint8Array(buffer))), mimeType: "application/pdf" };
    } catch { return {}; }
  }
  return {};
}

/* ===============================
   🚀 PHASE 1: GENERATE OUTLINE + LESSONS + QUIZZES
================================ */

async function generateOutline(apiKey: string, topic: string, userContent: any, hasFile: boolean): Promise<any> {
  console.log("[Phase 1] Generating course outline, lessons, and quizzes...");

  const systemPrompt = `You are an expert educational designer for Repend, a dynamic learning platform.

Generate a course OUTLINE with lessons and quizzes. Do NOT generate lab_data yet — just specify what lab_type each module should have.

=== LESSON FORMAT ===
Slides separated by "---". Use emoji headers (🔥🎯📊💡🧪🧠✅⚡🛠📈🌎🎭), tables, short paragraphs, bullet points.
7-slide sequence: 🎯Objective → 🧠Core Concept → 📊Visual Summary → 🌎Real-World → 🧪Lab Preview → 🧠Challenge → ✅Takeaways

=== LAB TYPE SELECTION ===
Choose the BEST lab type for each concept. Use variety — at least 3 different types across modules:
- simulation: Interactive system with parameters and decisions (good for systems, processes, dynamics)
- classification: Sort items into categories (good for taxonomy, identification, comparison)
- policy_optimization: Achieve goals within constraints (good for resource allocation, planning)
- ethical_dilemma: Navigate moral tradeoffs across dimensions (good for ethics, policy, social issues)
- decision_lab: Scenario-based strategic choice (good for strategy, case studies, problem-solving)
- math_lab: Visual math exploration with graphs/geometry (good for math, physics, data)

=== QUIZ RULES ===
8-10 questions per module. Mix: conceptual, applied, scenario-based. No "all of the above".

${hasFile ? "IMPORTANT: Base ALL content on the uploaded SOURCE MATERIAL." : ""}
Generate 4-6 modules.`;

  const aiData = await callAI(apiKey, {
    model: "google/gemini-3-flash-preview",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    tools: [{
      type: "function",
      function: {
        name: "create_course_outline",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            modules: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  lesson_content: { type: "string", description: "Markdown lesson with --- slide separators" },
                  youtube_query: { type: "string" },
                  youtube_title: { type: "string" },
                  lab_type: { type: "string", description: "simulation, classification, policy_optimization, ethical_dilemma, decision_lab, or math_lab" },
                  lab_title: { type: "string", description: "Title for the lab" },
                  lab_description: { type: "string", description: "Brief description of what the lab will cover" },
                  quiz: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correct: { type: "number" },
                        explanation: { type: "string" },
                      },
                      required: ["question", "options", "correct", "explanation"],
                    },
                  },
                },
                required: ["title", "lesson_content", "lab_type", "quiz"],
              },
            },
          },
          required: ["title", "description", "modules"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "create_course_outline" } },
  });

  const parsed = extractToolArgs(aiData);

  // Repair lessons
  if (parsed.modules) {
    for (const mod of parsed.modules) {
      mod.lesson_content = repairLessonContent(mod.lesson_content || "");
      if (!mod.quiz || !Array.isArray(mod.quiz) || mod.quiz.length === 0) {
        mod.quiz = [{ question: `What is a key concept from "${mod.title}"?`, options: ["A", "B", "C", "D"], correct: 0, explanation: "Review the lesson." }];
      }
    }
  }

  return OutlineSchema.parse(parsed);
}

/* ===============================
   🚀 PHASE 2: GENERATE INDIVIDUAL LABS
================================ */

async function generateLabForModule(apiKey: string, topic: string, moduleTitle: string, labType: string, labDescription: string, moduleIndex: number): Promise<{ lab_type: string; lab_data: any }> {
  console.log(`[Phase 2] Generating ${labType} lab for: "${moduleTitle}"...`);

  const labPrompts: Record<string, string> = {
    simulation: `Generate a SIMULATION lab for the concept "${moduleTitle}" in the topic "${topic}".

REQUIRED STRUCTURE:
{
  "parameters": [{"name": "DOMAIN-SPECIFIC name", "icon": "emoji", "unit": "%", "min": 0, "max": 100, "default": 50}],
  "decisions": [{"question": "scenario question", "emoji": "🔬", "choices": [{"text": "choice", "explanation": "what happens", "set_state": {"param1": value, "param2": value, ...}}]}],
  "thresholds": [{"label": "Excellent", "min_percent": 75, "message": "..."}, {"label": "Good", "min_percent": 50, "message": "..."}, {"label": "Needs Work", "min_percent": 0, "message": "..."}],
  "repend_intro": {"relevance": "where used IRL", "role": "your role", "scenario_context": "2-3 sentence scene", "information": ["fact1", "fact2", "fact3"], "objective": "1 sentence goal"},
  "key_insight": "core lesson learned"
}

RULES:
- 3-5 DOMAIN-SPECIFIC parameters (NOT generic like Efficiency/Quality/Cost)
- 3-4 decisions with 2-3 choices each
- Every choice must set ALL parameters to specific values 0-100
- Real tradeoffs — no choice should improve everything
- Parameters must reflect REAL system variables for ${topic}`,

    classification: `Generate a CLASSIFICATION lab for "${moduleTitle}" in "${topic}".

REQUIRED STRUCTURE:
{
  "categories": [{"name": "Category Name", "description": "what belongs here", "color": "#hex"}],
  "items": [{"content": "item to classify", "correctCategory": "Category Name", "explanation": "why it belongs"}],
  "repend_intro": {"relevance": "...", "role": "...", "scenario_context": "...", "information": ["..."], "objective": "..."},
  "key_insight": "..."
}

RULES:
- 3-5 categories with distinct descriptions
- 8-12 items to classify
- Items should require real understanding, not be obvious`,

    policy_optimization: `Generate a POLICY OPTIMIZATION lab for "${moduleTitle}" in "${topic}".

REQUIRED STRUCTURE:
{
  "parameters": [{"name": "domain-specific", "icon": "emoji", "unit": "%", "min": 0, "max": 100, "default": 50}],
  "constraints": [{"parameter": "param name", "operator": ">=", "value": 30, "label": "Keep X above 30%"}],
  "max_decisions": 4,
  "decisions": [{"question": "...", "emoji": "🔬", "choices": [{"text": "...", "explanation": "...", "set_state": {"param1": val}}]}],
  "repend_intro": {"relevance": "...", "role": "...", "scenario_context": "...", "information": ["..."], "objective": "..."},
  "key_insight": "..."
}

RULES:
- 3-5 parameters with meaningful constraints
- Some choices should violate constraints, creating tension
- Domain-specific variables only`,

    ethical_dilemma: `Generate an ETHICAL DILEMMA lab for "${moduleTitle}" in "${topic}".

REQUIRED STRUCTURE:
{
  "dimensions": [{"name": "Dimension", "icon": "emoji", "description": "what this measures", "default": 50}],
  "decisions": [{"question": "dilemma scenario", "choices": [{"text": "choice", "explanation": "...", "impacts": {"Dimension": delta_number}}]}],
  "repend_intro": {"relevance": "...", "role": "...", "scenario_context": "...", "information": ["..."], "objective": "..."},
  "key_insight": "..."
}

RULES:
- 3-4 ethical dimensions with clear tension
- 3-4 dilemma decisions with genuine tradeoffs
- No choice should be obviously "correct"
- impacts are DELTAS (positive or negative integers like +15, -10)`,

    decision_lab: `Generate a DECISION LAB for "${moduleTitle}" in "${topic}".

REQUIRED STRUCTURE:
{
  "concept_knowledge": {"definition": "...", "key_ideas": ["..."], "examples": ["..."]},
  "real_world_relevance": {"explanation": "...", "domain": "..."},
  "scenario": "detailed scenario description",
  "decision_challenge": {"question": "what would you do?", "options": [{"id": "a", "text": "...", "consequence": "what happens...", "is_best": true/false}]},
  "best_decision_explanation": "why the best option works"
}

RULES:
- Realistic scenario tied to ${topic}
- 3-4 options with distinct consequences
- Exactly one option marked is_best: true`,

    math_lab: `Generate a MATH LAB for "${moduleTitle}" in "${topic}".

REQUIRED STRUCTURE:
{
  "visual_type": "graph" or "chart" or "geometry" or "solution_steps",
  "title": "...",
  "objective": "...",
  "concept_overview": "...",
  "scenario": "problem setup",
  "instructions": "what to do",
  "tasks": [{"id": "t1", "description": "task", "type": "input", "correct_answer": "answer"}],
  "hints": ["hint1"],
  "solution": "final answer",
  "solution_explanation": "step by step",
  "graph_data": {"type": "line", "xLabel": "...", "yLabel": "...", "datasets": [{"label": "...", "data": [{"x": 0, "y": 0}]}]},
  "interactive_params": [{"name": "...", "min": 0, "max": 100, "default": 50, "step": 1}]
}

RULES:
- Domain-specific math problem
- 2-4 tasks with real calculations
- Include graph_data even if visual_type is different`,
  };

  const labPrompt = labPrompts[labType] || labPrompts.simulation;

  const aiData = await callAI(apiKey, {
    model: "google/gemini-3-flash-preview",
    temperature: 0.6,
    messages: [
      { role: "system", content: `You generate interactive lab data for educational simulations. Return ONLY the lab data structure via the tool call. Be creative and domain-specific. ${labDescription ? `Lab description: ${labDescription}` : ""}` },
      { role: "user", content: labPrompt },
    ],
    tools: [{
      type: "function",
      function: {
        name: "create_lab",
        description: "Create interactive lab data",
        parameters: {
          type: "object",
          properties: {
            lab_data: { type: "object", description: "The complete lab data structure" },
          },
          required: ["lab_data"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "create_lab" } },
  });

  const result = extractToolArgs(aiData);
  const rawLabData = result.lab_data || result;

  // Normalize the lab data
  const normalizedLabData = normalizeLab(rawLabData, labType, moduleTitle, moduleIndex);

  if (!normalizedLabData) {
    console.warn(`[Phase 2] Lab generation returned empty for: "${moduleTitle}"`);
    return { lab_type: labType, lab_data: { title: moduleTitle, description: `Lab for ${moduleTitle}`, empty: true } };
  }

  // Detect the best renderable type
  const renderableType = detectRenderableLabType(normalizedLabData, labType);
  console.log(`[Phase 2] Lab generated for "${moduleTitle}" → type: ${renderableType}, params: ${normalizedLabData.parameters?.length || 0}`);

  return { lab_type: renderableType, lab_data: normalizedLabData };
}

/* ===============================
   🚀 MAIN HANDLER
================================ */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { topic, filePath } = await req.json();
    if (!topic?.trim()) throw new Error("Topic is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Extract file content if provided
    let fileContent: { text?: string; imageBase64?: string; mimeType?: string } = {};
    if (filePath) {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      fileContent = await extractFileContent(filePath, supabaseAdmin);
      console.log(`[FileUpload] Extracted: hasText=${!!fileContent.text}, hasImage=${!!fileContent.imageBase64}`);
    }

    // Create course row
    const { data: course } = await supabase
      .from("courses")
      .insert({ user_id: user.id, title: topic.trim(), topic: topic.trim(), status: "generating" })
      .select().single();

    // Build user message content
    let userContent: any;
    if (fileContent.imageBase64 && fileContent.mimeType) {
      userContent = [
        { type: "image_url", image_url: { url: `data:${fileContent.mimeType};base64,${fileContent.imageBase64}` } },
        { type: "text", text: `Create a course on: ${topic}\n\nThe attached image/document is the SOURCE MATERIAL.` },
      ];
    } else if (fileContent.text) {
      userContent = `Create a course on: ${topic}\n\nSOURCE MATERIAL:\n\n${fileContent.text}`;
    } else {
      userContent = `Create a course on: ${topic}`;
    }

    // ===== PHASE 1: Outline + Lessons + Quizzes =====
    const outline = await generateOutline(LOVABLE_API_KEY, topic, userContent, !!filePath);
    console.log(`[Phase 1] Complete: "${outline.title}" with ${outline.modules.length} modules`);

    // Update course title/description
    await supabase.from("courses").update({ title: outline.title, description: outline.description, status: "generating" }).eq("id", course.id);

    // Insert modules WITHOUT lab_data first
    const moduleRows = outline.modules.map((mod: any, index: number) => ({
      course_id: course.id,
      module_order: index + 1,
      title: mod.title,
      lesson_content: mod.lesson_content,
      youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.youtube_query || mod.title)}`,
      youtube_title: mod.youtube_title || mod.title,
      lab_type: mod.lab_type || "simulation",
      lab_title: mod.lab_title || null,
      lab_description: mod.lab_description || null,
      lab_data: null, // Will be filled in Phase 2
      quiz: mod.quiz,
    }));

    const { data: insertedModules } = await supabase.from("course_modules").insert(moduleRows).select("id, title, lab_type, lab_description, module_order");
    console.log(`[Phase 1] Inserted ${insertedModules?.length || 0} modules`);

    // ===== PHASE 2: Generate Labs Individually =====
    if (insertedModules && insertedModules.length > 0) {
      // Generate labs sequentially to avoid rate limits
      for (let i = 0; i < insertedModules.length; i++) {
        const mod = insertedModules[i];
        try {
          const { lab_type, lab_data } = await generateLabForModule(
            LOVABLE_API_KEY,
            topic,
            mod.title,
            mod.lab_type || "simulation",
            mod.lab_description || "",
            i,
          );

          await supabase.from("course_modules").update({ lab_type, lab_data }).eq("id", mod.id);
          console.log(`[Phase 2] Lab ${i + 1}/${insertedModules.length} saved for: "${mod.title}"`);

          // Small delay between lab generations to avoid rate limits
          if (i < insertedModules.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (labErr: any) {
          console.error(`[Phase 2] Lab generation failed for "${mod.title}":`, labErr.message);
          // Save a minimal lab so the module isn't broken
          await supabase.from("course_modules").update({
            lab_data: { title: mod.title, description: `Lab for ${mod.title}`, empty: true, error: labErr.message },
          }).eq("id", mod.id);
        }
      }
    }

    // Mark course as ready
    await supabase.from("courses").update({ status: "ready" }).eq("id", course.id);

    // Track usage
    if (filePath) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: existing } = await supabaseAdmin.from("usage_tracking").select("id, file_courses_generated").eq("user_id", user.id).eq("month", currentMonth).single();
      if (existing) {
        await supabaseAdmin.from("usage_tracking").update({ file_courses_generated: (existing.file_courses_generated || 0) + 1 }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("usage_tracking").insert({ user_id: user.id, month: currentMonth, file_courses_generated: 1, courses_generated: 1 });
      }
    }

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("COURSE GENERATION ERROR:", error);

    if (error instanceof z.ZodError) {
      console.error("ZOD DETAILS:", JSON.stringify(error.issues, null, 2));
      return new Response(JSON.stringify({ error: "Course generation produced invalid data. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
