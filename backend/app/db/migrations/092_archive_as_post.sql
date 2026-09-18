-- 092 · 档案条目接入帖子互动体系（点赞 / 评论 / 收藏）
--
-- 背景：这个库里的互动层不是多态的 —— post_likes / post_comments /
-- post_favorites 都硬绑 post_id 外键，store_products、buyer_stores、events
-- 各自又抄了一份平行实现。给档案再抄第五份意味着 4 张表 + 一套 service +
-- 一套路由 + 一套前端 hook，且以后每加一个互动特性都要改五个地方。
--
-- 所以这里换个方向：让每条档案在 posts 里挂一条「影子帖子」，
-- post_type = 'ARCHIVE'，通过 archive_item_id 双向关联。
-- 点赞/评论/收藏直接复用帖子那一整套表、RPC、路由和前端组件。
--
-- 关键设计：影子帖子的 status 固定为 'HIDDEN'。
--   posts 的每一处 feed / 列表 / 搜索查询都带 .eq("status", "PUBLISHED")
--   （feed_service 4 处 + post_service 二十多处），用 HIDDEN 就能让档案帖子
--   被全部排除，一行业务代码都不用改。反过来如果发 PUBLISHED 再逐处加
--   .neq("post_type", "ARCHIVE")，漏掉任意一处档案就会涌进帖子流，
--   而这种遗漏在 code review 里几乎看不出来。
--
--   互动侧不受影响：post_service.like_post / favorite_post 和
--   comment_service.create_comment 都不校验 status，
--   get_liked_posts_by_user_id / get_favorite_posts_by_user_id 也不过滤 —— 
--   所以收藏的档案能正常出现在「我的收藏」里。
--
-- 档案的可见性仍然由 user_archive_items.visibility 管（migration 090），
-- 影子帖子不参与可见性判断，它只是互动数据的挂载点。

-- ---------------------------------------------------------------- 关联列
ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS archive_item_id BIGINT
        REFERENCES user_archive_items(id) ON DELETE CASCADE;

COMMENT ON COLUMN posts.archive_item_id IS
    '非空表示这是某条档案的影子帖子（post_type=ARCHIVE，status=HIDDEN），'
    '仅用于承载点赞/评论/收藏；正文展示走 /api/archive/items/{id}。'
    '档案删除时级联删除本行，连带清掉其点赞与评论。';

-- 一条档案最多一条影子帖子。并发下的重复插入由这个唯一索引兜底，
-- 服务端 _sync_shadow_post 依赖它做 upsert 判重。
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_archive_item_unique
    ON posts (archive_item_id)
    WHERE archive_item_id IS NOT NULL;

-- ------------------------------------------------------------------ 回填
-- 给存量档案补影子帖子。title 在 posts 里是 NOT NULL，而
-- user_archive_items.title 可空，所以回退到品牌名、再回退到占位符。
INSERT INTO posts (
    user_id,
    archive_item_id,
    post_type,
    status,
    audit_status,
    title,
    content_text,
    image_urls,
    created_at,
    updated_at
)
SELECT
    a.user_id,
    a.id,
    'ARCHIVE',
    'HIDDEN',
    'APPROVED',
    COALESCE(NULLIF(a.title, ''), NULLIF(a.brand_name, ''), '未命名档案'),
    COALESCE(a.note, ''),
    COALESCE(a.photos, '{}'),
    a.created_at,
    a.updated_at
FROM user_archive_items a
WHERE NOT EXISTS (
    SELECT 1 FROM posts p WHERE p.archive_item_id = a.id
);
