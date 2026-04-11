-- Extend content_reports to support MESSAGE and USER report types
-- Add rate-limiting index for 24h duplicate check

ALTER TABLE content_reports
  DROP CONSTRAINT IF EXISTS content_reports_target_type_check;

ALTER TABLE content_reports
  ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type IN ('POST', 'COMMENT', 'MESSAGE', 'USER'));

CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_target
  ON content_reports(reporter_id, target_type, target_id, created_at DESC);
