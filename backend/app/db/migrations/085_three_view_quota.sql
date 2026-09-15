-- =====================================================
-- Migration 085: 三视图生成每日配额
-- =====================================================
--
-- 数字护照的「AI 三视角」调 OpenAI images.edit,一组三张图是真实计费,
-- 必须有 per-user 日限,否则单个账号就能刷掉一天的预算。
--
-- 复用 ai_post_quota 这一行,而不是新建表:日切归零逻辑
-- (quota_service._fetch_or_init) 已经写好,多一列就能共用,
-- 也省掉一次查询。计数与 daily_count 相互独立,互不影响 AI 发帖配额。
-- =====================================================

ALTER TABLE ai_post_quota
    ADD COLUMN IF NOT EXISTS daily_three_view_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN ai_post_quota.daily_three_view_count IS
    '当日已生成的三视图组数;上限见 settings.THREE_VIEW_DAILY_LIMIT';
