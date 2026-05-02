-- =====================================================
-- 045: 商家商品「收藏」(Save / Bookmark) 功能
-- =====================================================
--
-- 与 044 的「想要」(want) 完全平行，但语义独立 —— 镜像 posts 上同时存在
-- post_likes / post_favorites / post_wants 三种关联的设计：
--   - 喜欢 (like)   ：032/init —— 「这件商品我喜欢」(轻量、用于推荐排序)
--   - 收藏 (save)   ：本迁移   —— 「我想之后再看」(书签/备忘)
--   - 想要 (want)   ：044       —— 「加入愿望单」(强意图，触发 want_clicked 等级行为)
--
-- 三者必须分表：合并到单张关联表会强行塞 type 列、破坏 UNIQUE(product_id,
-- user_id) 的约束语义；下游"我的喜欢/收藏/愿望单"列表也要绕个 case-when。
-- 多张窄表查询性能更好（部分索引能直接命中），与现有 like/want 的代码路径
-- 一比一对称。
-- =====================================================


-- 1. store_products 增加 favorite_count（和 want_count 风格保持一致）
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS favorite_count INTEGER DEFAULT 0;


-- 2. 商品收藏表
CREATE TABLE IF NOT EXISTS store_product_favorites (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_product_favorites_user
    ON store_product_favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_product_favorites_product
    ON store_product_favorites(product_id);


-- 3. RPC：增/减 favorite_count（命名与 increment_post_favorite_count 对齐）
CREATE OR REPLACE FUNCTION increment_store_product_favorite_count(product_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE store_products
       SET favorite_count = favorite_count + 1
     WHERE id = product_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_store_product_favorite_count(product_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE store_products
       SET favorite_count = GREATEST(0, favorite_count - 1)
     WHERE id = product_id_param;
END;
$$ LANGUAGE plpgsql;
