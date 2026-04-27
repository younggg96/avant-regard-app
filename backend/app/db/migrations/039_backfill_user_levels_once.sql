-- =====================================================
-- 039: 存量用户等级一次性回填 (纯 SQL 实现)
--
-- 背景:
--   等级系统 (migration 038) 上线后, 用户 Lv1-Lv3 靠 record_action
--   埋点实时累加, 但**已有的老数据**不会被"回放". 于是线上出现所有
--   用户 user_levels.current_level = 0 的情况.
--
--   `backend/app/services/level_service.py::backfill_all` 提供了服务
--   层版本, 但依赖 Python 运行时 + 生产 .env. 本脚本是它的 SQL 对等
--   版本, 可直接在 Supabase SQL Editor 中执行, 绕开所有环境问题.
--
-- 设计红线:
--   1) **幂等**.      重复执行不会回退等级, 不会重复发放权益,
--                     不会重复创建 Lv4 PENDING 审批.
--   2) **静默升级**.  不插入站内通知, 不打扰老用户.
--   3) **只升 Lv1-3**. Lv4 只创建 PENDING 审批 (等 Admin 复核);
--                     Lv5 绝不自动触发 (必须 Admin 手动授予).
--   4) **max 合并**.  如果 user_level_progress.counters 已有值,
--                     取 max(real_counter, existing_counter),
--                     避免业务表存在软删除 / 抽样差异时丢数据.
--   5) **only-ascent**. 现有 user_levels 触发器保证不会回退;
--                     INSERT ON CONFLICT DO UPDATE 用 GREATEST 显式
--                     再保险.
--
-- 使用:
--   在 Supabase SQL Editor 粘贴并执行. 幂等, 可反复跑.
-- =====================================================

BEGIN;

-- ---------------------------------------------------------------
-- Step 1: 计算每个用户的真实累计计数
-- ---------------------------------------------------------------
DROP TABLE IF EXISTS _tmp_user_counters;

CREATE TEMP TABLE _tmp_user_counters AS
SELECT
    u.id AS user_id,
    COALESCE((
        SELECT COUNT(*) FROM posts p
        WHERE p.user_id = u.id AND p.status = 'PUBLISHED'
    ), 0)::int AS post_created,
    COALESCE((
        SELECT COUNT(*) FROM community_follows cf
        WHERE cf.user_id = u.id
    ), 0)::int AS community_followed,
    COALESCE((
        SELECT COUNT(*) FROM post_likes pl
        WHERE pl.user_id = u.id
    ), 0)::int AS post_liked,
    COALESCE((
        SELECT COUNT(*) FROM user_follows uf
        WHERE uf.follower_id = u.id
    ), 0)::int AS user_followed,
    COALESCE((
        SELECT COUNT(*) FROM post_wants pw
        WHERE pw.user_id = u.id
    ), 0)::int AS want_clicked,
    COALESCE((
        SELECT COUNT(*) FROM buyer_store_comments bc
        WHERE bc.user_id = u.id AND bc.parent_id IS NULL
    ), 0)::int AS store_commented,
    COALESCE((
        SELECT COUNT(*) FROM user_submitted_stores us
        WHERE us.user_id = u.id AND us.status = 'APPROVED'
    ), 0)::int
    +
    COALESCE((
        SELECT COUNT(*) FROM shows s
        WHERE s.created_by = u.id AND s.status = 'APPROVED'
    ), 0)::int
    +
    COALESCE((
        SELECT COUNT(*) FROM brand_submissions bs
        WHERE bs.user_id = u.id AND bs.status = 'APPROVED'
    ), 0)::int AS archive_uploaded
FROM users u;

CREATE INDEX ON _tmp_user_counters(user_id);

-- ---------------------------------------------------------------
-- Step 2: 计算每个用户达到的最高 AUTO 等级 (Lv1-3) + Lv4 资格
--   level_service._evaluate() 的等价 SQL:
--   从 Lv1 往上检查, 只要本级任务全部达标就继续, 否则停.
-- ---------------------------------------------------------------
DROP TABLE IF EXISTS _tmp_user_targets;

