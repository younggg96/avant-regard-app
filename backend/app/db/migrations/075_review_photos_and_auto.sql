-- =====================================================
-- Migration 075 · 评价图片 + 自动关闭机制
-- =====================================================
--
-- PRD 「评价 · 双盲互评 + 15 天单方公开 + 7 天自动好评」:
--   1. photos_json: 评价配图,JSONB array,最多 3 张(应用层限制)
--   2. auto_closed_at: 由 cron 写入,标记这条评价是 7 天后系统自动给的好评
--   3. 通过 reviewer_role + auto_closed_at 配合,15 天单方公开 cron 能识别
--      谁是"主动方"
-- =====================================================

ALTER TABLE trade_reviews ADD COLUMN IF NOT EXISTS photos_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE trade_reviews ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN trade_reviews.photos_json IS '评价图片 URL 数组(最多 3 张)';
COMMENT ON COLUMN trade_reviews.auto_closed_at IS '系统在 completed_at+7d 后自动写一条 5 星好评时填充;NULL 表示用户手写';

-- 15 天单方公开索引(cron 扫单方未公开的评价)
CREATE INDEX IF NOT EXISTS idx_trade_reviews_visible_pending
ON trade_reviews(visible, submitted_at)
WHERE visible = FALSE;
