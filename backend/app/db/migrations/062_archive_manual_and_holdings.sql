-- =====================================================
-- Migration 062: MY ARCHIVE 独立上传 + 持有记录
-- =====================================================
--
-- 对应 PDF p.21 + p.22 设计要点：
--   (a) MY ARCHIVE 允许用户独立上传典藏条目（不必依赖订单完成）
--   (b) MY ARCHIVE 持有记录：每件单品可记录多段持有历史
--       例：买入 → 转让给某友 → 回购 → 再次转让...
-- =====================================================


-- ---------------------------------------------------------
-- (a) user_archive_items 增加 source / 备注字段
-- ---------------------------------------------------------
-- source = 'order'  → 由订单完成自动 snapshot 写入（既有行为）
-- source = 'manual' → 用户在 MY ARCHIVE 独立上传（新行为）
-- 现有数据默认补 'order'，保持向后兼容。
ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'order'
        CHECK (source IN ('order', 'manual', 'imported'));

-- 物理位置 / 收纳备注（独立上传时用户可填）
ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS storage_location VARCHAR(120);

-- 当前是否仍在持有（被转让 / 出售后置为 false）
ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS is_currently_owned BOOLEAN NOT NULL DEFAULT TRUE;


-- ---------------------------------------------------------
-- (b) archive_holding_history —— 持有记录时间轴
-- ---------------------------------------------------------
-- 一个 archive item 可有多条 holding history，例如：
--   1. 2023-01 ~ 2024-03 持有，备注 "本人"
--   2. 2024-03 ~ 2024-09 转让给 @friend
--   3. 2024-09 ~ 至今 回购
CREATE TABLE IF NOT EXISTS archive_holding_history (
    id BIGSERIAL PRIMARY KEY,
    archive_item_id BIGINT NOT NULL REFERENCES user_archive_items(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 持有起止时间
    held_from DATE,
    held_to DATE,            -- NULL 表示当前仍在持有
    -- 这一段持有的状态
    status VARCHAR(24) NOT NULL DEFAULT 'owned'
        CHECK (status IN ('owned', 'lent', 'transferred', 'resold', 'returned')),
    -- 自由文本备注
    note TEXT,
    -- 转让 / 出售时的对方（可选）
    counterpart_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    counterpart_name VARCHAR(120),
    -- 相关单品（若是「一键转卖」结果，回填 product_id；若是订单结算，回填 order_id）
    related_product_id BIGINT REFERENCES store_products(id) ON DELETE SET NULL,
    related_order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_archive_holding_history_updated_at ON archive_holding_history;
CREATE TRIGGER trg_archive_holding_history_updated_at
    BEFORE UPDATE ON archive_holding_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_archive_holding_history_item
    ON archive_holding_history(archive_item_id, held_from DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_archive_holding_history_user
    ON archive_holding_history(user_id, created_at DESC);
