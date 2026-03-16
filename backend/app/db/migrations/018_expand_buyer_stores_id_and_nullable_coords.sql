-- 扩展 buyer_stores.id 长度，支持用户提交审核后自动生成的较长ID
ALTER TABLE buyer_stores ALTER COLUMN id TYPE VARCHAR(100);

-- 允许 latitude/longitude 为空（用户提交的店铺可能没有精确坐标）
ALTER TABLE buyer_stores ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE buyer_stores ALTER COLUMN longitude DROP NOT NULL;

-- 添加 submitted_by 字段，关联提交者
ALTER TABLE buyer_stores ADD COLUMN IF NOT EXISTS submitted_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- 更新注释
COMMENT ON COLUMN buyer_stores.id IS '店铺ID，管理员创建格式：bj-001，用户提交审核格式：u-{city}-{timestamp}';
