-- =====================================================
-- 082: 商家商品「浏览记录」(Browsing History)
-- =====================================================
--
-- 与 045「收藏」(store_product_favorites) 平行的一张窄表，但语义不同：
--   - 收藏 (favorite) ：用户主动书签，强意图，需要去重 + 计数
--   - 浏览 (history)  ：用户进入商品详情页自动落库，弱意图，仅用于「最近看过」
--
-- 设计要点：
--   1. 每个 (product_id, user_id) 只保留一行 —— 重复浏览同一商品时
--      UPSERT 刷新 viewed_at，使其重新置顶到「浏览记录」列表最前。
--   2. 不维护 store_products 上的任何计数（view_count 已由详情页单独维护），
--      浏览记录纯粹是「按用户维度的最近访问序列」。
--   3. (user_id, viewed_at DESC) 复合索引直接命中「我的浏览记录」分页查询。
-- =====================================================


CREATE TABLE IF NOT EXISTS store_product_browsing_history (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_product_browsing_history_user
    ON store_product_browsing_history(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_product_browsing_history_product
    ON store_product_browsing_history(product_id);
