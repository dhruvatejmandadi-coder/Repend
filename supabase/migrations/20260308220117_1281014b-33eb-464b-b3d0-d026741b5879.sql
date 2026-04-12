ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'medium';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS challenge_type text DEFAULT 'problem_solving';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS objective text DEFAULT NULL;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS instructions text DEFAULT NULL;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS problem text DEFAULT NULL;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS hints jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS solution text DEFAULT NULL;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS solution_explanation text DEFAULT NULL;