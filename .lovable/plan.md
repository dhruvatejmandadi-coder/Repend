# File-Based Course Generation

&nbsp;

Overview

&nbsp;

Allow users to drag-and-drop files (PDF, TXT) into the course creation flow. The AI reads the file content and generates a structured slide-based course from it — same format as topic-based generation but grounded in the uploaded material.

&nbsp;

How It Works

&nbsp;

User drops file --> Upload to Storage --> Edge function fetches file

     --> Convert to base64 --> Send to Gemini as document input

     --> AI generates structured course from file content

     --> Same slide/lab/quiz output as topic-based generation

&nbsp;

Supported Formats (Phase 1)

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

PDF — Gemini processes natively via base64 (no external API needed)

&nbsp;

&nbsp;

&nbsp;

TXT / Markdown — Read as plain text, pass as context

&nbsp;

&nbsp;

&nbsp;

Images (PNG, JPG) — Gemini processes as vision input (useful for slide photos, diagrams)

&nbsp;

DOCX and PPTX require specialized parsing. Recommend starting with PDF/TXT and adding those later if needed.

&nbsp;

Changes Required

&nbsp;

1. Create Storage Bucket

&nbsp;

Create a course-uploads storage bucket with RLS policies so users can only upload/read their own files. Max file size ~10MB.

&nbsp;

2. Update Courses Page UI

&nbsp;

File: src/pages/Courses.tsx

&nbsp;

Add a file drop zone alongside the existing topic input:

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Drag-and-drop area with visual feedback (dashed border, icon)

&nbsp;

&nbsp;

&nbsp;

Also supports click-to-browse

&nbsp;

&nbsp;

&nbsp;

Shows file name and size after selection

&nbsp;

&nbsp;

&nbsp;

Accepts: .pdf, .txt, .md, .png, .jpg

&nbsp;

&nbsp;

&nbsp;

Upload button triggers the generation flow

&nbsp;

&nbsp;

&nbsp;

User can optionally add a topic/title alongside the file for better context

&nbsp;

The UI would look like:

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Existing topic input stays as-is

&nbsp;

&nbsp;

&nbsp;

Below it: "Or upload a file" with a drop zone

&nbsp;

&nbsp;

&nbsp;

When a file is selected, the "Create Course" button uploads + generates

&nbsp;

3. Update Edge Function

&nbsp;

File: supabase/functions/generate-course/index.ts

&nbsp;

Modify the endpoint to accept either topic (existing) or fileUrl + optional topic:

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

If fileUrl is provided, fetch the file from Storage

&nbsp;

&nbsp;

&nbsp;

Determine file type from the URL/extension

&nbsp;

&nbsp;

&nbsp;

For PDF: convert to base64, send as a multimodal message part to Gemini

&nbsp;

&nbsp;

&nbsp;

For TXT/MD: read as text, include in the user message as context

&nbsp;

&nbsp;

&nbsp;

For images: convert to base64, send as image content part

&nbsp;

&nbsp;

&nbsp;

Adjust the user prompt: "Create a course based on the following document content" instead of "Create a course on: topic"

&nbsp;

The Gemini API multimodal format:

&nbsp;

messages: [

  { role: "system", content: "..." },

  { role: "user", content: [

    { type: "text", text: "Create a course from this document. Focus on: [optional topic]" },

    { type: "image_url", url: { url: "data:application/pdf;base64,..." } }

  ]}

]

&nbsp;

4. No External API Needed

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Gemini handles PDF and image input natively

&nbsp;

&nbsp;

&nbsp;

No Firecrawl, no document parsing API

&nbsp;

&nbsp;

&nbsp;

Everything runs through the existing Lovable AI gateway

&nbsp;

&nbsp;

&nbsp;

Same structured JSON output via function calling

&nbsp;

What Stays the Same

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

All slide format rules (4-8 slides, bullet-only, type rotation)

&nbsp;

&nbsp;

&nbsp;

All lab generation logic (simulation, classification, etc.)

&nbsp;

&nbsp;

&nbsp;

All repair/validation logic

&nbsp;

&nbsp;

&nbsp;

Quiz generation rules

&nbsp;

&nbsp;

&nbsp;

Course storage in the same tables

&nbsp;

Technical Notes

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

File size limit: 10MB (Gemini supports up to 20MB inline)

&nbsp;

&nbsp;

&nbsp;

Base64 encoding increases size ~33%, so 10MB file becomes ~13MB payload — well within limits

&nbsp;

&nbsp;

&nbsp;

The system prompt stays identical; only the user message changes to include document content

&nbsp;

&nbsp;

&nbsp;

For very large documents, the AI will naturally focus on key concepts (Gemini has large context windows)

&nbsp;

&nbsp;

&nbsp;

RLS on the storage bucket ensures users can only access their own uploads# Pricing Model and Stripe Integration

&nbsp;

## Pricing Strategy: 3-Tier Anchor Model

&nbsp;

Based on the platform's value (AI course generation, interactive labs, quizzes, community, challenges), here's the recommended pricing:

&nbsp;

| | Starter (Free) | Pro ($7.99/mo) | Elite ($11.99/mo) |

|---|---|---|---|

| AI Course Generation | 2 courses/month | 15 courses/month | Unlimited |

| Modules per Course | Up to 5 | Up to 10 | Unlimited |

| Interactive Labs | Basic only | All lab types | All lab types + priority |

| Daily Challenges | View only | Full participation | Full + exclusive challenges |

| Community | Read only | Full access | Full + highlighted posts |

