-- =====================================================================
-- 055_store_posts_and_links.sql
--
-- 买手店帖子（store posts）+ 入口卡片关联帖子。
--
-- 1. 在 posts 表上加 store_id (VARCHAR(100), nullable, FK→buyer_stores.id)，
--    用于把"普通 Lookbook 帖子"标记成"某买手店发的店铺帖子"。和
--    community_id / brand_ids 类似，作为 post 的"归属维度"之一：
--      - store_id IS NULL  → 普通用户帖子（保持兼容）
--      - store_id IS NOT NULL → 买手店帖子，PostCard 上要显示 "买手店" 角标，
--        StoreDetail 的 Posts tab 也用这个字段拉取列表。
--
--    校验在 backend/app/services/post_service.py 创建/更新时做：发帖人必须
--    是该 store 已 APPROVED 的 store_merchants.user_id（或者管理员）。SQL
--    层不强加 RLS，避免和现有 post 流水交叉影响。
--
-- 2. 在 store_banners / store_announcements / store_activities /
--    store_discounts 上各加一列 linked_post_id (BIGINT, nullable,
--    FK→posts.id ON DELETE SET NULL)。商家在管理后台编辑这些"入口元素"
--    时可以挑一篇 store post 关联，消费者点 banner/活动/折扣/公告卡片 →
--    跳到 PostDetail（如果填了），否则保持原行为（外链 / 详情页占位）。
--
--    历史：banner.link_type 之前只有 INTERNAL / EXTERNAL / NONE 三档，
--    现在多一档 POST。我们用「应用层判断」即可（service / 前端检查
--    linked_post_id IS NOT NULL），无需在 SQL 层加 CHECK 约束去枚举它，
--    保持向后兼容（旧 link_type 值仍合法）。
--
-- 3. 索引：
--    - posts.store_id 上加 GIN/BTREE（B-tree 即可，单字符串列），
--      支持 StoreDetail 高频按 store_id 拉 Posts tab。
--    - 各 entry 表的 linked_post_id 上加 BTREE，便于反向查询「哪些
--      banner / activity 引用了这个 post」做级联失效或运营排查。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. posts.store_id
-- ---------------------------------------------------------------------
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS store_id VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'posts'
      AND constraint_name = 'posts_store_id_fkey'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_store_id_fkey
      FOREIGN KEY (store_id) REFERENCES buyer_stores(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_store_id
  ON posts(store_id)
  WHERE store_id IS NOT NULL;

COMMENT ON COLUMN posts.store_id IS
  '可选：标记此帖为某买手店发布的「店铺帖子」。NULL = 普通用户帖子。';

-- ---------------------------------------------------------------------
-- 2. linked_post_id 列：banner / announcement / activity / discount
-- ---------------------------------------------------------------------
ALTER TABLE store_banners
  ADD COLUMN IF NOT EXISTS linked_post_id BIGINT
    REFERENCES posts(id) ON DELETE SET NULL;

ALTER TABLE store_announcements
  ADD COLUMN IF NOT EXISTS linked_post_id BIGINT
    REFERENCES posts(id) ON DELETE SET NULL;

ALTER TABLE store_activities
  ADD COLUMN IF NOT EXISTS linked_post_id BIGINT
    REFERENCES posts(id) ON DELETE SET NULL;

ALTER TABLE store_discounts
  ADD COLUMN IF NOT EXISTS linked_post_id BIGINT
    REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_banners_linked_post_id
  ON store_banners(linked_post_id)
  WHERE linked_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_announcements_linked_post_id
  ON store_announcements(linked_post_id)
  WHERE linked_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_activities_linked_post_id
  ON store_activities(linked_post_id)
  WHERE linked_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_discounts_linked_post_id
  ON store_discounts(linked_post_id)
  WHERE linked_post_id IS NOT NULL;

COMMENT ON COLUMN store_banners.linked_post_id IS
  '可选：banner 点击后跳到的店铺帖子 ID。优先级高于 link_url。';
COMMENT ON COLUMN store_announcements.linked_post_id IS
  '可选：公告关联的店铺帖子 ID（用户点公告卡片可进入 PostDetail）。';
COMMENT ON COLUMN store_activities.linked_post_id IS
  '可选：活动关联的店铺帖子 ID。';
COMMENT ON COLUMN store_discounts.linked_post_id IS
  '可选：折扣关联的店铺帖子 ID。';
