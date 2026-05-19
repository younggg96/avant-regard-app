-- Feed Recommendation: Hacker News-style scoring RPC
-- Rules implemented in SQL:
--   Rule 0: Score = (likes*1 + saves*2 + wants*3) / (hours_since_post + 2)^1.5
--   Rule 2: Posts within 24h get Score * 2
--   Rule 5/6: boost_brand_id match gets Score * 10
--   Rule 1: exclude_ids filtering (dedup, replaces OFFSET)

-- Performance indexes (non-CONCURRENTLY for transaction safety)
CREATE INDEX IF NOT EXISTS idx_posts_feed_base
  ON posts (created_at DESC)
  WHERE status = 'PUBLISHED'
    AND audit_status = 'APPROVED'
    AND community_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_brand_ids
  ON posts USING GIN (brand_ids);

-- Main RPC: get_feed_scored
-- Design: no OFFSET — dedup is handled entirely by exclude_ids sliding window.
-- This avoids the "shifting scores cause skipped/duplicate rows" problem.
CREATE OR REPLACE FUNCTION get_feed_scored(
  p_user_id        BIGINT    DEFAULT NULL,
  p_exclude_ids    BIGINT[]  DEFAULT '{}',
  p_boost_brand_id INTEGER   DEFAULT NULL,
  p_blocked_ids    BIGINT[]  DEFAULT '{}',
  p_limit          INTEGER   DEFAULT 30
)
RETURNS TABLE (
  id              BIGINT,
  user_id         BIGINT,
  post_type       VARCHAR,
  status          VARCHAR,
  audit_status    VARCHAR,
  title           VARCHAR,
  content_text    TEXT,
  image_urls      TEXT[],
  product_name    VARCHAR,
  brand_name      VARCHAR,
  rating          NUMERIC,
  show_ids        TEXT[],
  community_id    INTEGER,
  brand_ids       INTEGER[],
  item_brand      VARCHAR,
  item_brand_id   INTEGER,
  item_category   VARCHAR,
  item_sizes      TEXT[],
  item_colors     TEXT[],
  like_count      INTEGER,
  favorite_count  INTEGER,
  comment_count   INTEGER,
  want_count      INTEGER,
  grade           TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  feed_score      DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  WITH scored AS (
    SELECT
      p.*,
      (
        (COALESCE(p.like_count, 0) * 1.0
         + COALESCE(p.favorite_count, 0) * 2.0
         + COALESCE(p.want_count, 0) * 3.0)
        / POWER(
            GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 0) + 2,
            1.5
          )
      )
      * CASE WHEN p.created_at >= NOW() - INTERVAL '24 hours' THEN 2.0 ELSE 1.0 END
      * CASE
          WHEN p_boost_brand_id IS NOT NULL
               AND p.brand_ids @> ARRAY[p_boost_brand_id]
          THEN 10.0
          ELSE 1.0
        END
      AS feed_score
    FROM posts p
    WHERE p.status = 'PUBLISHED'
      AND p.audit_status = 'APPROVED'
      AND p.community_id IS NULL
      -- Rule 1: dedup — exclude already-seen posts
      AND (ARRAY_LENGTH(p_exclude_ids, 1) IS NULL OR p.id != ALL(p_exclude_ids))
      -- Filter blocked users at SQL level to guarantee correct LIMIT count
      AND (ARRAY_LENGTH(p_blocked_ids, 1) IS NULL OR p.user_id != ALL(p_blocked_ids))
      -- Include graded (A/B/C) OR ungraded-but-recent posts (< 1h, awaiting async grading)
      AND (
        (p.grade IS NOT NULL AND p.grade IN ('A', 'B', 'C'))
        OR (p.grade IS NULL AND p.created_at >= NOW() - INTERVAL '1 hour')
      )
  )
  SELECT
    s.id, s.user_id, s.post_type, s.status, s.audit_status,
    s.title, s.content_text, s.image_urls,
    s.product_name, s.brand_name, s.rating,
    s.show_ids, s.community_id, s.brand_ids,
    s.item_brand, s.item_brand_id, s.item_category,
    s.item_sizes, s.item_colors,
    s.like_count, s.favorite_count, s.comment_count, s.want_count,
    s.grade, s.created_at, s.updated_at,
    s.feed_score
  FROM scored s
  ORDER BY s.feed_score DESC, s.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_feed_scored(BIGINT, BIGINT[], INTEGER, BIGINT[], INTEGER) IS
  'Feed v2 RPC: HN time-decay scoring, 24h boost, brand boost, dedup via exclude_ids, blocked filtering at SQL level.';
