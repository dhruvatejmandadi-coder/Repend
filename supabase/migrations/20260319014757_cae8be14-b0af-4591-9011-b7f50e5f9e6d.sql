ALTER TABLE public.course_modules 
ADD COLUMN IF NOT EXISTS lab_generation_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS lab_blueprint jsonb,
ADD COLUMN IF NOT EXISTS lab_error text;