-- 买手店表
-- 存储全球买手店信息，包含位置、品牌、风格等

CREATE TABLE IF NOT EXISTS buyer_stores (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    brands TEXT[] DEFAULT '{}',
    style TEXT[] DEFAULT '{}',
    is_open BOOLEAN DEFAULT true,
    phone TEXT[] DEFAULT '{}',
    hours VARCHAR(100),
    rating DECIMAL(2, 1),
    description TEXT,
    images TEXT[] DEFAULT '{}',
    rest VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_buyer_stores_city ON buyer_stores(city);
CREATE INDEX IF NOT EXISTS idx_buyer_stores_country ON buyer_stores(country);
CREATE INDEX IF NOT EXISTS idx_buyer_stores_is_open ON buyer_stores(is_open);
CREATE INDEX IF NOT EXISTS idx_buyer_stores_location ON buyer_stores(latitude, longitude);

-- 全文搜索索引（用于搜索店名）
CREATE INDEX IF NOT EXISTS idx_buyer_stores_name_search ON buyer_stores USING gin(to_tsvector('simple', name));

-- 更新时间触发器
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
    FOR EACH ROW
    EXECUTE FUNCTION update_buyer_stores_updated_at();

-- 添加 RLS 策略
ALTER TABLE buyer_stores ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "Allow public read access to buyer_stores" ON buyer_stores
    FOR SELECT USING (true);

-- 只允许管理员写入
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

-- 添加注释
COMMENT ON TABLE buyer_stores IS '买手店信息表';
COMMENT ON COLUMN buyer_stores.id IS '店铺ID，格式：城市缩写-序号，如 bj-001';
COMMENT ON COLUMN buyer_stores.name IS '店铺名称';
COMMENT ON COLUMN buyer_stores.address IS '详细地址';
COMMENT ON COLUMN buyer_stores.city IS '所在城市';
COMMENT ON COLUMN buyer_stores.country IS '所在国家';
COMMENT ON COLUMN buyer_stores.latitude IS '纬度';
COMMENT ON COLUMN buyer_stores.longitude IS '经度';
COMMENT ON COLUMN buyer_stores.brands IS '销售品牌列表';
COMMENT ON COLUMN buyer_stores.style IS '风格标签列表';
COMMENT ON COLUMN buyer_stores.is_open IS '是否营业（非预约制）';
COMMENT ON COLUMN buyer_stores.phone IS '联系电话列表';
COMMENT ON COLUMN buyer_stores.hours IS '营业时间';
COMMENT ON COLUMN buyer_stores.rating IS '评分';
COMMENT ON COLUMN buyer_stores.description IS '店铺描述';
COMMENT ON COLUMN buyer_stores.images IS '店铺图片列表';
COMMENT ON COLUMN buyer_stores.rest IS '休息日信息';
