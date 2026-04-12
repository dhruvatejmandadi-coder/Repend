-- Create challenges table
CREATE TABLE public.challenges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    youtube_url TEXT,
    is_daily BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create challenge comments table
CREATE TABLE public.challenge_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create challenge participations table
CREATE TABLE public.challenge_participations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participations ENABLE ROW LEVEL SECURITY;

-- Challenges policies (public read, admin write later)
CREATE POLICY "Anyone can view challenges" 
ON public.challenges 
FOR SELECT 
USING (true);

-- Comments policies
CREATE POLICY "Anyone can view comments" 
ON public.challenge_comments 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can comment" 
ON public.challenge_comments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can comment" 
ON public.challenge_comments 
FOR INSERT 
WITH CHECK (user_id IS NULL AND author_name IS NOT NULL);

CREATE POLICY "Users can delete their own comments" 
ON public.challenge_comments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Participations policies
CREATE POLICY "Anyone can view participations" 
ON public.challenge_participations 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can participate" 
ON public.challenge_participations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their participation" 
ON public.challenge_participations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add updated_at trigger for challenges
CREATE TRIGGER update_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();