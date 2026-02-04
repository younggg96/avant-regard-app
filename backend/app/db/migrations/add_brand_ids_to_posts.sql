-- Migration: Add brand_ids column to posts table
-- This column stores an array of brand IDs that a post is associated with

-- Add brand_ids column to posts table (array of integers)
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS brand_ids INTEGER[] DEFAULT '{}';

-- Create index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_posts_brand_ids ON posts USING GIN (brand_ids);

-- Comment on column
COMMENT ON COLUMN posts.brand_ids IS 'Array of brand IDs associated with this post';
