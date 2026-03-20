import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
   🚀 PHASE 1: OUTLINE + LESSONS + QUIZZES (no labs)
================================ */

async function generateOutline(apiKey: string, topic: string, userContent: any, hasFile: boolean): Promise<any> {
  console.log("[Phase 1] Generating course outline, lessons, and quizzes...");

  const systemPrompt = `You are an expert educational designer for Repend, a decision-based interactive learning platform.

Generate a course OUTLINE with lessons and quizzes. Do NOT generate lab data — just describe what each lab should teach.

=== LESSON FORMAT ===
Slides separated by "---". Use emoji headers (🔥🎯📊💡🧪🧠✅⚡🛠📈🌎🎭), tables, short paragraphs, bullet points.
7-slide sequence: 🎯Objective → 🧠Core Concept → 📊Visual Summary → 🌎Real-World → 🧪Lab Preview → 🧠Challenge → ✅Takeaways

=== LAB CONCEPT ===
For each module, describe what concept the lab should explore. Do NOT pick a lab_type — the AI will design the interaction later.
Just describe: what concept to simulate, what tradeoffs exist, what decisions students should face.

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
                  lab_concept: { type: "string", description: "What concept the lab should explore, what tradeoffs exist, what decisions students face" },
                  lab_title: { type: "string" },
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
                required: ["title", "lesson_content", "lab_concept", "quiz"],
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
  if (parsed.modules) {
    for (const mod of parsed.modules) {
      mod.lesson_content = repairLessonContent(mod.lesson_content || "");
      if (!mod.quiz || !Array.isArray(mod.quiz) || mod.quiz.length === 0) {
        mod.quiz = [{ question: `What is a key concept from "${mod.title}"?`, options: ["A", "B", "C", "D"], correct: 0, explanation: "Review the lesson." }];
      }
    }
  }
  return parsed;
}

/* ===============================
   🚀 PHASE 2: CONCEPT ANALYSIS → LAB BLUEPRINT
   
   This is the core innovation. Instead of picking a lab_type and filling a template,
   the AI analyzes the concept and designs a custom lab blueprint with:
   - scenario context
   - variables (domain-specific)
   - interaction blocks (what UI primitives to use)
   - tasks
   - feedback logic
   - completion rules
================================ */

async function generateLabBlueprint(
  apiKey: string,
  topic: string,
  moduleTitle: string,
  labConcept: string,
  moduleIndex: number,
): Promise<{ blueprint: any; error?: string }> {
  console.log(`[Phase 2] Generating lab blueprint for: "${moduleTitle}"...`);

  const systemPrompt = `You are a lab designer for Repend, a decision-based interactive learning platform.

Your job: Design a UNIQUE interactive lab blueprint for a specific concept. You are NOT constrained to any template.
You design the lab from scratch based on what interaction best teaches this concept.

=== BLUEPRINT SCHEMA ===
Return a lab blueprint with these fields:

{
  "title": "Lab title",
  "kind": "a unique descriptive name like 'ecosystem_balance', 'market_simulator', 'pedigree_analysis', 'reaction_optimizer', etc.",
  "scenario": "2-3 sentence real-world scenario the student is placed in",
  "learning_goal": "What the student should understand after completing this lab",
  
  "variables": [
    {
      "name": "Domain-Specific Variable Name",
      "icon": "emoji",
      "unit": "unit like %, km, $, etc",
      "min": 0,
      "max": 100,
      "default": 50,
      "description": "What this variable represents"
    }
  ],
  
  "blocks": [
    // UI blocks rendered in order. Types:
    
    // TEXT block - displays information
    { "type": "text", "content": "markdown text to display" },
    
    // CHOICE_SET block - student picks from options
    {
      "type": "choice_set",
      "question": "What would you do?",
      "emoji": "🔬",
      "choices": [
        {
          "text": "Option description",
          "feedback": "What happens when you pick this",
          "effects": { "Variable Name": 75, "Other Variable": 30 },
          "is_best": false
        }
      ]
    },
    
    // SLIDER block - student adjusts a value
    {
      "type": "slider",
      "variable": "Variable Name",
      "prompt": "Adjust the temperature to find the optimal reaction point",
      "interactive": true
    },
    
    // TABLE block - displays comparison data
    {
      "type": "table",
      "title": "Comparison",
      "headers": ["Factor", "Option A", "Option B"],
      "rows": [["Cost", "$100", "$200"], ["Efficiency", "80%", "95%"]]
    },
    
    // STEP_TASK block - sequential tasks
    {
      "type": "step_task",
      "tasks": [
        { "id": "t1", "prompt": "Calculate the energy needed", "type": "input", "correct_answer": "42 kJ", "hint": "Use Q = mcΔT" },
        { "id": "t2", "prompt": "Which catalyst is most efficient?", "type": "choice", "options": ["Platinum", "Iron", "Nickel"], "correct_answer": "Platinum", "explanation": "Platinum has the lowest activation energy" }
      ]
    },
    
    // CHART block - visual data display
    {
      "type": "chart",
      "chart_type": "line",
      "title": "Chart title",
      "x_label": "X axis",
      "y_label": "Y axis",
      "datasets": [{ "label": "Series", "data": [{"x": 0, "y": 10}, {"x": 50, "y": 60}] }]
    },
    
    // INSIGHT block - key takeaway shown at end
    { "type": "insight", "content": "The key insight from this lab..." }
  ],
  
  "completion_rule": "all_blocks" or "all_choices" or "all_tasks",
  
  "intro": {
    "relevance": "Where this concept is used in real life",
    "role": "What role the student plays",
    "scenario_context": "2-3 sentence scene-setting",
    "information": ["Key fact 1", "Key fact 2", "Key fact 3"],
    "objective": "What the student must accomplish"
  }
}

=== RULES ===
1. Variables must be DOMAIN-SPECIFIC to ${topic}. Never use generic names like "Efficiency", "Quality", "Cost".
2. Design at least 3 choice_set blocks with real tradeoffs — no choice should improve everything.
3. Every choice effect must set ALL variables to specific values.
4. Include at least one step_task with 2-3 tasks.
5. The lab should feel like a real professional scenario, not a textbook exercise.
6. Mix block types — don't just use choice_sets. Use tables, charts, text, and step_tasks.
7. The "kind" field should be unique and descriptive — it describes WHAT this lab IS.
8. Be creative! Each lab should feel different.`;

  const blueprintToolSchema = {
    type: "function" as const,
    function: {
      name: "create_lab_blueprint",
      description: "Create an interactive lab blueprint with UI blocks, variables, and scenario",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Lab title" },
          kind: { type: "string", description: "Unique descriptive kind like 'ecosystem_balance', 'reaction_optimizer', 'market_simulator'" },
          scenario: { type: "string", description: "2-3 sentence real-world scenario the student is placed in" },
          learning_goal: { type: "string", description: "What the student should understand after completing this lab" },
          variables: {
            type: "array",
            description: "Domain-specific variables that change based on student decisions",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                icon: { type: "string", description: "Single emoji" },
                unit: { type: "string", description: "Unit like %, km, $, kJ" },
                min: { type: "number" },
                max: { type: "number" },
                default: { type: "number" },
                description: { type: "string" },
              },
              required: ["name", "icon", "unit", "min", "max", "default"],
            },
          },
          blocks: {
            type: "array",
            description: "Ordered UI blocks. Must include at least 3 blocks mixing different types.",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["text", "choice_set", "slider", "table", "step_task", "chart", "insight"] },
                content: { type: "string", description: "For text/insight blocks" },
                question: { type: "string", description: "For choice_set blocks" },
                emoji: { type: "string", description: "For choice_set blocks" },
                choices: {
                  type: "array",
                  description: "For choice_set blocks",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      feedback: { type: "string" },
                      effects: { type: "object", description: "Maps variable name → new value (0-100)" },
                      is_best: { type: "boolean" },
                    },
                    required: ["text", "feedback", "effects"],
                  },
                },
                variable: { type: "string", description: "For slider blocks" },
                prompt: { type: "string", description: "For slider blocks" },
                interactive: { type: "boolean", description: "For slider blocks" },
                title: { type: "string", description: "For table/chart blocks" },
                headers: { type: "array", items: { type: "string" }, description: "For table blocks" },
                rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "For table blocks" },
                tasks: {
                  type: "array",
                  description: "For step_task blocks",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      prompt: { type: "string" },
                      type: { type: "string", enum: ["input", "choice"] },
                      correct_answer: { type: "string" },
                      hint: { type: "string" },
                      explanation: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                    },
                    required: ["id", "prompt", "type", "correct_answer"],
                  },
                },
                chart_type: { type: "string", enum: ["line", "bar", "area"], description: "For chart blocks" },
                x_label: { type: "string", description: "For chart blocks" },
                y_label: { type: "string", description: "For chart blocks" },
                datasets: {
                  type: "array",
                  description: "For chart blocks",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      data: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } } },
                    },
                  },
                },
              },
              required: ["type"],
            },
          },
          completion_rule: { type: "string", enum: ["all_blocks", "all_choices", "all_tasks"] },
          intro: {
            type: "object",
            properties: {
              relevance: { type: "string" },
              role: { type: "string" },
              scenario_context: { type: "string" },
              information: { type: "array", items: { type: "string" } },
              objective: { type: "string" },
            },
          },
        },
        required: ["title", "kind", "scenario", "variables", "blocks", "completion_rule"],
      },
    },
  };

  const userPrompt = `Design a lab blueprint for the concept: "${moduleTitle}"\n\nTopic: ${topic}\nLab concept hint: ${labConcept}\n\nDesign a unique, creative, domain-specific interactive lab. You MUST return at least 3 blocks mixing different types (choice_set, step_task, table, text, chart, insight). Every choice_set must set ALL variables.`;

  try {
    // Attempt 1: Full generation
    let aiData = await callAI(apiKey, {
      model: "google/gemini-2.5-pro",
      temperature: 0.7,
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [blueprintToolSchema],
      tool_choice: { type: "function", function: { name: "create_lab_blueprint" } },
    });

    let result = extractToolArgs(aiData);
    let blueprint = result.blueprint || result;

    // Validate minimum structure
    if (!blueprint || typeof blueprint !== "object") {
      return { blueprint: null, error: "AI returned empty blueprint" };
    }

    // Repair: ensure blocks array exists
    if (!Array.isArray(blueprint.blocks)) {
      blueprint.blocks = [];
      if (Array.isArray(blueprint.decisions)) {
        for (const d of blueprint.decisions) {
          blueprint.blocks.push({
            type: "choice_set",
            question: d.question || d.prompt || "What do you decide?",
            emoji: d.emoji || "🔬",
            choices: Array.isArray(d.choices) ? d.choices.map((c: any) => ({
              text: c.text || c.label || "Choice",
              feedback: c.explanation || c.feedback || c.consequence || "",
              effects: c.set_state || c.effects || {},
              is_best: c.is_best || false,
            })) : [],
          });
        }
      }
      if (Array.isArray(blueprint.tasks)) {
        blueprint.blocks.push({
          type: "step_task",
          tasks: blueprint.tasks.map((t: any, i: number) => ({
            id: t.id || `t${i + 1}`,
            prompt: t.description || t.prompt || t.question || "Task",
            type: t.type || "input",
            correct_answer: t.correct_answer || t.answer || "",
            ...(t.options ? { options: t.options } : {}),
            ...(t.hint ? { hint: t.hint } : {}),
            ...(t.explanation ? { explanation: t.explanation } : {}),
          })),
        });
      }
    }

    // Retry if blocks are still empty
    if (!blueprint.blocks || blueprint.blocks.length === 0) {
      console.warn(`[Phase 2] Attempt 1 returned 0 blocks for "${moduleTitle}". Retrying with direct prompt...`);
      
      const retryPrompt = `You MUST generate a lab blueprint with AT LEAST 3 blocks for: "${moduleTitle}" (${topic}).

Return EXACTLY this structure with real content:
- 1 text block with a scenario description
- 2 choice_set blocks with 3 choices each, each choice must have effects setting all variables
- 1 step_task block with 2 tasks
- 1 insight block with the key takeaway

Variables must be domain-specific to ${topic}. Create at least 3 variables.
Do NOT return empty blocks or empty arrays.`;

      aiData = await callAI(apiKey, {
        model: "google/gemini-2.5-pro",
        temperature: 0.5,
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: retryPrompt },
        ],
        tools: [blueprintToolSchema],
        tool_choice: { type: "function", function: { name: "create_lab_blueprint" } },
      });

      result = extractToolArgs(aiData);
      blueprint = result.blueprint || result;

      if (!blueprint || typeof blueprint !== "object") {
        return { blueprint: null, error: "Retry also returned empty blueprint" };
      }
      if (!Array.isArray(blueprint.blocks)) blueprint.blocks = [];
    }

    // If STILL empty after retry, fail cleanly
    if (blueprint.blocks.length === 0) {
      return { blueprint: null, error: "Blueprint generation produced no blocks after 2 attempts" };
    }

    // Repair: ensure variables array
    if (!Array.isArray(blueprint.variables)) {
      blueprint.variables = [];
      if (Array.isArray(blueprint.parameters)) {
        blueprint.variables = blueprint.parameters.map((p: any) => ({
          name: String(p.name || p.label || "Variable"),
          icon: String(p.icon || p.emoji || "📊"),
          unit: String(p.unit || "%"),
          min: typeof p.min === "number" ? p.min : 0,
          max: typeof p.max === "number" ? p.max : 100,
          default: typeof p.default === "number" ? p.default : 50,
          description: p.description || "",
        }));
      }
    }

    // Ensure variable defaults are clamped
    for (const v of blueprint.variables) {
      v.min = typeof v.min === "number" ? v.min : 0;
      v.max = typeof v.max === "number" ? v.max : 100;
      v.default = Math.max(v.min, Math.min(v.max, typeof v.default === "number" ? v.default : 50));
    }

    // Ensure choice effects reference all variables
    const varNames = blueprint.variables.map((v: any) => v.name);
    for (const block of blueprint.blocks) {
      if (block.type === "choice_set" && Array.isArray(block.choices)) {
        for (const choice of block.choices) {
          if (!choice.effects || typeof choice.effects !== "object") {
            choice.effects = {};
          }
          for (const vn of varNames) {
            if (typeof choice.effects[vn] !== "number") {
              choice.effects[vn] = 50;
            } else {
              choice.effects[vn] = Math.max(0, Math.min(100, choice.effects[vn]));
            }
          }
        }
      }
    }

    // Add insight block at end if missing
    const hasInsight = blueprint.blocks.some((b: any) => b.type === "insight");
    if (!hasInsight && blueprint.key_insight) {
      blueprint.blocks.push({ type: "insight", content: blueprint.key_insight });
    }

    blueprint.title = blueprint.title || moduleTitle;
    blueprint.kind = blueprint.kind || "dynamic_lab";
    blueprint.completion_rule = blueprint.completion_rule || "all_choices";

    console.log(`[Phase 2] Blueprint generated for "${moduleTitle}" → kind: ${blueprint.kind}, blocks: ${blueprint.blocks.length}, vars: ${blueprint.variables.length}`);
    return { blueprint };
  } catch (e: any) {
    console.error(`[Phase 2] Blueprint generation failed for "${moduleTitle}":`, e.message);
    return { blueprint: null, error: e.message };
  }
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

    // Insert modules with lab_generation_status = 'pending'
    const moduleRows = outline.modules.map((mod: any, index: number) => ({
      course_id: course.id,
      module_order: index + 1,
      title: mod.title,
      lesson_content: mod.lesson_content,
      youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mod.youtube_query || mod.title)}`,
      youtube_title: mod.youtube_title || mod.title,
      lab_type: "dynamic", // No more fixed types
      lab_title: mod.lab_title || mod.title,
      lab_description: mod.lab_concept || null,
      lab_data: null,
      lab_generation_status: "pending",
      lab_blueprint: null,
      lab_error: null,
      quiz: mod.quiz,
    }));

    const { data: insertedModules } = await supabase.from("course_modules").insert(moduleRows).select("id, title, lab_description, module_order");
    console.log(`[Phase 1] Inserted ${insertedModules?.length || 0} modules`);

    // ===== PHASE 2: Generate Lab Blueprints Individually =====
    if (insertedModules && insertedModules.length > 0) {
      for (let i = 0; i < insertedModules.length; i++) {
        const mod = insertedModules[i];
        
        // Update status to generating
        await supabase.from("course_modules").update({ lab_generation_status: "generating" }).eq("id", mod.id);

        const { blueprint, error } = await generateLabBlueprint(
          LOVABLE_API_KEY,
          topic,
          mod.title,
          mod.lab_description || mod.title,
          i,
        );

        if (blueprint && blueprint.blocks?.length > 0) {
          await supabase.from("course_modules").update({
            lab_data: blueprint,
            lab_blueprint: blueprint,
            lab_type: "dynamic",
            lab_generation_status: "done",
            lab_error: null,
          }).eq("id", mod.id);
          console.log(`[Phase 2] Lab ${i + 1}/${insertedModules.length} saved for: "${mod.title}"`);
        } else {
          // Mark as failed — NOT empty. Can be retried.
          await supabase.from("course_modules").update({
            lab_generation_status: "failed",
            lab_error: error || "Blueprint generation produced no blocks",
            lab_data: null,
          }).eq("id", mod.id);
          console.warn(`[Phase 2] Lab ${i + 1} FAILED for: "${mod.title}" — ${error}`);
        }

        // Delay between generations
        if (i < insertedModules.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
