import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ===============================
   🔧 ZOD SCHEMAS & VALIDATORS
================================ */

const CourseSchema = z.object({
  title: z.string(),
  description: z.string(),
  modules: z.array(
    z.object({
      title: z.string(),
      lesson_content: z.string(),
      youtube_query: z.string().optional(),
      youtube_title: z.string().optional(),
      lab_type: z.enum(["simulation", "classification", "policy_optimization", "ethical_dilemma", "decision_lab", "math_lab"]),
      lab_data: z.any(),
      quiz: z.array(
        z.object({
          question: z.string(),
          options: z.array(z.string()),
          correct: z.number(),
          explanation: z.string(),
        }),
      ),
    }),
  ),
});

/* ===============================
   🔧 VALIDATORS
================================ */

function isValidSimulation(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!Array.isArray(ld.parameters) || ld.parameters.length !== 3) return false;
  for (const p of ld.parameters) {
    if (typeof p.name !== "string" || typeof p.min !== "number" || typeof p.max !== "number" || typeof p.default !== "number") return false;
  }
  if (!Array.isArray(ld.thresholds) || ld.thresholds.length !== 3) return false;
  if (!Array.isArray(ld.decisions) || ld.decisions.length < 2) return false;
  const paramNames = ld.parameters.map((p: any) => p.name);
  for (const d of ld.decisions) {
    if (!Array.isArray(d.choices)) return false;
    for (const c of d.choices) {
      if (!c.set_state || typeof c.set_state !== "object") return false;
      for (const pn of paramNames) {
        if (typeof c.set_state[pn] !== "number") return false;
      }
    }
  }
  return true;
}

function isValidClassification(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!Array.isArray(ld.categories) || ld.categories.length < 3) return false;
  for (const cat of ld.categories) {
    if (typeof cat.name !== "string") return false;
  }
  if (!Array.isArray(ld.items) || ld.items.length < 5) return false;
  for (const item of ld.items) {
    const content = item.content || item.name;
    const category = item.correctCategory || item.correct_category;
    if (typeof content !== "string" || typeof category !== "string") return false;
  }
  return true;
}

function isValidPolicyOptimization(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!Array.isArray(ld.parameters) || ld.parameters.length < 3) return false;
  for (const p of ld.parameters) {
    if (typeof p.name !== "string" || typeof p.min !== "number" || typeof p.max !== "number" || typeof p.default !== "number") return false;
  }
  if (!Array.isArray(ld.constraints) || ld.constraints.length < 2) return false;
  for (const c of ld.constraints) {
    if (typeof c.parameter !== "string" || typeof c.operator !== "string" || typeof c.value !== "number" || typeof c.label !== "string") return false;
  }
  if (typeof ld.max_decisions !== "number") return false;
  if (!Array.isArray(ld.decisions) || ld.decisions.length < 2) return false;
  const paramNames = ld.parameters.map((p: any) => p.name);
  for (const d of ld.decisions) {
    if (!Array.isArray(d.choices)) return false;
    for (const ch of d.choices) {
      if (!ch.set_state || typeof ch.set_state !== "object") return false;
      for (const pn of paramNames) {
        if (typeof ch.set_state[pn] !== "number") return false;
      }
    }
  }
  return true;
}

function isValidEthicalDilemma(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (!Array.isArray(ld.dimensions) || ld.dimensions.length < 3) return false;
  for (const dim of ld.dimensions) {
    if (typeof dim.name !== "string" || typeof dim.icon !== "string" || typeof dim.description !== "string") return false;
  }
  if (!Array.isArray(ld.decisions) || ld.decisions.length < 3) return false;
  const dimNames = ld.dimensions.map((d: any) => d.name);
  for (const d of ld.decisions) {
    if (!Array.isArray(d.choices)) return false;
    for (const c of d.choices) {
      if (!c.impacts || typeof c.impacts !== "object") return false;
      for (const dn of dimNames) {
        if (typeof c.impacts[dn] !== "number") return false;
      }
    }
  }
  return true;
}

function isValidDecisionLab(ld: any): boolean {
  if (!ld || typeof ld !== "object") return false;
  if (typeof ld.scenario !== "string" || ld.scenario.length < 20) return false;
  if (!Array.isArray(ld.constraints) || ld.constraints.length < 2) return false;
  if (typeof ld.decision_prompt !== "string") return false;
  if (typeof ld.twist !== "string" || ld.twist.length < 10) return false;
  if (typeof ld.reflection_question !== "string") return false;
  return true;
}

/* ===============================
   🔧 FALLBACK GENERATORS
================================ */

