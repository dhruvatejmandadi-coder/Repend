export const surveyQuestions = {
  hear_about: {
    title: "Discovery",
    question: "How did you hear about us?",
    type: "single" as const,
    options: [
      "Instagram",
      "YouTube",
      "TikTok",
      "Google search",
      "Friend / referral",
      "School / teacher",
      "Online community",
    ],
  },

  signup_reason: {
    title: "Motivation",
    question: "What made you sign up today?",
    type: "single" as const,
    options: [
      "AI-powered learning",
      "Personalized courses",
      "Certificates",
      "Community",
      "Curiosity",
      "Recommendation",
    ],
  },

  interests: {
    title: "Interests",
    question: "What subjects or skills are you most interested in?",
    type: "multi" as const,
    options: [
      "Math",
      "Science",
      "Programming / Tech",
      "Business / Entrepreneurship",
      "Writing",
      "Design / Creative",
      "Public Speaking",
      "Career Guidance",
      "Productivity",
      "Personal Growth",
    ],
  },

  working_toward: {
    title: "Goals",
    question: "What are you currently working toward?",
    type: "single" as const,
    options: [
      "Improving grades",
      "Building projects",
      "Preparing for exams",
      "Learning for fun",
      "Career growth",
      "Starting a business",
      "College preparation",
    ],
  },

  skill_level: {
    title: "Your Level",
    question: "What is your current level in this area?",
    type: "single" as const,
    options: ["Beginner", "Basic", "Intermediate", "Advanced"],
  },

  time_commitment: {
    title: "Time Commitment",
    question: "How many hours per week can you commit?",
    type: "single" as const,
    options: ["< 1 hour", "1–3 hours", "3–5 hours", "5+ hours"],
  },
};

export interface SurveyResponses {
  hear_about: string;
  hear_about_other: string;
  signup_reason: string;
  signup_reason_other: string;
  interests: string[];
  interests_other: string;
  working_toward: string;
  working_toward_other: string;
  skill_level: string;
  time_commitment: string;
}

export const initialSurveyResponses: SurveyResponses = {
  hear_about: "",
  hear_about_other: "",
  signup_reason: "",
  signup_reason_other: "",
  interests: [],
  interests_other: "",
  working_toward: "",
  working_toward_other: "",
  skill_level: "",
  time_commitment: "",
};
