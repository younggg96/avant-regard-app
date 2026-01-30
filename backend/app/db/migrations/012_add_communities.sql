-- 社区表
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

-- 社区关注关系表
CREATE TABLE IF NOT EXISTS community_follows (
    id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

-- 在 posts 表添加 community_id 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'posts' AND column_name = 'community_id') THEN
        ALTER TABLE posts ADD COLUMN community_id INTEGER REFERENCES communities(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_communities_is_active ON communities(is_active);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities(category);
CREATE INDEX IF NOT EXISTS idx_communities_sort_order ON communities(sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_community_follows_user_id ON community_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_community_follows_community_id ON community_follows(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts(community_id);

-- 增加社区成员数的函数
CREATE OR REPLACE FUNCTION increment_community_member_count(community_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE communities 
    SET member_count = member_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = community_id_param;
END;
$$ LANGUAGE plpgsql;

-- 减少社区成员数的函数
CREATE OR REPLACE FUNCTION decrement_community_member_count(community_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE communities 
    SET member_count = GREATEST(member_count - 1, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = community_id_param;
END;
$$ LANGUAGE plpgsql;

-- 增加社区帖子数的函数
CREATE OR REPLACE FUNCTION increment_community_post_count(community_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE communities 
    SET post_count = post_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = community_id_param;
END;
$$ LANGUAGE plpgsql;

-- 减少社区帖子数的函数
CREATE OR REPLACE FUNCTION decrement_community_post_count(community_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE communities 
    SET post_count = GREATEST(post_count - 1, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = community_id_param;
END;
$$ LANGUAGE plpgsql;

-- 自动更新 updated_at 的触发器
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
    FOR EACH ROW
    EXECUTE FUNCTION update_communities_updated_at();

-- 插入默认社区数据（如果不存在）
INSERT INTO communities (name, slug, description, category, is_official, sort_order)
SELECT * FROM (VALUES
    ('时尚穿搭', 'fashion-outfit', '分享你的日常穿搭灵感', 'FASHION', TRUE, 100),
    ('品牌讨论', 'brand-talk', '讨论各大时尚品牌的最新动态', 'FASHION', TRUE, 90),
    ('秀场评论', 'runway-review', '点评时装周和秀场精彩瞬间', 'FASHION', TRUE, 80),
    ('美妆护肤', 'beauty-skincare', '美妆护肤心得分享', 'BEAUTY', TRUE, 70),
    ('生活方式', 'lifestyle', '分享精致生活的点滴', 'LIFESTYLE', TRUE, 60)
) AS v(name, slug, description, category, is_official, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM communities WHERE slug = v.slug);
