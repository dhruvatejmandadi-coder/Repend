

## File Upload for Personalized Course Generation

### What We're Building
A file attachment button ("+") next to the course topic input that lets users upload documents (PDF, images, text files) up to 10MB. The uploaded file content is sent to the AI course generator so courses are grounded in the user's material.

### Architecture

```text
┌─────────────────────────────────────┐
│  Courses.tsx  (UI)                  │
│  [+] [topic input] [Create Course]  │
│       ↓ file selected               │
│  Upload to storage → get public URL │
│  Send {topic, fileUrl} to edge fn   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  generate-course edge function      │
│  - Fetch file from storage URL      │
│  - Extract text (for PDF/text)      │
│  - For images: send as base64       │
│  - Inject into AI prompt as context │
└─────────────────────────────────────┘
```

### Changes

**1. Storage bucket setup (migration)**
- The `course-uploads` bucket already exists (private). Add RLS policies so authenticated users can upload/read their own files. Enforce 10MB limit.

**2. Frontend: `src/pages/Courses.tsx`**
- Add a "+" icon button left of the input field (or as a paperclip/attachment icon).
- Hidden file input accepting `.pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp` with 10MB max.
- On file select: show file name chip with remove button.
- On generate: upload file to `course-uploads/{userId}/{timestamp}_{filename}`, then call the edge function with `{ topic, fileUrl }`.
- Tier gating: check subscription — file uploads count against `fileUploadsPerMonth` (Pro: 3/mo, Elite: unlimited, Starter: blocked with upgrade prompt).

**3. Edge function: `supabase/functions/generate-course/index.ts`**
- Accept optional `fileUrl` in request body.
- If provided, download the file using the service role key.
- For text-based files (`.txt`, `.md`, `.csv`): read as text and inject into the system prompt as "SOURCE MATERIAL".
- For PDFs: extract text content (basic text extraction).
- For images (`.png`, `.jpg`, `.webp`): convert to base64 and send as a multimodal message to Gemini (already supports images).
- Modify the user message from `"Create a course on: ${topic}"` to `"Create a course on: ${topic}\n\nSOURCE MATERIAL:\n${extractedContent}"`.

**4. Usage tracking**
- Increment `file_courses_generated` in `usage_tracking` table when a file-based course is generated (column already exists).

**5. UI details**
- File chip shows filename + size + remove "x" button.
- 10MB validation client-side with toast error if exceeded.
- Loading state during upload before generation starts.
- Guest users see the "+" button but get redirected to signup on click.

