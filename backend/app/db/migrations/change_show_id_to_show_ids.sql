-- 将 posts 表的 show_id 改为 show_ids 数组类型
-- 支持一个帖子关联多个秀场

-- 1. 添加新的 show_ids 数组列
ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_ids BIGINT[] DEFAULT '{}';

-- 2. 迁移现有数据：将 show_id 的值转移到 show_ids
UPDATE posts SET show_ids = ARRAY[show_id] WHERE show_id IS NOT NULL AND (show_ids IS NULL OR show_ids = '{}');

-- 3. 创建 GIN 索引以支持数组查询
CREATE INDEX IF NOT EXISTS idx_posts_show_ids ON posts USING GIN (show_ids);

-- 4. 删除旧的 show_id 列（可选，保留以防需要回滚）
-- ALTER TABLE posts DROP COLUMN IF EXISTS show_id;
