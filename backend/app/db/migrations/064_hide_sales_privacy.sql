-- 用户隐私：是否对他人隐藏「在售」单品列表
ALTER TABLE user_info
    ADD COLUMN IF NOT EXISTS hide_sales BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_info.hide_sales IS '是否隐藏在售单品列表（他人主页「在售」tab）';

UPDATE user_info
SET hide_sales = FALSE
WHERE hide_sales IS NULL;
