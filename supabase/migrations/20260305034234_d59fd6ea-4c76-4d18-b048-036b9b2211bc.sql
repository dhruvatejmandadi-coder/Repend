-- Create course-uploads storage bucket (private, 10MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('course-uploads', 'course-uploads', false, 10485760);

-- Storage RLS: users upload to their own folder
CREATE POLICY "Users can upload their own course files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'course-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own course files"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own course files"
ON storage.objects FOR DELETE
USING (bucket_id = 'course-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Usage tracking table
CREATE TABLE public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  courses_generated int NOT NULL DEFAULT 0,
  file_courses_generated int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
ON public.usage_tracking FOR SELECT
USING (auth.uid() = user_id);

-- Trigger for subscriptions updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();