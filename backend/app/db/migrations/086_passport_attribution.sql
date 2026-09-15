-- =====================================================
-- Migration 086: 数字护照 · AI 归因与入库 (5.2 / 5.3)
-- =====================================================
--
-- (a) user_archive_items 扩展为护照主体
--     品牌从裸字符串升级为 brands 外键(需求硬约束:品牌只能从列表选),
--     系列复用已有的 original_show_id(shows.id 是 VARCHAR)。
-- (b) passport_attributions —— 一次上传 = 一条归因会话,
--     同时就是一条 data labeling 数据(AI 建议 + 用户最终选择 + 差异)。
-- (c) ai_post_quota 加归因日限,和三视图一样防刷 token。
-- =====================================================


-- ---------------------------------------------------------
-- (a) user_archive_items 扩展
-- ---------------------------------------------------------
-- brand_name 保留:新品牌还在审核时用户看到的仍是自己填的名字,
-- 此时 brand_id 为 NULL。两者并存,brand_id 有值即视为「已归一到品牌库」。
ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL;

ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS release_year SMALLINT;

-- 5.3 的有效性检查结论。blocked 的根本不会入库,所以这里只有三种:
--   passed        全部检查通过
--   warned        图片与所选品类冲突,用户二次确认后仍然入库
--   manual_review 低置信 / 新品牌待审,进后台队列
ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS validity_status VARCHAR(16) NOT NULL DEFAULT 'passed';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_archive_items_validity_status_check'
    ) THEN
        ALTER TABLE user_archive_items
            ADD CONSTRAINT user_archive_items_validity_status_check
            CHECK (validity_status IN ('passed', 'warned', 'manual_review'));
    END IF;
END $$;

-- original_show_id 在 061 里建成了 BIGINT,而 shows.id 后来被
-- fix_shows_id_type.sql 改成了 VARCHAR(100)。两边对不上时这里纠正过来,
-- 已经是 varchar 的库上是 no-op。
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'user_archive_items' AND column_name = 'original_show_id';

    IF col_type IS NOT NULL AND col_type <> 'character varying' THEN
        ALTER TABLE user_archive_items
            DROP CONSTRAINT IF EXISTS user_archive_items_original_show_id_fkey;
        ALTER TABLE user_archive_items
            ALTER COLUMN original_show_id TYPE VARCHAR(100)
            USING original_show_id::VARCHAR(100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_archive_items_brand
    ON user_archive_items(brand_id);


-- ---------------------------------------------------------
-- (b) passport_attributions —— 归因会话 / 标注数据
-- ---------------------------------------------------------
-- 一次「上传照片 → AI 识别 → 用户确认」产生一行。
-- archive_item_id 在用户确认入库后回填;用户中途放弃则保持 NULL,
-- 这些「看过候选但没确认」的记录同样是有价值的负样本,不要删。
CREATE TABLE IF NOT EXISTS passport_attributions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    archive_item_id BIGINT REFERENCES user_archive_items(id) ON DELETE SET NULL,

    photos TEXT[] NOT NULL DEFAULT '{}',
    -- photos 的 sha256。/validate 与 /attribute 靠它认出「这组图刚识别过」,
    -- 后者直接复用前者的模型输出,不重复调用也不重复扣配额。
    photos_fingerprint VARCHAR(64),

    -- 5.3 有效性检查结果: {is_fashion_item, reject_reason, category, confidence, ...}
    validity_result JSONB,
    -- 模型第一轮的原始推测: {brand_guesses, year_guess, visual_summary, ...}
    ai_suggestion JSONB,
    -- 收敛后展示给用户的候选列表: [{brand_id, brand_name, show_id, season, year, evidence, ...}]
    candidates JSONB,

    -- 用户确认后的最终字段(= 标注答案)
    user_final JSONB,
    -- accepted     直接采纳某个候选
    -- edited       采纳候选但改了字段
    -- none_of_above 候选都不对,全手填
    user_action VARCHAR(16)
        CHECK (user_action IS NULL OR user_action IN ('accepted', 'edited', 'none_of_above')),
    -- AI 建议与用户最终选择的差异字段,供后台审核与训练用
    divergence JSONB,

    model_provider VARCHAR(32),
    model_name VARCHAR(64),
    prompt_version VARCHAR(20),
    tokens_used INTEGER DEFAULT 0,
    -- validated 只跑了有效性检查,还没出候选(等着被 /attribute 复用或就此作废)
    -- success / blocked / error 是完整归因的三种结局
    status VARCHAR(16) NOT NULL DEFAULT 'success',
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_passport_attributions_user
    ON passport_attributions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passport_attributions_item
    ON passport_attributions(archive_item_id);
-- 后台捞标注数据 / 异常偏差时按这两个维度过滤
CREATE INDEX IF NOT EXISTS idx_passport_attributions_action
    ON passport_attributions(user_action, created_at DESC);
-- /attribute 每次都要查一把「这组图有没有刚识别过」,走这个索引
CREATE INDEX IF NOT EXISTS idx_passport_attributions_reuse
    ON passport_attributions(user_id, photos_fingerprint, created_at DESC)
    WHERE status = 'validated';


-- ---------------------------------------------------------
-- (c) 归因日配额
-- ---------------------------------------------------------
-- 与 085 的 daily_three_view_count 同理:一次归因是 1-4 次 VL 调用,
-- 必须有 per-user 日限。日切归零逻辑共用 quota_service._fetch_or_init。
ALTER TABLE ai_post_quota
    ADD COLUMN IF NOT EXISTS daily_attribution_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN ai_post_quota.daily_attribution_count IS
    '当日已发起的护照归因次数;上限见 settings.ATTRIBUTION_DAILY_LIMIT';
