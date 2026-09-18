-- =====================================================
-- Migration 090: 档案条目可见性 (user_archive_items.visibility)
-- =====================================================
--
-- 在此之前「世界」feed 的过滤条件只有一句 .neq(user_id, viewer)——
-- 换句话说别人的藏品全部对所有人可见,而且没有任何开关能关掉。
-- 上传页同时又写着「这里不会公开发布,仅自己可见」,两边是矛盾的。
--
-- 这里补上真正的可见性字段,让那句承诺要么被兑现、要么被明确改掉
-- (产品选的是后者:默认公开、可手动转私密,上传页文案同步修正)。
--
-- 为什么默认 'public' 而不是更保守的 'private':
--   存量数据今天事实上已经全部公开,也已经在 feed 里被看过了。
--   一刀切转私密并不能把「已经被看到」这件事收回来,却会让世界 feed
--   瞬间清空、让用户以为自己的藏品丢了。保持现状 + 给出退出开关,
--   是这两者之间唯一不制造新问题的选择。
-- =====================================================

ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'public';

-- 只认这两个值。写死在约束里而不是只靠 Pydantic:
-- 管理员后台和后续的脚本都会直接写这张表,应用层校验挡不住它们。
ALTER TABLE user_archive_items
    DROP CONSTRAINT IF EXISTS chk_user_archive_items_visibility;
ALTER TABLE user_archive_items
    ADD CONSTRAINT chk_user_archive_items_visibility
    CHECK (visibility IN ('public', 'private'));

-- 世界 feed 的查询形状是 visibility='public' + 排除自己 + created_at 倒序。
-- 部分索引只覆盖 public 行,私密条目不进索引,feed 翻页不会被它们拖慢。
CREATE INDEX IF NOT EXISTS idx_user_archive_items_world
    ON user_archive_items(created_at DESC)
    WHERE visibility = 'public';

COMMENT ON COLUMN user_archive_items.visibility IS
    'public = 出现在「世界」档案 feed、允许他人打开详情页;'
    'private = 仅本人可见。默认 public,由本人在藏品详情页切换。';
