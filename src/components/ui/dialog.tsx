export const surveyQuestions = {
  discovery: {
    title: "How You Found Us",
    question: "How did you hear about Repend AI?",
    type: "single" as const,
    options: [
      "TikTok",
      "Instagram",
      "YouTube",
      "Google Search",
      "Friend / Referral",
      "School / Teacher",
      "Online Community",
      "Advertisement",
      "Other",
    ],
  },

  primary_goal: {
    title: "Your Main Goal",
    question: "What is the main reason you joined Repend AI?",
    type: "single" as const,
    options: [
      "Improve grades",
      "Prepare for exams",
      "Learn a new skill",
      "Build projects",
      "Career guidance",
      "College preparation",
      "Personal development",
    ],
  },

  interests: {
    title: "Your Interests",
    question: "What topics are you most interested in?",
    type: "multi" as const,
    options: [
      "Math",
      "Science",
      "Programming / Tech",
      "Business / Startups",
      "Writing",
      "Public Speaking",
      "Design / Creative",
      "Study Skills",
      "Productivity",
    ],
  },

  experience_level: {
    title: "Experience Level",
    question: "How would you describe your current level?",
    type: "single" as const,
    options: ["Beginner", "Some experience", "Intermediate", "Advanced"],
  },

  learning_style: {
    title: "Learning Preference",
    question: "How do you prefer to learn?",
    type: "multi" as const,
    options: [
      "Step-by-step explanations",
      "Real-world examples",
      "Practice challenges",
      "Visual explanations",
      "Short summaries",
      "Interactive discussions",
    ],
  },

  time_commitment: {
    title: "Time Commitment",
    question: "How much time can you dedicate weekly?",
    type: "single" as const,
    options: ["Less than 1 hour", "1–3 hours", "3–5 hours", "5+ hours"],
  },

  urgency: {
    title: "Urgency",
    question: "How urgent is your goal?",
    type: "single" as const,
    options: ["Just exploring", "Planning ahead", "Need progress soon", "Very urgent (deadline)"],
  },

  satisfaction_expectation: {
    title: "Expectations",
    question: "What would make this platform valuable for you?",
    type: "multi" as const,
    options: [
      "Clear explanations",
      "Structured learning paths",
      "Personalized recommendations",
      "Progress tracking",
      "Practical real-world skills",
      "Motivation and accountability",
    ],
  },

  rating_confidence: {
    title: "Self Rating",
    question: "On a scale of 1–5, how confident are you in achieving your goal right now?",
    type: "rating" as const,
    scale: 5,
  },

  open_feedback: {
    title: "Open Feedback",
    question: "Is there anything we should know to better support you?",
    type: "text" as const,
  },
};
