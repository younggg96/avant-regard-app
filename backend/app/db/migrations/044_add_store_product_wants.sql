-- =====================================================
-- 044: 商家商品「想要」(愿望单) 功能
-- =====================================================
--
-- 镜像 029 在 posts 上做的事：
--   - store_products 增加 want_count
--   - 新增 store_product_wants 关联表 + 索引
--   - 增/减计数的 RPC 函数（保持和 posts 一致的命名约定）
--
-- 设计决策：
--   - 不复用 post_wants 表 —— 商品不在 posts 模型里，user_post_wants.post_id
--     是 BIGINT REFERENCES posts(id)，硬塞 product_id 会污染外键语义。
--   - want_count 用 RPC 维护，与 like_count 的"读-改-写"不同，是为了和 posts
--     的实现严格一致（`increment_post_want_count`），便于 ops 排查和未来抽公共。
-- =====================================================


-- 1. store_products 增加 want_count
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS want_count INTEGER DEFAULT 0;


-- 2. 商品想要表
CREATE TABLE IF NOT EXISTS store_product_wants (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_product_wants_user
    ON store_product_wants(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_product_wants_product
    ON store_product_wants(product_id);


-- 3. RPC 函数：增/减 want_count
CREATE OR REPLACE FUNCTION increment_store_product_want_count(product_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE store_products
       SET want_count = want_count + 1
     WHERE id = product_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_store_product_want_count(product_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE store_products
       SET want_count = GREATEST(0, want_count - 1)
     WHERE id = product_id_param;
END;
$$ LANGUAGE plpgsql;
