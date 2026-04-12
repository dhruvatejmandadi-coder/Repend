
-- Add user_id column to challenges table for personal challenges
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS user_id uuid;

-- Allow authenticated users to insert their own challenges
CREATE POLICY "Users can insert their own challenges"
ON public.challenges
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own challenges
CREATE POLICY "Users can delete their own challenges"
ON public.challenges
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
