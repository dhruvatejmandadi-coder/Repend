

# Turn Lessons into Interactive Slides

## What Changes

Instead of showing lessons as one long wall of text, lessons will be split into **navigable slides** with emoji-rich content. Users click "Next" and "Previous" to move through bite-sized content cards.

## Two Parts

### 1. AI Prompt Update (Edge Function)

Update the system prompt in `supabase/functions/generate-course/index.ts` to instruct the AI to:
- Format `lesson_content` with `---` (horizontal rule) separators between slides
- Each slide should have an emoji-prefixed heading (e.g., `## 🧬 What is DNA?`)
- Keep each slide to 2-3 short paragraphs max
- Add relevant emojis throughout the text to make it engaging
- Aim for 4-6 slides per module

Example output format:
```
## 🎯 Introduction to Forces

Forces are pushes or pulls that act on objects! 💪 ...

---

## 🔬 Types of Forces

There are two main types of forces: **contact** and **non-contact** ✨ ...

---

## 📐 Measuring Forces

We measure forces in **Newtons (N)** 📏 ...
```

### 2. Slide Viewer Component (Frontend)

Create a new `LessonSlides` component used in `CourseView.tsx` that:
- Splits the markdown content on `---` into an array of slides
- Shows one slide at a time inside a styled card
- Displays a slide counter (e.g., "Slide 2 of 5")
- Has "Previous" and "Next" buttons with arrow icons
- Supports keyboard navigation (left/right arrow keys)
- Shows a progress bar across the top of the slide
- Each slide renders its markdown chunk with `ReactMarkdown`

### Technical Details

**New file:** `src/components/courses/LessonSlides.tsx`
- Props: `content: string`, `youtubeUrl?: string`, `youtubeTitle?: string`
- Splits content by `---` separator, trims empty slides
- Manages `currentSlide` state (0-indexed)
- Renders the YouTube card on the last slide
- Keyboard listener for arrow key navigation

**Modified file:** `src/pages/CourseView.tsx`
- Replace the current lesson rendering block (lines 194-219) with the new `<LessonSlides>` component
- Pass `mod.lesson_content`, `mod.youtube_url`, `mod.youtube_title` as props

**Modified file:** `supabase/functions/generate-course/index.ts`
- Add to system prompt: instruction to format lesson_content as slide-separated sections using `---`, with emoji headings, 4-6 slides per module, 2-3 paragraphs max per slide
- Update the `lesson_content` field description in the tool schema to: `"Detailed lesson formatted as slides separated by --- dividers. Each slide starts with an emoji heading (## emoji Title). 4-6 slides per module, 2-3 paragraphs each. Use emojis throughout to make content engaging."`

Existing courses with plain markdown will still work -- if no `---` separators are found, the entire content becomes a single slide.

