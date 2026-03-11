-- =====================================================
-- Avant Regard 增量迁移脚本
-- 从旧 schema 升级到最新结构
-- 适用于已有数据的 MemfireDB 实例
-- =====================================================

-- =====================================================
-- 1. shows 表：添加用户上传 & 审核字段
-- =====================================================

ALTER TABLE shows ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS designer VARCHAR(200);
ALTER TABLE shows ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE shows ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'APPROVED';
ALTER TABLE shows ADD COLUMN IF NOT EXISTS reject_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_shows_created_by ON shows(created_by);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);


-- =====================================================
-- 2. buyer_stores 表：修复字段长度不足
-- =====================================================

ALTER TABLE buyer_stores ALTER COLUMN hours TYPE TEXT;
ALTER TABLE buyer_stores ALTER COLUMN rest TYPE TEXT;
ALTER TABLE buyer_stores ALTER COLUMN city TYPE TEXT;
ALTER TABLE buyer_stores ALTER COLUMN country TYPE TEXT;


-- =====================================================
-- 3. 新建 brand_images 表（含 is_selected）
-- =====================================================

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

CREATE INDEX IF NOT EXISTS idx_brand_images_brand_id ON brand_images(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_images_status ON brand_images(status);

-- 迁移旧数据：将 brands.cover_image 非空记录插入 brand_images
INSERT INTO brand_images (brand_id, image_url, sort_order, status, is_selected)
SELECT id, cover_image, 0, 'APPROVED', TRUE
FROM brands
WHERE cover_image IS NOT NULL AND cover_image != ''
    AND NOT EXISTS (
        SELECT 1 FROM brand_images bi WHERE bi.brand_id = brands.id
    );


-- =====================================================
-- 4. 新建 brand_submissions 表
-- =====================================================

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

CREATE INDEX IF NOT EXISTS idx_brand_submissions_user_id ON brand_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_submissions_status ON brand_submissions(status);

CREATE OR REPLACE TRIGGER update_brand_submissions_updated_at
    BEFORE UPDATE ON brand_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- 5. 新增表注释
-- =====================================================

COMMENT ON TABLE brand_images IS '品牌图片表（用户上传 + 管理员审核）';
COMMENT ON COLUMN brand_images.brand_id IS '关联品牌ID';
COMMENT ON COLUMN brand_images.image_url IS '图片URL';
COMMENT ON COLUMN brand_images.sort_order IS '排序顺序';
COMMENT ON COLUMN brand_images.status IS '审核状态：PENDING/APPROVED/REJECTED';
COMMENT ON COLUMN brand_images.is_selected IS '是否被管理员选为品牌展示图';
COMMENT ON COLUMN brand_images.uploaded_by IS '上传用户ID';

COMMENT ON TABLE brand_submissions IS '用户提交的品牌（待管理员审核）';
COMMENT ON COLUMN brand_submissions.status IS '审核状态：PENDING/APPROVED/REJECTED';
COMMENT ON COLUMN brand_submissions.reject_reason IS '驳回原因';
COMMENT ON COLUMN brand_submissions.reviewed_at IS '审核时间';

COMMENT ON COLUMN shows.description IS '秀场描述';
COMMENT ON COLUMN shows.designer IS '设计师名称';
COMMENT ON COLUMN shows.created_by IS '创建者（用户上传时的用户ID）';
COMMENT ON COLUMN shows.status IS '审核状态：APPROVED/PENDING/REJECTED';
COMMENT ON COLUMN shows.reject_reason IS '驳回原因';


-- =====================================================
-- 完成！增量迁移已应用
-- =====================================================
