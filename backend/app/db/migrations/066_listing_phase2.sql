-- =====================================================
-- Migration 065: 单品发布 Phase 2 (PRD 单品发布扩展)
-- =====================================================
--
-- 在 057 基础上为 PRD 单品发布加入：
--   · style_name        款式 / 系列（如 Runway 系列名）
--   · year_decade       年代（1950s, 1960s ... 2020s）
--   · accessories_note  配件说明（独立字段方便筛选展示）
--   · ship_from_country / state / city 国家 + 省/州 + 城市 三段式发货地
--   · shipping_fee_mode 运费方式：cod（到付）/ free（包邮）
--   · commission_rate_bps  上架时确认的平台抽佣率（1%）
--   · dedup_signature   防重复上架指纹
--
-- 同时落地：
--   · idx_store_products_dedup        (seller_user_id, dedup_signature) 唯一索引
--   · brand_price_history (VIEW)      品牌历史价格区间推荐数据源
--   · offers 在 store_products 下架时由 service 层批量 withdraw
-- =====================================================

ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS style_name        VARCHAR(200),
    ADD COLUMN IF NOT EXISTS year_decade       VARCHAR(8),
    ADD COLUMN IF NOT EXISTS accessories_note  TEXT,
    ADD COLUMN IF NOT EXISTS ship_from_country VARCHAR(80),
    ADD COLUMN IF NOT EXISTS ship_from_state   VARCHAR(80),
    ADD COLUMN IF NOT EXISTS ship_from_city    VARCHAR(80),
    ADD COLUMN IF NOT EXISTS shipping_fee_mode VARCHAR(16) DEFAULT 'cod',
    ADD COLUMN IF NOT EXISTS commission_rate_bps INT DEFAULT 100,
    ADD COLUMN IF NOT EXISTS dedup_signature   VARCHAR(64);

COMMENT ON COLUMN store_products.style_name        IS '款式 / Runway 系列名';
COMMENT ON COLUMN store_products.year_decade       IS '年代（1950s, 1960s, ... 2020s）';
COMMENT ON COLUMN store_products.accessories_note  IS '配件说明（防尘袋 / 原盒 / 票据）';
COMMENT ON COLUMN store_products.ship_from_country IS '发货国家（中文或英文，前端归一化）';
COMMENT ON COLUMN store_products.ship_from_state   IS '发货省份 / 州';
COMMENT ON COLUMN store_products.ship_from_city    IS '发货城市';
COMMENT ON COLUMN store_products.shipping_fee_mode IS '运费方式：cod (到付) | free (包邮)';
COMMENT ON COLUMN store_products.commission_rate_bps IS '平台抽佣率，单位 bps，默认 100 = 1%';
COMMENT ON COLUMN store_products.dedup_signature   IS '基于品牌+款式+尺码+颜色的指纹，用于防重复上架';

-- 1% 兜底：把历史已有行的抽佣率统一刷成 100 bps，避免旧 listing 显示成 0
UPDATE store_products
SET    commission_rate_bps = 100
WHERE  commission_rate_bps IS NULL OR commission_rate_bps = 0;

-- shipping_fee_mode CHECK：分两步走防止旧值冲突
UPDATE store_products
SET    shipping_fee_mode = 'cod'
WHERE  shipping_fee_mode IS NULL
   OR  shipping_fee_mode NOT IN ('cod', 'free');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE  table_name = 'store_products'
        AND    constraint_name = 'store_products_shipping_fee_mode_check'
    ) THEN
        ALTER TABLE store_products
        ADD CONSTRAINT store_products_shipping_fee_mode_check
        CHECK (shipping_fee_mode IN ('cod', 'free'));
    END IF;
END$$;

-- 防止同一卖家重复上架同一单品（指纹由 service 层填）
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_products_dedup
    ON store_products (seller_user_id, dedup_signature)
    WHERE seller_user_id IS NOT NULL
      AND dedup_signature IS NOT NULL
      AND status IN ('draft', 'reviewing', 'active', 'frozen');

-- =====================================================
-- 品牌历史价格区间推荐：物化为 VIEW，service 端缓存即可
-- =====================================================
DROP VIEW IF EXISTS brand_price_history;
CREATE VIEW brand_price_history AS
SELECT
    lower(trim(brand))                       AS brand_key,
    brand                                    AS brand_display,
    condition,
    COUNT(*)                                 AS sample_size,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY price_cents) AS p25_cents,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY price_cents) AS p50_cents,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY price_cents) AS p75_cents,
    MIN(price_cents)                          AS min_cents,
    MAX(price_cents)                          AS max_cents
FROM   store_products
WHERE  brand IS NOT NULL
  AND  trim(brand) <> ''
  AND  status IN ('active', 'sold')
  AND  price_cents > 0
GROUP  BY lower(trim(brand)), brand, condition;

COMMENT ON VIEW brand_price_history IS 'PRD 1.4 智能定价：按品牌 + 成色聚合的历史价格区间（active+sold）。';

-- =====================================================
-- 草稿数上限（不在 DB 层强制，由 service 层判断）
-- 这里只放一个辅助索引来加速 count
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_store_products_seller_status_draft
    ON store_products (seller_user_id, status)
    WHERE status = 'draft' AND seller_kind = 'individual';

-- =====================================================
-- 客服配置（找不到品牌 / 秀场时引导联系）
-- =====================================================
CREATE TABLE IF NOT EXISTS support_contact_config (
    id              SERIAL PRIMARY KEY,
    weekday_hours   VARCHAR(64) DEFAULT '09:00 - 21:00',
    weekend_hours   VARCHAR(64) DEFAULT '10:00 - 18:00',
    timezone        VARCHAR(32) DEFAULT 'Asia/Shanghai',
    wechat_id       VARCHAR(64),
    email           VARCHAR(120),
    notice          TEXT,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 默认一条记录（若已有则不动）
INSERT INTO support_contact_config (id, weekday_hours, weekend_hours, timezone, email, notice)
VALUES (1,
        '09:00 - 21:00',
        '10:00 - 18:00',
        'Asia/Shanghai',
        'support@avantregard.com',
        '工作日 09:00-21:00 · 周末 10:00-18:00 · 节假日延迟回复')
ON CONFLICT (id) DO NOTHING;
