-- =====================================================
-- 为 posts 表添加 show_id 字段，直接关联秀场
-- 替代原来的 post_show_images 多对多关系表
-- =====================================================

-- 添加 show_id 字段到 posts 表
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS show_id BIGINT REFERENCES shows(id) ON DELETE SET NULL;

-- 创建索引以优化按秀场查询帖子的性能
CREATE INDEX IF NOT EXISTS idx_posts_show_id ON posts(show_id);

-- 可选：如果需要迁移旧数据，从 post_show_images 表迁移到 posts.show_id
-- 注意：这会取每个帖子关联的第一个 show_id
-- UPDATE posts p
-- SET show_id = (
--     SELECT si.show_id 
--     FROM post_show_images psi 
--     JOIN show_images si ON psi.show_image_id = si.id
--     WHERE psi.post_id = p.id
--     ORDER BY psi.sort_order
--     LIMIT 1
-- )
-- WHERE p.show_id IS NULL;

-- 可选：迁移完成后可以删除 post_show_images 表
-- DROP TABLE IF EXISTS post_show_images;
