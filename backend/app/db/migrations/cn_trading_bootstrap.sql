-- =====================================================================
-- cn_trading_bootstrap.sql  —— 国内库（MemFire）交易系统建表脚本
-- =====================================================================
--
-- 用途:
--   国内库当前只有基础表(users / store_products / buyer_stores 等),
--   交易系统的表全部缺失, 导致 web 端交易页面全线 404。本脚本把
--   057-083 的建表迁移合并成一份, 直接粘贴到 MemFire 控制台的
--   SQL 编辑器执行即可。
--
-- 特性:
--   * 全部语句均为 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, 幂等,
--     重复执行安全, 不会破坏已有数据。
--   * 不含任何 mock / seed 数据(078、079 已刻意排除)。
--
-- 注意:
--   combined_063_076.sql 名字有误导性 —— 它实际只含 063/064/065/066/
--   070/071/076, 跳过了 072-075。072-075(含 user_addresses 建表)在
--   combined_072_075.sql 里, 因此两份都必须执行。
--
-- 已合并(按执行顺序):
--   trading_consolidated_057_062.sql
--   combined_063_076.sql
--   combined_072_075.sql
--   077_drop_listing_year_decade.sql
--   080_kyc_overseas_identity.sql
--   081_seller_after_sales_response.sql
--   082_add_store_product_browsing_history.sql
--   083_store_product_category_kind.sql
--
-- 刻意排除:
--   078_normalize_mock_order_commission.sql  — 只修历史 mock 订单抽佣, 国内无数据
--   079_reset_and_seed_per_user_listings.sql — 会清空交易数据并灌 mock 在售商品
--   trading_mock_data*.sql                   — mock 数据
-- =====================================================================


-- #####################################################################
-- ##  BEGIN trading_consolidated_057_062.sql
-- #####################################################################

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


-- ##  END trading_consolidated_057_062.sql


-- #####################################################################
-- ##  BEGIN combined_063_076.sql
-- #####################################################################

-- =============================================================
-- Combined migration 063 → 076 (catch-up bundle)
--   合并 / 重新整理:
--     063_buyer_confirm_and_wallet.sql       — KYC / 放款账户 / pending_payouts / wallet_withdrawals
--     064_hide_sales_privacy.sql             — user_info.hide_sales
--     065_marketplace_curated_and_completeness.sql
--     066_listing_phase2.sql
--     070_tracking_events.sql                — order_shipments latest_* + tracking_events
--     071_add_preferred_currency.sql
--     076_stripe_connect_and_clawback.sql    — Stripe Connect + clawback
--
--   特性:
--     - 全部 IF NOT EXISTS / DROP IF EXISTS / ON CONFLICT,可重复执行
--     - 整体包在 BEGIN / COMMIT,任一语句失败回滚
--     - 与 trading_consolidated_057_062.sql + combined_072_075.sql 互不冲突
--
--   适用: 数据库只跑过 trading_consolidated_057_062 + combined_072_075,
--         缺 063 / 064 / 065 / 066 / 070 / 071, 现在又要新加 076。
-- =============================================================

BEGIN;

-- =============================================================
-- 063 · 买家确认收货 + 卖家钱包 + 实名认证
-- =============================================================

-- (a) orders.commission_rate_bps 默认改成 1%
-- orders / commission_rate_bps 来自 trading_consolidated_057_062, 一定存在。
ALTER TABLE orders ALTER COLUMN commission_rate_bps SET DEFAULT 100;
UPDATE orders
SET    commission_rate_bps = 100,
       commission_cents    = paid_price_cents / 100,
       seller_payout_cents = paid_price_cents - (paid_price_cents / 100)
WHERE  status IN ('pending_payment', 'paid')
  AND  commission_rate_bps <> 100;

-- (b) seller_kyc —— 卖家实名认证
CREATE TABLE IF NOT EXISTS seller_kyc (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    real_name VARCHAR(80) NOT NULL,
    id_card_no VARCHAR(64) NOT NULL,
    id_card_front_url TEXT,
    id_card_back_url TEXT,
    holder_photo_url TEXT,
    contact_phone VARCHAR(32),
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('none', 'pending', 'approved', 'rejected')),
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reject_reason TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_seller_kyc_updated_at ON seller_kyc;
CREATE TRIGGER trg_seller_kyc_updated_at
    BEFORE UPDATE ON seller_kyc
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_seller_kyc_status
    ON seller_kyc(status, submitted_at DESC);

