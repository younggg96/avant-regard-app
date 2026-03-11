-- =====================================================
-- 为 shows 表添加用户上传秀场 + 审核所需字段
-- =====================================================

ALTER TABLE shows ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS designer VARCHAR(200);
ALTER TABLE shows ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE shows ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'APPROVED';
ALTER TABLE shows ADD COLUMN IF NOT EXISTS reject_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_shows_created_by ON shows(created_by);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