CREATE TEMP TABLE _tmp_user_targets AS
SELECT
    c.user_id,
    c.post_created,
    c.community_followed,
    c.post_liked,
    c.user_followed,
    c.want_clicked,
    c.store_commented,
    c.archive_uploaded,
    CASE
        -- Lv3 条件必须建立在 Lv1 + Lv2 都达成之上 (只升不跳)
        WHEN c.post_created       >= 1
         AND c.community_followed >= 1
         AND c.post_liked         >= 10
         AND c.user_followed      >= 3
         AND c.want_clicked       >= 10
         AND c.store_commented    >= 5
        THEN 3
        WHEN c.post_created       >= 1
         AND c.community_followed >= 1
         AND c.post_liked         >= 10
         AND c.user_followed      >= 3
        THEN 2
        WHEN c.post_created       >= 1
         AND c.community_followed >= 1
        THEN 1
        ELSE 0
    END AS auto_target_level,
    -- Lv4 需要在已达 Lv3 基础上 + 档案 >= 3
    (c.post_created       >= 1
     AND c.community_followed >= 1
     AND c.post_liked         >= 10
     AND c.user_followed      >= 3
     AND c.want_clicked       >= 10
     AND c.store_commented    >= 5
     AND c.archive_uploaded   >= 3
    ) AS lv4_eligible
FROM _tmp_user_counters c;

CREATE INDEX ON _tmp_user_targets(user_id);

-- ---------------------------------------------------------------
-- Step 3: 把 counters 写入 user_level_progress (max 合并)
-- ---------------------------------------------------------------
INSERT INTO user_level_progress (user_id, counters, updated_at)
SELECT
    t.user_id,
    jsonb_build_object(
        'post_created',       GREATEST(t.post_created,       COALESCE((ex.counters->>'post_created')::int,       0)),
        'community_followed', GREATEST(t.community_followed, COALESCE((ex.counters->>'community_followed')::int, 0)),
        'post_liked',         GREATEST(t.post_liked,         COALESCE((ex.counters->>'post_liked')::int,         0)),
        'user_followed',      GREATEST(t.user_followed,      COALESCE((ex.counters->>'user_followed')::int,      0)),
        'want_clicked',       GREATEST(t.want_clicked,       COALESCE((ex.counters->>'want_clicked')::int,       0)),
        'store_commented',    GREATEST(t.store_commented,    COALESCE((ex.counters->>'store_commented')::int,    0)),
        'archive_uploaded',   GREATEST(t.archive_uploaded,   COALESCE((ex.counters->>'archive_uploaded')::int,   0))
    ),
    NOW()
FROM _tmp_user_counters t
LEFT JOIN user_level_progress ex ON ex.user_id = t.user_id
ON CONFLICT (user_id) DO UPDATE
    SET counters   = EXCLUDED.counters,
        updated_at = EXCLUDED.updated_at;

-- ---------------------------------------------------------------
-- Step 4: 升级 user_levels (Lv1-3)
--   - 先 INSERT Lv0 行 (若还没有), 以便后续 UPDATE
--   - 再把每个用户推到 auto_target_level (Lv4+ 不动, 由 Step 5 建 PENDING)
--   - GREATEST + only-ascent trigger 双保险, 绝不回退
-- ---------------------------------------------------------------
INSERT INTO user_levels (user_id, current_level)
SELECT t.user_id, 0
FROM _tmp_user_targets t
ON CONFLICT (user_id) DO NOTHING;

UPDATE user_levels ul
SET current_level    = GREATEST(ul.current_level, t.auto_target_level),
    last_level_up_at = CASE
        WHEN t.auto_target_level > ul.current_level THEN NOW()
        ELSE ul.last_level_up_at
    END
FROM _tmp_user_targets t
WHERE ul.user_id = t.user_id
  AND t.auto_target_level > 0
  AND t.auto_target_level > ul.current_level;  -- 无变化就跳过, 减少 trigger 开销

