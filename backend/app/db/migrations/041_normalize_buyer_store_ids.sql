-- =====================================================
-- Migration 041: 规范化 buyer_stores.id —— 清理脏数据格式
-- =====================================================
--
-- 背景：
--   历史上 `frontend/src/screens/StoreReviewScreen.tsx` 管理员单条审核通过
--   按钮自拼 storeId:
--       const cityCode = submission.city.slice(0, 2).toLowerCase();
--       const storeId = `user-${cityCode}-${Date.now()}`;
--   对中文城市 (如 "上海") slice 后仍是中文, 最终把类似
--   `user-上海-1777296718133` 这种含 CJK 字符的 id 写入 `buyer_stores.id`,
--   URL-encode 之后一串 %E4%B8%8A%E6%B5%B7 又丑又难分享, 且和
--   Excel 导入的 `sh-037` / 后端 `u-citySlug-{submissionId}` 等其它
--   格式不一致.
--
--   代码侧 bug 已修 (见同日 PROGRESS_LOG `修复买手店审核通过生成的 store id
--   含中文 / 格式不一致` 条目), 本迁移负责**清理存量脏数据**, 把所有含
--   非 `[a-z0-9-]` 字符的 id 改成统一的 `u-<10 位 hex>` 新格式.
--
-- 涉及表 (全部原子更新):
--   有显式 FK (REFERENCES buyer_stores(id)):
--     1. store_profile_configs         (PK = store_id)
--     2. store_entry_cards
--     3. store_product_categories
--     4. store_products
--   隐式 VARCHAR(100) 关联 (无 FK 约束):
--     5. user_submitted_stores.approved_store_id
--     6. buyer_store_comments
--     7. buyer_store_ratings
--     8. buyer_store_favorites
--     9. store_merchants
--    10. store_announcements
--    11. store_banners
--    12. store_activities
--    13. store_discounts
--   VIEW `buyer_store_rating_stats` 从 `buyer_store_ratings` 聚合, 跟随自动
--   更新, 不需单独处理.
--
-- 策略:
--   a) 建临时表 `store_id_remap (old_id, new_id)`, 只挑含非法字符的 id;
--      合法的历史 id (sh-037 / bj-001 / u-shanghai-42 / u-a7c4f1b2e9) 一律保留.
--   b) 断言新 id 两两不重且不撞既有 id, 撞了直接抛错 rollback.
--   c) 先 DROP 4 个显式 FK (PG 默认 FK 没有 ON UPDATE CASCADE, 不 drop 掉
--      没法改主表 PK).
--   d) UPDATE 主表 + 13 张关联表, 一次性刷新.
--   e) 重建 4 个 FK, 顺手加上 `ON UPDATE CASCADE`, 未来再改 id 时 FK 会
--      自动跟随, 不用再走这套流程.
--   f) 最终断言 `buyer_stores` 里不再有脏 id.
--
--   整个流程包在 BEGIN ... COMMIT 里, 任何一步失败自动回滚, 不会半成功.
-- =====================================================


BEGIN;


-- ---------------------------------------------------------
-- 1. 建临时 remap 表: old_id → new_id
-- ---------------------------------------------------------
-- `[^a-z0-9\-]` 命中任何非法字符 (中文 / 大写字母 / 下划线 / 空格 等),
-- 只要 id 包含任意一个非法字符就进 remap. gen_random_uuid() 每行独立调用,
-- hex 去 dash 后取前 10 位 = 16^10 ≈ 1.1 × 10^12 种可能, 单次迁移内撞车
-- 概率可忽略, 但仍会在下一步做唯一性断言.
CREATE TEMP TABLE store_id_remap AS
SELECT
    id AS old_id,
    'u-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 10) AS new_id
FROM buyer_stores
WHERE id ~ '[^a-z0-9\-]';


-- ---------------------------------------------------------
-- 2. 唯一性断言: 新 id 两两不重, 且不与既有合法 id 冲突
-- ---------------------------------------------------------
DO $$
DECLARE
    self_dup   INT;
    vs_existing INT;
