-- =====================================================================
-- 077_drop_listing_year_decade.sql
-- =====================================================================
-- 移除 store_products.year_decade 字段。
--
-- 背景:
--   - 单品发布表单原本要求卖家选「年代」(1950s ~ 2020s), 但实际上多数卖家
--     无法准确判断衣物年份, 强制选会大量乱填, 反而污染按年代筛选的数据。
--   - 产品决定彻底移除该字段, 前后端 schema / UI 都同步删掉, 而不是仅"选填"
--     —— 避免遗留无用字段长期沉淀。
--
-- 影响:
--   - 后端 schema (`StoreProductCreate / Update / StoreProduct`) 同步去掉
--     `yearDecade` 字段; service 层不再读写 `year_decade` 列。
--   - 前端发布表单删除该 chip 行; `MarketplaceFilter` / 详情页本来就没用它。
--   - completeness_score trigger 不依赖 year_decade, 无需重建。
--   - 066 中的 `brand_price_history` view 同样不引用 year_decade, 无需重建。
--
-- 兼容:
--   - 老数据丢弃即可, 没有业务功能依赖这一列。
-- =====================================================================

ALTER TABLE store_products
    DROP COLUMN IF EXISTS year_decade;
