-- =====================================================
-- Migration 061: 交易系统 Phase 6 — My Archive / Plus 订阅
-- =====================================================
--
-- 对应 PRD 模块 6 & 8：
--   (a) user_archive_items   买家个人时间轴
--   (b) plus_subscriptions   Plus 订阅
--   (c) plus_benefits_ledger Plus 权益使用流水（鉴定免费券等）
--
-- 注：user_collections 已在 058 中存在；这里不重复创建。
-- =====================================================


-- ---------------------------------------------------------
-- (a) user_archive_items —— 个人 My Archive 时间轴
-- ---------------------------------------------------------
-- 一笔订单完成时由 order_service.complete_order 写入；
-- 这里冗余 snapshot 商品信息，避免商品下架后历史记录消失。
CREATE TABLE IF NOT EXISTS user_archive_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    -- snapshot 字段
    title VARCHAR(200),
    brand_name VARCHAR(200),
    size VARCHAR(32),
    color VARCHAR(32),
    condition VARCHAR(16),
    original_show_id BIGINT REFERENCES shows(id) ON DELETE SET NULL,
    acquired_price_cents BIGINT,
    currency VARCHAR(10) DEFAULT 'CNY',
    photos TEXT[] DEFAULT '{}',
    -- 时间轴节点
    acquired_at DATE,
    note TEXT,
    -- 转卖跟踪：当用户「一键转卖」时把生成的新 listing 写到这里，方便归档
    relisted_product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    relisted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_archive_items_updated_at ON user_archive_items;
CREATE TRIGGER trg_user_archive_items_updated_at
    BEFORE UPDATE ON user_archive_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_archive_items_user
    ON user_archive_items(user_id, acquired_at DESC NULLS LAST, id);
CREATE INDEX IF NOT EXISTS idx_user_archive_items_order
    ON user_archive_items(order_id) WHERE order_id IS NOT NULL;


-- ---------------------------------------------------------
-- (b) plus_subscriptions —— Plus 订阅
-- ---------------------------------------------------------
-- plan: 'monthly' / 'annual'
-- status: 'active' / 'expired' / 'canceled' / 'pending_payment'
-- source: 'stripe' / 'alipay' / 'wechat' / 'mock'（与 PaymentProvider 一致）
CREATE TABLE IF NOT EXISTS plus_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(16) NOT NULL CHECK (plan IN ('monthly', 'annual')),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    price_cents BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'CNY',
    source VARCHAR(16) NOT NULL DEFAULT 'mock',
    payment_intent_id VARCHAR(128),
    status VARCHAR(16) NOT NULL DEFAULT 'pending_payment'
        CHECK (status IN ('active', 'expired', 'canceled', 'pending_payment')),
    auto_renew BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_plus_subscriptions_updated_at ON plus_subscriptions;
CREATE TRIGGER trg_plus_subscriptions_updated_at
    BEFORE UPDATE ON plus_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_plus_subs_user_active
    ON plus_subscriptions(user_id, status, period_end DESC);


-- ---------------------------------------------------------
-- (c) plus_benefits_ledger —— Plus 权益流水
-- ---------------------------------------------------------
-- 用于追踪：鉴定免费券使用、抽佣折扣应用、Archive 数据面板访问等。
CREATE TABLE IF NOT EXISTS plus_benefits_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id BIGINT REFERENCES plus_subscriptions(id) ON DELETE SET NULL,
    benefit_type VARCHAR(32) NOT NULL,    -- 'commission_discount' / 'free_authentication' / 'archive_analytics'
    amount_cents BIGINT,
    related_order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    related_auth_order_id BIGINT REFERENCES authentication_orders(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plus_benefits_user
    ON plus_benefits_ledger(user_id, created_at DESC);
