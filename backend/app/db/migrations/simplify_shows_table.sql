-- =====================================================
-- 简化 shows 表结构 - 删除不需要的字段
-- =====================================================

-- 删除不需要的字段
ALTER TABLE shows DROP COLUMN IF EXISTS designer_id;
ALTER TABLE shows DROP COLUMN IF EXISTS city;
ALTER TABLE shows DROP COLUMN IF EXISTS collection_ts;
ALTER TABLE shows DROP COLUMN IF EXISTS original_offset;
ALTER TABLE shows DROP COLUMN IF EXISTS review_title;
ALTER TABLE shows DROP COLUMN IF EXISTS review_author;
ALTER TABLE shows DROP COLUMN IF EXISTS review_text;

-- 删除相关的索引（如果存在）
DROP INDEX IF EXISTS idx_shows_designer_id;

-- =====================================================
-- 简化后的 shows 表结构将是：
-- =====================================================
-- id              bigserial PRIMARY KEY
-- show_url        text
-- season          varchar(100) NOT NULL
-- category        varchar(100)
-- brand_name      varchar(200)
-- title           varchar(200)
-- cover_image     text
-- year            integer
-- created_at      timestamptz
-- updated_at      timestamptz
