-- =====================================================
-- 029: 添加帖子「想要」(愿望单) 功能
-- =====================================================

-- 1. posts 表增加 want_count 字段
ALTER TABLE posts ADD COLUMN IF NOT EXISTS want_count INTEGER DEFAULT 0;

-- 2. 帖子想要表
CREATE TABLE IF NOT EXISTS post_wants (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_wants_user_id ON post_wants(user_id);
CREATE INDEX IF NOT EXISTS idx_post_wants_post_id ON post_wants(post_id);

-- 3. user_info 表增加 hide_wishlist 隐私设置字段（默认 false = 公开）
ALTER TABLE user_info ADD COLUMN IF NOT EXISTS hide_wishlist BOOLEAN DEFAULT FALSE;

-- 4. 增加/减少想要数的 RPC 函数
CREATE OR REPLACE FUNCTION increment_post_want_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET want_count = want_count + 1 WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_want_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET want_count = GREATEST(0, want_count - 1) WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;
