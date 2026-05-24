-- Add preferred display currency to user_info table.
--
-- 与 preferred_theme / preferred_language 对齐的"用户级展示偏好"：
--   - CNY: 人民币（¥）—— 国内用户默认
--   - USD: 美元（$）   —— 北美 / 英文用户默认
--
-- 后端只保留偏好；具体展示用什么符号 / 千分位格式 / 是否做汇率换算由前端决定。
-- 后续要新增日元等其它币种只需要把 CHECK 约束扩开。
ALTER TABLE user_info
ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(8) DEFAULT NULL;

ALTER TABLE user_info
DROP CONSTRAINT IF EXISTS user_info_preferred_currency_check;

ALTER TABLE user_info
ADD CONSTRAINT user_info_preferred_currency_check
CHECK (preferred_currency IS NULL OR preferred_currency IN ('CNY', 'USD'));
