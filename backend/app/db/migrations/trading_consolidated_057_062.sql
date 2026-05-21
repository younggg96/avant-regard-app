-- =====================================================
-- 交易系统 057–062 合并迁移（Trading Phase 1–6）
-- =====================================================
--
-- 把以下 6 个增量迁移合并到一份可复制粘贴的脚本里，方便直接在
-- Supabase / MemFire 的 SQL 编辑器一次性执行：
--
--   057_trading_listings.sql                — Listing 基建
--   058_provenance_and_collections.sql      — 履历 / 价格基准 / 多收藏夹
--   059_orders_engine.sql                   — 订单引擎（offer / order / 库存锁 / 结算）
--   060_disputes_authentication_reviews.sql — 售后 / 鉴定 / 双盲互评 / IM 富媒体
--   061_archive_plus.sql                    — My Archive / Plus 订阅
--   062_archive_manual_and_holdings.sql     — Archive 独立上传 + 持有记录
--
-- 兼容前提：
--   - users / store_products / store_merchants / store_product_favorites /
--     buyer_stores / shows / brands / messages 等基础表已存在
--   - 公共触发器函数 update_updated_at_column() 已存在（在更早的迁移里）
--
-- 全脚本使用 IF NOT EXISTS / DROP IF EXISTS / ON CONFLICT 保持幂等，
-- 重复执行不会破坏已有数据。
-- =====================================================


-- =====================================================
-- 057 — Trading Listings 基建
-- =====================================================

-- (a) seller_profiles —— C2C 个人卖家档案
CREATE TABLE IF NOT EXISTS seller_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(64),
    bio TEXT,
    id_verified BOOLEAN DEFAULT FALSE,
    id_verified_at TIMESTAMP WITH TIME ZONE,
    credit_score INTEGER DEFAULT 100,
    response_avg_minutes INTEGER,
    total_sales INTEGER DEFAULT 0,
    total_gmv_cents BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_seller_profiles_updated_at ON seller_profiles;
