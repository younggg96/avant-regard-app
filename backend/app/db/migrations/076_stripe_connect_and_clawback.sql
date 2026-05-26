-- =====================================================================
-- 076_stripe_connect_and_clawback.sql
-- 1) pending_payouts.status 增加 clawed_back —— T+3 后退款的钱包扣回标记
-- 2) payout_accounts.account_type 增加 stripe_connect —— 海外卖家走 Stripe Express
-- 3) 新表 stripe_connect_accounts —— 卖家与 Stripe Connect 账号 (acct_*) 的关联
-- 4) wallet_withdrawals.metadata —— 记录 Stripe payout id / transfer id 等
-- =====================================================================
-- 依赖: 063_buyer_confirm_and_wallet 必须先跑(创建 pending_payouts /
-- payout_accounts / wallet_withdrawals 三张表)。如果你的 DB 直接报
-- "relation pending_payouts does not exist", 用 combined_063_076.sql
-- 一次性补齐 063-076 的所有改动。
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) pending_payouts.status: locked / released / reversed / clawed_back
-- ---------------------------------------------------------------------
-- WalletService.reverse_pending_for_order 在 T+3 后退款会把 status 标
-- 为 clawed_back, 并尝试从 available_cents 扣回, 不足时把缺口写到
-- settlement_ledger.metadata.shortfall。
ALTER TABLE pending_payouts
    DROP CONSTRAINT IF EXISTS pending_payouts_status_check;

ALTER TABLE pending_payouts
    ADD CONSTRAINT pending_payouts_status_check
    CHECK (status IN ('locked', 'released', 'reversed', 'clawed_back'));


-- ---------------------------------------------------------------------
-- (2) payout_accounts.account_type 增加 stripe_connect
-- ---------------------------------------------------------------------
-- 现有 bank / alipay / wechat 是手动放款; stripe_connect 走 Stripe
-- Payout API, 由 stripe_connect_service 自动处理。account_no 字段对
-- stripe_connect 类型存放 acct_* (Stripe Connect Account ID)。
ALTER TABLE payout_accounts
    DROP CONSTRAINT IF EXISTS payout_accounts_account_type_check;

ALTER TABLE payout_accounts
    ADD CONSTRAINT payout_accounts_account_type_check
    CHECK (account_type IN ('bank', 'alipay', 'wechat', 'stripe_connect'));


-- ---------------------------------------------------------------------
-- (3) stripe_connect_accounts —— 卖家 Connect 账号关联表
-- ---------------------------------------------------------------------
-- 设计:
--   - 一个 user 一条; UNIQUE 约束防止重复 onboarding。
--   - charges_enabled / payouts_enabled / details_submitted 由 stripe
--     account.updated webhook 同步, 决定是否允许放款。
--   - country / currency 由 onboarding 时确定, 后续做合规判断 (US 只能
--     发 USD 等)。
--   - status 跟踪本地状态机:
--       pending     Onboarding URL 已签发但还没完成
--       active      details_submitted=true 且 payouts_enabled=true
--       restricted  Stripe 标记账号需要补资料
--       disabled    主动停用 / 平台关停
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

DROP TRIGGER IF EXISTS trg_stripe_connect_accounts_updated_at
    ON stripe_connect_accounts;
CREATE TRIGGER trg_stripe_connect_accounts_updated_at
    BEFORE UPDATE ON stripe_connect_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------------------
-- (4) wallet_withdrawals.metadata —— Stripe payout / transfer 状态
-- ---------------------------------------------------------------------
-- 已经存在 status / note / reject_reason; 但 stripe payout 还需要记录:
--   - payoutId (po_*)
--   - transferId (tr_*) — 如果走 Connect Transfer
--   - lastError 上次 Stripe 报错信息, 供客服复查
-- 用单独 JSONB 存避免反复加列。
ALTER TABLE wallet_withdrawals
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
