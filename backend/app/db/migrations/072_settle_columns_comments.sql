-- migration 072 · 统一 orders 表关键时间字段的 PG 注释
--
-- 背景:migration 059 把 settlement_due_at 错误注释为「completed + 7d」,
-- 实际 order_service.SETTLEMENT_DAYS = 3。配合 wallet_service.PENDING_RELEASE_DAYS = 3,
-- 形成 T+3 售后窗口与可提现资金锁定。
--
-- 同时把 shipping_due_at / auto_confirm_due_at 的语义写到 PG COMMENT,
-- 方便 SQL 排查与 BI 查询者一眼看清。

COMMENT ON COLUMN orders.shipping_due_at IS
    '卖家发货截止时间 = paid_at + 72h。超过未发货会被 expire_overdue_shipments cron 自动 refunded_auto。';

COMMENT ON COLUMN orders.auto_confirm_due_at IS
    '买家未确认收货的兜底时间 = delivered_at + 7d。auto_confirm_delivered cron 到时把订单推进 completed。';

COMMENT ON COLUMN orders.settlement_due_at IS
    '订单结算时间 = completed_at + 3d (T+3 售后锁定窗口)。settle_completed cron 到时把订单推进 settled,同步 wallet release_due_pending 把钱划入 available_cents。';
