-- =====================================================
-- 051: 档案表多语言扩展 — designers / shows / brands
-- =====================================================
--
-- 背景:
--   047 把 styles 升级成 JSONB 多语言后,后续 AI 发帖助手读到的其他档案
--   (designers.bio / shows.title / shows.review_text / brands.category)
--   仍是单语言列,导致 RAG 上下文里部分字段是 EN、部分是 ZH,LLM 输出
--   也会跟着不稳定。本期把「AI 发帖会读」的文本字段都升级成 _i18n JSONB。
--
-- 不动的字段 (有意为之):
--   - designers.name / brands.name: 大部分是专有名词 (Yohji Yamamoto / Vetements),
--     不翻译。需要罗马音 / 中文别名时再单独建 alias 表,避免污染主名。
--   - shows.season / shows.city: 'Fall 23' / 'Paris' 这类字符串语言中性,
--     展示侧靠 i18n key 翻译,不进库。
--   - shows.review_author: 作者名同设计师名,不翻译。
--
-- 兼容性 (重要):
--   - 旧列保留,不 DROP。其他业务路径 (admin 后台、archive 浏览页等) 仍可
--     不改一行代码继续跑;只有 AI 发帖助手 RAG 这一路换读 _i18n 列。
--   - 回填脚本走 DO $$ ... IF EXISTS,如果源列不存在就跳过 (不同环境下
--     init_tables.sql 与实际 Supabase schema 可能有漂移,例如 shows.review_text
--     在某些环境里没建出来),保证迁移在所有环境都能 idempotent 跑过。
--   - 回填把旧列内容塞进 {"en": ...} (默认假定原始数据是 EN),fallback
--     链 (zh → en → first) 保证读取稳定。如果业务知道源语言不是 EN,
--     之后跑一次 UPDATE 把 'en' 改成 'zh' 即可,代价低。
-- =====================================================


-- ----------------------------------------------------
-- designers.bio → bio_i18n
-- ----------------------------------------------------
ALTER TABLE designers ADD COLUMN IF NOT EXISTS bio_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'designers'
           AND column_name = 'bio'
    ) THEN
        EXECUTE $sql$
            UPDATE designers
               SET bio_i18n = jsonb_build_object('en', bio)
             WHERE COALESCE(bio, '') <> ''
               AND bio_i18n = '{}'::jsonb
        $sql$;
    END IF;
END $$;

COMMENT ON COLUMN designers.bio_i18n IS
    '多语言简介: {"en": "...", "zh": "..."}。新写入推荐直接写本字段;'
    '旧 bio 列保留以兼容现存读路径。';


-- ----------------------------------------------------
-- shows.title → title_i18n; shows.review_text → review_text_i18n
-- ----------------------------------------------------
ALTER TABLE shows ADD COLUMN IF NOT EXISTS title_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS review_text_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'shows'
           AND column_name = 'title'
    ) THEN
        EXECUTE $sql$
            UPDATE shows
               SET title_i18n = jsonb_build_object('en', title)
             WHERE COALESCE(title, '') <> ''
               AND title_i18n = '{}'::jsonb
        $sql$;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'shows'
           AND column_name = 'review_text'
    ) THEN
        EXECUTE $sql$
            UPDATE shows
               SET review_text_i18n = jsonb_build_object('en', review_text)
             WHERE COALESCE(review_text, '') <> ''
               AND review_text_i18n = '{}'::jsonb
        $sql$;
    END IF;
END $$;

COMMENT ON COLUMN shows.title_i18n IS
    '多语言秀场标题。如果是「Fall 2023 Ready-to-Wear」这类英文中性'
    '可以只填 en;有中文译名再补 zh。';

COMMENT ON COLUMN shows.review_text_i18n IS
    '多语言秀评全文,LLM RAG 时按 user_locale 注入,不再混用语言。';


-- ----------------------------------------------------
-- brands.category → category_i18n
-- ----------------------------------------------------
ALTER TABLE brands ADD COLUMN IF NOT EXISTS category_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'brands'
           AND column_name = 'category'
    ) THEN
        EXECUTE $sql$
            UPDATE brands
               SET category_i18n = jsonb_build_object('en', category)
             WHERE COALESCE(category, '') <> ''
               AND category_i18n = '{}'::jsonb
        $sql$;
    END IF;
END $$;

COMMENT ON COLUMN brands.category_i18n IS
    '多语言品牌类别 (时装品牌 / 奢侈 / 先锋 ...)。'
    '前端 archive 浏览页若要展示翻译,优先读这里。';


-- ----------------------------------------------------
-- 索引: 暂不建表达式索引
--   pick_locale 主要在 RAG 路径上读, 走 PK / 外键命中率已极高,
--   单条记录 JSONB 解析成本可忽略。等到出现「按译名搜索」需求再补
--   `(name_i18n->>'zh')` 这类表达式索引。
-- ----------------------------------------------------
