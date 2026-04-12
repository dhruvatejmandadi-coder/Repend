-- Create table to store user survey responses for AI/mentor matching
CREATE TABLE public.user_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Section 1: Goals (array for multi-select)
  goals TEXT[] DEFAULT '{}',
  goals_other TEXT,
  
  -- Section 2: Challenges
  challenges TEXT[] DEFAULT '{}',
  challenges_other TEXT,
  
  -- Section 3: Subject/Field
  subject_area TEXT,
  subject_other TEXT,
  
  -- Section 4: Level
  skill_level TEXT,
  
  -- Section 5: Type of help
  help_types TEXT[] DEFAULT '{}',
  help_other TEXT,
  
  -- Section 6: Mentor personality
  mentor_personality TEXT[] DEFAULT '{}',
  mentor_other TEXT,
  
  -- Section 7: Learning style
  learning_styles TEXT[] DEFAULT '{}',
  learning_other TEXT,
  
  -- Section 8: Time commitment
  time_commitment TEXT,
  
  -- Section 9: Urgency
  urgency TEXT,
  
  -- Section 10: Success definition
  success_definition TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_surveys ENABLE ROW LEVEL SECURITY;

-- Users can view their own survey
CREATE POLICY "Users can view their own survey"
ON public.user_surveys FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own survey
CREATE POLICY "Users can insert their own survey"
ON public.user_surveys FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own survey
CREATE POLICY "Users can update their own survey"
ON public.user_surveys FOR UPDATE
USING (auth.uid() = user_id);

-- Anonymous users can insert surveys (for non-logged-in users)
CREATE POLICY "Anonymous users can insert surveys"
ON public.user_surveys FOR INSERT
WITH CHECK (user_id IS NULL);

-- Trigger for updated_at
CREATE TRIGGER update_user_surveys_updated_at
BEFORE UPDATE ON public.user_surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();