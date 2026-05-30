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
