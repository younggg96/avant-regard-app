-- 修复 posts 表中 post_type 字段的空白字符问题
-- 问题：某些记录的 post_type 值包含换行符，如 'ARTICLES\n'

-- 清理 post_type 字段中的空白字符
UPDATE posts
SET post_type = TRIM(post_type)
WHERE post_type != TRIM(post_type);

-- 将 FORUM 类型转换为 ARTICLES（如果存在）
UPDATE posts
SET post_type = 'ARTICLES'
WHERE TRIM(post_type) = 'FORUM';

-- 验证修复结果
-- SELECT DISTINCT post_type, LENGTH(post_type) as len FROM posts;
