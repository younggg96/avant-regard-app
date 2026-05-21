-- =====================================================
-- Migration 060: 交易系统 Phase 5 — 售后 / 鉴定 / 双盲互评 / IM 卡片
-- =====================================================
--
-- 对应 PRD 模块 5 & 7：
--   (a) disputes                 售后/客服仲裁队列
--   (b) authentication_orders    ¥99/199/399 三档鉴定 SKU
--   (c) authentication_packages  鉴定 SKU 配置
--   (d) trade_reviews            双盲互评
--   (e) messages 扩展 message_type （4 种富媒体卡片：product_listing / offer / order_status / dispute）
-- =====================================================


-- ---------------------------------------------------------
-- (a) disputes
-- ---------------------------------------------------------
-- status:
--   - open          买家发起
--   - investigating CS 介入
--   - resolved_refund CS 判退款
--   - resolved_release CS 判放款
--   - withdrawn     买家撤销
CREATE TABLE IF NOT EXISTS disputes (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    opener_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opener_role VARCHAR(16) NOT NULL CHECK (opener_role IN ('buyer', 'seller')),
    reason VARCHAR(32) NOT NULL,                  -- not_as_described / damaged / not_received / fake / other
    description TEXT,
    evidence_photos TEXT[] DEFAULT '{}',
    status VARCHAR(24) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved_refund', 'resolved_release', 'withdrawn')),
    cs_handler_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    cs_decision TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_disputes_updated_at ON disputes;
CREATE TRIGGER trg_disputes_updated_at
    BEFORE UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_handler ON disputes(cs_handler_user_id, status, created_at DESC) WHERE cs_handler_user_id IS NOT NULL;


-- ---------------------------------------------------------
-- (b) authentication_packages —— 鉴定 SKU
-- ---------------------------------------------------------
-- 三档：standard (¥99) / pro (¥199) / expert (¥399)。
-- 各档 SLA 与说明在配置层；这里只存基础信息。
CREATE TABLE IF NOT EXISTS authentication_packages (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,            -- 'standard' / 'pro' / 'expert'
    name VARCHAR(64) NOT NULL,
    price_cents BIGINT NOT NULL CHECK (price_cents > 0),
    currency VARCHAR(10) DEFAULT 'CNY',
    sla_hours INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO authentication_packages (code, name, price_cents, sla_hours, description, sort_order)
VALUES
    ('standard', '标准鉴定', 9900, 48, '基础真伪判定，48 小时内出报告', 1),
    ('pro', '专业鉴定', 19900, 24, '加急 + 高清细节图比对，24 小时出报告', 2),
    ('expert', '专家鉴定', 39900, 24, '资深鉴定师人工出具书面证书', 3)
ON CONFLICT (code) DO NOTHING;


-- ---------------------------------------------------------
-- (c) authentication_orders —— 鉴定订单
-- ---------------------------------------------------------
-- status: pending_payment / paid / reviewing / completed / canceled
-- result: pending / authentic / fake / inconclusive
CREATE TABLE IF NOT EXISTS authentication_orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(32) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id BIGINT NOT NULL REFERENCES authentication_packages(id),
    product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    brand_name VARCHAR(200),
    item_photos TEXT[] DEFAULT '{}',
    note TEXT,
    price_cents BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'CNY',
    status VARCHAR(24) NOT NULL DEFAULT 'pending_payment'
        CHECK (status IN ('pending_payment', 'paid', 'reviewing', 'completed', 'canceled')),
    result VARCHAR(16) DEFAULT 'pending'
        CHECK (result IN ('pending', 'authentic', 'fake', 'inconclusive')),
    expert_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    expert_report TEXT,
    certificate_url TEXT,
    payment_provider VARCHAR(32),
    payment_intent_id VARCHAR(128),
    paid_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_authentication_orders_updated_at ON authentication_orders;
CREATE TRIGGER trg_authentication_orders_updated_at
    BEFORE UPDATE ON authentication_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_auth_orders_user ON authentication_orders(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_orders_status ON authentication_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_orders_expert ON authentication_orders(expert_user_id) WHERE expert_user_id IS NOT NULL;


-- ---------------------------------------------------------
-- (d) trade_reviews —— 双盲互评
-- ---------------------------------------------------------
-- visible 在双方都提交后才置 TRUE（应用层逻辑 + 触发器）；单方默认不可见，避免泄露评分。
-- 唯一约束：每个订单同一 reviewer_role 只能评一次。
CREATE TABLE IF NOT EXISTS trade_reviews (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reviewer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_role VARCHAR(8) NOT NULL CHECK (reviewer_role IN ('buyer', 'seller')),
    target_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    payload_json JSONB,                          -- {asDescribed:5, communication:5, packaging:4, shipping:5, tags:[...]}
    comment TEXT,
    visible BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (order_id, reviewer_role)
);

CREATE INDEX IF NOT EXISTS idx_trade_reviews_target ON trade_reviews(target_user_id, visible, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_reviews_order ON trade_reviews(order_id);


-- 触发器：当一个订单已经有 2 条 review 时，自动把两条都置 visible=true
CREATE OR REPLACE FUNCTION reveal_dual_reviews() RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM trade_reviews WHERE order_id = NEW.order_id) >= 2 THEN
        UPDATE trade_reviews SET visible = TRUE WHERE order_id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trade_reviews_reveal ON trade_reviews;
CREATE TRIGGER trg_trade_reviews_reveal
    AFTER INSERT ON trade_reviews
    FOR EACH ROW EXECUTE FUNCTION reveal_dual_reviews();


-- ---------------------------------------------------------
-- (e) messages 扩展富媒体卡片
-- ---------------------------------------------------------
-- 现有 messages 表 message_type 已经是 VARCHAR 枚举；这里只新增可接受的值：
--   - product_listing  商品卡片（id, cover, title, price）
--   - offer            出价卡片（offerId, productId, priceCents, status）
--   - order_status     订单状态卡片（orderId, status, key timestamps）
--   - dispute          争议卡片（disputeId, orderId, reason）
-- 由于 message_type 在 chat schema 中是字符串，无需 ALTER；前端按 metadata.cardType 渲染。
COMMENT ON COLUMN messages.message_type IS
    'text / image / system / product_listing / offer / order_status / dispute（PRD 模块 7 富媒体卡片）';

-- 索引：聚合查询某用户卡片消息
CREATE INDEX IF NOT EXISTS idx_messages_card_types
    ON messages(message_type, created_at DESC)
    WHERE message_type IN ('product_listing', 'offer', 'order_status', 'dispute');