-- (c) payout_accounts —— 卖家提现账户
-- 注意:这里的 CHECK 只列三种,真正的 stripe_connect 在文件末尾 076 段统一打开
CREATE TABLE IF NOT EXISTS payout_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type VARCHAR(16) NOT NULL CHECK (account_type IN ('bank', 'alipay', 'wechat')),
    holder_name VARCHAR(80) NOT NULL,
    account_no VARCHAR(64) NOT NULL,
    bank_name VARCHAR(80),
    branch_name VARCHAR(120),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_payout_accounts_updated_at ON payout_accounts;
CREATE TRIGGER trg_payout_accounts_updated_at
    BEFORE UPDATE ON payout_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_accounts_user_default
    ON payout_accounts(user_id) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_payout_accounts_user
    ON payout_accounts(user_id, created_at DESC);

-- (d) pending_payouts —— 待解冻款项
-- 注意:status CHECK 同样在 076 段重写,先用三态版本建表
CREATE TABLE IF NOT EXISTS pending_payouts (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    owner_kind VARCHAR(16) NOT NULL CHECK (owner_kind IN ('user', 'merchant')),
    owner_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    owner_merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    commission_cents BIGINT NOT NULL DEFAULT 0,
    gross_amount_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'CNY',
    release_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'locked'
        CHECK (status IN ('locked', 'released', 'reversed')),
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pending_payouts_release
    ON pending_payouts(release_at) WHERE status = 'locked';
CREATE INDEX IF NOT EXISTS idx_pending_payouts_user
    ON pending_payouts(owner_user_id, status, release_at)
    WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_payouts_merchant
    ON pending_payouts(owner_merchant_id, status, release_at)
    WHERE owner_merchant_id IS NOT NULL;

-- (e) wallet_withdrawals —— 提现申请
CREATE TABLE IF NOT EXISTS wallet_withdrawals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payout_account_id BIGINT REFERENCES payout_accounts(id) ON DELETE SET NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(10) DEFAULT 'CNY',
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
    note TEXT,
    reject_reason TEXT,
    processed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_wallet_withdrawals_updated_at ON wallet_withdrawals;
CREATE TRIGGER trg_wallet_withdrawals_updated_at
    BEFORE UPDATE ON wallet_withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user
    ON wallet_withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_pending
    ON wallet_withdrawals(status, created_at)
    WHERE status IN ('pending', 'processing');

-- (f) seller_balances 增加 withdrawn 累计与最近一次释放时间
ALTER TABLE seller_balances
    ADD COLUMN IF NOT EXISTS total_withdrawn_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE seller_balances
    ADD COLUMN IF NOT EXISTS last_release_at TIMESTAMP WITH TIME ZONE;

-- (g) settlement_ledger.reason 注释扩充(settlement_ledger 由 057-062 包创建)
COMMENT ON COLUMN settlement_ledger.reason IS
    'confirm_receipt | pending_lock | pending_release | withdrawal | refund_reverse | refund_clawback | order_settled (legacy)';


-- =============================================================
-- 064 · 用户隐私: 是否对他人隐藏「在售」单品列表
-- =============================================================
ALTER TABLE user_info
    ADD COLUMN IF NOT EXISTS hide_sales BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN user_info.hide_sales IS '是否隐藏在售单品列表（他人主页「在售」tab）';
UPDATE user_info SET hide_sales = FALSE WHERE hide_sales IS NULL;


-- =============================================================
-- 065 · Marketplace 策展 + 信息完整度评级
-- =============================================================
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS is_curated BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS curated_sort_order INT,
    ADD COLUMN IF NOT EXISTS completeness_score INT DEFAULT 0 NOT NULL;

COMMENT ON COLUMN store_products.is_curated IS '管理员是否将此单品标记为「大家都在看」';
COMMENT ON COLUMN store_products.curated_sort_order IS '同批策展内的展示顺序，asc，NULL 视为最大';
COMMENT ON COLUMN store_products.completeness_score IS '信息完整度评分 0..100，trigger 自动计算';

CREATE INDEX IF NOT EXISTS idx_store_products_curated
    ON store_products (is_curated, curated_sort_order, published_at DESC)
    WHERE is_curated = TRUE;
CREATE INDEX IF NOT EXISTS idx_store_products_completeness
    ON store_products (completeness_score DESC, favorite_count DESC)
    WHERE status = 'active';

CREATE OR REPLACE FUNCTION compute_store_product_completeness(p store_products)
RETURNS INT AS $$
DECLARE
    score INT := 0;
    img_count INT := 0;
    desc_len INT := 0;
    note_len INT := 0;
    tag_count INT := 0;
    angle JSONB;
    angles_filled INT := 0;
BEGIN
    IF p.title IS NOT NULL AND length(trim(p.title)) > 0 THEN score := score + 5; END IF;
    desc_len := COALESCE(length(p.description), 0);
    IF desc_len >= 200 THEN score := score + 15;
    ELSIF desc_len >= 50 THEN score := score + 10;
    END IF;
    IF p.brand IS NOT NULL AND length(trim(p.brand)) > 0 THEN score := score + 10; END IF;
    IF p.category_id IS NOT NULL THEN score := score + 8; END IF;
    IF p.size IS NOT NULL AND length(trim(p.size)) > 0 THEN score := score + 6; END IF;
    IF p.color IS NOT NULL AND length(trim(p.color)) > 0 THEN score := score + 6; END IF;
    IF p.condition IS NOT NULL AND length(trim(p.condition)) > 0 THEN score := score + 8; END IF;
    note_len := COALESCE(length(p.condition_note), 0);
    IF note_len >= 10 THEN score := score + 8; END IF;
    img_count := COALESCE(array_length(p.images, 1), 0);
    IF img_count >= 5 THEN score := score + 15;
    ELSIF img_count >= 3 THEN score := score + 10;
    ELSIF img_count >= 1 THEN score := score + 5;
    END IF;
    angle := p.photo_angles;
    IF angle IS NOT NULL THEN
        IF (angle->>'front') IS NOT NULL AND length(angle->>'front') > 0 THEN angles_filled := angles_filled + 1; END IF;
        IF (angle->>'back') IS NOT NULL AND length(angle->>'back') > 0 THEN angles_filled := angles_filled + 1; END IF;
        IF (angle->>'wash_label') IS NOT NULL AND length(angle->>'wash_label') > 0 THEN angles_filled := angles_filled + 1; END IF;
        IF (angle->>'brand_label') IS NOT NULL AND length(angle->>'brand_label') > 0 THEN angles_filled := angles_filled + 1; END IF;
        IF (angle->>'flaw') IS NOT NULL AND length(angle->>'flaw') > 0 THEN angles_filled := angles_filled + 1; END IF;
    END IF;
    IF angles_filled >= 5 THEN score := score + 10; END IF;
    tag_count := COALESCE(array_length(p.tags, 1), 0);
    IF tag_count >= 1 THEN score := score + 4; END IF;
    IF p.accept_offer IS TRUE THEN score := score + 2; END IF;
    IF p.original_show_id IS NOT NULL AND length(trim(p.original_show_id)) > 0 THEN score := score + 3; END IF;
    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION trg_refresh_store_product_completeness()
RETURNS TRIGGER AS $$
BEGIN
    NEW.completeness_score := compute_store_product_completeness(NEW);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS store_products_completeness_trigger ON store_products;
CREATE TRIGGER store_products_completeness_trigger
    BEFORE INSERT OR UPDATE OF
        title, description, brand, category_id,
        size, color, condition, condition_note,
        images, photo_angles, tags, accept_offer, original_show_id
    ON store_products
    FOR EACH ROW
    EXECUTE FUNCTION trg_refresh_store_product_completeness();

-- 回填存量
UPDATE store_products
SET completeness_score = compute_store_product_completeness(store_products.*)
WHERE TRUE;


-- =============================================================
-- 066 · Listing Phase 2
-- =============================================================
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS style_name        VARCHAR(200),
    ADD COLUMN IF NOT EXISTS year_decade       VARCHAR(8),
    ADD COLUMN IF NOT EXISTS accessories_note  TEXT,
    ADD COLUMN IF NOT EXISTS ship_from_country VARCHAR(80),
    ADD COLUMN IF NOT EXISTS ship_from_state   VARCHAR(80),
    ADD COLUMN IF NOT EXISTS ship_from_city    VARCHAR(80),
    ADD COLUMN IF NOT EXISTS shipping_fee_mode VARCHAR(16) DEFAULT 'cod',
    ADD COLUMN IF NOT EXISTS commission_rate_bps INT DEFAULT 100,
    ADD COLUMN IF NOT EXISTS dedup_signature   VARCHAR(64);

COMMENT ON COLUMN store_products.style_name        IS '款式 / Runway 系列名';
COMMENT ON COLUMN store_products.year_decade       IS '年代（1950s, 1960s, ... 2020s）';
COMMENT ON COLUMN store_products.accessories_note  IS '配件说明（防尘袋 / 原盒 / 票据）';
COMMENT ON COLUMN store_products.ship_from_country IS '发货国家（中文或英文，前端归一化）';
COMMENT ON COLUMN store_products.ship_from_state   IS '发货省份 / 州';
COMMENT ON COLUMN store_products.ship_from_city    IS '发货城市';
COMMENT ON COLUMN store_products.shipping_fee_mode IS '运费方式：cod (到付) | free (包邮)';
COMMENT ON COLUMN store_products.commission_rate_bps IS '平台抽佣率，单位 bps，默认 100 = 1%';
COMMENT ON COLUMN store_products.dedup_signature   IS '基于品牌+款式+尺码+颜色的指纹，用于防重复上架';

UPDATE store_products
SET    commission_rate_bps = 100
WHERE  commission_rate_bps IS NULL OR commission_rate_bps = 0;

UPDATE store_products
SET    shipping_fee_mode = 'cod'
WHERE  shipping_fee_mode IS NULL
   OR  shipping_fee_mode NOT IN ('cod', 'free');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE  table_name = 'store_products'
        AND    constraint_name = 'store_products_shipping_fee_mode_check'
    ) THEN
        ALTER TABLE store_products
        ADD CONSTRAINT store_products_shipping_fee_mode_check
        CHECK (shipping_fee_mode IN ('cod', 'free'));
    END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_products_dedup
    ON store_products (seller_user_id, dedup_signature)
    WHERE seller_user_id IS NOT NULL
      AND dedup_signature IS NOT NULL
      AND status IN ('draft', 'reviewing', 'active', 'frozen');

