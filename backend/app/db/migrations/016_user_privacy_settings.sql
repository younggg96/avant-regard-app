-- 用户隐私设置
-- 添加隐私设置字段到 user_info 表

-- 添加隐私设置列（默认全部隐藏）
ALTER TABLE user_info
ADD COLUMN IF NOT EXISTS hide_following BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS hide_followers BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS hide_likes BOOLEAN DEFAULT TRUE;

-- 为现有用户设置默认值
UPDATE user_info
SET hide_following = TRUE,
    hide_followers = TRUE,
    hide_likes = TRUE
WHERE hide_following IS NULL
   OR hide_followers IS NULL
   OR hide_likes IS NULL;

-- 添加注释
COMMENT ON COLUMN user_info.hide_following IS '是否隐藏关注列表';
COMMENT ON COLUMN user_info.hide_followers IS '是否隐藏粉丝列表';
COMMENT ON COLUMN user_info.hide_likes IS '是否隐藏点赞列表';
