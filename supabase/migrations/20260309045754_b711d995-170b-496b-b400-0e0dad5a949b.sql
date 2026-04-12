
-- Add bio column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';

-- Allow authenticated users to view any profile (for public profile viewing)
CREATE POLICY "Authenticated users can view any profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Create post_reports table
CREATE TABLE public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'inappropriate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report posts"
ON public.post_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports"
ON public.post_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
