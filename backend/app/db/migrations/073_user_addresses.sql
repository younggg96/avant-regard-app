-- =====================================================
-- Migration 073 · 用户常用收货地址簿
-- =====================================================
--
-- PRD 「支付环节 · 地址管理,用户可以管理自己的常用地址」
--
-- 设计要点:
--   1. 软删除:用户可能引用过的历史订单仍要能读地址,所以用 deleted_at 而不是 DELETE。
--   2. 结构化字段 + full_text 双轨:
--      - 国内地址用 province/city/district/detail 结构,方便后续接快递 API。
--      - 海外地址或老用户直接填 full_text 也能跑。
--      - orders.shipping_address_json 是「下单瞬间快照」,跟地址簿解耦,
--        即使用户事后删/改地址簿条目,订单上的地址不会变。
--   3. 默认地址唯一性:同一用户最多一条 is_default = true,用 partial unique index 保证。
--   4. 索引按 user_id 过滤未删除,首屏列表常用查询。
-- =====================================================

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
    label TEXT,                       -- 「家」「公司」等用户自起的标签
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
ON user_addresses(user_id)
WHERE deleted_at IS NULL;

-- 同一用户最多一个默认地址(仅在未删除的条目中)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_addresses_default_per_user
ON user_addresses(user_id)
WHERE is_default = TRUE AND deleted_at IS NULL;

COMMENT ON TABLE user_addresses IS '用户常用收货地址簿(PRD 模块四支付环节)。下单时仅作为快照来源,订单 shipping_address_json 不引用此表。';
COMMENT ON COLUMN user_addresses.full_text IS '地址纯文本快照。结构化字段缺失时(海外/老数据)以本字段为准。';
COMMENT ON COLUMN user_addresses.is_default IS '默认地址。partial unique index 保证同一用户未删除条目里最多一条为 TRUE。';
