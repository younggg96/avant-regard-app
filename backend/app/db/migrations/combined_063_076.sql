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
