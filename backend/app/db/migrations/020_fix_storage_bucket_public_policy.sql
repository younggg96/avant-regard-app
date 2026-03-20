-- Migration 020: Fix storage bucket public access
-- The images bucket was created without public=true, causing "Bucket not found"
-- when accessing files via the public URL path.

UPDATE storage.buckets SET public = true WHERE id = 'images';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow public read access on images'
    ) THEN
        CREATE POLICY "Allow public read access on images"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'images');
    END IF;
END $$;
