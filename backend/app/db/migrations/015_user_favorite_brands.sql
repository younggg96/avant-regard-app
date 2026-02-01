-- =====================================================
-- 用户喜欢的品牌表迁移
-- =====================================================

-- 创建用户喜欢的品牌关联表
CREATE TABLE IF NOT EXISTS user_favorite_brands (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    brand_id BIGINT REFERENCES brands(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, brand_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_favorite_brands_user_id ON user_favorite_brands(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_brands_brand_id ON user_favorite_brands(brand_id);

-- 添加注释
COMMENT ON TABLE user_favorite_brands IS '用户喜欢的品牌关联表';
COMMENT ON COLUMN user_favorite_brands.user_id IS '用户ID';
COMMENT ON COLUMN user_favorite_brands.brand_id IS '品牌ID';
