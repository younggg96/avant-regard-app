-- =====================================================
-- 054: AI 发帖助手 — Prompt 运行时覆盖表
-- =====================================================
--
-- 需求 (V3 #25.5):
--   admin 在不重新部署的情况下查看与修改 AI 生成 prompt。
--
-- 设计要点:
--   - "key per row":每个可被覆盖的 prompt 用一个稳定字符串 key 标识 (例如
--     'qa_system' / 'image_brief_system'),代码里枚举,DB 里只是 KV 存储。
--   - prompt_builder 读取顺序: DB override 优先 → fallback 到代码里 hardcoded
--     的 default。这样 DB 行不存在 = 用默认,DB 有行 = 用 admin 改过的版本。
--   - 不在这一层做版本历史:`ai_post_service_logs.prompt_version` 已经记录
--     每次 LLM 调用使用的 prompt_version 字符串,要回放/AB 直接看日志即可。
--     如果将来要 multi-version 切流量,再加一张 ai_prompt_overrides_history
--     就行,不影响这张表的形态。
--   - updated_by + updated_at:审计字段,出问题能查是谁改的。
--   - notes:admin 编辑时可写"为什么改"备忘,与 git commit message 对应。
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_prompt_overrides (
    -- 稳定 key,代码里枚举 (PromptKey),典型值: 'qa_system' / 'image_brief_system'
    key VARCHAR(50) PRIMARY KEY,

    -- 完整 prompt 文本; 长度按 LLM 上下文窗口预留, 现实里 < 4KB
    content TEXT NOT NULL,

    -- 审计
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- 可选: 改动原因备忘 (e.g. "把 200-400 字放宽到 150-500 字")
    notes TEXT
);

COMMENT ON TABLE ai_prompt_overrides IS
    'AI 发帖助手 prompt 运行时覆盖。代码 prompt_builder 优先读这里,不存在则 fallback 到 hardcoded default。';

COMMENT ON COLUMN ai_prompt_overrides.key IS
    '稳定的 prompt 标识符,与代码里 PromptKey 枚举对齐。当前: qa_system / image_brief_system。';

COMMENT ON COLUMN ai_prompt_overrides.notes IS
    'admin 编辑备忘,留给后人 (含自己 3 个月后) 看为什么改成现在这个样子。';
