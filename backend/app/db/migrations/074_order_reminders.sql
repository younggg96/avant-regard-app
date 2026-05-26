-- =====================================================
-- Migration 074 · 订单提醒系列字段
-- =====================================================
--
-- PRD 「自动确认收货 · 3/5/7 天提醒序列」 + 「72h 发货 · 24h/48h 催促」 +
--    「包裹长期不动 → 暂停 auto_confirm_due_at」
--
-- 这些字段都是 "已经发过 X 提醒 / 暂停在某时刻" 的轨迹,
-- 让 cron 幂等推进,而不是每次扫描都重复发。
-- =====================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirm_reminder_3d_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirm_reminder_5d_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_reminder_48h_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_reminder_24h_sent_at TIMESTAMP WITH TIME ZONE;

-- 包裹长期不动相关:
--   tracking_stuck_since: 系统观察到物流卡住的起算时间。
--   auto_confirm_paused_at: cron 把 auto_confirm_due_at 暂停的时间;
--     用户解除 stuck 之后(下一次物流轨迹更新)清零 → 自动恢复计时。
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_stuck_since TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_confirm_paused_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_orders_confirm_reminders
ON orders(status, delivered_at)
WHERE status = 'delivered';

CREATE INDEX IF NOT EXISTS idx_orders_shipping_reminders
ON orders(status, shipping_due_at)
WHERE status = 'paid';

COMMENT ON COLUMN orders.confirm_reminder_3d_sent_at IS '第 3 天 push + 站内信催买家确认收货的发送时刻(防止重复发)';
COMMENT ON COLUMN orders.confirm_reminder_5d_sent_at IS '第 5 天短信催买家确认收货的发送时刻';
COMMENT ON COLUMN orders.shipping_reminder_48h_sent_at IS '距离 shipping_due_at 48h 时给卖家的发货催促';
COMMENT ON COLUMN orders.shipping_reminder_24h_sent_at IS '距离 shipping_due_at 24h 时给卖家的最后一次发货催促';
COMMENT ON COLUMN orders.tracking_stuck_since IS '物流连续无更新的起算时间;cron 据此判断是否要暂停 auto_confirm_due_at';
COMMENT ON COLUMN orders.auto_confirm_paused_at IS '当前 auto_confirm_due_at 是否被 stuck 暂停的标记;新增 tracking_event 时清零';
