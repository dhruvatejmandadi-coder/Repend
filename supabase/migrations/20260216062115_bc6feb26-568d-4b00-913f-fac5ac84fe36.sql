
CREATE TABLE public.lab_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lab_id text NOT NULL,
  metrics jsonb DEFAULT '{}'::jsonb,
  decisions jsonb DEFAULT '[]'::jsonb,
  decision_style text,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lab results"
ON public.lab_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lab results"
ON public.lab_results FOR INSERT
WITH CHECK (auth.uid() = user_id);
