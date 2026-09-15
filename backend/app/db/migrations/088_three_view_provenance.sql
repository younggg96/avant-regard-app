-- =====================================================
-- Migration 088: 三视图落表 + 图片来源标记 (5.1 / 5.4 前置)
-- =====================================================
--
-- 在此之前三视图生成不留任何记录:图直接传 Storage,URL 返给前端被塞进
-- user_archive_items.photos,和实拍照片混在一起无法区分。
--
-- 这会带来一个不能接受的后果:5.4 的公开验证页要展示单品照片,买家看到的
-- 「背面」实际是 AI 猜的,却没有任何提示 —— 那就不是功能缺失,是误导交易。
--
-- 这里补两件事:
--   (a) passport_three_views —— 每张生成图一行,记录源图、视角、模型、成本
--   (b) user_archive_items.ai_photos —— 标出 photos 里哪些是 AI 生成的
--
-- ai_photos 由服务端在入库时反查 passport_three_views 得出,不接受客户端
-- 自报(客户端可以谎称 AI 图是实拍,那恰恰是我们要防的方向)。
-- =====================================================


-- ---------------------------------------------------------
-- (a) 三视图生成记录
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS passport_three_views (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 生成时档案条目往往还不存在(用户在上传页先生成、后提交),
    -- 所以这里可空,入库时再回填。
    archive_item_id BIGINT REFERENCES user_archive_items(id) ON DELETE SET NULL,

    source_image_url TEXT NOT NULL,
    view_slug VARCHAR(16) NOT NULL,          -- front / side / back
    -- 成功时是生成图地址;失败时为空,error_message 里写原因。
    -- 这一列同时是「这张图是 AI 生成的」的权威依据,必须建索引。
    image_url TEXT,

    model VARCHAR(64),
    image_size VARCHAR(16),
    tokens_used INTEGER DEFAULT 0,
    -- gpt-image-1 按张计费,这里留给后续按单价回填,便于算账。
    cost_cents INTEGER DEFAULT 0,

    status VARCHAR(16) NOT NULL DEFAULT 'success',   -- success / failed / disabled
    error_message TEXT,

    -- 管理员下架不合格的生成图时留痕
    disabled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    disabled_at TIMESTAMP WITH TIME ZONE,
    disable_reason TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 入库时要用一批 photo URL 反查「哪些是 AI 生成的」,这是热点查询。
CREATE INDEX IF NOT EXISTS idx_passport_three_views_image_url
    ON passport_three_views(image_url)
    WHERE image_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_passport_three_views_user
    ON passport_three_views(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passport_three_views_item
    ON passport_three_views(archive_item_id);


-- ---------------------------------------------------------
-- (b) 档案条目上的 AI 图标记
-- ---------------------------------------------------------
-- 有意做成 photos 的子集而不是改 photos 的结构:photos TEXT[] 已经被
-- 列表页、详情页、转售、公开档案等一堆地方读,改成对象数组的代价太大。
-- 这里并列一个子集数组,读的人按 url 是否在其中判断即可。
ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS ai_photos TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN user_archive_items.ai_photos IS
    'photos 的子集:其中由 AI 生成(三视图)而非实拍的那些。'
    '服务端入库时反查 passport_three_views 得出,不信客户端自报。'
    '公开验证页必须据此标注,不能把 AI 推测的侧背面当实物照展示。';
