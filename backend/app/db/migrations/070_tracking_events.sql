-- =====================================================
-- Migration 070: 物流轨迹事件
-- =====================================================
--
-- 配合 backend/app/services/logistics/ 抽象层使用。
--
-- 数据来源：
--   1. provider webhook（快递鸟 / AfterShip / 其他聚合方）— 推荐
--   2. provider 主动 query（兜底 cron 兜住没接 webhook 或推送漏过的）
--   3. Admin 后台手动注入（dev 联调 + 真物流方失联时的兜底）
--
-- 唯一约束 (shipment_id, occurred_at, status_code) 用于跨来源去重。
-- =====================================================


-- ---------------------------------------------------------
-- order_shipments —— 在 059 基础上加几列缓存"最近一条事件"
-- 列表 / 卡片不必每次去 join tracking_events，性能优先。
-- ---------------------------------------------------------
ALTER TABLE order_shipments
    ADD COLUMN IF NOT EXISTS latest_status_code  VARCHAR(32),
    ADD COLUMN IF NOT EXISTS latest_description  TEXT,
    ADD COLUMN IF NOT EXISTS latest_location     VARCHAR(128),
    ADD COLUMN IF NOT EXISTS latest_event_at     TIMESTAMP WITH TIME ZONE,
    -- 'kdniao' / 'aftership' / 'mock' / 'manual'
    ADD COLUMN IF NOT EXISTS provider_source     VARCHAR(32) DEFAULT 'mock';

CREATE INDEX IF NOT EXISTS idx_order_shipments_latest_event_at
    ON order_shipments(latest_event_at);


-- ---------------------------------------------------------
-- tracking_events —— 物流轨迹原子事件
-- 一条运单可能有几十条事件（每个站点 + 派送 + 签收）。
-- 详情页时间轴 = SELECT WHERE shipment_id ORDER BY occurred_at DESC.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracking_events (
    id           BIGSERIAL PRIMARY KEY,
    shipment_id  BIGINT NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
    -- 冗余 order_id，避免列表查询时再 join 一次 shipments
    order_id     BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- 事件发生时间（物流公司原文，非入库时间）
    occurred_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    -- 归一化后的状态码（详见 backend/app/services/logistics/base.py::TrackingStatus）
    --   picked_up / in_transit / out_for_delivery / delivered / exception / returned
    status_code  VARCHAR(32) NOT NULL,
    -- 原文描述："已到达上海转运中心" / "Out for delivery"
    description  TEXT,
    -- 解析出的地点："上海·徐汇" / "Shanghai Distribution Center"
    location     VARCHAR(128),

    -- 数据来源：'kdniao' / 'aftership' / 'mock' / 'manual'
    source       VARCHAR(32) NOT NULL DEFAULT 'mock',
    -- provider 原文留证（顺丰 traces / AfterShip checkpoints 等）
    raw_payload  JSONB,
    -- 是否已经触发过 push（防同一事件多次推送）
    notified_at  TIMESTAMP WITH TIME ZONE,

    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 同一运单、同一时间、同一状态认定为同一事件 → 跨来源天然去重
    UNIQUE (shipment_id, occurred_at, status_code)
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment_time
    ON tracking_events(shipment_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_events_order_time
    ON tracking_events(order_id, occurred_at DESC);

-- 找"未推送"事件用（推送规则 worker / 即时投递）
CREATE INDEX IF NOT EXISTS idx_tracking_events_pending_notify
    ON tracking_events(created_at)
    WHERE notified_at IS NULL;

COMMENT ON TABLE tracking_events IS
  '物流轨迹事件。来源混合（webhook/query/manual），(shipment_id, occurred_at, status_code) 去重。';
