-- Migration: Support half-star ratings (0.5 increments)
-- Changes INTEGER rating columns to NUMERIC(2,1) with CHECK for 0.5 steps

-- 1. posts.rating: INTEGER -> NUMERIC(2,1)
ALTER TABLE posts
  ALTER COLUMN rating TYPE NUMERIC(2, 1) USING rating::NUMERIC(2, 1);

ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_rating_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_rating_check
  CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = FLOOR(rating * 2));

-- 2. buyer_store_ratings.rating: drop dependent view first
DROP VIEW IF EXISTS buyer_store_rating_stats;

ALTER TABLE buyer_store_ratings
  ALTER COLUMN rating TYPE NUMERIC(2, 1) USING rating::NUMERIC(2, 1);

ALTER TABLE buyer_store_ratings
  DROP CONSTRAINT IF EXISTS buyer_store_ratings_rating_check;

ALTER TABLE buyer_store_ratings
  ADD CONSTRAINT buyer_store_ratings_rating_check
  CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = FLOOR(rating * 2));

-- Recreate the view with half-star aware counts
CREATE OR REPLACE VIEW buyer_store_rating_stats AS
SELECT
    store_id,
    COUNT(*) as rating_count,
    ROUND(AVG(rating)::numeric, 1) as average_rating,
    COUNT(CASE WHEN rating >= 4.5 THEN 1 END) as five_star_count,
    COUNT(CASE WHEN rating >= 3.5 AND rating < 4.5 THEN 1 END) as four_star_count,
    COUNT(CASE WHEN rating >= 2.5 AND rating < 3.5 THEN 1 END) as three_star_count,
    COUNT(CASE WHEN rating >= 1.5 AND rating < 2.5 THEN 1 END) as two_star_count,
    COUNT(CASE WHEN rating < 1.5 THEN 1 END) as one_star_count
FROM buyer_store_ratings
GROUP BY store_id;

-- 3. show_image_reviews.rating: INTEGER -> NUMERIC(2,1)
ALTER TABLE show_image_reviews
  ALTER COLUMN rating TYPE NUMERIC(2, 1) USING rating::NUMERIC(2, 1);

ALTER TABLE show_image_reviews
  DROP CONSTRAINT IF EXISTS show_image_reviews_rating_check;

ALTER TABLE show_image_reviews
  ADD CONSTRAINT show_image_reviews_rating_check
  CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = FLOOR(rating * 2));
