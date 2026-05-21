-- =====================================================
-- Migration 057: 交易系统 Phase 1 — Listing 基建
-- =====================================================
--
-- PRD 模块一（Listing）要求：
--   1. 单品支持 brand / category / size / color / 5 档成色 / 关联秀场 / 原入手时间
--   2. 严格 5 视角图（正面/背面/洗标/领标/瑕疵细节）+ 最多 4 张额外图
--   3. 状态机 draft → reviewing → active → frozen → sold （+ rejected / offline）
--   4. C2C 个人卖家与买手店双轨：listings.seller_kind ∈ {merchant, individual}
--   5. 后台审核记录留痕（product_review_audits）
--
-- 改动概览：
--   (a) 新表 seller_profiles ：C2C 个人卖家档案（与 users 1:1）
--   (b) ALTER store_products  ：补齐 PRD 字段；扩展状态机；增加冻结锁字段
--   (c) 数据迁移              ：把旧 status 值 (PUBLISHED/SOLD_OUT) 映射到新枚举
--   (d) 新表 product_review_audits：审核记录
--
-- 兼容性：
--   - 旧调用方仍可写入 status='PUBLISHED'，由 trigger 兜底转成 'active'；
--     这是为了避免本次迁移阻塞前后端发版顺序。前后端切换完成后可移除 trigger。
-- =====================================================


-- ---------------------------------------------------------
-- (a) seller_profiles —— C2C 个人卖家档案
-- ---------------------------------------------------------
-- 卖家身份多态：买手店复用 store_merchants；个人卖家新建本表，与 users 1:1。
-- 未实名认证仍允许浏览；触发认证检查的时机由应用层决定（推荐：首次成交前）。
CREATE TABLE IF NOT EXISTS seller_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(64),
    bio TEXT,
    id_verified BOOLEAN DEFAULT FALSE,
    id_verified_at TIMESTAMP WITH TIME ZONE,
    credit_score INTEGER DEFAULT 100,           -- 0~100；售后/超时按规则扣
    response_avg_minutes INTEGER,               -- IM 平均响应分钟数（异步聚合）
    total_sales INTEGER DEFAULT 0,
    total_gmv_cents BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_seller_profiles_updated_at ON seller_profiles;
CREATE TRIGGER trg_seller_profiles_updated_at
    BEFORE UPDATE ON seller_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------
-- (b) store_products 扩展
-- ---------------------------------------------------------
-- 双轨卖家：
--   seller_kind = 'merchant'   时，merchant_id 必填，seller_user_id 可填可不填
--   seller_kind = 'individual' 时，seller_user_id 必填，merchant_id 必须为 NULL
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS seller_kind VARCHAR(16) NOT NULL DEFAULT 'merchant',
    ADD COLUMN IF NOT EXISTS seller_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS size VARCHAR(32),
    ADD COLUMN IF NOT EXISTS color VARCHAR(32),
    ADD COLUMN IF NOT EXISTS condition VARCHAR(16),
    ADD COLUMN IF NOT EXISTS condition_note TEXT,
    ADD COLUMN IF NOT EXISTS original_show_id BIGINT REFERENCES shows(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS original_acquired_at DATE,
    ADD COLUMN IF NOT EXISTS accept_offer BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS photo_angles JSONB,
    ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS current_buyer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- store_id / merchant_id 在 C2C 情况下必须放开 NOT NULL
ALTER TABLE store_products ALTER COLUMN store_id DROP NOT NULL;

-- 双轨完整性约束
ALTER TABLE store_products
    DROP CONSTRAINT IF EXISTS chk_store_products_seller_kind;
ALTER TABLE store_products
    ADD CONSTRAINT chk_store_products_seller_kind CHECK (
        (seller_kind = 'merchant'   AND merchant_id IS NOT NULL)
     OR (seller_kind = 'individual' AND seller_user_id IS NOT NULL AND merchant_id IS NULL)
    );

-- 5 档成色枚举（应用层枚举 ProductCondition）；NULL 仅在草稿阶段允许
ALTER TABLE store_products
    DROP CONSTRAINT IF EXISTS chk_store_products_condition;
ALTER TABLE store_products
    ADD CONSTRAINT chk_store_products_condition CHECK (
        condition IS NULL
     OR condition IN ('BNWT', 'NEW_99', 'NEW_95', 'USED_8', 'FLAW')
    );


-- ---------------------------------------------------------
-- (c) 状态机扩展 + 数据迁移
-- ---------------------------------------------------------
-- 新状态集合：draft / reviewing / active / frozen / sold / rejected / offline
-- 旧值映射：
--   PUBLISHED -> active
--   SOLD_OUT  -> sold
--   HIDDEN    -> offline
--   DRAFT     -> draft

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

-- 默认值同步切到 draft（新发布默认走草稿态）
ALTER TABLE store_products ALTER COLUMN status SET DEFAULT 'draft';

-- 兼容旧前端的写入：如果有人继续 INSERT 时传 'PUBLISHED' 等，将其映射到新值
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


-- 索引：按卖家 / 状态 / 上架时间排序的列表查询
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


-- ---------------------------------------------------------
-- (d) product_review_audits —— 审核记录
-- ---------------------------------------------------------
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