function generateSimulationFallback(title: string) {
  const t = title || "Topic";
  const p1 = `${t} Efficiency`;
  const p2 = `${t} Quality`;
  const p3 = `${t} Sustainability`;
  return {
    parameters: [
      { name: p1, icon: "📊", unit: "%", min: 0, max: 100, default: 50 },
      { name: p2, icon: "📈", unit: "%", min: 0, max: 100, default: 50 },
      { name: p3, icon: "📉", unit: "%", min: 0, max: 100, default: 50 },
    ],
    thresholds: [
      { label: "Excellent", min_percent: 75, message: "Outstanding performance across all factors." },
      { label: "Good", min_percent: 50, message: "Solid results with room for improvement." },
      { label: "Needs Work", min_percent: 0, message: "Consider revisiting your approach." },
    ],
    decisions: [
      {
        question: `How would you approach improving ${t.toLowerCase()} outcomes?`,
        emoji: "🔬",
        choices: [
          { text: "Prioritize efficiency", explanation: `Focuses resources on maximizing ${t.toLowerCase()} throughput at the cost of long-term viability.`, set_state: { [p1]: 80, [p2]: 45, [p3]: 40 } },
          { text: "Balanced approach", explanation: `Spreads effort evenly across all dimensions of ${t.toLowerCase()}.`, set_state: { [p1]: 60, [p2]: 60, [p3]: 55 } },
        ],
      },
      {
        question: `A challenge arises in ${t.toLowerCase()}. What's your response?`,
        emoji: "⚡",
        choices: [
          { text: "Invest in quality", explanation: `Improving quality standards strengthens long-term ${t.toLowerCase()} outcomes.`, set_state: { [p1]: 50, [p2]: 85, [p3]: 60 } },
          { text: "Focus on sustainability", explanation: `Sustainable practices ensure ${t.toLowerCase()} remains viable over time.`, set_state: { [p1]: 45, [p2]: 55, [p3]: 80 } },
        ],
      },
    ],
  };
}

function generateClassificationFallback(title: string) {
  const t = title || "Topic";
  const cats = [
    { name: "Core Concepts", description: `Fundamental principles of ${t.toLowerCase()}`, color: "#4CAF50" },
    { name: "Supporting Factors", description: `Elements that contribute to ${t.toLowerCase()}`, color: "#2196F3" },
    { name: "Common Misconceptions", description: `Frequent misunderstandings about ${t.toLowerCase()}`, color: "#FF9800" },
  ];
  return {
    title: `${t} Classification`,
    description: `Categorize the following items related to ${t.toLowerCase()} into the correct groups.`,
    categories: cats,
    items: [
      { content: `Primary principle of ${t.toLowerCase()}`, correctCategory: "Core Concepts", explanation: "This is a foundational element." },
      { content: `Key theory behind ${t.toLowerCase()}`, correctCategory: "Core Concepts", explanation: "This forms the theoretical basis." },
      { content: `Resource that enables ${t.toLowerCase()}`, correctCategory: "Supporting Factors", explanation: "This supports but isn't central." },
      { content: `Tool commonly used in ${t.toLowerCase()}`, correctCategory: "Supporting Factors", explanation: "This is a supporting mechanism." },
      { content: `"${t} always works the same way"`, correctCategory: "Common Misconceptions", explanation: "This oversimplifies the reality." },
      { content: `"${t} has no tradeoffs"`, correctCategory: "Common Misconceptions", explanation: "Every system involves tradeoffs." },
    ],
  };
}

function generatePolicyOptimizationFallback(title: string) {
  const t = title || "Topic";
  const p1 = `${t} Performance`;
  const p2 = `${t} Cost`;
  const p3 = `${t} Risk`;
  return {
    title: `${t} Optimization`,
    description: `Optimize ${t.toLowerCase()} outcomes within the given constraints.`,
    parameters: [
      { name: p1, icon: "🎯", unit: "%", min: 0, max: 100, default: 50 },
      { name: p2, icon: "💰", unit: "%", min: 0, max: 100, default: 50 },
      { name: p3, icon: "⚠️", unit: "%", min: 0, max: 100, default: 50 },
    ],
    constraints: [
      { parameter: p1, operator: ">", value: 60, label: `Keep ${t} performance above 60%` },
      { parameter: p3, operator: "<", value: 40, label: `Keep ${t} risk below 40%` },
    ],
    max_decisions: 3,
    decisions: [
      {
        question: `How do you allocate resources for ${t.toLowerCase()}?`,
        emoji: "🎯",
        choices: [
          { text: "Aggressive investment", explanation: "High performance but increased costs and risk.", set_state: { [p1]: 85, [p2]: 75, [p3]: 60 } },
          { text: "Conservative strategy", explanation: "Lower risk but moderate performance gains.", set_state: { [p1]: 60, [p2]: 40, [p3]: 30 } },
        ],
      },
      {
        question: `A new opportunity emerges in ${t.toLowerCase()}. How do you respond?`,
        emoji: "💡",
        choices: [
          { text: "Seize the opportunity", explanation: "Potential for high reward but with elevated risk.", set_state: { [p1]: 80, [p2]: 65, [p3]: 55 } },
          { text: "Evaluate carefully", explanation: "Measured approach that maintains stability.", set_state: { [p1]: 65, [p2]: 50, [p3]: 35 } },
        ],
      },
    ],
  };
}

