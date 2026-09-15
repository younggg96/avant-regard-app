-- =====================================================
-- Migration 087: 档案人工审核队列 (5.3)
-- =====================================================
--
-- 086 给 user_archive_items 加了 validity_status,manual_review 的条目会
-- 堆进队列,但当时没有「驳回」这个终态,也没有留痕字段 —— 审核员点了通过
-- 或驳回之后,看不出是谁在什么时候基于什么理由做的决定。这里补上。
--
-- 驳回不删除条目:那是用户自己上传的数据,删掉太重。改成标记为 rejected,
-- 它仍然留在用户的档案里,但不是一本有效护照,不参与公开验证与流转。
-- =====================================================

-- 扩展 validity_status 允许值:passed / warned / manual_review / rejected
ALTER TABLE user_archive_items
    DROP CONSTRAINT IF EXISTS user_archive_items_validity_status_check;

ALTER TABLE user_archive_items
    ADD CONSTRAINT user_archive_items_validity_status_check
    CHECK (validity_status IN ('passed', 'warned', 'manual_review', 'rejected'));

-- 审核留痕
ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 驳回理由;通过时也可以写备注,所以不叫 reject_reason。
ALTER TABLE user_archive_items
    ADD COLUMN IF NOT EXISTS review_note TEXT;

-- 队列页默认只看 manual_review,按提交时间从早到晚处理,走这个偏索引。
CREATE INDEX IF NOT EXISTS idx_user_archive_items_review_queue
    ON user_archive_items(created_at)
    WHERE validity_status = 'manual_review';

COMMENT ON COLUMN user_archive_items.validity_status IS
    '5.3 有效性检查结论: passed 通过 / warned 品类冲突但用户坚持 / '
    'manual_review 待人工复核 / rejected 人工驳回(非有效护照)';
