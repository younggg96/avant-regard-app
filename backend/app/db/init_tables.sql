-- =====================================================
-- Avant Regard 数据库表结构 (Supabase PostgreSQL)
-- =====================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. 用户相关表
-- =====================================================

-- 用户表
-- 使用 Supabase Auth，supabase_uid 关联 Supabase 用户
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    supabase_uid UUID UNIQUE,  -- 关联 Supabase Auth 用户
    phone VARCHAR(20) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    user_type VARCHAR(50) DEFAULT 'USER',  -- USER, DESIGNER, EDITOR
    status VARCHAR(20) DEFAULT 'ACTIVE',   -- ACTIVE, BANNED, DELETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户信息表
CREATE TABLE IF NOT EXISTS user_info (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT DEFAULT '',
    location VARCHAR(100) DEFAULT '',
    avatar_url TEXT DEFAULT '',
    gender VARCHAR(10) DEFAULT 'OTHER',  -- MALE, FEMALE, OTHER
    age INTEGER DEFAULT 0,
    preference TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 注意：短信验证码和令牌由 Supabase Auth 管理，不需要单独的表

-- =====================================================
-- 2. 设计师相关表
-- =====================================================

-- 设计师表
CREATE TABLE IF NOT EXISTS designers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    designer_url TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 秀场表
CREATE TABLE IF NOT EXISTS shows (
    id BIGSERIAL PRIMARY KEY,
    designer_id BIGINT REFERENCES designers(id) ON DELETE CASCADE,
    show_url TEXT DEFAULT '',
    season VARCHAR(100) NOT NULL,
    category VARCHAR(100) DEFAULT '',  -- Ready-To-Wear, Couture, etc.
    city VARCHAR(100) DEFAULT '',
    collection_ts TIMESTAMP WITH TIME ZONE,
    original_offset VARCHAR(50),
    review_title TEXT,
    review_author VARCHAR(200),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 秀场图片表
CREATE TABLE IF NOT EXISTS show_images (
    id BIGSERIAL PRIMARY KEY,
    show_id BIGINT REFERENCES shows(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(50) DEFAULT 'LOOK',  -- LOOK, DETAIL, BACKSTAGE
    sort_order INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户喜欢的设计师表（偏好设置）
CREATE TABLE IF NOT EXISTS user_preferred_designers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    designer_id BIGINT REFERENCES designers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, designer_id)
);

-- =====================================================
-- 3. 帖子相关表
-- =====================================================

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    post_type VARCHAR(50) NOT NULL,  -- OUTFIT, DAILY_SHARE, ITEM_REVIEW, ARTICLES
    status VARCHAR(20) DEFAULT 'DRAFT',  -- DRAFT, PUBLISHED, HIDDEN
    audit_status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
    title VARCHAR(500) NOT NULL,
    content_text TEXT DEFAULT '',
    image_urls TEXT[] DEFAULT '{}',
    -- 单品评价专用字段
    product_name VARCHAR(200),
    brand_name VARCHAR(200),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    -- 统计
    like_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 帖子关联的秀场图片
CREATE TABLE IF NOT EXISTS post_show_images (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    show_image_id BIGINT REFERENCES show_images(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(post_id, show_image_id)
);

-- 帖子点赞表
CREATE TABLE IF NOT EXISTS post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- 帖子收藏表
CREATE TABLE IF NOT EXISTS post_favorites (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- 帖子评论表
CREATE TABLE IF NOT EXISTS post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 评论点赞表
CREATE TABLE IF NOT EXISTS comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- =====================================================
-- 4. 关注相关表
-- =====================================================

-- 用户关注用户表
CREATE TABLE IF NOT EXISTS user_follows (
    id BIGSERIAL PRIMARY KEY,
    follower_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    following_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- 用户关注设计师表
CREATE TABLE IF NOT EXISTS designer_follows (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    designer_id BIGINT REFERENCES designers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, designer_id)
);

-- =====================================================
-- 5. 秀场图片评论表
-- =====================================================

CREATE TABLE IF NOT EXISTS show_image_reviews (
    id BIGSERIAL PRIMARY KEY,
    image_id BIGINT REFERENCES show_images(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 秀场图片点赞表
CREATE TABLE IF NOT EXISTS show_image_likes (
    id BIGSERIAL PRIMARY KEY,
    image_id BIGINT REFERENCES show_images(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(image_id, user_id)
);

-- =====================================================
-- 6. 通知表
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- LIKE, COMMENT, FOLLOW, MENTION, SYSTEM
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    action_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. 索引
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_user_info_user_id ON user_info(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, audit_status);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_shows_designer_id ON shows(designer_id);
CREATE INDEX IF NOT EXISTS idx_show_images_show_id ON show_images(show_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_designer_follows_user ON designer_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- =====================================================
-- 8. 触发器：自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_info_updated_at BEFORE UPDATE ON user_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_designers_updated_at BEFORE UPDATE ON designers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shows_updated_at BEFORE UPDATE ON shows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
