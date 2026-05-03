-- =====================================================
-- 050: AI 发帖助手 — 用户每日配额表
-- =====================================================
--
-- 需求 (V3 #25):
--   "「重新生成」一天最多 3 次。"
--   隐含: 整体生成也要有上限,避免恶意刷 token / 配额耗尽运维侧 LLM 钱包。
--
-- 设计要点:
--   - 单行 per user,不存历史 (历史看 ai_post_service_logs 即可)。
--   - daily_reset_at = current_date,每次写入前先判断是否需要日切重置。
--     设计为应用层主动 reset 而不是触发器或 cron 是为了:
--       1) 避开 Supabase 触发器复杂度;
--       2) 用户不活跃就不重置 (省 IO);
--       3) 跨时区一致性: 服务器 UTC date,与 V3 #16 看板窗口口径对齐.
--   - 没有 user_id 行的用户视为 0 / 0,首次写入时 INSERT。
--   - 删除策略: 用户被删除时 CASCADE,不需要单独清理任务。
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_post_quota (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    daily_count INTEGER NOT NULL DEFAULT 0,           -- 今日累计 generate 次数 (含 blocked)
    daily_regen_count INTEGER NOT NULL DEFAULT 0,     -- 今日累计 regenerate 次数
    daily_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_post_quota IS
    'AI 发帖助手用户配额。daily_reset_at < CURRENT_DATE 时'
    '应用层会先把 daily_* 归零再扣减。';

COMMENT ON COLUMN ai_post_quota.daily_count IS
    '今日 generate 总次数 (含被图片审核 blocked 的,'
    '防止刷违规图骗 quota)。上限读自 settings.AI_DAILY_GENERATE_LIMIT。';

COMMENT ON COLUMN ai_post_quota.daily_regen_count IS
    '今日 regenerate 次数,需求规定 <= 3。'
    '上限读自 settings.AI_DAILY_REGEN_LIMIT。';
