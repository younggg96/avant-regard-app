-- 将隐私设置默认值从 TRUE 改为 FALSE（所有用户初始化时不隐藏）

ALTER TABLE user_info
ALTER COLUMN hide_following SET DEFAULT FALSE,
ALTER COLUMN hide_followers SET DEFAULT FALSE,
ALTER COLUMN hide_likes SET DEFAULT FALSE;

UPDATE user_info
SET hide_following = FALSE,
    hide_followers = FALSE,
    hide_likes = FALSE
WHERE hide_following = TRUE
   OR hide_followers = TRUE
   OR hide_likes = TRUE;
