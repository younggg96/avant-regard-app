-- =====================================================
-- 修改 shows 表 id 类型：bigserial → varchar(100)
-- 同时更新 show_images 的外键引用
-- =====================================================

-- 1. 删除 show_images 表的外键约束
ALTER TABLE show_images DROP CONSTRAINT IF EXISTS show_images_show_id_fkey;

-- 2. 删除 shows 表的主键约束
ALTER TABLE shows DROP CONSTRAINT IF EXISTS shows_pkey;

-- 3. 删除 id 列的 sequence（bigserial 会自动创建 sequence）
ALTER TABLE shows ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS shows_id_seq;

-- 4. 修改 shows.id 类型为 varchar(100)
ALTER TABLE shows ALTER COLUMN id TYPE VARCHAR(100) USING id::VARCHAR(100);

-- 5. 设置 NOT NULL 并重新添加主键
ALTER TABLE shows ALTER COLUMN id SET NOT NULL;
ALTER TABLE shows ADD CONSTRAINT shows_pkey PRIMARY KEY (id);

-- 6. 修改 show_images.show_id 类型为 varchar(100)
ALTER TABLE show_images ALTER COLUMN show_id TYPE VARCHAR(100) USING show_id::VARCHAR(100);

-- 7. 重新添加外键约束
ALTER TABLE show_images 
ADD CONSTRAINT show_images_show_id_fkey 
FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE;

-- 8. 添加 category 索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_shows_category ON shows(category);

-- =====================================================
-- 完成！验证修改
-- =====================================================
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'shows' AND column_name = 'id';
