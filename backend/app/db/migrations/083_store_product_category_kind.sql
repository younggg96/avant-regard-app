-- ===========================================================
-- 083 · store_products.category_kind（PRD 6 大类）
-- ===========================================================
-- 背景：
--   交易大厅筛选（MarketplaceFilterSheet）按 PRD 6 大类
--   （外套/上衣/裤装/鞋履/包袋/配饰）过滤；旧逻辑只能靠
--   store_product_categories.name 模糊匹配反查 category_id，
--   但个人卖家（C2C，store_id IS NULL）没有自建分类行，
--   导致发布单品时选的分类无法落库、也筛不出来。
--
--   本迁移给 store_products 增加 category_kind 列，直接存 PRD
--   大类名。发布单品 Step1 选的分类写入此列；筛选时按此列
--   精确匹配（与按名称反查 category_id 取 OR）。
-- ---------------------------------------------------------

ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS category_kind VARCHAR(16);

-- 仅允许 PRD 6 大类；NULL 表示未分类（兼容历史数据 / 草稿）。
ALTER TABLE store_products
    DROP CONSTRAINT IF EXISTS chk_store_products_category_kind;
ALTER TABLE store_products
    ADD CONSTRAINT chk_store_products_category_kind CHECK (
        category_kind IS NULL
     OR category_kind IN ('外套', '上衣', '裤装', '鞋履', '包袋', '配饰')
    );

-- 按 PRD 大类筛选是高频路径，建部分索引（只索引在售单品）。
CREATE INDEX IF NOT EXISTS idx_store_products_category_kind
    ON store_products (category_kind)
    WHERE status = 'active';
