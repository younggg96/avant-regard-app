-- =====================================================
-- 047: AI 发帖助手 — styles 风格字典表 + designers.primary_style_id
-- =====================================================
--
-- 背景:
--   AI 发帖助手 (V3 #25) 的 5 步问答首问就是「你今天想发什么风格?」,
--   答案必须从档案数据库中实拉取,不能硬编码 (避免 LLM 编造风格).
--   现有 buyer_store_service.get_all_styles() 是按商家货品聚合出来的
--   字符串,既不稳定 (商家上下架就变),也无法挂封面图给前端大卡使用.
--
-- 因此本期建一张独立 styles 字典表:
--   - 由后端 seed 一批稳定枚举 (见底部 INSERT),后续可通过 admin 后台增删.
--   - designers 表挂上 primary_style_id 外键,Q1 选完风格后 Q2 即可
--     SELECT designers WHERE primary_style_id = ? LIMIT 5.
--   - 历史 designers 不强制回填,Q2 走 LIMIT 5 取存在外键的即可,
--     后续 admin 后台批量补.
--
-- 多语言设计 (V3 #25.1):
--   name / description 用 JSONB 存 {locale: text} 映射, 不用为每种语言单独
--   建列。前端 i18n 当前只跑 zh / en,但后台档案库未来会上日韩等,
--   schema 不应每加一种语言就 ALTER TABLE。
--   - 取值约定: 优先 user_locale,回退 'en';再回退 jsonb 里第一个 key。
--     这层回退在 backend ai_post_service / rag_retriever 里集中实现,
--     SQL 这一层只保证存储与索引。
--   - 索引: 对常见 locale 建表达式索引,如果未来跑大量"按风格名搜索"再补.
--   - slug 不进 i18n,它是稳定的程序标识符 (前端 key、URL slug 都用这个)。
-- =====================================================

CREATE TABLE IF NOT EXISTS styles (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,             -- 稳定标识符 (前端 i18n key 与 URL slug)
    name_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"en": "Avant-garde", "zh": "先锋", ...}
    description_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 同上, 注入 LLM RAG 用
    cover_url TEXT,                                -- Q1 大卡封面图 URL (locale 无关)
    sort_order INTEGER NOT NULL DEFAULT 0,         -- 默认排序;用户已关注的会动态前置
    is_active BOOLEAN NOT NULL DEFAULT TRUE,       -- 软下线开关
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- 至少要有 en 文案,否则 fallback 链兜底失败,前端会展示空字符串。
    CONSTRAINT styles_name_has_en CHECK (name_i18n ? 'en')
);

CREATE INDEX IF NOT EXISTS idx_styles_active_sort ON styles(is_active, sort_order);

-- designers 加主风格外键 (允许 NULL,历史数据不强迁)
ALTER TABLE designers ADD COLUMN IF NOT EXISTS primary_style_id BIGINT REFERENCES styles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_designers_primary_style ON designers(primary_style_id);

-- 触发器: 自动更新 updated_at
DROP TRIGGER IF EXISTS update_styles_updated_at ON styles;
CREATE TRIGGER update_styles_updated_at BEFORE UPDATE ON styles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE styles IS
    'AI 发帖助手 Q1 风格字典。由后端 seed,可由 admin 增删。'
    'designers.primary_style_id 关联到本表用于 Q2 召回。';

COMMENT ON COLUMN styles.name_i18n IS
    '多语言名: {"en": "Avant-garde", "zh": "先锋"}。'
    '加新语言只需 UPDATE 这一列,不用 ALTER TABLE。后端读取顺序: '
    'user_locale → en → jsonb 第一个 key。';

COMMENT ON COLUMN styles.description_i18n IS
    '多语言风格描述,会随其他档案信息一起塞进 LLM prompt,'
    '直接影响生成文案质量,改动需谨慎。回退顺序同 name_i18n。';


-- =====================================================
-- Seed 默认风格枚举
--   - slug 用 snake_case,稳定不变,前端 i18n 也以此为 key.
--   - cover_url 留空,先由 admin 后台补;前端无图时 fallback 到首字母色块.
--   - 描述短句直接给 LLM 用,不要写太长。当前先填 en/zh,后续语言增量 UPDATE。
-- =====================================================
INSERT INTO styles (slug, name_i18n, description_i18n, sort_order) VALUES
    (
        'avant_garde',
        jsonb_build_object('en', 'Avant-garde', 'zh', '先锋'),
        jsonb_build_object(
            'en', 'Deconstructed silhouettes, irregular shapes and experimental fabrics challenging mainstream aesthetics',
            'zh', '强调解构、不规则廓形与实验性面料,挑战传统审美'
        ),
        10
    ),
    (
        'minimalism',
        jsonb_build_object('en', 'Minimalism', 'zh', '极简'),
        jsonb_build_object(
            'en', 'Restrained palette and crisp tailoring; the material and the line speak for themselves',
            'zh', '克制配色与利落剪裁,追求材质与线条本身的表达'
        ),
        20
    ),
    (
        'streetwear',
        jsonb_build_object('en', 'Streetwear', 'zh', '街头'),
        jsonb_build_object(
            'en', 'Sportswear elements, relaxed fits, graphics and subculture narrative',
            'zh', '运动元素、宽松版型、印花与亚文化叙事'
        ),
        30
    ),
    (
        'workwear',
        jsonb_build_object('en', 'Workwear', 'zh', '工装'),
        jsonb_build_object(
            'en', 'Functional pockets, durable fabrics and pragmatism rooted in blue-collar uniforms',
            'zh', '功能性口袋、耐磨面料、源自蓝领工服的实用主义'
        ),
        40
    ),
    (
        'classic',
        jsonb_build_object('en', 'Classic', 'zh', '经典'),
        jsonb_build_object(
            'en', 'British / Italian tailoring; suits, shirts and traditional accessories',
            'zh', '英伦/意式剪裁,西装、衬衫与传统配饰'
        ),
        50
    ),
    (
        'vintage',
        jsonb_build_object('en', 'Vintage', 'zh', '复古'),
        jsonb_build_object(
            'en', 'Silhouettes and palettes from a specific 20th-century decade; secondhand and archive context',
            'zh', '20 世纪某十年的廓形与配色,二手与古着语境'
        ),
        60
    ),
    (
        'y2k',
        jsonb_build_object('en', 'Y2K', 'zh', 'Y2K'),
        jsonb_build_object(
            'en', 'Millennium futurism: metallic finishes, low-rise, bright colors and toy-like elements',
            'zh', '千禧未来感,金属光泽、低腰、亮色与潮玩元素'
        ),
        70
    ),
    (
        'grunge',
        jsonb_build_object('en', 'Grunge', 'zh', '颓废'),
        jsonb_build_object(
            'en', 'Layering, distress, tears and dark tones rooted in 90s rock',
            'zh', '层叠、做旧、撕裂与暗色调,源自 90 年代摇滚'
        ),
        80
    ),
    (
        'techwear',
        jsonb_build_object('en', 'Techwear', 'zh', '机能'),
        jsonb_build_object(
            'en', 'High-tech fabrics, modular construction; outdoor + urban hybrid aesthetics',
            'zh', '高科技面料、模块化结构、户外+都市的混合美学'
        ),
        90
    ),
    (
        'romantic',
        jsonb_build_object('en', 'Romantic', 'zh', '浪漫'),
        jsonb_build_object(
            'en', 'Lace, tulle, florals and soft palettes; a feminine narrative',
            'zh', '蕾丝、薄纱、花卉与柔和配色,女性化叙事'
        ),
        100
    )
ON CONFLICT (slug) DO NOTHING;
