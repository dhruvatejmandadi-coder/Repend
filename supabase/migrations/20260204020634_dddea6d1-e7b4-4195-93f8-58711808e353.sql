-- Add image_url column to community_posts
ALTER TABLE public.community_posts 
ADD COLUMN image_url TEXT;

-- Create storage bucket for community images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('community-images', 'community-images', true);

-- Storage policies for community images
CREATE POLICY "Anyone can view community images"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-images');

CREATE POLICY "Authenticated users can upload community images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'community-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own community images"
ON storage.objects FOR DELETE
USING (bucket_id = 'community-images' AND auth.uid()::text = (storage.foldername(name))[1]);