DROP VIEW IF EXISTS brand_price_history;
CREATE VIEW brand_price_history AS
SELECT
    lower(trim(brand))                       AS brand_key,
    brand                                    AS brand_display,
    condition,
    COUNT(*)                                 AS sample_size,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY price_cents) AS p25_cents,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY price_cents) AS p50_cents,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY price_cents) AS p75_cents,
    MIN(price_cents)                          AS min_cents,
    MAX(price_cents)                          AS max_cents
FROM   store_products
WHERE  brand IS NOT NULL
  AND  trim(brand) <> ''
  AND  status IN ('active', 'sold')
  AND  price_cents > 0
GROUP  BY lower(trim(brand)), brand, condition;
COMMENT ON VIEW brand_price_history IS 'PRD 1.4 智能定价：按品牌 + 成色聚合的历史价格区间（active+sold）。';

CREATE INDEX IF NOT EXISTS idx_store_products_seller_status_draft
    ON store_products (seller_user_id, status)
    WHERE status = 'draft' AND seller_kind = 'individual';

CREATE TABLE IF NOT EXISTS support_contact_config (
    id              SERIAL PRIMARY KEY,
    weekday_hours   VARCHAR(64) DEFAULT '09:00 - 21:00',
    weekend_hours   VARCHAR(64) DEFAULT '10:00 - 18:00',
    timezone        VARCHAR(32) DEFAULT 'Asia/Shanghai',
    wechat_id       VARCHAR(64),
    email           VARCHAR(120),
    notice          TEXT,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
INSERT INTO support_contact_config (id, weekday_hours, weekend_hours, timezone, email, notice)
VALUES (1, '09:00 - 21:00', '10:00 - 18:00', 'Asia/Shanghai',
        'support@avantregard.com',
        '工作日 09:00-21:00 · 周末 10:00-18:00 · 节假日延迟回复')
ON CONFLICT (id) DO NOTHING;


-- =============================================================
-- 070 · 物流轨迹事件
-- =============================================================
ALTER TABLE order_shipments
    ADD COLUMN IF NOT EXISTS latest_status_code  VARCHAR(32),
    ADD COLUMN IF NOT EXISTS latest_description  TEXT,
    ADD COLUMN IF NOT EXISTS latest_location     VARCHAR(128),
    ADD COLUMN IF NOT EXISTS latest_event_at     TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS provider_source     VARCHAR(32) DEFAULT 'mock';

CREATE INDEX IF NOT EXISTS idx_order_shipments_latest_event_at
    ON order_shipments(latest_event_at);

CREATE TABLE IF NOT EXISTS tracking_events (
    id           BIGSERIAL PRIMARY KEY,
    shipment_id  BIGINT NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
    order_id     BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    occurred_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    status_code  VARCHAR(32) NOT NULL,
    description  TEXT,
    location     VARCHAR(128),
    source       VARCHAR(32) NOT NULL DEFAULT 'mock',
    raw_payload  JSONB,
    notified_at  TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (shipment_id, occurred_at, status_code)
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment_time
    ON tracking_events(shipment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_order_time
    ON tracking_events(order_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_pending_notify
    ON tracking_events(created_at)
    WHERE notified_at IS NULL;

COMMENT ON TABLE tracking_events IS
  '物流轨迹事件。来源混合（webhook/query/manual），(shipment_id, occurred_at, status_code) 去重。';


-- =============================================================
-- 071 · 用户偏好币种
-- =============================================================
ALTER TABLE user_info
    ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(8) DEFAULT NULL;

ALTER TABLE user_info
    DROP CONSTRAINT IF EXISTS user_info_preferred_currency_check;
ALTER TABLE user_info
    ADD CONSTRAINT user_info_preferred_currency_check
    CHECK (preferred_currency IS NULL OR preferred_currency IN ('CNY', 'USD'));


-- =============================================================
-- 076 · Stripe Connect + clawback
-- =============================================================

-- (1) pending_payouts.status: locked / released / reversed / clawed_back
ALTER TABLE pending_payouts
    DROP CONSTRAINT IF EXISTS pending_payouts_status_check;
ALTER TABLE pending_payouts
    ADD CONSTRAINT pending_payouts_status_check
    CHECK (status IN ('locked', 'released', 'reversed', 'clawed_back'));

-- (2) payout_accounts.account_type: + stripe_connect
ALTER TABLE payout_accounts
    DROP CONSTRAINT IF EXISTS payout_accounts_account_type_check;
ALTER TABLE payout_accounts
    ADD CONSTRAINT payout_accounts_account_type_check
    CHECK (account_type IN ('bank', 'alipay', 'wechat', 'stripe_connect'));

-- (3) stripe_connect_accounts —— 卖家 Connect 账号关联表
CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_account_id VARCHAR(64) NOT NULL UNIQUE,
    account_type VARCHAR(16) NOT NULL DEFAULT 'express'
        CHECK (account_type IN ('express', 'standard', 'custom')),
    country VARCHAR(2),
    default_currency VARCHAR(10),
    charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    requirements_currently_due TEXT[] NOT NULL DEFAULT '{}',
    requirements_disabled_reason VARCHAR(120),
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'restricted', 'disabled')),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id)
);
DROP TRIGGER IF EXISTS trg_stripe_connect_accounts_updated_at ON stripe_connect_accounts;
CREATE TRIGGER trg_stripe_connect_accounts_updated_at
    BEFORE UPDATE ON stripe_connect_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- (4) wallet_withdrawals.metadata
