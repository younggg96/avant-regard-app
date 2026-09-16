-- =====================================================
-- Migration 089: 三视图成本口径修正
-- =====================================================
--
-- 088 建表时留了 cost_cents INTEGER，但一直写不进真实数字，因为这个口径
-- 从一开始就不成立：
--
--   (a) 币种缺失。万相按人民币计价(¥0.50/张)，gpt-image 按美元计价。
--       两者写进同一列再 SUM，得到的数没有任何含义。
--   (b) 精度不够。gpt-image 1024x1024 中等质量约 $0.053，取整到「分」
--       会丢掉 6%；跑上几千张，账就对不上了。
--
-- 所以换成 micros(货币单位的百万分之一) + 显式币种：
--   ¥0.50  -> 500000 micros, CNY
--   $0.053 ->  53000 micros, USD
--
-- 直接删掉 cost_cents 而不是保留兼容：这一列历史上从未写入过非零值，
-- 留着只会让人以为它有数据。
-- =====================================================


ALTER TABLE passport_three_views
    DROP COLUMN IF EXISTS cost_cents;

ALTER TABLE passport_three_views
    ADD COLUMN IF NOT EXISTS cost_micros BIGINT;

ALTER TABLE passport_three_views
    ADD COLUMN IF NOT EXISTS cost_currency CHAR(3);

COMMENT ON COLUMN passport_three_views.cost_micros IS
    '本次生成的花费，单位为 cost_currency 的百万分之一。'
    'NULL = 未能定价(模型不在价表里，或上游没返回用量)，与 0 不同：'
    '0 表示确认没花钱(请求压根没发出去)，NULL 表示花了但算不出来。';

COMMENT ON COLUMN passport_three_views.cost_currency IS
    'cost_micros 的币种。CNY = 万相(阿里云百炼)，USD = OpenAI。'
    '统计必须按此分组，不能跨币种求和。';

-- 成本看板按币种聚合，且只关心真正产生了费用的行。
CREATE INDEX IF NOT EXISTS idx_passport_three_views_cost
    ON passport_three_views(cost_currency, created_at)
    WHERE cost_micros IS NOT NULL;
