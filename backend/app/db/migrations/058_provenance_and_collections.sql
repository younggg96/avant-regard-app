-- =====================================================
-- Migration 058: 交易系统 Phase 3 — 履历 / 价格基准 / 多收藏夹
-- =====================================================
--
-- PRD 模块三对应的数据基础：
--   (a) product_provenance_events  —— Provenance Strip 数据源
--   (b) product_price_history      —— 价格基准柱状图数据源
--   (c) user_collections           —— 多收藏夹分组
--   (d) ALTER store_product_favorites ADD COLUMN collection_id
-- =====================================================


-- ---------------------------------------------------------
-- (a) product_provenance_events —— 单品履历事件
-- ---------------------------------------------------------
-- event_type:
--   - origin_show       品牌秀场原始亮相
--   - merchant_acquired 买手店入手
--   - collector_owned   藏家持有
--   - on_sale_now       当前在售
--   - sold              成交完成（P4 完成订单时写）
--   - resale            转卖发布（P6 一键转卖时写）
-- actor_kind:
--   - brand / merchant / user / system
CREATE TABLE IF NOT EXISTS product_provenance_events (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL,
    actor_kind VARCHAR(16) NOT NULL,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE SET NULL,
    actor_brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL,
    occurred_at DATE,                              -- 业务发生日期；无精确时间用 DATE 即可
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provenance_product
    ON product_provenance_events(product_id, occurred_at DESC NULLS LAST, id);


-- ---------------------------------------------------------
-- (b) product_price_history —— 历史成交价（基准柱状图）
-- ---------------------------------------------------------
-- 当订单完成时（P4）由 settlement_service 落入；Phase 3 也允许 admin 批量导入。
-- 关键查询：按 brand + (category|size|condition) 聚合 N 个月分桶。
CREATE TABLE IF NOT EXISTS product_price_history (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    brand_name VARCHAR(200),
    category_id BIGINT REFERENCES store_product_categories(id) ON DELETE SET NULL,
    size VARCHAR(32),
    condition VARCHAR(16),
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    currency VARCHAR(10) DEFAULT 'CNY',
    sold_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    source VARCHAR(16) DEFAULT 'order',           -- 'order' / 'manual'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_brand_time
    ON product_price_history(brand_name, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_brand_condition
    ON product_price_history(brand_name, condition, sold_at DESC);


-- ---------------------------------------------------------
-- (c) user_collections —— 用户多收藏夹
-- ---------------------------------------------------------
-- visibility: 'private' / 'public'
CREATE TABLE IF NOT EXISTS user_collections (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    visibility VARCHAR(16) NOT NULL DEFAULT 'private',
    cover_product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

DROP TRIGGER IF EXISTS trg_user_collections_updated_at ON user_collections;
CREATE TRIGGER trg_user_collections_updated_at
    BEFORE UPDATE ON user_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------
-- (d) ALTER store_product_favorites 关联到具体收藏夹
-- ---------------------------------------------------------
-- 兼容性：原来的 (product_id, user_id) UNIQUE 仍保留；同一商品只能存在于「默认收藏夹」
-- 或某个用户自建夹之一。FE 在切换夹时通过 UPDATE 改 collection_id。
ALTER TABLE store_product_favorites
    ADD COLUMN IF NOT EXISTS collection_id BIGINT
        REFERENCES user_collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_product_favorites_collection
    ON store_product_favorites(collection_id)
    WHERE collection_id IS NOT NULL;
