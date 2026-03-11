-- =====================================================
-- 新建 brand_images 表 + 迁移旧 cover_image 数据
-- =====================================================

CREATE TABLE IF NOT EXISTS brand_images (
    id BIGSERIAL PRIMARY KEY,
    brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_images_brand_id ON brand_images(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_images_status ON brand_images(status);

-- 迁移旧数据：将 brands.cover_image 非空记录插入 brand_images（status=APPROVED）
INSERT INTO brand_images (brand_id, image_url, sort_order, status)
SELECT id, cover_image, 0, 'APPROVED'
FROM brands
WHERE cover_image IS NOT NULL AND cover_image != ''
ON CONFLICT DO NOTHING;
