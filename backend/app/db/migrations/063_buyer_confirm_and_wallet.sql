-- =====================================================
-- Migration 063: 买家确认收货 + 卖家钱包 + 实名认证
-- =====================================================
--
-- 业务规则（PRD 「确认收货 / 结算 / 提款」 补充版）：
--
--   1. 买家确认收货（主动 or 7d 自动）后立即把订单推到 COMPLETED：
--      - 平台抽 1% 手续费（commission_rate_bps = 100）
--      - 剩余金额 → 卖家钱包的 pending_cents
--      - pending_cents 在 3 天后才会自动释放成 available_cents（可提现）
--      - 系统创建一条 SETTLEMENT 通知给卖家（含订单号 / 成交金额 / 手续费 / 实收）
--      - 单品自动进入买家 MY ARCHIVE（既有行为，不变）
--      - 双方进入评价流程（既有行为，不变）
--
--   2. 卖家必须完成「实名认证 + 绑定放款账户」才能发起提现；
--      未完成时金额仍会进 pending → available，只是「提款按钮」灰着。
--
--   3. 既有 commission 默认 800 bps（8%）历史订单不动；
--      此迁移只把 DEFAULT 改成 100 (1%)，并把仍是 800 的 in-flight 订单（pending_payment / paid）
--      回填到 100，避免买家未付款的订单还按旧费率收。
--
-- 兼容性：
--   - seller_balances 之前就已经有 available_cents / pending_cents / total_payout_cents 字段，
--     无需迁；这里新增的是「pending 排队 + 释放时间」机制。
-- =====================================================


-- ---------------------------------------------------------
-- (a) orders.commission_rate_bps 默认改成 1%
-- ---------------------------------------------------------
ALTER TABLE orders ALTER COLUMN commission_rate_bps SET DEFAULT 100;

UPDATE orders
SET    commission_rate_bps = 100,
       commission_cents    = paid_price_cents / 100,
       seller_payout_cents = paid_price_cents - (paid_price_cents / 100)
WHERE  status IN ('pending_payment', 'paid')
  AND  commission_rate_bps <> 100;


-- ---------------------------------------------------------
-- (b) seller_kyc —— 卖家实名认证
-- ---------------------------------------------------------
-- 一个用户 1 条记录。status:
--   - none        从未提交
--   - pending     已提交待审
--   - approved    审核通过（可提现）
--   - rejected    审核驳回（带 reject_reason）
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_kyc (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    real_name VARCHAR(80) NOT NULL,
    id_card_no VARCHAR(64) NOT NULL,          -- 加密存储（后端 service 层处理脱敏）
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


-- ---------------------------------------------------------
-- (c) payout_accounts —— 卖家提现账户（实名后绑定）
-- ---------------------------------------------------------
-- 支持三类放款渠道：
--   - bank      银行卡（卡号 / 持卡人 / 行）
--   - alipay    支付宝（账号 / 实名）
--   - wechat    微信（账号 / 实名）
-- 同一用户允许有多条；is_default 标识默认放款账户。
-- ---------------------------------------------------------
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


-- ---------------------------------------------------------
-- (d) pending_payouts —— 已确认收货但未到 3 天解冻的款项
-- ---------------------------------------------------------
-- 一笔订单对应一行；release_at = 完成时间 + 3 天。
-- status:
--   - locked    锁定中（在 seller_balances.pending_cents 内）
--   - released  已释放到 available_cents
--   - reversed  发生退款 / 仲裁退给买家
-- ---------------------------------------------------------
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
    ON pending_payouts(release_at)
    WHERE status = 'locked';

CREATE INDEX IF NOT EXISTS idx_pending_payouts_user
    ON pending_payouts(owner_user_id, status, release_at)
    WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_payouts_merchant
    ON pending_payouts(owner_merchant_id, status, release_at)
    WHERE owner_merchant_id IS NOT NULL;


-- ---------------------------------------------------------
-- (e) wallet_withdrawals —— 提现申请
-- ---------------------------------------------------------
-- 卖家从 seller_balances.available_cents 发起提款。
-- status:
--   - pending     提交后待处理
--   - processing  打款中（人工 / 自动接渠道）
--   - paid        已到账
--   - rejected    驳回 / 退回
-- ---------------------------------------------------------
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


-- ---------------------------------------------------------
-- (f) seller_balances 增加冗余字段：withdrawn 累计与最近一次释放时间
-- ---------------------------------------------------------
ALTER TABLE seller_balances
    ADD COLUMN IF NOT EXISTS total_withdrawn_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE seller_balances
    ADD COLUMN IF NOT EXISTS last_release_at TIMESTAMP WITH TIME ZONE;


-- ---------------------------------------------------------
-- (g) settlement_ledger.reason 扩充：新增 confirm_receipt / pending_lock / pending_release / withdrawal
-- ---------------------------------------------------------
-- 老 reason='order_settled' 保留；新流水细分一下，便于钱包流水页直接渲染。
-- 不强约束 reason 枚举（只是注释提示）。
COMMENT ON COLUMN settlement_ledger.reason IS
    'confirm_receipt | pending_lock | pending_release | withdrawal | refund_reverse | order_settled (legacy)';
