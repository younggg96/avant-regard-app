-- =====================================================
-- brand_images 表添加 is_selected 字段
-- 标记哪些已审核图片被管理员选为品牌展示图
-- =====================================================

ALTER TABLE brand_images ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT FALSE;

-- 将现有 APPROVED 图片默认设为选中
UPDATE brand_images SET is_selected = TRUE WHERE status = 'APPROVED';
