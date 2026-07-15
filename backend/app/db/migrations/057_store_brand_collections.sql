-- =====================================================
-- Migration 057: 买手店品牌图集（Brand Collections）
-- =====================================================
--
-- 新增表：
--   store_brand_collections —— 商家为店铺主营品牌上传的图集卡片
--     (品牌名 / 封面图 / 排序 / 状态)。消费端 BuyerTab 渲染成
--     "BRAND COLLECTIONS" 横向卡片画廊，点开展开该品牌下的单品。
--
-- 设计要点：
--   - brand_name 与 store_products.brand 用字符串关联（大小写不敏感匹配
--     由查询层处理），不强制外键：商品可以先于图集存在，反之亦然。
--   - UNIQUE(store_id, brand_name) 防止同店重复品牌卡。
--   - status PUBLISHED/HIDDEN 语义与 store_entry_cards 一致。
-- =====================================================

CREATE TABLE IF NOT EXISTS store_brand_collections (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    brand_name VARCHAR(200) NOT NULL,
    cover_image TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_store_brand_collections_store
    ON store_brand_collections(store_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_store_brand_collections_published
    ON store_brand_collections(store_id) WHERE status = 'PUBLISHED';

DROP TRIGGER IF EXISTS trg_store_brand_collections_updated_at ON store_brand_collections;
CREATE TRIGGER trg_store_brand_collections_updated_at
    BEFORE UPDATE ON store_brand_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 品牌维度的商品筛选（BuyerTab 展开品牌卡时按 brand 精确过滤）
CREATE INDEX IF NOT EXISTS idx_store_products_brand
    ON store_products(store_id, brand)
    WHERE status = 'PUBLISHED' AND brand IS NOT NULL;