| Quizzes | Limited retries | Unlimited retries | Unlimited + detailed analytics |

| Certificates | No | Yes | Yes + shareable badge |

| File Upload Courses | No | 3/month | Unlimited |

| Progress Analytics | Basic | Detailed | Advanced + behavioral insights |

| Support | Community | Email | Priority |

&nbsp;

Pro is the **anchor** -- positioned as the best value. Elite exists to make Pro look affordable.

&nbsp;

---

&nbsp;

## Implementation Plan

&nbsp;

### 1. Enable Stripe Integration

Use the Stripe tool to connect Stripe and create 3 products with monthly prices:

- Starter: Free (no Stripe product needed)

- Pro: $12/month

- Elite: $29/month

&nbsp;

### 2. Database: Subscriptions Table

Create a `subscriptions` table to track user plan status:

&nbsp;

```text

subscriptions

- id (uuid, PK)

- user_id (uuid, references auth.users, unique)

- stripe_customer_id (text)

- stripe_subscription_id (text)

- plan (text: 'starter' | 'pro' | 'elite')

- status (text: 'active' | 'canceled' | 'past_due')

- current_period_end (timestamptz)

- created_at, updated_at

```

&nbsp;

Add a `course_generation_count` column to the `profiles` table or a separate `usage_tracking` table to enforce monthly limits.

&nbsp;

RLS: Users can only read their own subscription. Insert/update handled by edge function with service role.

&nbsp;

### 3. Edge Functions

&nbsp;

**`create-checkout`**: Creates a Stripe Checkout session for Pro or Elite. Redirects user to Stripe-hosted payment page.

&nbsp;

**`stripe-webhook`**: Listens for Stripe events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) and updates the `subscriptions` table.

&nbsp;

**`customer-portal`**: Creates a Stripe Customer Portal session for managing/canceling subscriptions.

&nbsp;

### 4. New Pricing Page (`src/pages/Pricing.tsx`)

A dedicated `/pricing` page with:

- 3 cards side-by-side (Starter, Pro highlighted as "Most Popular", Elite)

- Feature comparison list for each tier

- CTA buttons: "Get Started Free", "Subscribe to Pro", "Go Elite"

- Toggle for monthly/annual (annual = 2 months free: $120/yr Pro, $290/yr Elite)

- FAQ section at bottom

&nbsp;

### 5. Update Navigation

- Add "Pricing" link to the landing page Header nav

- Add "Upgrade" button in the sidebar for free users

- Add plan badge on Profile page

&nbsp;

### 6. Enforce Limits Throughout the App

&nbsp;

**Course generation (`src/pages/Courses.tsx`)**:

- Before generating, check user's plan and monthly usage

- Show upgrade prompt when limit reached

&nbsp;

**Labs (`src/components/labs/*`)**:

- Starter users see only simulation labs

- Pro/Elite unlock all lab types

&nbsp;

**Community (`src/pages/Community.tsx`)**:

- Starter: read-only (hide create post button)

- Pro/Elite: full access

&nbsp;

**Challenges (`src/pages/Challenges.tsx`)**:

- Starter: view challenges but can't submit

- Pro/Elite: full participation

&nbsp;

**Certificates (`src/components/courses/CertificateCard.tsx`)**:

- Gate certificate generation behind Pro+

&nbsp;

**Progress (`src/pages/ProgressPage.tsx`)**:

- Starter: basic stats

- Pro: detailed analytics

- Elite: behavioral insights section

&nbsp;

### 7. Upgrade Prompts

Create a reusable `<UpgradePrompt>` component that appears contextually when a user hits a limit. Shows what they'd unlock by upgrading with a direct link to checkout.

&nbsp;

### 8. Plan Hook (`useSubscription`)

A custom hook that:

- Fetches the user's current subscription from the `subscriptions` table

- Exposes `plan`, `isProOrAbove`, `isElite`, `canGenerateCourse()`, `canAccessLabs()`, etc.

- Used throughout the app for gating features

&nbsp;

---

&nbsp;

## Files to Create/Modify

&nbsp;

| File | Action |

|------|--------|

| `src/pages/Pricing.tsx` | Create -- full pricing page with 3 tiers |

| `src/hooks/useSubscription.ts` | Create -- plan checking hook |

| `src/components/pricing/PricingCard.tsx` | Create -- reusable pricing card component |

| `src/components/pricing/UpgradePrompt.tsx` | Create -- contextual upgrade modal |

| `supabase/functions/create-checkout/index.ts` | Create -- Stripe checkout session |

| `supabase/functions/stripe-webhook/index.ts` | Create -- webhook handler |

| `supabase/functions/customer-portal/index.ts` | Create -- manage subscription |

| `src/App.tsx` | Add `/pricing` route |

| `src/components/layout/Header.tsx` | Add Pricing nav link |

| `src/components/layout/AppSidebar.tsx` | Add Upgrade button for free users |

| `src/pages/Courses.tsx` | Add generation limit check |

| `src/pages/Community.tsx` | Gate posting behind Pro+ |

| `src/pages/Challenges.tsx` | Gate participation behind Pro+ |

| `src/pages/Profile.tsx` | Show current plan badge |

| `src/components/courses/CertificateCard.tsx` | Gate behind Pro+ |

| Database migration | Create `subscriptions` and `usage_tracking` tables |

&nbsp;

## Sequencing

1. Enable Stripe integration (tool call)

2. Create database tables + RLS

3. Create edge functions (checkout, webhook, portal)

4. Build Pricing page + components

5. Add `useSubscription` hook

6. Wire up feature gating across existing pages

7. Update navigation