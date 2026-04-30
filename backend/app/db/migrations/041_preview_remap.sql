-- =====================================================
-- 041 预览版：只看映射结果，不真正修改数据
-- =====================================================
-- 跑完后会输出 old_id → new_id 映射表，然后自动 ROLLBACK，数据零影响。

BEGIN;

CREATE TEMP TABLE store_id_remap AS
SELECT
    id AS old_id,
    'u-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 10) AS new_id
FROM buyer_stores
WHERE id ~ '[^a-z0-9\-]';

-- 预览映射结果
SELECT old_id, new_id FROM store_id_remap ORDER BY old_id;

-- 统计
SELECT COUNT(*) AS total_dirty_ids FROM store_id_remap;

-- 唯一性检查（确认无碰撞）
SELECT new_id, COUNT(*) AS cnt
FROM store_id_remap
GROUP BY new_id
HAVING COUNT(*) > 1;

-- 不改数据，直接回滚
ROLLBACK;
