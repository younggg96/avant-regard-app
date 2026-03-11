-- 修复 buyer_stores 表字段长度不足的问题
-- 将可能超长的 VARCHAR 字段改为 TEXT

ALTER TABLE buyer_stores ALTER COLUMN hours TYPE TEXT;
ALTER TABLE buyer_stores ALTER COLUMN rest TYPE TEXT;
ALTER TABLE buyer_stores ALTER COLUMN city TYPE TEXT;
ALTER TABLE buyer_stores ALTER COLUMN country TYPE TEXT;
