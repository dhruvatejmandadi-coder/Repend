ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS lab_type text DEFAULT NULL;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS lab_data jsonb DEFAULT NULL;