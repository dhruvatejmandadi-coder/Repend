
ALTER TABLE public.courses ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Allow anyone to view public courses
CREATE POLICY "Anyone can view public courses"
ON public.courses
FOR SELECT
TO public
USING (is_public = true);
