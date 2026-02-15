export const surveyQuestions = {
  goals: {
    title: "Your Goal",
    question: "What do you want help with right now?",
    type: "multi" as const,
    options: [
      "Understanding a school subject",
      "Choosing a career path",
      "Learning a new skill",
      "Building a project",
      "Preparing for tests/exams",
      "College applications",
      "Resume / interviews",
      "Starting a business",
      "Improving productivity",
    ],
  },

  challenges: {
    title: "Your Challenges",
    question: "What's been holding you back?",
    type: "multi" as const,
    options: [
      "Lack of motivation",
      "Don't know where to start",
      "Too many distractions",
      "No mentor or guidance",
      "Not enough time",
      "Feeling overwhelmed",
      "Fear of failure",
    ],
  },

  subject_area: {
    title: "Subject / Field",
    question: "What area do you want help in most?",
    type: "single" as const,
    options: [
      "Math",
      "Science",
      "Programming / Tech",
      "Business / Entrepreneurship",
      "Writing",
      "Public Speaking",
      "Design / Creative",
      "Career Guidance",
      "Personal Growth",
    ],
  },

  skill_level: {
    title: "Your Level",
    question: "How would you describe your level in this area?",
    type: "single" as const,
    options: ["Complete beginner", "Basic understanding", "Intermediate", "Advanced"],
  },

  help_types: {
    title: "Type of Help",
    question: "What kind of help would benefit you most?",
    type: "multi" as const,
    options: [
      "Step-by-step tutorials",
      "Practice problems",
      "Real-world projects",
      "Mentorship",
      "Study plans",
      "Career advice",
    ],
  },

  mentor_personality: {
    title: "Mentor Style",
    question: "What mentor personality resonates with you?",
    type: "multi" as const,
    options: [
      "Encouraging & supportive",
      "Direct & no-nonsense",
      "Funny & casual",
      "Analytical & detailed",
      "Big-picture thinker",
    ],
  },

  learning_styles: {
    title: "Learning Style",
    question: "How do you learn best?",
    type: "multi" as const,
    options: [
      "Watching videos",
      "Reading articles",
      "Hands-on projects",
      "Interactive quizzes",
      "Group discussions",
      "One-on-one coaching",
    ],
  },

  time_commitment: {
    title: "Time Commitment",
    question: "How much time can you dedicate per week?",
    type: "single" as const,
    options: [
      "Less than 1 hour",
      "1–3 hours",
      "3–5 hours",
      "5–10 hours",
      "10+ hours",
    ],
  },

  urgency: {
    title: "Urgency",
    question: "How soon do you need results?",
    type: "single" as const,
    options: [
      "No rush — just exploring",
      "Within a few weeks",
      "Within a month",
      "ASAP — I have a deadline",
    ],
  },
};

export interface SurveyResponses {
  goals: string[];
  goals_other: string;
  challenges: string[];
  challenges_other: string;
  subject_area: string;
  subject_other: string;
  skill_level: string;
  help_types: string[];
  help_other: string;
  mentor_personality: string[];
  mentor_other: string;
  learning_styles: string[];
  learning_other: string;
  time_commitment: string;
  urgency: string;
  success_definition: string;
}

export const initialSurveyResponses: SurveyResponses = {
  goals: [],
  goals_other: "",
  challenges: [],
  challenges_other: "",
  subject_area: "",
  subject_other: "",
  skill_level: "",
  help_types: [],
  help_other: "",
  mentor_personality: [],
  mentor_other: "",
  learning_styles: [],
  learning_other: "",
  time_commitment: "",
  urgency: "",
  success_definition: "",
};
