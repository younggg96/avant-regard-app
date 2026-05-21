-- =====================================================
-- Migration 059: 交易系统 Phase 4 — 订单引擎
-- =====================================================
--
-- PRD 模块四对应的全套订单/出价/库存锁/物流/验货/结算表。
-- Payment 通道用适配器抽象（见 backend/app/services/payment/）；
-- 这一份迁移不绑定具体支付平台。
-- =====================================================


-- ---------------------------------------------------------
-- stock_holds —— 30 分钟库存锁
-- ---------------------------------------------------------
-- 关键约束：同一商品在同一时刻最多一条「未过期」hold（PG 部分唯一索引实现）。
CREATE TABLE IF NOT EXISTS stock_holds (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    buyer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    released_at TIMESTAMP WITH TIME ZONE,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_holds_active
    ON stock_holds(product_id)
    WHERE released_at IS NULL AND consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_holds_expires
    ON stock_holds(expires_at)
    WHERE released_at IS NULL AND consumed_at IS NULL;


-- ---------------------------------------------------------
-- offers —— 出价（24h TTL）
-- ---------------------------------------------------------
-- status:
--   - pending     初始
--   - accepted    卖家接受 → 创建 stock_hold + order
--   - rejected    卖家拒绝
--   - countered   卖家还价（生成一条新的 pending offer 指向同 product/buyer）
--   - expired     24h 过期未操作（cron）
--   - withdrawn   买家撤回
CREATE TABLE IF NOT EXISTS offers (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    buyer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    seller_merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE SET NULL,
    price_cents BIGINT NOT NULL CHECK (price_cents > 0),
    currency VARCHAR(10) DEFAULT 'CNY',
    message TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired', 'withdrawn')),
    parent_offer_id BIGINT REFERENCES offers(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_buyer ON offers(buyer_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_seller_user ON offers(seller_user_id, status, created_at DESC) WHERE seller_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_seller_merchant ON offers(seller_merchant_id, status, created_at DESC) WHERE seller_merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_expires_pending ON offers(expires_at) WHERE status = 'pending';


-- ---------------------------------------------------------
-- orders —— 订单
-- ---------------------------------------------------------
-- PRD 模块四状态机：
--   pending_payment → paid → shipped → delivered → completed → settled
--   超时与异常分支：refunded_auto / refunded / disputed / resolved
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(32) NOT NULL UNIQUE,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE RESTRICT,
    buyer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    seller_merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE SET NULL,
    offer_id BIGINT REFERENCES offers(id) ON DELETE SET NULL,
    -- 价格快照（订单创建时 freeze）
    listing_price_cents BIGINT NOT NULL,
    paid_price_cents BIGINT NOT NULL,
    commission_rate_bps INTEGER NOT NULL DEFAULT 800,    -- 8% = 800 bps；Plus = 600 bps
    commission_cents BIGINT NOT NULL DEFAULT 0,
    seller_payout_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'CNY',
    -- 收货 / 物流
    shipping_address_json JSONB,
    shipping_due_at TIMESTAMP WITH TIME ZONE,            -- paid + 72h
    auto_confirm_due_at TIMESTAMP WITH TIME ZONE,        -- delivered + 7d
    settlement_due_at TIMESTAMP WITH TIME ZONE,          -- completed + 7d
    -- 状态
    status VARCHAR(24) NOT NULL DEFAULT 'pending_payment'
        CHECK (status IN (
            'pending_payment', 'paid', 'shipped', 'delivered',
            'completed', 'settled',
            'refunded_auto', 'refunded',
            'disputed', 'resolved'
        )),
    paid_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    settled_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    -- 支付侧（具体通道写在 metadata）
    payment_provider VARCHAR(32),                        -- 'stripe' / 'alipay' / 'wechat' / 'mock'
    payment_intent_id VARCHAR(128),
    payment_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller_user ON orders(seller_user_id, status, created_at DESC) WHERE seller_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_seller_merchant ON orders(seller_merchant_id, status, created_at DESC) WHERE seller_merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_due ON orders(shipping_due_at) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_orders_auto_confirm_due ON orders(auto_confirm_due_at) WHERE status = 'delivered';
CREATE INDEX IF NOT EXISTS idx_orders_settlement_due ON orders(settlement_due_at) WHERE status = 'completed';


-- ---------------------------------------------------------
-- order_shipments —— 物流凭证
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_shipments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier VARCHAR(64),
    tracking_no VARCHAR(128),
    images TEXT[] DEFAULT '{}',
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_shipments_order ON order_shipments(order_id);


-- ---------------------------------------------------------
-- order_inspections —— PRD 4.5 五项验货 Checklist（拍照留证）
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_inspections (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    checked_items JSONB,                       -- {"package_intact": true, ...}
    photos TEXT[] DEFAULT '{}',
    note TEXT,
    submitted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ---------------------------------------------------------
-- seller_balances + ledger —— 结算账户
-- ---------------------------------------------------------
-- seller_balances 1:1 卖家（user 或 merchant 用 owner_kind 区分）
CREATE TABLE IF NOT EXISTS seller_balances (
    id BIGSERIAL PRIMARY KEY,
    owner_kind VARCHAR(16) NOT NULL CHECK (owner_kind IN ('user', 'merchant')),
    owner_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    owner_merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    available_cents BIGINT NOT NULL DEFAULT 0,
    pending_cents BIGINT NOT NULL DEFAULT 0,
    total_payout_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'CNY',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_owner_kind CHECK (
        (owner_kind = 'user' AND owner_user_id IS NOT NULL AND owner_merchant_id IS NULL)
     OR (owner_kind = 'merchant' AND owner_merchant_id IS NOT NULL AND owner_user_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seller_balances_user
    ON seller_balances(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_seller_balances_merchant
    ON seller_balances(owner_merchant_id) WHERE owner_merchant_id IS NOT NULL;


-- 结算流水
CREATE TABLE IF NOT EXISTS settlement_ledger (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    owner_kind VARCHAR(16) NOT NULL,
    owner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    owner_merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE SET NULL,
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('credit', 'debit')),
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'CNY',
    reason VARCHAR(64) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_ledger_owner_user
    ON settlement_ledger(owner_user_id, created_at DESC) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settlement_ledger_owner_merchant
    ON settlement_ledger(owner_merchant_id, created_at DESC) WHERE owner_merchant_id IS NOT NULL;
