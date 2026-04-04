-- 品牌关注表
CREATE TABLE IF NOT EXISTS brand_follows (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    brand_id BIGINT REFERENCES brands(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_follows_user_id ON brand_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_follows_brand_id ON brand_follows(brand_id);
