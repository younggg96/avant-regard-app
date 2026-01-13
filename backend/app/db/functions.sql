-- =====================================================
-- Supabase 数据库函数
-- 用于原子性地增减计数器
-- =====================================================

-- 增加帖子点赞数
CREATE OR REPLACE FUNCTION increment_post_like_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET like_count = like_count + 1 WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

-- 减少帖子点赞数
CREATE OR REPLACE FUNCTION decrement_post_like_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

-- 增加帖子收藏数
CREATE OR REPLACE FUNCTION increment_post_favorite_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET favorite_count = favorite_count + 1 WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

-- 减少帖子收藏数
CREATE OR REPLACE FUNCTION decrement_post_favorite_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET favorite_count = GREATEST(0, favorite_count - 1) WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

-- 增加帖子评论数
CREATE OR REPLACE FUNCTION increment_post_comment_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

-- 减少帖子评论数
CREATE OR REPLACE FUNCTION decrement_post_comment_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

-- 增加秀场图片点赞数
CREATE OR REPLACE FUNCTION increment_show_image_like_count(image_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE show_images SET like_count = like_count + 1 WHERE id = image_id_param;
END;
$$ LANGUAGE plpgsql;

-- 减少秀场图片点赞数
CREATE OR REPLACE FUNCTION decrement_show_image_like_count(image_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE show_images SET like_count = GREATEST(0, like_count - 1) WHERE id = image_id_param;
END;
$$ LANGUAGE plpgsql;