-- ---------------------------------------------------------------
-- Step 5: Lv4 达标 -> 创建 PENDING 审批 (去重)
--   只给目前 current_level < 4 的用户建, 已经在 Lv4/5 的不建.
--   ux_level_upgrade_requests_pending 唯一索引会兜底.
-- ---------------------------------------------------------------
INSERT INTO level_upgrade_requests (user_id, target_level, status, remark)
SELECT t.user_id, 4, 'PENDING', 'backfill: archive_uploaded>=3'
FROM _tmp_user_targets t
JOIN user_levels ul ON ul.user_id = t.user_id
WHERE t.lv4_eligible
  AND ul.current_level < 4
  AND NOT EXISTS (
      SELECT 1 FROM level_upgrade_requests r
      WHERE r.user_id      = t.user_id
        AND r.target_level = 4
        AND r.status       = 'PENDING'
  );

-- ---------------------------------------------------------------
-- Step 6: 对 current_level >= N 的用户幂等发放 level_benefits
--   - 已有 (user_id, benefit_id) 记录则跳过 (user_level_benefits
--     本身有 UNIQUE 约束兜底)
-- ---------------------------------------------------------------
INSERT INTO user_level_benefits (user_id, benefit_id, quota, used)
SELECT ul.user_id, b.id, b.default_quota, 0
FROM user_levels ul
JOIN level_benefits b
  ON b.level_required <= ul.current_level
 AND b.is_active = TRUE
WHERE ul.current_level >= 1
ON CONFLICT (user_id, benefit_id) DO NOTHING;

-- ---------------------------------------------------------------
-- Step 7: Lv3+ 用户加入"当月"抽奖池 (若当月 round 存在)
--   - 没有当月 round 时整段会被跳过, 不报错
-- ---------------------------------------------------------------
INSERT INTO lottery_entries (round_id, user_id)
SELECT lr.id, ul.user_id
FROM user_levels ul
JOIN lottery_rounds lr
  ON lr.month = to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
WHERE ul.current_level >= 3
  AND lr.status = 'OPEN'
ON CONFLICT (round_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------
-- Step 8: 输出一份统计摘要到控制台 (Supabase SQL Editor 可见)
-- ---------------------------------------------------------------
DO $$
DECLARE
    v_total      int;
    v_lv0        int;
    v_lv1        int;
    v_lv2        int;
    v_lv3        int;
    v_lv4        int;
    v_lv5        int;
    v_pending4   int;
BEGIN
    SELECT COUNT(*) INTO v_total FROM user_levels;
    SELECT COUNT(*) INTO v_lv0   FROM user_levels WHERE current_level = 0;
    SELECT COUNT(*) INTO v_lv1   FROM user_levels WHERE current_level = 1;
    SELECT COUNT(*) INTO v_lv2   FROM user_levels WHERE current_level = 2;
    SELECT COUNT(*) INTO v_lv3   FROM user_levels WHERE current_level = 3;
    SELECT COUNT(*) INTO v_lv4   FROM user_levels WHERE current_level = 4;
    SELECT COUNT(*) INTO v_lv5   FROM user_levels WHERE current_level = 5;
    SELECT COUNT(*) INTO v_pending4
      FROM level_upgrade_requests
     WHERE status = 'PENDING' AND target_level = 4;

    RAISE NOTICE '-----------------------------------------';
    RAISE NOTICE '[039] User level backfill complete.';
    RAISE NOTICE '  user_levels rows: %', v_total;
    RAISE NOTICE '    Lv0  = %', v_lv0;
    RAISE NOTICE '    Lv1  = %', v_lv1;
    RAISE NOTICE '    Lv2  = %', v_lv2;
    RAISE NOTICE '    Lv3  = %', v_lv3;
    RAISE NOTICE '    Lv4  = %  (应由 Admin 手动审批升级)', v_lv4;
    RAISE NOTICE '    Lv5  = %  (仅 Admin 授予, 回填不会改动)', v_lv5;
    RAISE NOTICE '  Lv4 PENDING 审批: %', v_pending4;
    RAISE NOTICE '-----------------------------------------';
END $$;

COMMIT;

-- 事后清理临时表 (临时表会在 session 结束时自动 DROP, 这里显式释放更干净)
DROP TABLE IF EXISTS _tmp_user_counters;
DROP TABLE IF EXISTS _tmp_user_targets;
