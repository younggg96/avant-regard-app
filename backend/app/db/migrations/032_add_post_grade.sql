-- 032: 帖子内容评级字段
-- A/B/C/D/F 五级评级，帖子发布后异步写入

ALTER TABLE posts ADD COLUMN IF NOT EXISTS grade TEXT;

COMMENT ON COLUMN posts.grade IS '内容评级: A(深度)/B(单品)/C(日常)/D(无关联)/F(违规)';

CREATE INDEX IF NOT EXISTS idx_posts_grade ON posts (grade);