ALTER TABLE wallet_withdrawals
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;


-- ##  END combined_063_076.sql


-- #####################################################################
-- ##  BEGIN combined_072_075.sql
-- #####################################################################

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


-- ##  END combined_072_075.sql


-- #####################################################################
-- ##  BEGIN 077_drop_listing_year_decade.sql
-- #####################################################################

-- =====================================================================
-- 077_drop_listing_year_decade.sql
-- =====================================================================
-- 移除 store_products.year_decade 字段。
--
-- 背景:
--   - 单品发布表单原本要求卖家选「年代」(1950s ~ 2020s), 但实际上多数卖家
--     无法准确判断衣物年份, 强制选会大量乱填, 反而污染按年代筛选的数据。
--   - 产品决定彻底移除该字段, 前后端 schema / UI 都同步删掉, 而不是仅"选填"
--     —— 避免遗留无用字段长期沉淀。
--
-- 影响:
--   - 后端 schema (`StoreProductCreate / Update / StoreProduct`) 同步去掉
--     `yearDecade` 字段; service 层不再读写 `year_decade` 列。
--   - 前端发布表单删除该 chip 行; `MarketplaceFilter` / 详情页本来就没用它。
--   - completeness_score trigger 不依赖 year_decade, 无需重建。
--   - 066 中的 `brand_price_history` view 同样不引用 year_decade, 无需重建。
--
-- 兼容:
--   - 老数据丢弃即可, 没有业务功能依赖这一列。
-- =====================================================================

