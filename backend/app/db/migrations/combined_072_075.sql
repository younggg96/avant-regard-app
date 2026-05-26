-- =============================================================
-- Combined migration 072 → 075
--   合并自:
--     072_settle_columns_comments.sql
--     073_user_addresses.sql
--     074_order_reminders.sql
--     075_review_photos_and_auto.sql
--
--   特性:
--     - 全部用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS,
--       重复执行不会报错
--     - 整体包在 BEGIN / COMMIT 里, 任一语句失败全部回滚
--
--   适用: Supabase SQL Editor 直接粘贴运行
-- =============================================================

BEGIN;

-- =============================================================
-- 072 · orders 表关键时间字段注释统一
-- 背景: migration 059 把 settlement_due_at 错误注释为「completed + 7d」,
--       实际 order_service.SETTLEMENT_DAYS = 3, 配合 wallet
--       PENDING_RELEASE_DAYS = 3 形成 T+3 售后窗口。
-- =============================================================

COMMENT ON COLUMN orders.shipping_due_at IS
    '卖家发货截止时间 = paid_at + 72h。超过未发货会被 expire_overdue_shipments cron 自动 refunded_auto。';

COMMENT ON COLUMN orders.auto_confirm_due_at IS
    '买家未确认收货的兜底时间 = delivered_at + 7d。auto_confirm_delivered cron 到时把订单推进 completed。';

COMMENT ON COLUMN orders.settlement_due_at IS
    '订单结算时间 = completed_at + 3d (T+3 售后锁定窗口)。settle_completed cron 到时把订单推进 settled,同步 wallet release_due_pending 把钱划入 available_cents。';


-- =============================================================
-- 073 · 用户常用收货地址簿 user_addresses
-- 软删除 + 结构化字段 + full_text 快照 + 每用户唯一默认地址
-- =============================================================

CREATE TABLE IF NOT EXISTS user_addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    receiver_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    country TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    detail TEXT,
    full_text TEXT NOT NULL,
    postal_code TEXT,
    label TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
ON user_addresses(user_id)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_addresses_default_per_user
ON user_addresses(user_id)
WHERE is_default = TRUE AND deleted_at IS NULL;

COMMENT ON TABLE  user_addresses          IS '用户常用收货地址簿(PRD 模块四支付环节)。下单时仅作为快照来源,订单 shipping_address_json 不引用此表。';
COMMENT ON COLUMN user_addresses.full_text  IS '地址纯文本快照。结构化字段缺失时(海外/老数据)以本字段为准。';
COMMENT ON COLUMN user_addresses.is_default IS '默认地址。partial unique index 保证同一用户未删除条目里最多一条为 TRUE。';


-- =============================================================
-- 074 · 订单提醒系列字段
-- 3/5/7 天确认提醒 + 48h/24h 发货催促 + 包裹 stuck 暂停 auto_confirm
-- =============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirm_reminder_3d_sent_at   TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirm_reminder_5d_sent_at   TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_reminder_48h_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_reminder_24h_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_stuck_since          TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_confirm_paused_at        TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_orders_confirm_reminders
ON orders(status, delivered_at)
WHERE status = 'delivered';

CREATE INDEX IF NOT EXISTS idx_orders_shipping_reminders
ON orders(status, shipping_due_at)
WHERE status = 'paid';

COMMENT ON COLUMN orders.confirm_reminder_3d_sent_at   IS '第 3 天 push + 站内信催买家确认收货的发送时刻(防止重复发)';
COMMENT ON COLUMN orders.confirm_reminder_5d_sent_at   IS '第 5 天短信催买家确认收货的发送时刻';
COMMENT ON COLUMN orders.shipping_reminder_48h_sent_at IS '距离 shipping_due_at 48h 时给卖家的发货催促';
COMMENT ON COLUMN orders.shipping_reminder_24h_sent_at IS '距离 shipping_due_at 24h 时给卖家的最后一次发货催促';
COMMENT ON COLUMN orders.tracking_stuck_since          IS '物流连续无更新的起算时间;cron 据此判断是否要暂停 auto_confirm_due_at';
COMMENT ON COLUMN orders.auto_confirm_paused_at        IS '当前 auto_confirm_due_at 是否被 stuck 暂停的标记;新增 tracking_event 时清零';


-- =============================================================
-- 075 · 评价图片 + 自动关闭机制
-- photos_json(JSONB array) + auto_closed_at(系统好评标记)
-- =============================================================

ALTER TABLE trade_reviews ADD COLUMN IF NOT EXISTS photos_json    JSONB DEFAULT '[]'::jsonb;
ALTER TABLE trade_reviews ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN trade_reviews.photos_json    IS '评价图片 URL 数组(最多 3 张, 应用层限制)';
COMMENT ON COLUMN trade_reviews.auto_closed_at IS '系统在 completed_at+7d 后自动写一条 5 星好评时填充;NULL 表示用户手写';

CREATE INDEX IF NOT EXISTS idx_trade_reviews_visible_pending
ON trade_reviews(visible, submitted_at)
WHERE visible = FALSE;


COMMIT;
