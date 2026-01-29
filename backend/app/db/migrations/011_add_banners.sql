-- =====================================================
-- Banner 轮播图表
-- 用于首页 Discover 页面的运营 Banner 配置
-- =====================================================

-- Banner 表
CREATE TABLE IF NOT EXISTS banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,                    -- Banner 标题
    subtitle VARCHAR(500),                          -- 副标题/描述
    image_url TEXT NOT NULL,                        -- 图片 URL
    link_type VARCHAR(50) DEFAULT 'NONE',           -- 链接类型: NONE, POST, BRAND, EXTERNAL, SHOW
    link_value TEXT,                                -- 链接值（帖子ID、品牌ID、外部URL等）
    sort_order INTEGER DEFAULT 0,                   -- 排序顺序（越小越靠前）
    is_active BOOLEAN DEFAULT TRUE,                 -- 是否启用
    start_time TIMESTAMP WITH TIME ZONE,            -- 开始展示时间（可选）
    end_time TIMESTAMP WITH TIME ZONE,              -- 结束展示时间（可选）
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- 创建者
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_sort_order ON banners(sort_order);
CREATE INDEX IF NOT EXISTS idx_banners_time_range ON banners(start_time, end_time);

-- 触发器：自动更新 updated_at
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入一些默认的 Banner 数据（品牌展示）
INSERT INTO banners (title, subtitle, image_url, link_type, link_value, sort_order, is_active)
VALUES
    ('CHANEL', '2024 秋冬高定系列', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'BRAND', 'CHANEL', 1, true),
    ('DIOR', '探索最新时装系列', 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800', 'BRAND', 'DIOR', 2, true),
    ('LOUIS VUITTON', '经典与创新的完美融合', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800', 'BRAND', 'LOUIS VUITTON', 3, true);
