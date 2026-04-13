-- =====================================================
-- 030: 添加帖子单品信息字段（品牌、品类、尺码、颜色）
-- =====================================================

-- posts 表增加单品信息字段（全部可选）
ALTER TABLE posts ADD COLUMN IF NOT EXISTS item_brand VARCHAR(200);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS item_brand_id INTEGER;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS item_category VARCHAR(50);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS item_sizes TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS item_colors TEXT[] DEFAULT '{}';
