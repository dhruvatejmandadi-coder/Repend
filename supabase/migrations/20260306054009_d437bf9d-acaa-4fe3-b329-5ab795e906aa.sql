
-- RLS policies for course-uploads bucket
-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload course files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own course files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own course files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role to read files (for edge functions)
CREATE POLICY "Service role can read course files"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'course-uploads');

-- Set file size limit on bucket (10MB)
UPDATE storage.buckets 
SET file_size_limit = 10485760
WHERE id = 'course-uploads';