ALTER TABLE store_products
    DROP COLUMN IF EXISTS year_decade;


-- ##  END 077_drop_listing_year_decade.sql


-- #####################################################################
-- ##  BEGIN 080_kyc_overseas_identity.sql
-- #####################################################################

-- =====================================================
-- Migration 080: 实名认证支持海外(美国)会话式证件 + 活体自拍
-- =====================================================
--
-- 背景:
--   seller_kyc 原本只为中国大陆设计 —— "姓名 + 身份证号" 同步二要素 +
--   三张证件照人工兜底。海外(美国)没有可商用的 "姓名 + 证件号" 比对接口,
--   走的是 "证件影像 OCR + 活体自拍" 的第三方托管流程(Stripe Identity 等),
--   平台不落证件影像 / SSN,只持有会话标识 + 核验结果。
--
-- 本迁移:
--   1. seller_kyc.id_card_no 放开 NOT NULL —— 海外流程没有身份证号。
--   2. 新增 provider / provider_session_id / verified_country 字段,
--      区分这条 KYC 记录走的是哪条通道、第三方会话 ID、核验出的国别。
--
-- 兼容性:
--   - 历史中国大陆记录 provider 回填 'aliyun'(逻辑上等价于既有二要素流程);
--     provider 允许为空,服务层读到空按中国大陆流程处理。
-- =====================================================


