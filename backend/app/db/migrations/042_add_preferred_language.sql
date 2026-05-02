-- Add preferred language to user_info table
ALTER TABLE user_info ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT NULL;
