ALTER TABLE public.courses ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

DROP POLICY IF EXISTS "Users can view their own courses" ON public.courses;
CREATE POLICY "Users can view their own courses" ON public.courses
  FOR SELECT TO public
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can view their own deleted courses" ON public.courses
  FOR SELECT TO public
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view public courses" ON public.courses;
CREATE POLICY "Anyone can view public courses" ON public.courses
  FOR SELECT TO public
  USING (is_public = true AND deleted_at IS NULL);