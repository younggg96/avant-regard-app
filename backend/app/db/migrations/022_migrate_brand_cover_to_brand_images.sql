-- Migration: move brands.cover_image into brand_images table
-- For every brand that has a cover_image not yet present in brand_images,
-- insert it as an APPROVED + selected entry.

INSERT INTO brand_images (brand_id, image_url, sort_order, status, is_selected)
SELECT b.id, b.cover_image, 0, 'APPROVED', true
FROM brands b
WHERE b.cover_image IS NOT NULL
  AND b.cover_image <> ''
  AND NOT EXISTS (
    SELECT 1 FROM brand_images bi
    WHERE bi.brand_id = b.id AND bi.image_url = b.cover_image
  );

-- Do NOT drop brands.cover_image yet for safe rollback.
-- After verifying migration success, a future migration can:
-- ALTER TABLE brands DROP COLUMN cover_image;