function generateEthicalDilemmaFallback(title: string) {
  const t = title || "Topic";
  const dims = [
    { name: "Effectiveness", icon: "🎯", description: `How well ${t.toLowerCase()} achieves its goals` },
    { name: "Fairness", icon: "⚖️", description: `How equitably ${t.toLowerCase()} impacts stakeholders` },
    { name: "Sustainability", icon: "🌱", description: `Long-term viability of ${t.toLowerCase()} decisions` },
  ];
  const dn = dims.map(d => d.name);
  const patterns = [
    [{ [dn[0]]: 15, [dn[1]]: -10, [dn[2]]: 0 }, { [dn[0]]: -10, [dn[1]]: 15, [dn[2]]: 0 }],
    [{ [dn[0]]: 0, [dn[1]]: 15, [dn[2]]: -10 }, { [dn[0]]: 0, [dn[1]]: -10, [dn[2]]: 15 }],
    [{ [dn[0]]: -10, [dn[1]]: 0, [dn[2]]: 15 }, { [dn[0]]: 15, [dn[1]]: 0, [dn[2]]: -10 }],
  ];
  return {
    title: `${t} Ethical Dilemma`,
    description: `Navigate ethical tradeoffs in ${t.toLowerCase()}. Every choice has consequences.`,
    dimensions: dims,
    decisions: [
      {
        question: `${t} can be optimized for results or fairness. What do you prioritize?`,
        emoji: "⚖️",
        choices: [
          { text: "Maximize results", explanation: "Achieves goals but may disadvantage some stakeholders.", impacts: patterns[0][0] },
          { text: "Ensure fairness", explanation: "Equitable outcomes but potentially less efficient.", impacts: patterns[0][1] },
        ],
      },
      {
        question: `A shortcut in ${t.toLowerCase()} saves time but raises concerns. Your call?`,
        emoji: "🤔",
        choices: [
          { text: "Take the shortcut", explanation: "Quick gains but potential long-term drawbacks.", impacts: patterns[1][0] },
          { text: "Do it properly", explanation: "Slower but builds lasting foundations.", impacts: patterns[1][1] },
        ],
      },
      {
        question: `${t} stakeholders disagree on direction. How do you resolve it?`,
        emoji: "🗣️",
        choices: [
          { text: "Prioritize sustainability", explanation: "Long-term thinking over short-term wins.", impacts: patterns[2][0] },
          { text: "Prioritize effectiveness", explanation: "Deliver results now, adapt later.", impacts: patterns[2][1] },
        ],
      },
    ],
  };
}

function generateDecisionLabFallback(title: string) {
  const t = title || "Topic";
  return {
    scenario: `You are a decision-maker responsible for a critical ${t.toLowerCase()} initiative. Your organization has invested significant resources, and stakeholders expect results within 6 months. The market is competitive and conditions are shifting rapidly.`,
    constraints: [
      `Budget is fixed — no additional funding available`,
      `You must maintain team morale above acceptable levels`,
      `Regulatory compliance requirements cannot be violated`,
    ],
    decision_prompt: `Given these constraints, what is your strategic approach to delivering results in ${t.toLowerCase()}?`,
    twist: `Halfway through execution, a key competitor releases a superior solution and your primary team lead resigns unexpectedly. Your original timeline is now at risk.`,
    reflection_question: `Looking back at your initial strategy and how you adapted: what assumption was most dangerous, and what would you do differently from the start?`,
    difficulty_tier: 2,
    variables: {
      budget: { label: "Budget", value: "$100K" },
      timeline: { label: "Timeline", value: "6 months" },
      team_size: { label: "Team", value: "5 people" },
    },
  };
}
/* ===============================
   REPAIR MODULES
================================ */

