-- =====================================================
-- Migration: 添加用户封面图片字段
-- Date: 2026-01-28
-- Description: 为 user_info 表添加 cover_url 字段
-- =====================================================

-- 添加 cover_url 字段到 user_info 表
ALTER TABLE user_info 
ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT '';

-- 添加注释
COMMENT ON COLUMN user_info.cover_url IS '用户封面图片URL';
