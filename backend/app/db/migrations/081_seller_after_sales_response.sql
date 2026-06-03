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
