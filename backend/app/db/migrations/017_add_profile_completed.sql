-- 添加 profile_completed 字段到 user_info 表
-- 用于记录用户是否已完善个人资料

ALTER TABLE user_info 
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

-- 添加注释
COMMENT ON COLUMN user_info.profile_completed IS '用户是否已完善个人资料';

-- 根据现有数据更新 profile_completed 状态
-- 如果用户已经填写了 gender、location、age、bio、preference 中的任何一个，则认为已完善
UPDATE user_info 
SET profile_completed = TRUE 
WHERE 
    (gender IS NOT NULL AND gender != 'OTHER') OR
    (location IS NOT NULL AND location != '') OR
    (age IS NOT NULL AND age > 0) OR
    (bio IS NOT NULL AND bio != '') OR
    (preference IS NOT NULL AND preference != '');
