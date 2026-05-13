-- Add preferred theme to user_info table
-- Supported values:
--   - system: follow OS
--   - light: force light mode
--   - dark: force dark mode
ALTER TABLE user_info
ADD COLUMN IF NOT EXISTS preferred_theme VARCHAR(10) DEFAULT 'system';

UPDATE user_info
SET preferred_theme = 'system'
WHERE preferred_theme IS NULL;

ALTER TABLE user_info
DROP CONSTRAINT IF EXISTS user_info_preferred_theme_check;

ALTER TABLE user_info
ADD CONSTRAINT user_info_preferred_theme_check
CHECK (preferred_theme IN ('system', 'light', 'dark'));
