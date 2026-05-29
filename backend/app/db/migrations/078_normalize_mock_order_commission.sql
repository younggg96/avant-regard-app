-- =====================================================================
-- 078_normalize_mock_order_commission.sql
-- =====================================================================
-- 把历史 mock 订单的 commission 统一回填到 1% (100 bps)。
--
-- 背景:
--   - trading_mock_data.sql / trading_mock_data_v2.sql 在 PRD 改成 1% 抽佣
--     之前就已经存在, 里面硬编码塞了 commission_rate_bps = 800, commission_cents
--     = paid_price_cents * 0.08, seller_payout_cents = paid_price_cents * 0.92。
--   - 063 的回填只覆盖 status IN ('pending_payment','paid')。mock 数据塞的
--     'completed' / 'shipped' / 'delivered' 状态被遗漏, 导致「我的订单」详情
--     页平台佣金一栏仍然显示 8.0%, 与现行 1% 政策不符。
--
-- 范围:
--   - 仅修 payment_provider IN ('mock','mock_v2') 的订单, 真实订单一律不动 ——
--     真实历史订单一旦签收, commission 已经计入卖家钱包 / 平台台账, 改动会
--     破坏对账。
--   - mock 订单没有真实资金流, 直接按当前 1% 重算最安全。
--
-- 幂等: WHERE commission_rate_bps <> 100 保证重复执行不变。
-- =====================================================================

UPDATE orders
SET    commission_rate_bps = 100,
       commission_cents    = paid_price_cents / 100,
       seller_payout_cents = paid_price_cents - (paid_price_cents / 100)
WHERE  payment_provider IN ('mock', 'mock_v2')
  AND  commission_rate_bps <> 100;