-- ---------------------------------------------------------
-- (a) id_card_no 放开 NOT NULL(海外无身份证号)
-- ---------------------------------------------------------
ALTER TABLE seller_kyc ALTER COLUMN id_card_no DROP NOT NULL;


-- ---------------------------------------------------------
-- (b) 新增通道 / 会话 / 国别字段
-- ---------------------------------------------------------
-- provider:
--   - aliyun           中国大陆同步二要素(默认)
--   - stripe_identity  海外证件 + 活体自拍(Stripe Identity)
--   - mock_identity    开发用会话式 mock
ALTER TABLE seller_kyc
    ADD COLUMN IF NOT EXISTS provider VARCHAR(24);

-- 第三方会话 ID(Stripe Identity VerificationSession id 等),
-- webhook / 主动 refresh 时按它反查同步状态。
ALTER TABLE seller_kyc
    ADD COLUMN IF NOT EXISTS provider_session_id VARCHAR(128);

-- 核验出的证件国别(ISO 2 字母,海外会话式才有)。
ALTER TABLE seller_kyc
    ADD COLUMN IF NOT EXISTS verified_country VARCHAR(8);


-- ---------------------------------------------------------
-- (c) 历史数据回填 provider='aliyun'(既有都是中国大陆二要素流程)
-- ---------------------------------------------------------
UPDATE seller_kyc
SET    provider = 'aliyun'
WHERE  provider IS NULL;


-- ---------------------------------------------------------
-- (d) 按会话 ID 反查的索引(webhook 高频)
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_seller_kyc_provider_session
    ON seller_kyc(provider_session_id)
    WHERE provider_session_id IS NOT NULL;


-- ##  END 080_kyc_overseas_identity.sql


-- #####################################################################
-- ##  BEGIN 081_seller_after_sales_response.sql
-- #####################################################################

-- =====================================================
-- Migration 081: 售后买家 / 卖家分流 —— 卖家对买家售后请求的「响应」字段
-- =====================================================
--
-- 背景：此前 disputes 表只记录「发起方（买家/卖家）+ 客服仲裁」，买卖双方
-- 走的是同一套 IM 客服逻辑，卖家既看不到买家提交的售后列表，也无法对单条
-- 售后做出结构化的「同意退款 / 拒绝并申诉」响应。
--
-- 本次拆分：
--   - 买家端：通过 /api/disputes 提交结构化售后请求（reason + 描述 + 凭证图）。
--   - 卖家端：通过 /api/disputes/seller 拉取「买家售后列表」，并用
--     /api/disputes/{id}/seller-respond 做出响应。
--
-- 新增列均为可空 / 带默认值，旧数据无需回填。
-- reason 列仍是 VARCHAR(32) 自由值（应用层校验枚举），新增的
-- no_logistics_update / delivered_not_received / quality_issue /
-- listing_delisted 无需改 DB CHECK。
-- =====================================================