CREATE TRIGGER trg_seller_profiles_updated_at
    BEFORE UPDATE ON seller_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- (b) store_products 扩展（双轨卖家 / 5 视角 / 5 档成色 / 状态机扩展）
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS seller_kind VARCHAR(16) NOT NULL DEFAULT 'merchant',
    ADD COLUMN IF NOT EXISTS seller_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS size VARCHAR(32),
    ADD COLUMN IF NOT EXISTS color VARCHAR(32),
    ADD COLUMN IF NOT EXISTS condition VARCHAR(16),
    ADD COLUMN IF NOT EXISTS condition_note TEXT,
    -- NOTE: shows.id 已经在 fix_shows_id_type.sql 中改成 VARCHAR(100)，
    -- 这里必须用 VARCHAR(100) 才能挂上外键，否则会出现
    -- "Key columns ... are of incompatible types: bigint and character varying."
    ADD COLUMN IF NOT EXISTS original_show_id VARCHAR(100) REFERENCES shows(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS original_acquired_at DATE,
    ADD COLUMN IF NOT EXISTS accept_offer BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS photo_angles JSONB,
    ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS current_buyer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE store_products ALTER COLUMN store_id DROP NOT NULL;

ALTER TABLE store_products
    DROP CONSTRAINT IF EXISTS chk_store_products_seller_kind;
ALTER TABLE store_products
    ADD CONSTRAINT chk_store_products_seller_kind CHECK (
        (seller_kind = 'merchant'   AND merchant_id IS NOT NULL)
     OR (seller_kind = 'individual' AND seller_user_id IS NOT NULL AND merchant_id IS NULL)
    );

ALTER TABLE store_products
    DROP CONSTRAINT IF EXISTS chk_store_products_condition;
ALTER TABLE store_products
    ADD CONSTRAINT chk_store_products_condition CHECK (
        condition IS NULL
     OR condition IN ('BNWT', 'NEW_99', 'NEW_95', 'USED_8', 'FLAW')
    );

-- 旧状态值映射（向后兼容旧前端写入）
UPDATE store_products SET status = 'active'   WHERE status = 'PUBLISHED';
UPDATE store_products SET status = 'sold'     WHERE status = 'SOLD_OUT';
UPDATE store_products SET status = 'offline'  WHERE status = 'HIDDEN';
UPDATE store_products SET status = 'draft'    WHERE status = 'DRAFT';

ALTER TABLE store_products
    DROP CONSTRAINT IF EXISTS chk_store_products_status;
ALTER TABLE store_products
    ADD CONSTRAINT chk_store_products_status CHECK (
        status IN ('draft', 'reviewing', 'active', 'frozen', 'sold', 'rejected', 'offline')
    );

ALTER TABLE store_products ALTER COLUMN status SET DEFAULT 'draft';

CREATE OR REPLACE FUNCTION normalize_store_product_status() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS NULL THEN
        NEW.status := 'draft';
    ELSIF NEW.status = 'PUBLISHED' THEN
        NEW.status := 'active';
    ELSIF NEW.status = 'SOLD_OUT' THEN
        NEW.status := 'sold';
    ELSIF NEW.status = 'HIDDEN' THEN
        NEW.status := 'offline';
    ELSIF NEW.status = 'DRAFT' THEN
        NEW.status := 'draft';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_products_normalize_status ON store_products;
CREATE TRIGGER trg_store_products_normalize_status
    BEFORE INSERT OR UPDATE ON store_products
    FOR EACH ROW EXECUTE FUNCTION normalize_store_product_status();

CREATE INDEX IF NOT EXISTS idx_store_products_seller_user
    ON store_products(seller_user_id, status, published_at DESC)
    WHERE seller_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_products_seller_kind_status
    ON store_products(seller_kind, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_products_active_brand
    ON store_products(brand, published_at DESC)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_store_products_active_condition
    ON store_products(condition, published_at DESC)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_store_products_frozen_until
    ON store_products(frozen_until)
    WHERE frozen_until IS NOT NULL;


-- (d) product_review_audits —— 审核记录
CREATE TABLE IF NOT EXISTS product_review_audits (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    reviewer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    decision VARCHAR(16) NOT NULL CHECK (decision IN ('approved', 'rejected', 'auto_approved')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_review_audits_product
    ON product_review_audits(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_review_audits_reviewer
    ON product_review_audits(reviewer_user_id, created_at DESC)
    WHERE reviewer_user_id IS NOT NULL;


-- =====================================================
-- 058 — Provenance / Price History / Collections
-- =====================================================

CREATE TABLE IF NOT EXISTS product_provenance_events (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL,
    actor_kind VARCHAR(16) NOT NULL,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE SET NULL,
    actor_brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL,
    occurred_at DATE,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provenance_product
    ON product_provenance_events(product_id, occurred_at DESC NULLS LAST, id);


CREATE TABLE IF NOT EXISTS product_price_history (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    brand_name VARCHAR(200),
    category_id BIGINT REFERENCES store_product_categories(id) ON DELETE SET NULL,
    size VARCHAR(32),
    condition VARCHAR(16),
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    currency VARCHAR(10) DEFAULT 'CNY',
    sold_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    source VARCHAR(16) DEFAULT 'order',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_brand_time
    ON product_price_history(brand_name, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_brand_condition
    ON product_price_history(brand_name, condition, sold_at DESC);


CREATE TABLE IF NOT EXISTS user_collections (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    visibility VARCHAR(16) NOT NULL DEFAULT 'private',
    cover_product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

DROP TRIGGER IF EXISTS trg_user_collections_updated_at ON user_collections;
CREATE TRIGGER trg_user_collections_updated_at
    BEFORE UPDATE ON user_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


ALTER TABLE store_product_favorites
    ADD COLUMN IF NOT EXISTS collection_id BIGINT
        REFERENCES user_collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_product_favorites_collection
    ON store_product_favorites(collection_id)
    WHERE collection_id IS NOT NULL;


-- =====================================================
-- 059 — Orders Engine
-- =====================================================

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


CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(32) NOT NULL UNIQUE,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE RESTRICT,
    buyer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    seller_merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE SET NULL,
    offer_id BIGINT REFERENCES offers(id) ON DELETE SET NULL,
    listing_price_cents BIGINT NOT NULL,
    paid_price_cents BIGINT NOT NULL,
    commission_rate_bps INTEGER NOT NULL DEFAULT 800,
    commission_cents BIGINT NOT NULL DEFAULT 0,
    seller_payout_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'CNY',
    shipping_address_json JSONB,
    shipping_due_at TIMESTAMP WITH TIME ZONE,
    auto_confirm_due_at TIMESTAMP WITH TIME ZONE,
    settlement_due_at TIMESTAMP WITH TIME ZONE,
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
    payment_provider VARCHAR(32),
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


CREATE TABLE IF NOT EXISTS order_inspections (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    checked_items JSONB,
    photos TEXT[] DEFAULT '{}',
    note TEXT,
    submitted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


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


-- =====================================================
-- 060 — Disputes / Authentication / Trade Reviews / IM Cards
-- =====================================================

CREATE TABLE IF NOT EXISTS disputes (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    opener_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opener_role VARCHAR(16) NOT NULL CHECK (opener_role IN ('buyer', 'seller')),
    reason VARCHAR(32) NOT NULL,
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


CREATE TABLE IF NOT EXISTS authentication_packages (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
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


CREATE TABLE IF NOT EXISTS trade_reviews (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reviewer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_role VARCHAR(8) NOT NULL CHECK (reviewer_role IN ('buyer', 'seller')),
    target_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    payload_json JSONB,
    comment TEXT,
    visible BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (order_id, reviewer_role)
);

CREATE INDEX IF NOT EXISTS idx_trade_reviews_target ON trade_reviews(target_user_id, visible, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_reviews_order ON trade_reviews(order_id);


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


-- messages 富媒体卡片说明（只更新注释，不改 schema）
COMMENT ON COLUMN messages.message_type IS
    'text / image / system / product_listing / offer / order_status / dispute（PRD 模块 7 富媒体卡片）';

CREATE INDEX IF NOT EXISTS idx_messages_card_types
    ON messages(message_type, created_at DESC)
    WHERE message_type IN ('product_listing', 'offer', 'order_status', 'dispute');


-- =====================================================
-- 061 — My Archive / Plus 订阅
-- =====================================================

CREATE TABLE IF NOT EXISTS user_archive_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    title VARCHAR(200),
    brand_name VARCHAR(200),
    size VARCHAR(32),
    color VARCHAR(32),
    condition VARCHAR(16),
    -- shows.id 是 VARCHAR(100)（见 fix_shows_id_type.sql）
    original_show_id VARCHAR(100) REFERENCES shows(id) ON DELETE SET NULL,
    acquired_price_cents BIGINT,
    currency VARCHAR(10) DEFAULT 'CNY',
    photos TEXT[] DEFAULT '{}',
    acquired_at DATE,
    note TEXT,
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


CREATE TABLE IF NOT EXISTS plus_benefits_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id BIGINT REFERENCES plus_subscriptions(id) ON DELETE SET NULL,
    benefit_type VARCHAR(32) NOT NULL,
    amount_cents BIGINT,
    related_order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    related_auth_order_id BIGINT REFERENCES authentication_orders(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plus_benefits_user
    ON plus_benefits_ledger(user_id, created_at DESC);


-- =====================================================
-- 062 — Archive 独立上传 + 持有记录
-- =====================================================

ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'order'
        CHECK (source IN ('order', 'manual', 'imported'));

ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS storage_location VARCHAR(120);

ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS is_currently_owned BOOLEAN NOT NULL DEFAULT TRUE;


CREATE TABLE IF NOT EXISTS archive_holding_history (
    id BIGSERIAL PRIMARY KEY,
    archive_item_id BIGINT NOT NULL REFERENCES user_archive_items(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    held_from DATE,
    held_to DATE,
    status VARCHAR(24) NOT NULL DEFAULT 'owned'
        CHECK (status IN ('owned', 'lent', 'transferred', 'resold', 'returned')),
    note TEXT,
    counterpart_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    counterpart_name VARCHAR(120),
    related_product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    related_order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_archive_holding_history_updated_at ON archive_holding_history;
CREATE TRIGGER trg_archive_holding_history_updated_at
    BEFORE UPDATE ON archive_holding_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_archive_holding_history_item
    ON archive_holding_history(archive_item_id, held_from DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_archive_holding_history_user
    ON archive_holding_history(user_id, created_at DESC);


-- =====================================================
-- 完成
-- =====================================================
-- 提示：
--   1. 上面所有语句都是幂等的，可以重复执行。
--   2. mock data 在另一个文件 `trading_mock_data.sql` 中提供。
--   3. 执行后可用以下查询自检：
--        SELECT COUNT(*) FROM seller_profiles;
--        SELECT COUNT(*) FROM offers;
--        SELECT COUNT(*) FROM orders;
--        SELECT code, name FROM authentication_packages ORDER BY sort_order;
-- =====================================================
