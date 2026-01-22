-- =====================================================
-- 买手店社区功能数据库迁移
-- 包含：用户提交买手店、评论、评分、点赞功能
-- =====================================================

-- =====================================================
-- 1. 用户提交的买手店表
-- =====================================================

CREATE TABLE IF NOT EXISTS user_submitted_stores (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    -- 基本信息
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    -- 详细信息
    brands TEXT[] DEFAULT '{}',
    style TEXT[] DEFAULT '{}',
    phone TEXT[] DEFAULT '{}',
    hours VARCHAR(200),
    description TEXT,
    images TEXT[] DEFAULT '{}',
    -- 审核相关
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
    reject_reason TEXT,
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    -- 审核通过后关联到正式买手店
    approved_store_id VARCHAR(100),
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. 买手店评论表
-- =====================================================

CREATE TABLE IF NOT EXISTS buyer_store_comments (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,  -- 关联买手店ID
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES buyer_store_comments(id) ON DELETE CASCADE,  -- 父评论ID
    reply_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. 买手店评论点赞表
-- =====================================================

CREATE TABLE IF NOT EXISTS buyer_store_comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT REFERENCES buyer_store_comments(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- =====================================================
-- 4. 买手店评分表
-- =====================================================

CREATE TABLE IF NOT EXISTS buyer_store_ratings (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,  -- 关联买手店ID
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, user_id)  -- 每个用户对每个店铺只能评一次分
);

-- =====================================================
-- 5. 买手店收藏表
-- =====================================================

CREATE TABLE IF NOT EXISTS buyer_store_favorites (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,  -- 关联买手店ID
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, user_id)
);

-- =====================================================
-- 6. 买手店评分统计视图
-- =====================================================

CREATE OR REPLACE VIEW buyer_store_rating_stats AS
SELECT 
    store_id,
    COUNT(*) as rating_count,
    ROUND(AVG(rating)::numeric, 1) as average_rating,
    COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
    COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
    COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
    COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
    COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
FROM buyer_store_ratings
GROUP BY store_id;

-- =====================================================
-- 7. 索引
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_submitted_stores_user_id ON user_submitted_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_submitted_stores_status ON user_submitted_stores(status);
CREATE INDEX IF NOT EXISTS idx_user_submitted_stores_city ON user_submitted_stores(city);
CREATE INDEX IF NOT EXISTS idx_user_submitted_stores_country ON user_submitted_stores(country);

CREATE INDEX IF NOT EXISTS idx_buyer_store_comments_store_id ON buyer_store_comments(store_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_comments_user_id ON buyer_store_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_comments_parent_id ON buyer_store_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_buyer_store_ratings_store_id ON buyer_store_ratings(store_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_ratings_user_id ON buyer_store_ratings(user_id);

CREATE INDEX IF NOT EXISTS idx_buyer_store_favorites_store_id ON buyer_store_favorites(store_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_favorites_user_id ON buyer_store_favorites(user_id);

-- =====================================================
-- 8. 触发器：自动更新 updated_at
-- =====================================================

CREATE TRIGGER update_user_submitted_stores_updated_at 
    BEFORE UPDATE ON user_submitted_stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyer_store_comments_updated_at 
    BEFORE UPDATE ON buyer_store_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyer_store_ratings_updated_at 
    BEFORE UPDATE ON buyer_store_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. 辅助函数
-- =====================================================

-- 增加评论回复数
CREATE OR REPLACE FUNCTION increment_reply_count(comment_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE buyer_store_comments
    SET reply_count = reply_count + 1
    WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql;

-- 减少评论回复数
CREATE OR REPLACE FUNCTION decrement_reply_count(comment_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE buyer_store_comments
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql;

-- 增加评论点赞数
CREATE OR REPLACE FUNCTION increment_comment_like_count(p_comment_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE buyer_store_comments
    SET like_count = like_count + 1
    WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql;

-- 减少评论点赞数
CREATE OR REPLACE FUNCTION decrement_comment_like_count(p_comment_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE buyer_store_comments
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql;
