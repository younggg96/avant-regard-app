-- =====================================================
-- 031: 添加用户头衔系统
-- =====================================================

-- 用户头衔表
CREATE TABLE IF NOT EXISTS user_titles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_titles_user_id ON user_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_titles_primary ON user_titles(user_id, is_primary) WHERE is_primary = TRUE;

-- 确保每个用户只有一个主头衔
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_titles_unique_primary
    ON user_titles(user_id) WHERE is_primary = TRUE;