function repairModules(parsed: any) {
  if (!parsed?.modules || !Array.isArray(parsed.modules)) return parsed;

  for (const mod of parsed.modules) {
    mod.lab_data = mod.lab_data ?? {};

    if (!mod.lesson_content) {
      mod.lesson_content = mod.content || mod.lesson || mod.text || "## Lesson Content\n\nContent is being prepared.";
    }

    if (mod.lesson_content && !mod.lesson_content.includes("\n---\n")) {
      const sections = mod.lesson_content.split(/(?=^## )/m).filter(Boolean);
      if (sections.length > 1) {
        mod.lesson_content = sections.join("\n\n---\n\n");
      }
    }

    if (mod.lesson_content) {
      const slides = mod.lesson_content.split(/\n---\n/).map((s: string) => s.trim()).filter(Boolean);
      const repairedSlides: string[] = [];

      for (let si = 0; si < slides.length; si++) {
        let slide = slides[si];

        const lines = slide.split("\n");
        const repaired: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { repaired.push(""); continue; }
          if (trimmed.startsWith("#") || trimmed.startsWith("<!--") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            repaired.push(line);
          } else if (trimmed.length > 10 && !trimmed.startsWith("#")) {
            repaired.push(`- ${trimmed}`);
          } else {
            repaired.push(line);
          }
        }
        slide = repaired.join("\n");

        if (!slide.includes("<!-- type:")) {
          if (si === slides.length - 1 && slide.toLowerCase().includes("takeaway")) {
            slide = `<!-- type: key_takeaways -->\n${slide}`;
          } else {
            slide = `<!-- type: concept -->\n${slide}`;
          }
        }

        repairedSlides.push(slide);
      }

      if (repairedSlides.length > 0) {
        const last = repairedSlides[repairedSlides.length - 1];
        if (!last.includes("<!-- type: key_takeaways -->")) {
          repairedSlides[repairedSlides.length - 1] = last.replace(/<!-- type: \w+ -->/, "<!-- type: key_takeaways -->");
        }
      }

      while (repairedSlides.length > 8) {
        let minLen = Infinity, minIdx = 0;
        for (let i = 0; i < repairedSlides.length - 1; i++) {
          const combined = repairedSlides[i].length + repairedSlides[i + 1].length;
          if (combined < minLen) { minLen = combined; minIdx = i; }
        }
        repairedSlides[minIdx] = repairedSlides[minIdx] + "\n" + repairedSlides[minIdx + 1];
        repairedSlides.splice(minIdx + 1, 1);
      }

      mod.lesson_content = repairedSlides.join("\n\n---\n\n");
    }

    if (!mod.lab_type) {
      mod.lab_type = "simulation";
    }

    if (!mod.quiz || !Array.isArray(mod.quiz)) {
      mod.quiz = [
        {
          question: `What is a key concept from "${mod.title || "this module"}"?`,
          options: ["Option A", "Option B", "Option C", "Option D"],
          correct: 0,
          explanation: "Review the lesson content for details.",
        },
      ];
    }

    const ld = mod.lab_data;
    const title = mod.title || "Topic";

    if (mod.lab_type === "simulation") {
      if (!isValidSimulation(ld)) {
        console.warn(`[RepairModules] simulation fallback generated for: "${title}"`);
        mod.lab_data = generateSimulationFallback(title);
      } else {
        const paramNames = ld.parameters.map((p: any) => p.name);
        for (const p of ld.parameters) {
          p.min = 0; p.max = 100;
          p.default = Math.max(0, Math.min(100, p.default));
        }
        for (const d of ld.decisions) {
          for (const c of d.choices) {
            if (c.effects && !c.set_state) {
              const ss: Record<string, number> = {};
              for (const pn of paramNames) ss[pn] = Math.max(0, Math.min(100, 50 + (c.effects[pn] ?? 0)));
              c.set_state = ss;
              delete c.effects;
            }
            if (c.set_state) {
              for (const pn of paramNames) {
                if (typeof c.set_state[pn] !== "number") c.set_state[pn] = 50;
                c.set_state[pn] = Math.max(0, Math.min(100, c.set_state[pn]));
              }
            }
          }
        }
      }
    } else if (mod.lab_type === "classification") {
      if (!isValidClassification(ld)) {
        console.warn(`[RepairModules] classification fallback generated for: "${title}"`);
        mod.lab_data = generateClassificationFallback(title);
      }
    } else if (mod.lab_type === "policy_optimization") {
      if (!isValidPolicyOptimization(ld)) {
        console.warn(`[RepairModules] policy_optimization fallback generated for: "${title}"`);
        mod.lab_data = generatePolicyOptimizationFallback(title);
      } else {
        for (const p of ld.parameters) {
          p.min = 0; p.max = 100;
          p.default = Math.max(0, Math.min(100, p.default));
        }
      }
    } else if (mod.lab_type === "ethical_dilemma") {
      if (!isValidEthicalDilemma(ld)) {
        console.warn(`[RepairModules] ethical_dilemma fallback generated for: "${title}"`);
        mod.lab_data = generateEthicalDilemmaFallback(title);
      } else {
        for (const dim of ld.dimensions) {
          if (!dim.icon) dim.icon = "⚖️";
          if (!dim.description) dim.description = "";
        }
      }
    } else if (mod.lab_type === "math_lab") {
      // Math lab — ensure required fields
      const mld = mod.lab_data;
      if (!mld || !mld.tasks || !Array.isArray(mld.tasks) || mld.tasks.length === 0) {
        console.warn(`[RepairModules] math_lab fallback for: "${title}"`);
        mod.lab_data = {
          title: title,
          objective: `Practice ${title} concepts`,
          concept_overview: `This lab explores key concepts from ${title}.`,
          visual_type: "solution_steps",
          solution_steps: [
            { step: 1, expression: "Step 1", explanation: "Set up the problem" },
            { step: 2, expression: "Step 2", explanation: "Apply the concept" },
            { step: 3, expression: "Step 3", explanation: "Solve for the answer" },
          ],
          instructions: "Follow the steps and complete all tasks below.",
          tasks: [
            { id: 1, description: `Identify the key concept in ${title}.`, type: "explanation", correct_answer: "" },
            { id: 2, description: "Solve the problem step by step.", type: "input", correct_answer: "" },
            { id: 3, description: "Explain why your answer is correct.", type: "explanation", correct_answer: "" },
          ],
          hints: ["Break the problem into smaller parts.", "Review the concept overview."],
          solution: "See explanation.",
          solution_explanation: `Review the ${title} concepts covered in the lesson.`,
        };
      } else {
        if (!mld.title) mld.title = title;
        if (!mld.visual_type) mld.visual_type = "solution_steps";
        mld.tasks.forEach((t: any, i: number) => { if (!t.id) t.id = i + 1; });
      }
    }

    // --- FINAL GUARD ---
    const finalValid =
      (mod.lab_type === "simulation" && isValidSimulation(mod.lab_data)) ||
      (mod.lab_type === "classification" && isValidClassification(mod.lab_data)) ||
      (mod.lab_type === "policy_optimization" && isValidPolicyOptimization(mod.lab_data)) ||
      (mod.lab_type === "ethical_dilemma" && isValidEthicalDilemma(mod.lab_data)) ||
      (mod.lab_type === "decision_lab" && isValidDecisionLab(mod.lab_data)) ||
      (mod.lab_type === "math_lab" && mod.lab_data?.tasks?.length > 0);

    if (!finalValid) {
      console.error(`[RepairModules] FINAL GUARD - Forced simulation for: "${title}"`);
      mod.lab_type = "simulation";
      mod.lab_data = generateSimulationFallback(title);
    }
  }

  return parsed;
}

/* ===============================
   📄 FILE CONTENT EXTRACTION
================================ */

async function extractFileContent(filePath: string, supabaseAdmin: any): Promise<{ text?: string; imageBase64?: string; mimeType?: string }> {
  const { data, error } = await supabaseAdmin.storage.from("course-uploads").download(filePath);
  if (error || !data) {
    console.error("Failed to download file:", error);
    return {};
  }

  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const imageExts = ["png", "jpg", "jpeg", "webp"];
  const textExts = ["txt", "md", "csv"];

  if (imageExts.includes(ext)) {
    const buffer = await data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
    return { imageBase64: base64, mimeType: mimeMap[ext] || "image/png" };
  }

  if (textExts.includes(ext)) {
    const text = await data.text();
    return { text: text.slice(0, 50000) }; // Cap at 50k chars
  }

  if (ext === "pdf") {
    // For PDFs, read as text (basic extraction — works for text-based PDFs)
    try {
      const text = await data.text();
      // If it looks like binary PDF content, extract what we can
      const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ").trim();
      if (cleaned.length > 100) {
        return { text: cleaned.slice(0, 50000) };
      }
      // Fallback: send as image-like content for Gemini multimodal
      const buffer = await data.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return { imageBase64: base64, mimeType: "application/pdf" };
    } catch {
      return {};
    }
  }

  return {};
}

/* ===============================
   🚀 MAIN HANDLER
================================ */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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
      console.log(`[FileUpload] Extracted content from: ${filePath}, hasText: ${!!fileContent.text}, hasImage: ${!!fileContent.imageBase64}`);
    }

    // Create course row
    const { data: course } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        title: topic.trim(),
        topic: topic.trim(),
        status: "generating",
      })
      .select()
      .single();

    // Build user message content
    let userContent: any;
    const topicMessage = fileContent.text
      ? `Create a course on: ${topic}\n\nSOURCE MATERIAL (use this as the primary basis for the course content — all lessons, labs, and quizzes should be grounded in this material):\n\n${fileContent.text}`
      : `Create a course on: ${topic}`;

    if (fileContent.imageBase64 && fileContent.mimeType) {
      // Multimodal: send image + text
      userContent = [
        {
          type: "image_url",
          image_url: { url: `data:${fileContent.mimeType};base64,${fileContent.imageBase64}` },
        },
        {
          type: "text",
          text: `Create a course on: ${topic}\n\nThe attached image/document is the SOURCE MATERIAL. Use it as the primary basis for the course content — all lessons, labs, and quizzes should be grounded in this material.`,
        },
      ];
    } else {
      userContent = topicMessage;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `You are an expert course architect building interactive simulation-based courses. Return structured JSON only via the function tool.

CRITICAL MODULE STRUCTURE — every module MUST have ALL of these fields:
- title: string
- lesson_content: string (slide-based markdown, see LESSON CONTENT FORMAT below)
- youtube_query: string (search query to find a relevant video)
- youtube_title: string
- lab_type: one of "simulation", "classification", "policy_optimization", "ethical_dilemma", "decision_lab", "math_lab"
- lab_data: object (format depends on lab_type, see below)
- quiz: array of {question, options: string[4], correct: number 0-3, explanation}

=== LESSON CONTENT FORMAT — CRITICAL ===
Each slide is separated by "---". Each slide MUST follow this exact format:

<!-- type: [concept|example|case_study|comparison|quick_think|myth_vs_reality|process|interactive_predict|key_takeaways] -->
## Slide Title

- Bullet point 1
- Bullet point 2
- Bullet point 3
- Bullet point 4

SLIDE RULES:
- 4-8 slides per module
- 4-7 bullets per slide, each under 15 words
- NO paragraphs — bullets ONLY
- Do NOT repeat the slide title in bullets
- No more than 2 slides of the same type per module
- At least 1 applied slide (example, case_study, comparison)
- At least 1 interactive slide (quick_think or interactive_predict)
- Final slide MUST be <!-- type: key_takeaways --> and must synthesize the module

TOPIC RELEVANCE:
- Every slide must directly relate to the module title
- Every bullet must progress the learner toward the course objective
- Avoid generic filler, unrelated examples, or repeated ideas
- Before writing each slide, ask: "Does this move the learner closer to mastering this topic?"

SLIDE TYPE ROTATION:
- concept: explain core idea
- example: real-world example
- process: step breakdown
- comparison: pros vs cons or before vs after
- case_study: short scenario
- quick_think: reflection question for the learner
- myth_vs_reality: correct a common misconception
- interactive_predict: ask learner to predict an outcome
- key_takeaways: final summary slide

=== QUIZ RULES ===
- 8-10 questions per module (students need 70% to pass)
- Include 3 conceptual questions (test understanding of core ideas)
- Include 3 applied reasoning questions (apply concepts to new situations)
- Include 2-3 scenario-based questions (given a scenario, what happens?)
- Include 1 advanced challenge question
- No definition-only questions, no trivia, no "All of the above"
- No repeating slide bullets verbatim as answer options
- Each question must connect to the module's learning objective
- Vary difficulty: mix easy, medium, and hard questions for diverse scoring

=== INTELLIGENT LAB ASSIGNMENT ===
Choose lab_type based on the topic's cognitive nature:
- "simulation" → for systemic/process topics (cause-and-effect systems like economics, physics, biology)
- "classification" → for analytical/sorting topics (categorization, identification, prioritization)
- "policy_optimization" → for strategic/constraint topics (reaching targets within limits)
- "ethical_dilemma" → for ethical/moral topics (tradeoff decisions with no perfect answer)
- "decision_lab" → for strategic reasoning, business, negotiation, product design, engineering decisions
- "math_lab" → ONLY for math topics (algebra, geometry, calculus, statistics, trigonometry, equations, graphing)

MATH LAB RULE: If the course topic is math-related, use "math_lab" for ALL modules. Math topics include algebra, geometry, calculus, statistics, trigonometry, equations, graphing, number theory, etc.

For math_lab, lab_data format:
{
  "title": "Lab title",
  "objective": "What math skill the student will practice",
  "concept_overview": "2-4 sentence explanation of the concept",
  "visual_type": "graph" | "geometry" | "solution_steps" | "chart",
  "graph_data": { (for graph/chart types)
    "type": "function" | "scatter" | "bar",
    "equation": "x^2 - 4*x + 3", (JS math expression)
    "x_label": "x", "y_label": "y",
    "x_range": [-5, 10], "y_range": [-5, 15],
    "key_points": [{"x": 2, "y": -1, "label": "Vertex"}]
  },
  "geometry": [{ (for geometry type)
    "type": "triangle",
    "points": [{"x": 1, "y": 1, "label": "A"}],
    "measurements": {"AB": "4 units"}
  }],
  "solution_steps": [{ (for solution_steps type)
    "step": 1, "expression": "2x + 5 = 15", "explanation": "Original equation"
  }],
  "scenario": "Real-world application scenario",
  "instructions": "Step-by-step lab instructions",
  "tasks": [{"id": 1, "description": "task text", "type": "input"|"choice"|"explanation", "correct_answer": "answer"}],
  "hints": ["hint 1", "hint 2"],
  "solution": "correct answer",
  "solution_explanation": "step-by-step explanation"
}

PREFER decision_lab for at least 1-2 modules per course (unless it's a math course). Mix lab types across modules. Do NOT use the same lab_type for every module (except math courses which should always use math_lab).

=== SIMULATION LAB (lab_type: "simulation") ===
lab_data format:
{
  "parameters": [
    {"name": "<TOPIC-SPECIFIC FACTOR>", "icon": "📊", "unit": "%", "min": 0, "max": 100, "default": 50}
  ],
  "thresholds": [
    {"label": "Excellent", "min_percent": 75, "message": "..."},
    {"label": "Good", "min_percent": 50, "message": "..."},
    {"label": "Needs Work", "min_percent": 0, "message": "..."}
  ],
  "decisions": [
    {
      "question": "Scenario question?",
      "emoji": "🔬",
      "choices": [
        {"text": "Choice A", "explanation": "Why this matters", "set_state": {"Factor1": 80, "Factor2": 40, "Factor3": 55}},
        {"text": "Choice B", "explanation": "Why this matters", "set_state": {"Factor1": 45, "Factor2": 85, "Factor3": 65}}
      ]
    }
  ]
}
RULES: 3 parameters, 2-3 decisions with 2 choices each. Parameter names MUST be domain-specific (e.g. "GDP Growth", "Inflation Rate" for Economics). NEVER use generic names like "Understanding" or "Confidence". Every choice MUST have "set_state" mapping ALL parameter names to integers 0-100.

=== CLASSIFICATION LAB (lab_type: "classification") ===
lab_data format:
{
  "title": "...", "description": "...",
  "categories": [{"name": "Cat A", "description": "...", "color": "#hex"}],
  "items": [{"content": "...", "correctCategory": "Cat A", "explanation": "..."}]
}
RULES: 3-4 categories, 6-8 items minimum.

=== POLICY OPTIMIZATION LAB (lab_type: "policy_optimization") ===
lab_data format:
{
  "title": "...", "description": "...",
  "parameters": [
    {"name": "<TOPIC VARIABLE>", "icon": "📊", "unit": "%", "min": 0, "max": 100, "default": 50}
  ],
  "constraints": [
    {"parameter": "<PARAM NAME>", "operator": ">", "value": 70, "label": "Keep <param> above 70%"}
  ],
  "max_decisions": 3,
  "decisions": [
    {
      "question": "Policy scenario?", "emoji": "🎯",
      "choices": [
        {"text": "Option A", "explanation": "...", "set_state": {"Param1": 80, "Param2": 40, "Param3": 60}},
        {"text": "Option B", "explanation": "...", "set_state": {"Param1": 55, "Param2": 75, "Param3": 50}}
      ]
    }
  ]
}
RULES: 3 parameters, 2-3 constraints, max_decisions limits how many choices the student can make. Student must reach ALL constraint targets within the decision limit.

=== ETHICAL DILEMMA LAB (lab_type: "ethical_dilemma") ===
lab_data format:
{
  "title": "...", "description": "...",
  "dimensions": [
    {"name": "Profit", "icon": "💰", "description": "Financial performance"},
    {"name": "Ethics", "icon": "⚖️", "description": "Moral responsibility"},
    {"name": "Society", "icon": "🏘️", "description": "Social impact"}
  ],
  "decisions": [
    {
      "question": "Dilemma scenario?", "emoji": "⚖️",
      "choices": [
        {"text": "Option A", "explanation": "...", "impacts": {"Profit": 15, "Ethics": -20, "Society": 5}},
        {"text": "Option B", "explanation": "...", "impacts": {"Profit": -10, "Ethics": 20, "Society": -5}}
      ]
    }
  ]
}
RULES: 3-4 dimensions, 3-4 dilemmas. Every choice MUST improve at least one dimension AND harm at least one other. Use "impacts" (deltas, -50 to +50), NOT "set_state". Student is scored on BALANCE across dimensions.

=== DECISION LAB (lab_type: "decision_lab") ===
lab_data format:
{
  "scenario": "Detailed real-world scenario (3-5 sentences). Must be specific, concrete, and domain-relevant.",
  "constraints": ["Constraint 1", "Constraint 2", "Constraint 3"],
  "decision_prompt": "What is your strategic approach to [specific challenge]?",
  "twist": "A new constraint that fundamentally breaks or challenges the student's initial strategy (2-3 sentences).",
  "reflection_question": "Looking back at your decisions, what would you change and why?",
  "difficulty_tier": 2,
  "variables": {
    "budget": {"label": "Budget", "value": "$100K"},
    "timeline": {"label": "Timeline", "value": "6 months"},
    "team_size": {"label": "Team", "value": "5 people"}
  }
}
RULES:
- Scenario must be specific and grounded (not abstract)
- 2-3 hard constraints that force tradeoffs
- Twist must genuinely challenge the initial strategy (not just add difficulty)
- difficulty_tier: 1 (basic clarity), 2 (constrained), 3 (strategic tradeoffs)
- variables: randomizable parameters that make each run feel different
- Students write free-text responses; AI provides critique
- This lab type is PREFERRED for business, strategy, engineering, negotiation, product design topics

${filePath ? "IMPORTANT: The user has uploaded SOURCE MATERIAL. You MUST base the course content directly on the material provided. Extract key concepts, facts, and structure from the source material. Do NOT generate generic content — every lesson, lab scenario, and quiz question should reference or build upon the uploaded material." : ""}
Generate 4-6 modules with a good mix of lab types. Include at least 1-2 decision_lab modules.`,
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_course",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Course title" },
                  description: { type: "string", description: "Course description" },
                  modules: {
                    type: "array",
                    description: "Array of course modules",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        lesson_content: { type: "string", description: "Markdown lesson with --- slide separators" },
                        youtube_query: { type: "string" },
                        youtube_title: { type: "string" },
                        lab_type: { type: "string", enum: ["simulation", "classification", "policy_optimization", "ethical_dilemma", "decision_lab"] },
                        lab_data: { type: "object", description: "Lab configuration object" },
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
                      required: ["title", "lesson_content", "lab_type", "lab_data", "quiz"],
                    },
                  },
                },
                required: ["title", "description", "modules"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_course" } },
      }),
    });

    const aiData = await response.json();

    if (!aiData.choices?.length) {
      throw new Error("Empty AI response");
    }

    const message = aiData.choices[0].message;
    const toolCall = message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No function call returned by AI");
    }

    // Parse and repair
    const parsed = JSON.parse(toolCall.function.arguments);
    const repaired = repairModules(parsed);

    // Validate
    const courseData = CourseSchema.parse(repaired);

    // Update course
    await supabase
      .from("courses")
      .update({
        title: courseData.title,
        description: courseData.description,
        status: "ready",
      })
      .eq("id", course.id);

    const modules = courseData.modules.map((mod: any, index: number) => {
      let lessonContent = mod.lesson_content || "";

      if (!lessonContent.includes("\n---\n")) {
        const sections = lessonContent.split(/(?=^## )/m).filter(Boolean);
        if (sections.length > 1) {
          lessonContent = sections.join("\n\n---\n\n");
        }
      }

      return {
        course_id: course.id,
        module_order: index + 1,
        title: mod.title,
        lesson_content: lessonContent,
        youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
          mod.youtube_query || mod.title,
        )}`,
        youtube_title: mod.youtube_title || mod.title,
        lab_type: mod.lab_type,
        lab_data: mod.lab_data,
        quiz: mod.quiz,
      };
    });

    await supabase.from("course_modules").insert(modules);

    // Track file-based course generation
    if (filePath) {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      
      const { data: existing } = await supabaseAdmin
        .from("usage_tracking")
        .select("id, file_courses_generated")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .single();

      if (existing) {
        await supabaseAdmin
          .from("usage_tracking")
          .update({ file_courses_generated: (existing.file_courses_generated || 0) + 1 })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("usage_tracking")
          .insert({ user_id: user.id, month: currentMonth, file_courses_generated: 1, courses_generated: 1 });
      }
    }

    return new Response(JSON.stringify({ courseId: course.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("COURSE GENERATION ERROR:", error);

    if (error instanceof z.ZodError) {
      console.error("ZOD VALIDATION DETAILS:", JSON.stringify(error.issues, null, 2));
      return new Response(
        JSON.stringify({ error: "Course generation produced invalid data. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