ALTER TABLE disputes
    ADD COLUMN IF NOT EXISTS seller_response TEXT,
    ADD COLUMN IF NOT EXISTS seller_response_action VARCHAR(24)
        CHECK (seller_response_action IS NULL
               OR seller_response_action IN ('agree_refund', 'reject')),
    ADD COLUMN IF NOT EXISTS seller_response_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS seller_evidence_photos TEXT[] DEFAULT '{}';

COMMENT ON COLUMN disputes.seller_response IS '卖家对该售后请求的文字回复';
COMMENT ON COLUMN disputes.seller_response_action IS '卖家响应动作：agree_refund 同意退款 / reject 拒绝并申诉（转客服仲裁）';
COMMENT ON COLUMN disputes.seller_response_at IS '卖家响应时间';
COMMENT ON COLUMN disputes.seller_evidence_photos IS '卖家申诉提交的凭证图';


-- ##  END 081_seller_after_sales_response.sql


-- #####################################################################
-- ##  BEGIN 082_add_store_product_browsing_history.sql
-- #####################################################################

-- =====================================================
-- 082: 商家商品「浏览记录」(Browsing History)
-- =====================================================
--
-- 与 045「收藏」(store_product_favorites) 平行的一张窄表，但语义不同：
--   - 收藏 (favorite) ：用户主动书签，强意图，需要去重 + 计数
--   - 浏览 (history)  ：用户进入商品详情页自动落库，弱意图，仅用于「最近看过」
--
-- 设计要点：
--   1. 每个 (product_id, user_id) 只保留一行 —— 重复浏览同一商品时
--      UPSERT 刷新 viewed_at，使其重新置顶到「浏览记录」列表最前。
--   2. 不维护 store_products 上的任何计数（view_count 已由详情页单独维护），
--      浏览记录纯粹是「按用户维度的最近访问序列」。
--   3. (user_id, viewed_at DESC) 复合索引直接命中「我的浏览记录」分页查询。
-- =====================================================


CREATE TABLE IF NOT EXISTS store_product_browsing_history (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_product_browsing_history_user
    ON store_product_browsing_history(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_product_browsing_history_product
    ON store_product_browsing_history(product_id);


-- ##  END 082_add_store_product_browsing_history.sql


-- #####################################################################
-- ##  BEGIN 083_store_product_category_kind.sql
-- #####################################################################

-- ===========================================================
-- 083 · store_products.category_kind（PRD 6 大类）
-- ===========================================================
-- 背景：
--   交易大厅筛选（MarketplaceFilterSheet）按 PRD 6 大类
--   （外套/上衣/裤装/鞋履/包袋/配饰）过滤；旧逻辑只能靠
--   store_product_categories.name 模糊匹配反查 category_id，
--   但个人卖家（C2C，store_id IS NULL）没有自建分类行，
--   导致发布单品时选的分类无法落库、也筛不出来。
--
--   本迁移给 store_products 增加 category_kind 列，直接存 PRD
--   大类名。发布单品 Step1 选的分类写入此列；筛选时按此列
--   精确匹配（与按名称反查 category_id 取 OR）。
-- ---------------------------------------------------------

ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS category_kind VARCHAR(16);

-- 仅允许 PRD 6 大类；NULL 表示未分类（兼容历史数据 / 草稿）。
ALTER TABLE store_products
    DROP CONSTRAINT IF EXISTS chk_store_products_category_kind;
ALTER TABLE store_products
    ADD CONSTRAINT chk_store_products_category_kind CHECK (
        category_kind IS NULL
     OR category_kind IN ('外套', '上衣', '裤装', '鞋履', '包袋', '配饰')
    );

-- 按 PRD 大类筛选是高频路径，建部分索引（只索引在售单品）。
CREATE INDEX IF NOT EXISTS idx_store_products_category_kind
    ON store_products (category_kind)
    WHERE status = 'active';


-- ##  END 083_store_product_category_kind.sql


