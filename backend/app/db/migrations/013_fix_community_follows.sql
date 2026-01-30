-- 修复 community_follows 表的 user_id 类型
-- users.id 是 BIGINT，community_follows.user_id 应该也是 BIGINT

-- 1. 先删除旧的约束
ALTER TABLE community_follows DROP CONSTRAINT IF EXISTS community_follows_user_id_fkey;

-- 2. 修改 user_id 列类型为 BIGINT（如果当前是 INTEGER）
ALTER TABLE community_follows 
ALTER COLUMN user_id TYPE BIGINT;

-- 3. 添加外键约束（可选，确保数据完整性）
-- 注意：这可能失败如果有无效的 user_id，所以我们先不强制添加外键
-- ALTER TABLE community_follows 
-- ADD CONSTRAINT community_follows_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. 确保 community_id 也是正确的类型
ALTER TABLE community_follows 
ALTER COLUMN community_id TYPE INTEGER;

-- 5. 重新确认唯一约束存在
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'community_follows_community_id_user_id_key'
    ) THEN
        ALTER TABLE community_follows 
        ADD CONSTRAINT community_follows_community_id_user_id_key 
        UNIQUE (community_id, user_id);
    END IF;
END $$;

-- 6. 确保索引存在
CREATE INDEX IF NOT EXISTS idx_community_follows_user_id ON community_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_community_follows_community_id ON community_follows(community_id);
