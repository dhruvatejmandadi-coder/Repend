export interface LabChoice {
  text: string;
  hint?: string;
  impact: {
    growth: number;
    skill: number;
    stress: number;
    confidence: number;
  };
}

export interface LabScenario {
  title: string;
  description: string;
  choices: LabChoice[];
}

export interface LabDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  scenarios: LabScenario[];
  decisionStyles: { label: string; condition: (m: LabMetrics) => boolean }[];
  recommendedTopics: string[];
}

export interface LabMetrics {
  growth: number;
  skill: number;
  stress: number;
  confidence: number;
}

export const initialMetrics: LabMetrics = { growth: 50, skill: 50, stress: 50, confidence: 50 };

export const labDefinitions: LabDefinition[] = [
  {
    id: "startup-founder",
    title: "Startup Founder Lab",
    description: "Navigate the challenges of building a startup from scratch. Make critical decisions about product, hiring, and fundraising.",
    icon: "🚀",
    category: "Business / Entrepreneurship",
    scenarios: [
      {
        title: "The MVP Dilemma",
        description: "You have a great idea but limited resources. How do you approach building your first product?",
        choices: [
          { text: "Build a minimal prototype and launch fast", hint: "Speed to market can validate your idea quickly", impact: { growth: 15, skill: 5, stress: 10, confidence: 10 } },
          { text: "Spend months perfecting the product first", hint: "Quality matters but time is money", impact: { growth: 5, skill: 15, stress: 15, confidence: 5 } },
          { text: "Run surveys and interviews before building anything", hint: "Research reduces risk but delays action", impact: { growth: 10, skill: 10, stress: -5, confidence: 15 } },
        ],
      },
      {
        title: "First Hire",
        description: "Your startup is gaining traction. You can only afford one hire. Who do you bring on?",
        choices: [
          { text: "A technical co-founder to build faster", hint: "Technical talent accelerates product development", impact: { growth: 10, skill: 15, stress: -5, confidence: 10 } },
          { text: "A sales person to drive revenue", hint: "Revenue solves many startup problems", impact: { growth: 15, skill: 5, stress: 5, confidence: 10 } },
          { text: "A generalist who can wear many hats", hint: "Flexibility is valuable in early stages", impact: { growth: 10, skill: 10, stress: -10, confidence: 5 } },
        ],
      },
      {
        title: "Funding Decision",
        description: "An investor offers $500K but wants 30% equity. Your competitor just raised $2M. What do you do?",
        choices: [
          { text: "Take the deal and scale quickly", hint: "Capital enables growth but dilutes ownership", impact: { growth: 15, skill: 5, stress: 10, confidence: 5 } },
          { text: "Negotiate harder for better terms", hint: "Strong negotiation shows confidence", impact: { growth: 5, skill: 15, stress: 15, confidence: 15 } },
          { text: "Bootstrap and stay independent", hint: "Independence preserves vision but limits speed", impact: { growth: 5, skill: 10, stress: 5, confidence: 10 } },
        ],
      },
      {
        title: "Pivot or Persist",
        description: "After 6 months, growth is slow. User feedback suggests a different use case than you planned. What's your move?",
        choices: [
          { text: "Pivot to what users actually want", hint: "Listening to users is often the winning strategy", impact: { growth: 15, skill: 10, stress: -5, confidence: 10 } },
          { text: "Double down on your original vision", hint: "Conviction matters but so does data", impact: { growth: 5, skill: 5, stress: 15, confidence: 15 } },
          { text: "Run an A/B test between both directions", hint: "Data-driven decisions reduce guesswork", impact: { growth: 10, skill: 15, stress: 5, confidence: 10 } },
        ],
      },
      {
        title: "Crisis Management",
        description: "Your main server crashes during a product launch. Press is watching. How do you handle it?",
        choices: [
          { text: "Be transparent — post a public status update", hint: "Transparency builds trust long-term", impact: { growth: 5, skill: 10, stress: -10, confidence: 15 } },
          { text: "Fix silently and pretend it didn't happen", hint: "Risky — people may notice anyway", impact: { growth: 5, skill: 5, stress: 10, confidence: -5 } },
          { text: "Delay launch and ensure stability first", hint: "Reliability over speed", impact: { growth: -5, skill: 15, stress: -5, confidence: 10 } },
        ],
      },
    ],
    decisionStyles: [
      { label: "Visionary Builder", condition: (m) => m.growth >= 80 && m.confidence >= 70 },
      { label: "Strategic Planner", condition: (m) => m.skill >= 80 && m.stress <= 60 },
      { label: "Resilient Hustler", condition: (m) => m.confidence >= 80 && m.stress >= 70 },
      { label: "Balanced Leader", condition: (m) => Math.abs(m.growth - m.skill) <= 15 && m.confidence >= 60 },
    ],
    recommendedTopics: ["Business Strategy", "Product Management", "Entrepreneurship"],
  },
  {
    id: "career-decision",
    title: "Career Decision Lab",
    description: "Face real career crossroads — job offers, skill pivots, and networking decisions that shape your professional future.",
    icon: "💼",
    category: "Career Guidance",
    scenarios: [
      {
        title: "The Job Offer",
        description: "You receive two offers: a stable corporate role with great pay, or an exciting startup with equity but lower salary.",
        choices: [
          { text: "Take the corporate role for stability", hint: "Financial security provides a strong foundation", impact: { growth: 5, skill: 10, stress: -10, confidence: 10 } },
          { text: "Join the startup for growth potential", hint: "Risk can lead to outsized rewards", impact: { growth: 15, skill: 10, stress: 15, confidence: 10 } },
          { text: "Negotiate — ask the startup for more salary", hint: "You lose nothing by asking", impact: { growth: 10, skill: 15, stress: 5, confidence: 15 } },
        ],
      },
      {
        title: "Skill Pivot",
        description: "Your industry is shifting toward AI. Do you upskill, pivot, or stay the course?",
        choices: [
          { text: "Go all-in on learning AI/ML", hint: "Future-proofing your career", impact: { growth: 15, skill: 15, stress: 10, confidence: 10 } },
          { text: "Find a hybrid role combining current skills with AI", hint: "Leverage what you already know", impact: { growth: 10, skill: 10, stress: 5, confidence: 15 } },
          { text: "Stay specialized — experts always have value", hint: "Deep expertise is rare and valuable", impact: { growth: 5, skill: 15, stress: -5, confidence: 10 } },
        ],
      },
      {
        title: "The Networking Event",
        description: "You're at a major industry conference. How do you spend your time?",
        choices: [
          { text: "Target key speakers and VIPs", hint: "High-value connections can open doors", impact: { growth: 15, skill: 5, stress: 10, confidence: 10 } },
          { text: "Join peer roundtables and workshops", hint: "Peer learning builds lasting relationships", impact: { growth: 10, skill: 15, stress: -5, confidence: 10 } },
          { text: "Focus on giving a talk yourself", hint: "Positioning yourself as a thought leader", impact: { growth: 10, skill: 10, stress: 15, confidence: 15 } },
        ],
      },
      {
        title: "Promotion vs. Side Project",
        description: "You're up for promotion, but your side project is gaining traction. Where do you focus your energy?",
        choices: [
          { text: "Go for the promotion — secure the career path", hint: "Career advancement compounds over time", impact: { growth: 10, skill: 10, stress: 5, confidence: 10 } },
          { text: "Bet on the side project — it could be bigger", hint: "Entrepreneurial bets can pay off big", impact: { growth: 15, skill: 5, stress: 15, confidence: 15 } },
          { text: "Do both — manage your time carefully", hint: "Ambitious but risky for burnout", impact: { growth: 10, skill: 10, stress: 20, confidence: 5 } },
        ],
      },
    ],
    decisionStyles: [
      { label: "Ambitious Climber", condition: (m) => m.growth >= 80 && m.confidence >= 70 },
      { label: "Strategic Networker", condition: (m) => m.skill >= 75 && m.growth >= 65 },
      { label: "Calculated Risk-Taker", condition: (m) => m.confidence >= 80 && m.stress >= 60 },
      { label: "Steady Builder", condition: (m) => m.stress <= 55 && m.skill >= 70 },
    ],
    recommendedTopics: ["Career Development", "Leadership", "Professional Networking"],
  },
  {
    id: "productivity-optimization",
    title: "Productivity Optimization Lab",
    description: "Optimize your daily workflow with smart decisions about time management, focus, and delegation.",
    icon: "⚡",
    category: "Productivity",
    scenarios: [
      {
        title: "Morning Routine",
        description: "You have 2 hours before work. How do you spend them?",
        choices: [
          { text: "Deep work on your most important task", hint: "Morning focus is peak cognitive time", impact: { growth: 10, skill: 15, stress: 5, confidence: 10 } },
          { text: "Exercise and meditation first", hint: "Physical health boosts mental performance", impact: { growth: 5, skill: 5, stress: -15, confidence: 15 } },
          { text: "Clear emails and plan the day", hint: "Organization prevents reactive chaos", impact: { growth: 5, skill: 10, stress: -5, confidence: 10 } },
        ],
      },
      {
        title: "The Overloaded Week",
        description: "You have 3 major deadlines this week and a team member calls in sick. What's your approach?",
        choices: [
          { text: "Prioritize ruthlessly — drop the least important task", hint: "Not everything is equally urgent", impact: { growth: 10, skill: 15, stress: -5, confidence: 15 } },
          { text: "Work extra hours to get everything done", hint: "Hustle works short-term but burns you out", impact: { growth: 15, skill: 5, stress: 20, confidence: 5 } },
          { text: "Delegate and redistribute across the team", hint: "Good leaders multiply effort through others", impact: { growth: 10, skill: 10, stress: -10, confidence: 10 } },
        ],
      },
      {
        title: "Tool Overload",
        description: "Your team uses 8 different tools for communication and project management. What do you do?",
        choices: [
          { text: "Consolidate to 2-3 core tools", hint: "Simplicity reduces friction", impact: { growth: 5, skill: 15, stress: -10, confidence: 10 } },
          { text: "Add an automation layer to connect them", hint: "Automation saves time at scale", impact: { growth: 10, skill: 15, stress: 5, confidence: 10 } },
          { text: "Adapt and learn to use them all efficiently", hint: "Flexibility is a skill", impact: { growth: 5, skill: 10, stress: 10, confidence: 5 } },
        ],
      },
      {
        title: "The Distraction Battle",
        description: "You keep getting pulled into meetings and Slack messages during deep work time. How do you protect your focus?",
        choices: [
          { text: "Block calendar time and go Do Not Disturb", hint: "Protect your peak hours fiercely", impact: { growth: 10, skill: 10, stress: -10, confidence: 15 } },
          { text: "Batch all meetings into one day", hint: "Meeting-free days boost productivity", impact: { growth: 15, skill: 10, stress: -5, confidence: 10 } },
          { text: "Stay responsive — availability matters", hint: "Being helpful has value but at a cost", impact: { growth: 5, skill: 5, stress: 15, confidence: -5 } },
        ],
      },
    ],
    decisionStyles: [
      { label: "Efficiency Master", condition: (m) => m.skill >= 80 && m.stress <= 50 },
      { label: "Focus Champion", condition: (m) => m.confidence >= 80 && m.growth >= 65 },
      { label: "Burnout Risk", condition: (m) => m.stress >= 85 },
      { label: "Balanced Optimizer", condition: (m) => m.stress <= 60 && m.skill >= 65 && m.growth >= 60 },
    ],
    recommendedTopics: ["Time Management", "Productivity Systems", "Work-Life Balance"],
  },
];
