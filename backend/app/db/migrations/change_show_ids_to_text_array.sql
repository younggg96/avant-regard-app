-- 将 posts 表的 show_ids 列从 BIGINT[] 改为 TEXT[]
-- 以支持 MongoDB ObjectId 格式的字符串 ID

-- 1. 删除旧的 GIN 索引
DROP INDEX IF EXISTS idx_posts_show_ids;

-- 2. 修改列类型为 TEXT[]
-- 注意：这会自动将现有的整数值转换为文本
ALTER TABLE posts 
ALTER COLUMN show_ids TYPE TEXT[] 
USING show_ids::TEXT[];

-- 3. 重新创建 GIN 索引以支持数组查询
CREATE INDEX IF NOT EXISTS idx_posts_show_ids ON posts USING GIN (show_ids);

-- 完成后，show_ids 列将能够存储任何字符串格式的 ID
-- 包括整数字符串 "123" 和 MongoDB ObjectId "6978a0b9e253fe2e6a75ed42"
