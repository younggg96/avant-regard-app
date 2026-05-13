-- =====================================================
-- Avant Regard 完整数据库 Schema
-- 用于 MemfireDB 一键初始化
-- 整合自 init_tables.sql + 所有 migrations + functions.sql
-- =====================================================

-- =====================================================
-- 0. 启用扩展
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =====================================================
-- 1. 基础工具函数
-- =====================================================

-- 自动更新 updated_at 的通用触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';


-- =====================================================
-- 2. 用户相关表
-- =====================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    supabase_uid UUID UNIQUE,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(200),
    username VARCHAR(100) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    user_type VARCHAR(50) DEFAULT 'USER',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户信息表（含所有迁移字段）
CREATE TABLE IF NOT EXISTS user_info (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT DEFAULT '',
    location VARCHAR(100) DEFAULT '',
    avatar_url TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    gender VARCHAR(10) DEFAULT 'OTHER',
    age INTEGER DEFAULT 0,
    preference TEXT DEFAULT '',
    preferred_language VARCHAR(10) DEFAULT NULL,
    preferred_theme VARCHAR(10) DEFAULT 'system',
    -- 隐私设置（016_user_privacy_settings）
    hide_following BOOLEAN DEFAULT FALSE,
    hide_followers BOOLEAN DEFAULT FALSE,
    hide_likes BOOLEAN DEFAULT FALSE,
    -- 资料完善标记（017_add_profile_completed）
    profile_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_info_preferred_theme_check CHECK (preferred_theme IN ('system', 'light', 'dark'))
);

-- 用户推送 Token 表
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =====================================================
-- 3. 品牌表
-- =====================================================

