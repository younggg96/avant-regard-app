-- =====================================================
-- 048: AI 发帖助手 — posts 表增加 AI 标识与生成元数据
-- =====================================================
--
-- 需求 (V3 #25 基础架构):
--   "所有 AI 帖子必须写入 posts.generated_by_ai = true,并将原始问答
--   + 模型版本 + token 消耗写入 generation_metadata,方便后续 A/B
--   和 debug。"
--
-- 设计要点:
--   - generated_by_ai 单独建部分索引 (WHERE true),用于运营侧统计/筛选
--     AI 帖,避免给所有帖子建无差别索引浪费空间.
--   - generation_metadata 用 JSONB 不用单独建表,因为读路径几乎只在
--     debug/admin 时才取,无须为每条字段建索引。结构:
--       {
--         "log_id": 123,
--         "provider": "deepseek",
--         "model": "deepseek-chat",
--         "prompt_version": "v1.0.0",
--         "mode": "QA_TEXT",
--         "answers": {...},
--         "tokens_used": 1234,
--         "cost_cents": 3
--       }
--   - log_id 同时也写到 ai_post_service_logs.post_id 双向引用,便于从
--     日志或帖子任一端反查另一端.
-- =====================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_metadata JSONB;

-- 部分索引: 仅 AI 帖入索引;管理员看板/AB 实验用
CREATE INDEX IF NOT EXISTS idx_posts_generated_by_ai
    ON posts(created_at DESC)
    WHERE generated_by_ai = TRUE;

COMMENT ON COLUMN posts.generated_by_ai IS
    'AI 发帖助手生成的帖子标记为 true。'
    'AI 永远不直接落帖,必须用户预览确认后才会写入,'
    '该字段用于事后统计与 A/B 实验。';

COMMENT ON COLUMN posts.generation_metadata IS
    'AI 生成元数据快照: {log_id, provider, model, prompt_version, '
    'mode, answers, tokens_used, cost_cents}。改动需保持向后兼容。';
