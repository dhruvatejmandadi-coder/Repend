
-- Allow viewing modules of public courses
CREATE POLICY "Anyone can view modules of public courses"
ON public.course_modules
FOR SELECT
TO public
USING (EXISTS (
  SELECT 1 FROM courses
  WHERE courses.id = course_modules.course_id
  AND courses.is_public = true
));
