-- =====================================================
-- 品牌表和秀场表更新迁移
-- =====================================================

-- 1. 创建品牌表（独立于 designers 表）
CREATE TABLE IF NOT EXISTS brands (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),                    -- 品牌类别：时装品牌、奢侈、先锋、工匠品牌
    founded_year VARCHAR(10),                 -- 创立年份
    founder VARCHAR(200),                     -- 创始人
    country VARCHAR(100),                     -- 国家
    website TEXT,                             -- 官网
    cover_image TEXT,                         -- 封面图片
    latest_season VARCHAR(100),               -- 最新季度
    vogue_slug VARCHAR(200),                  -- Vogue slug
    vogue_url TEXT,                           -- Vogue 页面链接
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 更新现有 shows 表，添加新字段（如果需要）
-- 添加 brand_name 字段用于存储品牌名称（便于查询）
ALTER TABLE shows ADD COLUMN IF NOT EXISTS brand_name VARCHAR(200);
-- 添加 title 字段
ALTER TABLE shows ADD COLUMN IF NOT EXISTS title VARCHAR(200);
-- 添加 cover_image 字段
ALTER TABLE shows ADD COLUMN IF NOT EXISTS cover_image TEXT;
-- 添加 year 字段
ALTER TABLE shows ADD COLUMN IF NOT EXISTS year INTEGER;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_category ON brands(category);
CREATE INDEX IF NOT EXISTS idx_brands_vogue_slug ON brands(vogue_slug);
CREATE INDEX IF NOT EXISTS idx_shows_brand_name ON shows(brand_name);
CREATE INDEX IF NOT EXISTS idx_shows_year ON shows(year);
CREATE INDEX IF NOT EXISTS idx_shows_show_url ON shows(show_url);

-- 4. 创建触发器（先删除再创建）
DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
