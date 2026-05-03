-- =====================================================
-- 049: AI 发帖助手 — ai_post_service_logs 调用日志表
-- =====================================================
--
-- 需求 (V3 #25 基础架构):
--   "新增表 ai_post_service_logs(log_id, user_id, mode, prompt_snapshot,
--   model_response, tokens_used, cost_cents, created_at)。所有生成调用
--   必写,便于后续决定是否换模型。"
--
-- 设计要点:
--   - mode = QA_TEXT | IMAGE_BRIEF, 与前端两条产品线一一对应。
--   - prompt_snapshot 存完整 system + user prompt 与档案 RAG 片段,
--     用于回放 / 换模型重跑 / debug。LLM 计费按 token 算,这张表是
--     成本核算的唯一事实来源。
--   - model_response 同时存原始返回 (含 finish_reason 等) 和解析后的
--     {generated_text, suggested_tags, suggested_communities}, 不做拆列
--     避免后续模型返回结构变化要改 schema。
--   - status: success / error / blocked
--       blocked = 图片内容安全 (阿里云绿网) 或 LLM 合规拦截命中,
--       没有 model_response 但要计入 quota 防滥刷。
--   - post_id 是反向引用: 用户预览后真发了帖才会回填;若用户放弃则保持 NULL.
--     index 加 partial 只覆盖已发布的,看板查询更快。
--   - regenerated_from_log_id 链接「重新生成」上一次的 log_id,做漏斗分析。
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_post_service_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('QA_TEXT', 'IMAGE_BRIEF')),

    -- 输入快照 (含 archive RAG 片段); 完整可回放
    prompt_snapshot JSONB NOT NULL,
    prompt_version VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',

    -- 模型信息
    model_provider VARCHAR(50) NOT NULL,        -- deepseek / qwen / moonshot
    model_name VARCHAR(100) NOT NULL,           -- deepseek-chat / qwen-vl-plus 等

    -- 输出
    model_response JSONB,                       -- 含 raw + parsed
    tokens_used INTEGER,                        -- 总 token (输入 + 输出)
    cost_cents INTEGER,                         -- 估算成本,分

    -- 状态与错误
    status VARCHAR(20) NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'error', 'blocked')),
    error_message TEXT,

    -- 关联
    post_id BIGINT REFERENCES posts(id) ON DELETE SET NULL,    -- 用户预览后真发的帖
    regenerated_from_log_id BIGINT REFERENCES ai_post_service_logs(log_id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户维度查询 (个人配额、最近一次生成等)
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_created
    ON ai_post_service_logs(user_id, created_at DESC);

-- 看板维度: 按模型 / 状态拉趋势
CREATE INDEX IF NOT EXISTS idx_ai_logs_provider_status_created
    ON ai_post_service_logs(model_provider, status, created_at DESC);

-- 漏斗维度: 已发布的 AI 帖反查日志
CREATE INDEX IF NOT EXISTS idx_ai_logs_post_id
    ON ai_post_service_logs(post_id)
    WHERE post_id IS NOT NULL;

COMMENT ON TABLE ai_post_service_logs IS
    'AI 发帖助手调用全量日志。每次 generate / regenerate 必写,'
    '是 token 成本核算与模型换型决策的唯一事实来源。';

COMMENT ON COLUMN ai_post_service_logs.prompt_snapshot IS
    '完整输入快照,结构: {mode, user_id, answers, image_urls, '
    'context, archive_rag: {style, designer, show, look}, '
    'system_prompt, user_prompt}。改动保持向后兼容。';

COMMENT ON COLUMN ai_post_service_logs.status IS
    'success = 正常返回,error = 上游异常 (会重试一次后落库),'
    'blocked = 图片审核或 LLM 合规拦截,blocked 也计入日志且占用 quota。';
