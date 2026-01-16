-- =====================================================
-- 迁移脚本：添加评论回复功能
-- 执行日期：2026-01-15
-- 描述：为 post_comments 表添加回复相关字段
-- =====================================================

-- 1. 添加 parent_id 字段（父评论ID，NULL表示顶级评论）
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE;

-- 2. 添加 reply_to_user_id 字段（回复的用户ID）
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS reply_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- 3. 添加 reply_count 字段（回复数量）
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;

-- 4. 创建 parent_id 索引以优化查询
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_id);

-- 5. 更新现有评论的 reply_count（如果有历史数据需要修复）
-- 这个步骤会统计每条评论的实际回复数量并更新
UPDATE post_comments AS parent
SET reply_count = (
    SELECT COUNT(*) 
    FROM post_comments AS child 
    WHERE child.parent_id = parent.id
)
WHERE parent.parent_id IS NULL;

-- =====================================================
-- 验证迁移是否成功
-- =====================================================

-- 检查新字段是否存在
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_comments' AND column_name = 'parent_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: parent_id column not found';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_comments' AND column_name = 'reply_to_user_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: reply_to_user_id column not found';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_comments' AND column_name = 'reply_count'
    ) THEN
        RAISE EXCEPTION 'Migration failed: reply_count column not found';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;
