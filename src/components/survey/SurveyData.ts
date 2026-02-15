export const surveyQuestions = {
  heard_about: {
    title: "How Did You Hear About Us?",
    question: "How did you first discover Repend AI?",
    type: "single" as const,
    options: [
      "Instagram",
      "TikTok",
      "YouTube",
      "Google Search",
      "Friend / Referral",
      "School / Teacher",
      "Online Community",
      "Other",
    ],
  },

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

  interests: {
    title: "Your Interests",
    question: "What topics are you most interested in?",
    type: "multi" as const,
    options: [
      "Artificial Intelligence",
      "Web Development",
      "Startups",
      "Finance / Investing",
      "Personal Branding",
      "Productivity",
      "College Prep",
      "Public Speaking",
      "Creative Design",
      "Leadership",
    ],
  },

  experience_rating: {
    title: "First Impression",
    question: "How would you rate your experience so far?",
    type: "single" as const,
    options: ["⭐ Very Poor", "⭐⭐ Poor", "⭐⭐⭐ Average", "⭐⭐⭐⭐ Good", "⭐⭐⭐⭐⭐ Excellent"],
  },

  biggest_outcome: {
    title: "Desired Outcome",
    question: "If Repend AI works perfectly for you, what changes in your life?",
    type: "text" as const,
  },
};
