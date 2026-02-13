
-- Add structured lab fields to course_modules
ALTER TABLE public.course_modules
ADD COLUMN lab_type text DEFAULT NULL,
ADD COLUMN lab_data jsonb DEFAULT NULL;