CREATE TABLE IF NOT EXISTS brands (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    founded_year VARCHAR(10),
    founder VARCHAR(200),
    country VARCHAR(100),
    website TEXT,
    cover_image TEXT,
    latest_season VARCHAR(100),
    vogue_slug VARCHAR(200),
    vogue_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 品牌图片表（用户上传 + 管理员审核）
CREATE TABLE IF NOT EXISTS brand_images (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    is_selected BOOLEAN DEFAULT FALSE,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户提交的品牌（待审核）
CREATE TABLE IF NOT EXISTS brand_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    founded_year VARCHAR(10),
    founder VARCHAR(200),
    country VARCHAR(100),
    website TEXT,
    cover_image TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reject_reason TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- [已废弃] user_favorite_brands 已被 brand_follows 替代，保留仅供历史迁移参考
-- CREATE TABLE IF NOT EXISTS user_favorite_brands (
--     id BIGSERIAL PRIMARY KEY,
--     user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
--     brand_id BIGINT REFERENCES brands(id) ON DELETE CASCADE,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     UNIQUE(user_id, brand_id)
-- );

CREATE TABLE IF NOT EXISTS brand_follows (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    brand_id BIGINT REFERENCES brands(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_follows_user_id ON brand_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_follows_brand_id ON brand_follows(brand_id);


-- =====================================================
-- 4. 设计师 & 秀场相关表
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

-- 秀场表（简化后 + 新字段 + 用户上传/审核字段）
CREATE TABLE IF NOT EXISTS shows (
    id VARCHAR(100) NOT NULL PRIMARY KEY,
    brand_name VARCHAR(200),
    season VARCHAR(100) NOT NULL,
    title VARCHAR(200),
    cover_image TEXT,
    show_url TEXT,
    year INTEGER,
    category VARCHAR(100),
    description TEXT,
    designer VARCHAR(200),
    created_by INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'APPROVED',
    reject_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 秀场图片表
CREATE TABLE IF NOT EXISTS show_images (
    id BIGSERIAL PRIMARY KEY,
    show_id VARCHAR(100) REFERENCES shows(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(50) DEFAULT 'LOOK',
    sort_order INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户喜欢的设计师表
CREATE TABLE IF NOT EXISTS user_preferred_designers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    designer_id BIGINT REFERENCES designers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, designer_id)
);


-- =====================================================
-- 5. 社区表（012_add_communities）
-- =====================================================

CREATE TABLE IF NOT EXISTS communities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    icon_url TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    category VARCHAR(50) DEFAULT 'GENERAL',
    is_official BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    member_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 社区关注关系表（user_id 已修正为 BIGINT）
CREATE TABLE IF NOT EXISTS community_follows (
    id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);


-- =====================================================
-- 6. 帖子相关表
-- =====================================================

-- 帖子表（含所有迁移字段）
CREATE TABLE IF NOT EXISTS posts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    post_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT',
    audit_status VARCHAR(20) DEFAULT 'PENDING',
    title VARCHAR(500) NOT NULL,
    content_text TEXT DEFAULT '',
    image_urls TEXT[] DEFAULT '{}',
    -- 单品评价专用字段
    product_name VARCHAR(200),
    brand_name VARCHAR(200),
    rating NUMERIC(2, 1) CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = FLOOR(rating * 2)),
    -- 关联字段（来自迁移）
    show_ids TEXT[] DEFAULT '{}',
    community_id INTEGER REFERENCES communities(id) ON DELETE SET NULL,
    brand_ids INTEGER[] DEFAULT '{}',
    -- 单品信息（可选）
    item_brand VARCHAR(200),
    item_brand_id INTEGER,
    item_category VARCHAR(50),
    item_sizes TEXT[] DEFAULT '{}',
    item_colors TEXT[] DEFAULT '{}',
    -- 统计
    like_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    want_count INTEGER DEFAULT 0,
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

-- 帖子评论表（含回复功能）
CREATE TABLE IF NOT EXISTS post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE,
    reply_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
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
-- 7. 关注相关表
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
-- 8. 秀场图片评论 & 点赞
-- =====================================================

CREATE TABLE IF NOT EXISTS show_image_reviews (
    id BIGSERIAL PRIMARY KEY,
    image_id BIGINT REFERENCES show_images(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = FLOOR(rating * 2)),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS show_image_likes (
    id BIGSERIAL PRIMARY KEY,
    image_id BIGINT REFERENCES show_images(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(image_id, user_id)
);


-- =====================================================
-- 9. 通知表
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    action_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =====================================================
-- 10. 买手店相关表
-- =====================================================

-- 买手店表
CREATE TABLE IF NOT EXISTS buyer_stores (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    brands TEXT[] DEFAULT '{}',
    style TEXT[] DEFAULT '{}',
    is_open BOOLEAN DEFAULT true,
    phone TEXT[] DEFAULT '{}',
    hours TEXT,
    rating DECIMAL(2, 1),
    description TEXT,
    images TEXT[] DEFAULT '{}',
    rest TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户提交的买手店表
CREATE TABLE IF NOT EXISTS user_submitted_stores (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    brands TEXT[] DEFAULT '{}',
    style TEXT[] DEFAULT '{}',
    phone TEXT[] DEFAULT '{}',
    hours VARCHAR(200),
    description TEXT,
    images TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'PENDING',
    reject_reason TEXT,
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_store_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 买手店评论表
CREATE TABLE IF NOT EXISTS buyer_store_comments (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES buyer_store_comments(id) ON DELETE CASCADE,
    reply_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 买手店评论点赞表
CREATE TABLE IF NOT EXISTS buyer_store_comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT REFERENCES buyer_store_comments(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- 买手店评分表
CREATE TABLE IF NOT EXISTS buyer_store_ratings (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = FLOOR(rating * 2)) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, user_id)
);

-- 买手店收藏表
CREATE TABLE IF NOT EXISTS buyer_store_favorites (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, user_id)
);

-- 买手店评分统计视图
CREATE OR REPLACE VIEW buyer_store_rating_stats AS
SELECT
    store_id,
    COUNT(*) as rating_count,
    ROUND(AVG(rating)::numeric, 1) as average_rating,
    COUNT(CASE WHEN rating >= 4.5 THEN 1 END) as five_star_count,
    COUNT(CASE WHEN rating >= 3.5 AND rating < 4.5 THEN 1 END) as four_star_count,
    COUNT(CASE WHEN rating >= 2.5 AND rating < 3.5 THEN 1 END) as three_star_count,
    COUNT(CASE WHEN rating >= 1.5 AND rating < 2.5 THEN 1 END) as two_star_count,
    COUNT(CASE WHEN rating < 1.5 THEN 1 END) as one_star_count
FROM buyer_store_ratings
GROUP BY store_id;


-- =====================================================
-- 11. 商家入驻系统
-- =====================================================

-- 商家认证表
CREATE TABLE IF NOT EXISTS store_merchants (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(200),
    business_license TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    reject_reason TEXT,
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    merchant_level VARCHAR(20) DEFAULT 'BASIC',
    can_post_banner BOOLEAN DEFAULT TRUE,
    can_post_announcement BOOLEAN DEFAULT TRUE,
    can_post_activity BOOLEAN DEFAULT TRUE,
    can_post_discount BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 商家公告表
CREATE TABLE IF NOT EXISTS store_announcements (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 商家 Banner 表
CREATE TABLE IF NOT EXISTS store_banners (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    title VARCHAR(200),
    image_url TEXT NOT NULL,
    link_url TEXT,
    link_type VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    click_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 商家活动表
CREATE TABLE IF NOT EXISTS store_activities (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    cover_image TEXT,
    images TEXT[] DEFAULT '{}',
    activity_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    activity_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(500),
    activity_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    need_registration BOOLEAN DEFAULT FALSE,
    registration_limit INTEGER,
    registration_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 商家折扣表
CREATE TABLE IF NOT EXISTS store_discounts (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    cover_image TEXT,
    discount_type VARCHAR(50) NOT NULL,
    discount_value VARCHAR(100),
    applicable_brands TEXT[] DEFAULT '{}',
    applicable_categories TEXT[] DEFAULT '{}',
    discount_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    discount_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    min_purchase_amount DECIMAL(10, 2),
    terms_and_conditions TEXT,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    need_code BOOLEAN DEFAULT FALSE,
    discount_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 活动报名表
CREATE TABLE IF NOT EXISTS store_activity_registrations (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES store_activities(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(50),
    note TEXT,
    status VARCHAR(20) DEFAULT 'REGISTERED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(activity_id, user_id)
);


-- =====================================================
-- 11.1 商家商品系统 & 店铺主页可配置项（migration 040）
-- =====================================================

-- 店铺主页卡片配置（StoreProfileCard 数据源）
CREATE TABLE IF NOT EXISTS store_profile_configs (
    store_id VARCHAR(100) PRIMARY KEY REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE SET NULL,
    logo_image TEXT,
    cover_image TEXT,
    short_description TEXT,
    long_description TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 入口卡片（CategoryCards 数据源；card_type ∈ CLASSIFICATION/DISCOUNT/EVENT/NEW_ARRIVAL）
CREATE TABLE IF NOT EXISTS store_entry_cards (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    card_type VARCHAR(20) NOT NULL,
    label VARCHAR(50) NOT NULL,
    label_en VARCHAR(50),
    image_url TEXT NOT NULL,
    target_category_id BIGINT,
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_entry_cards_store ON store_entry_cards(store_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_store_entry_cards_published
    ON store_entry_cards(store_id) WHERE status = 'PUBLISHED';

-- 商家自定义商品分类
CREATE TABLE IF NOT EXISTS store_product_categories (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    cover_image TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, name)
);
CREATE INDEX IF NOT EXISTS idx_store_product_categories_store
    ON store_product_categories(store_id, sort_order);

-- entry_cards.target_category_id 外键延迟挂（要等 categories 表建完）
ALTER TABLE store_entry_cards
    DROP CONSTRAINT IF EXISTS fk_store_entry_cards_target_category;
ALTER TABLE store_entry_cards
    ADD CONSTRAINT fk_store_entry_cards_target_category
    FOREIGN KEY (target_category_id)
    REFERENCES store_product_categories(id)
    ON DELETE SET NULL;

-- 商品（价格单位为整数分，避免浮点坑）
CREATE TABLE IF NOT EXISTS store_products (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES store_product_categories(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    brand VARCHAR(200),
    images TEXT[] DEFAULT '{}',
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    currency VARCHAR(10) DEFAULT 'CNY',
    discount_price_cents BIGINT CHECK (discount_price_cents IS NULL OR discount_price_cents >= 0),
    has_discount BOOLEAN GENERATED ALWAYS AS (discount_price_cents IS NOT NULL) STORED,
    is_new BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_products_store_status
    ON store_products(store_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_products_category
    ON store_products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_products_is_new
    ON store_products(store_id, published_at DESC)
    WHERE is_new = TRUE AND status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_store_products_discount
    ON store_products(store_id, published_at DESC)
    WHERE has_discount = TRUE AND status = 'PUBLISHED';

-- 用户"喜欢"商品
CREATE TABLE IF NOT EXISTS store_product_likes (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_store_product_likes_user
    ON store_product_likes(user_id, created_at DESC);

-- 商品评论（结构镜像 buyer_store_comments）
CREATE TABLE IF NOT EXISTS store_product_comments (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES store_product_comments(id) ON DELETE CASCADE,
    reply_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_product_comments_product
    ON store_product_comments(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_product_comments_parent
    ON store_product_comments(parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS store_product_comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES store_product_comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);


-- =====================================================
-- 12. Banner 轮播图表
-- =====================================================

CREATE TABLE IF NOT EXISTS banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(500),
    image_url TEXT NOT NULL,
    link_type VARCHAR(50) DEFAULT 'NONE',
    link_value TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =====================================================
-- 13. 所有索引
-- =====================================================

-- 用户相关
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_user_info_user_id ON user_info(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token ON user_push_tokens(push_token);

-- 品牌相关
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_category ON brands(category);
CREATE INDEX IF NOT EXISTS idx_brands_vogue_slug ON brands(vogue_slug);
-- [已废弃] user_favorite_brands 索引
-- CREATE INDEX IF NOT EXISTS idx_user_favorite_brands_user_id ON user_favorite_brands(user_id);
-- CREATE INDEX IF NOT EXISTS idx_user_favorite_brands_brand_id ON user_favorite_brands(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_images_brand_id ON brand_images(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_images_status ON brand_images(status);
CREATE INDEX IF NOT EXISTS idx_brand_submissions_user_id ON brand_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_submissions_status ON brand_submissions(status);

-- 秀场相关
CREATE INDEX IF NOT EXISTS idx_shows_brand_name ON shows(brand_name);
CREATE INDEX IF NOT EXISTS idx_shows_year ON shows(year);
CREATE INDEX IF NOT EXISTS idx_shows_show_url ON shows(show_url);
CREATE INDEX IF NOT EXISTS idx_shows_category ON shows(category);
CREATE INDEX IF NOT EXISTS idx_show_images_show_id ON show_images(show_id);
CREATE INDEX IF NOT EXISTS idx_shows_created_by ON shows(created_by);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);

-- 帖子相关
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, audit_status);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);
CREATE INDEX IF NOT EXISTS idx_posts_show_ids ON posts USING GIN (show_ids);
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_brand_ids ON posts USING GIN (brand_ids);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_id);

-- 关注相关
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_designer_follows_user ON designer_follows(user_id);

-- 通知
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- 社区相关
CREATE INDEX IF NOT EXISTS idx_communities_is_active ON communities(is_active);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities(category);
CREATE INDEX IF NOT EXISTS idx_communities_sort_order ON communities(sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_community_follows_user_id ON community_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_community_follows_community_id ON community_follows(community_id);

-- 买手店相关
CREATE INDEX IF NOT EXISTS idx_buyer_stores_city ON buyer_stores(city);
CREATE INDEX IF NOT EXISTS idx_buyer_stores_country ON buyer_stores(country);
CREATE INDEX IF NOT EXISTS idx_buyer_stores_is_open ON buyer_stores(is_open);
CREATE INDEX IF NOT EXISTS idx_buyer_stores_location ON buyer_stores(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_buyer_stores_name_search ON buyer_stores USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_user_submitted_stores_user_id ON user_submitted_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_submitted_stores_status ON user_submitted_stores(status);
CREATE INDEX IF NOT EXISTS idx_user_submitted_stores_city ON user_submitted_stores(city);
CREATE INDEX IF NOT EXISTS idx_user_submitted_stores_country ON user_submitted_stores(country);
CREATE INDEX IF NOT EXISTS idx_buyer_store_comments_store_id ON buyer_store_comments(store_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_comments_user_id ON buyer_store_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_comments_parent_id ON buyer_store_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_ratings_store_id ON buyer_store_ratings(store_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_ratings_user_id ON buyer_store_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_favorites_store_id ON buyer_store_favorites(store_id);
CREATE INDEX IF NOT EXISTS idx_buyer_store_favorites_user_id ON buyer_store_favorites(user_id);

-- 商家入驻相关
CREATE INDEX IF NOT EXISTS idx_store_merchants_store_id ON store_merchants(store_id);
CREATE INDEX IF NOT EXISTS idx_store_merchants_user_id ON store_merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_store_merchants_status ON store_merchants(status);
CREATE INDEX IF NOT EXISTS idx_store_announcements_store_id ON store_announcements(store_id);
CREATE INDEX IF NOT EXISTS idx_store_announcements_merchant_id ON store_announcements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_announcements_status ON store_announcements(status);
CREATE INDEX IF NOT EXISTS idx_store_banners_store_id ON store_banners(store_id);
CREATE INDEX IF NOT EXISTS idx_store_banners_merchant_id ON store_banners(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_banners_status ON store_banners(status);
CREATE INDEX IF NOT EXISTS idx_store_activities_store_id ON store_activities(store_id);
CREATE INDEX IF NOT EXISTS idx_store_activities_merchant_id ON store_activities(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_activities_status ON store_activities(status);
CREATE INDEX IF NOT EXISTS idx_store_activities_time ON store_activities(activity_start_time, activity_end_time);
CREATE INDEX IF NOT EXISTS idx_store_discounts_store_id ON store_discounts(store_id);
CREATE INDEX IF NOT EXISTS idx_store_discounts_merchant_id ON store_discounts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_discounts_status ON store_discounts(status);
CREATE INDEX IF NOT EXISTS idx_store_discounts_time ON store_discounts(discount_start_time, discount_end_time);
CREATE INDEX IF NOT EXISTS idx_store_activity_registrations_activity_id ON store_activity_registrations(activity_id);
CREATE INDEX IF NOT EXISTS idx_store_activity_registrations_user_id ON store_activity_registrations(user_id);

-- Banner 相关
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_sort_order ON banners(sort_order);
CREATE INDEX IF NOT EXISTS idx_banners_time_range ON banners(start_time, end_time);


-- =====================================================
-- 14. 所有触发器
-- =====================================================

-- 用户相关
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_info_updated_at BEFORE UPDATE ON user_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_push_tokens_updated_at BEFORE UPDATE ON user_push_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 品牌
DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_brand_submissions_updated_at
    BEFORE UPDATE ON brand_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 设计师 & 秀场
CREATE TRIGGER update_designers_updated_at BEFORE UPDATE ON designers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shows_updated_at BEFORE UPDATE ON shows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 帖子 & 评论
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 买手店相关
CREATE OR REPLACE FUNCTION update_buyer_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_buyer_stores_updated_at ON buyer_stores;
CREATE TRIGGER trigger_buyer_stores_updated_at
    BEFORE UPDATE ON buyer_stores
    FOR EACH ROW EXECUTE FUNCTION update_buyer_stores_updated_at();

CREATE TRIGGER update_user_submitted_stores_updated_at 
    BEFORE UPDATE ON user_submitted_stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyer_store_comments_updated_at 
    BEFORE UPDATE ON buyer_store_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyer_store_ratings_updated_at 
    BEFORE UPDATE ON buyer_store_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 商家入驻相关
CREATE TRIGGER update_store_merchants_updated_at 
    BEFORE UPDATE ON store_merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_announcements_updated_at 
    BEFORE UPDATE ON store_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_banners_updated_at 
    BEFORE UPDATE ON store_banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_activities_updated_at 
    BEFORE UPDATE ON store_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_discounts_updated_at 
    BEFORE UPDATE ON store_discounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_activity_registrations_updated_at 
    BEFORE UPDATE ON store_activity_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 社区
CREATE OR REPLACE FUNCTION update_communities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_communities_updated_at ON communities;
CREATE TRIGGER trigger_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW EXECUTE FUNCTION update_communities_updated_at();

-- Banner
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 活动报名数量自动更新触发器
CREATE OR REPLACE FUNCTION update_activity_registration_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE store_activities
        SET registration_count = registration_count + 1
        WHERE id = NEW.activity_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE store_activities
        SET registration_count = GREATEST(registration_count - 1, 0)
        WHERE id = OLD.activity_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_activity_registration_count
    AFTER INSERT OR DELETE ON store_activity_registrations
    FOR EACH ROW EXECUTE FUNCTION update_activity_registration_count();


-- =====================================================
-- 15. 买手店 RLS 策略
-- =====================================================

ALTER TABLE buyer_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to buyer_stores" ON buyer_stores
    FOR SELECT USING (true);

CREATE POLICY "Allow admin insert to buyer_stores" ON buyer_stores
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "Allow admin update to buyer_stores" ON buyer_stores
    FOR UPDATE USING (
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "Allow admin delete to buyer_stores" ON buyer_stores
    FOR DELETE USING (
        auth.jwt() ->> 'role' = 'admin'
    );


-- =====================================================
-- 16. 所有业务函数
-- =====================================================

-- ---------- 帖子计数器函数 ----------

CREATE OR REPLACE FUNCTION increment_post_like_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET like_count = like_count + 1 WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_like_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_post_favorite_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET favorite_count = favorite_count + 1 WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_favorite_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET favorite_count = GREATEST(0, favorite_count - 1) WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_post_comment_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_comment_count(post_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = post_id_param;
END;
$$ LANGUAGE plpgsql;

-- ---------- 秀场图片计数器函数 ----------

CREATE OR REPLACE FUNCTION increment_show_image_like_count(image_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE show_images SET like_count = like_count + 1 WHERE id = image_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_show_image_like_count(image_id_param BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE show_images SET like_count = GREATEST(0, like_count - 1) WHERE id = image_id_param;
END;
$$ LANGUAGE plpgsql;

-- ---------- 买手店评论计数器函数 ----------

CREATE OR REPLACE FUNCTION increment_reply_count(comment_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE buyer_store_comments
    SET reply_count = reply_count + 1
    WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_reply_count(comment_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE buyer_store_comments
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_comment_like_count(p_comment_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE buyer_store_comments
    SET like_count = like_count + 1
    WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_comment_like_count(p_comment_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE buyer_store_comments
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql;

-- ---------- 社区计数器函数 ----------

CREATE OR REPLACE FUNCTION increment_community_member_count(community_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE communities 
    SET member_count = member_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = community_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_community_member_count(community_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE communities 
    SET member_count = GREATEST(member_count - 1, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = community_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_community_post_count(community_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE communities 
    SET post_count = post_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = community_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_community_post_count(community_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE communities 
    SET post_count = GREATEST(post_count - 1, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = community_id_param;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 17. Default seed data
-- =====================================================

-- Legacy migration: copy non-empty brands.cover_image into brand_images
-- (status=APPROVED, is_selected=TRUE) so the new media pipeline can take over.
INSERT INTO brand_images (brand_id, image_url, sort_order, status, is_selected)
SELECT id, cover_image, 0, 'APPROVED', TRUE
FROM brands
WHERE cover_image IS NOT NULL AND cover_image != ''
ON CONFLICT DO NOTHING;

-- Default banners
INSERT INTO banners (title, subtitle, image_url, link_type, link_value, sort_order, is_active)
VALUES
    ('CHANEL', 'Fall/Winter 2024 Haute Couture Collection', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'BRAND', 'CHANEL', 1, true),
    ('DIOR', 'Explore the latest collections', 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800', 'BRAND', 'DIOR', 2, true),
    ('LOUIS VUITTON', 'Where heritage meets innovation', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800', 'BRAND', 'LOUIS VUITTON', 3, true);

-- Default communities
INSERT INTO communities (name, slug, description, category, is_official, sort_order)
SELECT * FROM (VALUES
    ('Fashion Outfits', 'fashion-outfit', 'Share your daily outfit inspiration', 'FASHION', TRUE, 100),
    ('Brand Talk', 'brand-talk', 'Discuss the latest news from fashion brands', 'FASHION', TRUE, 90),
    ('Runway Reviews', 'runway-review', 'Review fashion week highlights and runway shows', 'FASHION', TRUE, 80),
    ('Beauty & Skincare', 'beauty-skincare', 'Share beauty and skincare tips', 'BEAUTY', TRUE, 70),
    ('Lifestyle', 'lifestyle', 'Share moments of refined living', 'LIFESTYLE', TRUE, 60)
) AS v(name, slug, description, category, is_official, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM communities WHERE slug = v.slug);


-- =====================================================
-- 18. Table and column comments
-- =====================================================

COMMENT ON TABLE buyer_stores IS 'Buyer stores (multi-brand boutique) registry';
COMMENT ON COLUMN buyer_stores.id IS 'Store ID; format: <city code>-<sequence>, e.g. bj-001';
COMMENT ON COLUMN buyer_stores.name IS 'Store display name';
COMMENT ON COLUMN buyer_stores.address IS 'Full street address';
COMMENT ON COLUMN buyer_stores.city IS 'City';
COMMENT ON COLUMN buyer_stores.country IS 'Country';
COMMENT ON COLUMN buyer_stores.latitude IS 'Latitude';
COMMENT ON COLUMN buyer_stores.longitude IS 'Longitude';
COMMENT ON COLUMN buyer_stores.brands IS 'List of brands carried by the store';
COMMENT ON COLUMN buyer_stores.style IS 'Style tags';
COMMENT ON COLUMN buyer_stores.is_open IS 'True if walk-ins are accepted; false means appointment only';
COMMENT ON COLUMN buyer_stores.phone IS 'Contact phone numbers';
COMMENT ON COLUMN buyer_stores.hours IS 'Business hours';
COMMENT ON COLUMN buyer_stores.rating IS 'Aggregate rating';
COMMENT ON COLUMN buyer_stores.description IS 'Free-form store description';
COMMENT ON COLUMN buyer_stores.images IS 'Store photo URLs';
COMMENT ON COLUMN buyer_stores.rest IS 'Rest day or seasonal closure info';

COMMENT ON TABLE store_merchants IS 'Merchant verification records';
COMMENT ON TABLE store_announcements IS 'Merchant announcements';
COMMENT ON TABLE store_banners IS 'Merchant promotional banners';
COMMENT ON TABLE store_activities IS 'Merchant-hosted events / activities';
COMMENT ON TABLE store_discounts IS 'Merchant discounts and promotions';
COMMENT ON TABLE store_activity_registrations IS 'User registrations for merchant activities';

-- [DEPRECATED] user_favorite_brands comments (table superseded by brand_follows)
-- COMMENT ON TABLE user_favorite_brands IS 'User-to-brand favorite relation';
-- COMMENT ON COLUMN user_favorite_brands.user_id IS 'User ID';
-- COMMENT ON COLUMN user_favorite_brands.brand_id IS 'Brand ID';

COMMENT ON COLUMN user_info.cover_url IS 'User profile cover photo URL';
COMMENT ON COLUMN user_info.hide_following IS 'Hide following list from other users';
COMMENT ON COLUMN user_info.hide_followers IS 'Hide followers list from other users';
COMMENT ON COLUMN user_info.hide_likes IS 'Hide liked-posts list from other users';
COMMENT ON COLUMN user_info.profile_completed IS 'Whether the user has completed their profile';

COMMENT ON COLUMN posts.brand_ids IS 'Array of brand IDs associated with this post';

COMMENT ON TABLE brand_images IS 'Brand image gallery (user-uploaded, admin-reviewed)';
COMMENT ON COLUMN brand_images.brand_id IS 'Associated brand ID';
COMMENT ON COLUMN brand_images.image_url IS 'Image URL';
COMMENT ON COLUMN brand_images.sort_order IS 'Display sort order';
COMMENT ON COLUMN brand_images.status IS 'Review status: PENDING / APPROVED / REJECTED';
COMMENT ON COLUMN brand_images.is_selected IS 'Whether admin selected this as the brand cover image';
COMMENT ON COLUMN brand_images.uploaded_by IS 'Uploader user ID';

COMMENT ON TABLE brand_submissions IS 'User-submitted brands awaiting admin review';
COMMENT ON COLUMN brand_submissions.status IS 'Review status: PENDING / APPROVED / REJECTED';
COMMENT ON COLUMN brand_submissions.reject_reason IS 'Reason for rejection';
COMMENT ON COLUMN brand_submissions.reviewed_at IS 'When the submission was reviewed';

COMMENT ON COLUMN shows.description IS 'Runway show description';
COMMENT ON COLUMN shows.designer IS 'Designer name';
COMMENT ON COLUMN shows.created_by IS 'Creator user ID (for user-uploaded shows)';
COMMENT ON COLUMN shows.status IS 'Review status: APPROVED / PENDING / REJECTED';
COMMENT ON COLUMN shows.reject_reason IS 'Reason for rejection';


-- =====================================================
-- Done. All tables, indexes, triggers, functions, and seed data are in place.
-- =====================================================
