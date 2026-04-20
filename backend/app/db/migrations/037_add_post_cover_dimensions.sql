-- Feed performance: store the natural pixel size of each post's cover image
-- so the discover masonry can render at the correct aspect ratio from the
-- very first frame, instead of decoding each image on the JS thread and
-- re-laying out the two-column waterfall after every new card enters the
-- viewport.
--
-- Rationale (see PROGRESS_LOG 2026-04-20 "瀑布流滚动掉帧根治"):
--   Before this change, the frontend relied on `Image.getSize` inside every
--   PostCard. That fires an async native round-trip while the user is
--   scrolling, each resolution triggers a `setState` → new aspectRatio →
--   MasonryFlashList re-balances its columns, producing per-card frame drops.
--   Publishing the cover dimensions alongside the post removes the async hop
--   entirely for newly-created posts; legacy rows stay NULL and fall back to
--   3/4 on the client (mild visual tradeoff; agreed with PM).
--
-- Both Stage 2 (scored) and Stage 3 (long-tail) feed RPCs declare explicit
-- RETURNS TABLE column lists, so we MUST recreate them here to surface the
-- new columns. Stage 1 uses `.select("*")` at the service layer, no change
-- needed there.

-- ---------------------------------------------------------------------------
-- 1. Schema: add nullable cover_width / cover_height to posts
-- ---------------------------------------------------------------------------
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS cover_width  INTEGER,
  ADD COLUMN IF NOT EXISTS cover_height INTEGER;

COMMENT ON COLUMN posts.cover_width  IS
  'Natural pixel width of the cover image (image_urls[0]); NULL for legacy posts.';
COMMENT ON COLUMN posts.cover_height IS
  'Natural pixel height of the cover image (image_urls[0]); NULL for legacy posts.';

-- ---------------------------------------------------------------------------
-- 2. Recreate Stage 2 RPC (get_feed_scored) with new columns
--    Only the RETURNS TABLE signature + outer SELECT list changes — the
--    scoring CTE still uses `p.*`, so it already carries the new columns.
--
--    Postgres forbids `CREATE OR REPLACE FUNCTION` from altering the
--    RETURNS TABLE column list (42P13). We DROP the old function by its
--    exact argument signature so future overloads, if any, are unaffected.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_feed_scored(
  BIGINT, BIGINT[], INTEGER, BIGINT[], INTEGER, INTERVAL
);

CREATE FUNCTION get_feed_scored(
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
  cover_width     INTEGER,
  cover_height    INTEGER,
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
      AND p.created_at >= NOW() - p_window
      AND (ARRAY_LENGTH(p_exclude_ids, 1) IS NULL OR p.id != ALL(p_exclude_ids))
      AND (ARRAY_LENGTH(p_blocked_ids, 1) IS NULL OR p.user_id != ALL(p_blocked_ids))
      AND (
        (p.grade IS NOT NULL AND p.grade IN ('A', 'B', 'C'))
        OR (p.grade IS NULL AND p.created_at >= NOW() - INTERVAL '1 hour')
      )
  )
  SELECT
    s.id, s.user_id, s.post_type, s.status, s.audit_status,
    s.title, s.content_text, s.image_urls,
    s.cover_width, s.cover_height,
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
  'Feed v2.1 stage-2 scored RPC (with cover_width/height for client-side masonry layout).';

-- ---------------------------------------------------------------------------
-- 3. Recreate Stage 3 RPC (get_feed_longtail) with new columns
--    Same 42P13 constraint as Stage 2 — drop by exact signature first.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_feed_longtail(
  BIGINT[], BIGINT[], INTEGER, INTERVAL
);

CREATE FUNCTION get_feed_longtail(
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
  cover_width     INTEGER,
  cover_height    INTEGER,
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
    p.cover_width, p.cover_height,
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
  'Feed v2.1 stage-3 long-tail RPC (with cover_width/height for client-side masonry layout).';
