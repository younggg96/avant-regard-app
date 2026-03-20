-- Migration 021: Add INSERT / UPDATE / DELETE policies for the images bucket
-- service_role bypasses RLS, but explicit policies ensure the bucket is
-- usable from authenticated clients as well.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow authenticated uploads to images'
    ) THEN
        CREATE POLICY "Allow authenticated uploads to images"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow authenticated updates to images'
    ) THEN
        CREATE POLICY "Allow authenticated updates to images"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow authenticated deletes on images'
    ) THEN
        CREATE POLICY "Allow authenticated deletes on images"
        ON storage.objects FOR DELETE
        USING (bucket_id = 'images');
    END IF;
END $$;