BEGIN
    SELECT COUNT(*) INTO self_dup
    FROM (
        SELECT new_id FROM store_id_remap GROUP BY new_id HAVING COUNT(*) > 1
    ) t;
    IF self_dup > 0 THEN
        RAISE EXCEPTION 'store_id_remap 新 id 自撞 % 条, 迁移中止 (概率极低, 重跑即可)', self_dup;
    END IF;

    SELECT COUNT(*) INTO vs_existing
    FROM store_id_remap r
    JOIN buyer_stores b ON b.id = r.new_id
    WHERE b.id NOT IN (SELECT old_id FROM store_id_remap);
    IF vs_existing > 0 THEN
        RAISE EXCEPTION 'store_id_remap 新 id 和既有合法 id 冲突 % 条, 迁移中止 (重跑即可)', vs_existing;
    END IF;
END $$;


-- ---------------------------------------------------------
-- 3. Drop 所有引用 buyer_stores 的 FK
-- ---------------------------------------------------------
-- PG 默认 FK 无 ON UPDATE CASCADE, 不 drop 没法改主表 PK. 不假设约束名符合
-- `{table}_{col}_fkey` 默认规则, 而是从 pg_constraint 反查所有引用
-- buyer_stores 的 FK, 动态 drop, 免得因命名不一致留下孤儿约束. 所有被 drop
-- 的约束稍后在第 5 步按标准命名 + `ON UPDATE CASCADE` 重建.
DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT con.conname, rel.relname AS table_name
        FROM pg_constraint con
        JOIN pg_class     rel ON rel.oid = con.conrelid
        WHERE con.contype  = 'f'
          AND con.confrelid = 'buyer_stores'::regclass
    LOOP
        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT %I',
            fk.table_name, fk.conname
        );
    END LOOP;
END $$;


-- ---------------------------------------------------------
-- 4. UPDATE 主表 + 13 张关联表
-- ---------------------------------------------------------
-- 主表
UPDATE buyer_stores b
SET id = r.new_id
FROM store_id_remap r
WHERE b.id = r.old_id;

-- 隐式关联表 (VARCHAR, 无 FK)
UPDATE user_submitted_stores t
SET approved_store_id = r.new_id
FROM store_id_remap r
WHERE t.approved_store_id = r.old_id;

UPDATE buyer_store_comments t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE buyer_store_ratings t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE buyer_store_favorites t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE store_merchants t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE store_announcements t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE store_banners t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE store_activities t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE store_discounts t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

-- 显式 FK 关联表 (FK 此刻已 drop, 先更新内容, 最后重建约束)
UPDATE store_profile_configs t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE store_entry_cards t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE store_product_categories t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;

UPDATE store_products t
SET store_id = r.new_id
FROM store_id_remap r
WHERE t.store_id = r.old_id;


-- ---------------------------------------------------------
-- 5. 重建 4 个 FK, 加上 ON UPDATE CASCADE
-- ---------------------------------------------------------
-- 加了 ON UPDATE CASCADE 之后, 未来万一再改 `buyer_stores.id`, 这 4 张有 FK
-- 的关联表会自动跟随, 不需要再走 drop/update/add 这一整套. 对 `ON DELETE
-- CASCADE` 的既有行为保持不变.
ALTER TABLE store_profile_configs
    ADD CONSTRAINT store_profile_configs_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES buyer_stores(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE store_entry_cards
    ADD CONSTRAINT store_entry_cards_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES buyer_stores(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE store_product_categories
    ADD CONSTRAINT store_product_categories_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES buyer_stores(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE store_products
    ADD CONSTRAINT store_products_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES buyer_stores(id)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------
-- 6. 最终断言: buyer_stores 不再有脏 id
-- ---------------------------------------------------------
DO $$
DECLARE
    bad_count INT;
BEGIN
    SELECT COUNT(*) INTO bad_count
    FROM buyer_stores
    WHERE id ~ '[^a-z0-9\-]';
    IF bad_count > 0 THEN
        RAISE EXCEPTION 'buyer_stores 仍有 % 条脏 id, 迁移异常, 回滚', bad_count;
    END IF;
END $$;


-- ---------------------------------------------------------
-- 7. 更新 COMMENT, 记录新格式约定
-- ---------------------------------------------------------
-- 迁移 018 里的注释说过 "用户提交审核格式：u-{city}-{timestamp}", 现在统一
-- 改成 `u-<10 位 hex>`, 这里刷一下主键 COMMENT 保持文档一致性.
COMMENT ON COLUMN buyer_stores.id IS
    '店铺 ID. 管理员导入: {cityCode}-{seq} (如 bj-001); 用户提交审核通过: u-<10 位 hex> (如 u-a7c4f1b2e9)';


COMMIT;
