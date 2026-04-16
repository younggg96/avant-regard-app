-- Feed v2.1: Three-stage slot dispatch
-- Stage 1 (slots 1-6):   Fresh — ORDER BY created_at DESC. Light cache.
-- Stage 2 (slots 7-27):  Scored — HN-style with 24h + brand boosts. Time-boxed to 30 days.
-- Stage 3 (slots 28+):   Long-tail — base HN score, wider 90-day window, no boosts.
--
-- Key hard constraint (time-boxed recall):
--   Every scoring query is bounded by a time window so the DB never does a full table scan.
--
-- This migration only amends the scoring RPC (narrower window + exponent 1.2 per spec)
-- and adds a new long-tail RPC. Indexes from 033 are reused.

-- Supporting index for long-tail created_at ordering with feed filters.
CREATE INDEX IF NOT EXISTS idx_posts_feed_longtail
  ON posts (created_at DESC)
  WHERE status = 'PUBLISHED'
    AND audit_status = 'APPROVED'
    AND community_id IS NULL
    AND grade IN ('A', 'B', 'C');

-- -----------------------------------------------------------------------------
-- Stage 2: scored RPC (refined)
--   Score = (likes*1 + saves*2 + wants*3) / (hours_since_post + 2)^1.2
--   * 2.0 if posted within 24h
--   * 10.0 if brand_ids contains p_boost_brand_id
--   Time window: created_at >= NOW() - p_window  (default 30 days)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_feed_scored(
  p_user_id        BIGINT    DEFAULT NULL,
  p_exclude_ids    BIGINT[]  DEFAULT '{}',
  p_boost_brand_id INTEGER   DEFAULT NULL,
  p_blocked_ids    BIGINT[]  DEFAULT '{}',
  p_limit          INTEGER   DEFAULT 20,
  p_window         INTERVAL  DEFAULT INTERVAL '30 days'
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
            1.2
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
      -- Performance: hard time-box to avoid full-table scan.
      AND p.created_at >= NOW() - p_window
      -- Rule 1: dedup
      AND (ARRAY_LENGTH(p_exclude_ids, 1) IS NULL OR p.id != ALL(p_exclude_ids))
      -- Blocked users at SQL layer (preserves LIMIT integrity)
      AND (ARRAY_LENGTH(p_blocked_ids, 1) IS NULL OR p.user_id != ALL(p_blocked_ids))
      -- Include graded posts OR ungraded-but-recent (< 1h) posts awaiting async grading
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

COMMENT ON FUNCTION get_feed_scored IS
  'Feed v2.1 stage-2 scored RPC: HN decay exponent 1.2, 24h + brand boosts, 30-day time-boxed recall.';

-- -----------------------------------------------------------------------------
-- Stage 3: long-tail RPC
--   Pure chronological cursor pagination driven by exclude_ids.
--   No scoring, no boosts. Cheapest possible query.
--   Time window is widened (default 90 days) so users can still dig back further
--   than stage 2 but we never scan the entire posts table.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_feed_longtail(
  p_exclude_ids BIGINT[]  DEFAULT '{}',
  p_blocked_ids BIGINT[]  DEFAULT '{}',
  p_limit       INTEGER   DEFAULT 20,
  p_window      INTERVAL  DEFAULT INTERVAL '90 days'
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
  SELECT
    p.id, p.user_id, p.post_type, p.status, p.audit_status,
    p.title, p.content_text, p.image_urls,
    p.product_name, p.brand_name, p.rating,
    p.show_ids, p.community_id, p.brand_ids,
    p.item_brand, p.item_brand_id, p.item_category,
    p.item_sizes, p.item_colors,
    p.like_count, p.favorite_count, p.comment_count, p.want_count,
    p.grade, p.created_at, p.updated_at,
    NULL::DOUBLE PRECISION AS feed_score
  FROM posts p
  WHERE p.status = 'PUBLISHED'
    AND p.audit_status = 'APPROVED'
    AND p.community_id IS NULL
    AND p.grade IN ('A', 'B', 'C')
    AND p.created_at >= NOW() - p_window
    AND (ARRAY_LENGTH(p_exclude_ids, 1) IS NULL OR p.id != ALL(p_exclude_ids))
    AND (ARRAY_LENGTH(p_blocked_ids, 1) IS NULL OR p.user_id != ALL(p_blocked_ids))
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_feed_longtail IS
  'Feed v2.1 stage-3 long-tail RPC: chronological cursor pagination, 90-day time-boxed, no boosts.';
