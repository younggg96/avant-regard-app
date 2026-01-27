-- =====================================================
-- 添加用户推送 Token 表
-- =====================================================

-- 用户推送 Token 表
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL,  -- ios, android
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token ON user_push_tokens(push_token);

-- 更新 updated_at 触发器
CREATE TRIGGER update_user_push_tokens_updated_at BEFORE UPDATE ON user_push_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
