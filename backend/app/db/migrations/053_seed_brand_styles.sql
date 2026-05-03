-- =====================================================
-- 053: AI 发帖助手 — brands 风格关联 + seed
-- =====================================================
--
-- 背景:
--   047/052 走的「style → designer → show」链路在我们实际数据库里不可行,
--   因为 designers 表是空的,所有秀场只挂在 brands 上 (shows.brand_name)。
--   于是把 AI 发帖 5 步问答的 Q2 从「设计师」改成「品牌」:
--     Q1 style → Q2 brand → Q3 show → Q4 look → Q5 perspective
--
--   shows.brand_name 是字符串列, 与 brands.name 一一对应, Q3 直接按
--   brand_name 过滤即可,不用引入新外键。
--
-- 设计要点:
--   - 跟 047 给 designers 加 primary_style_id 同样的模式; brands 也一样:
--     允许 NULL,历史数据不强迁,运营慢慢补。
--   - 052 给 designers 的 seed 大部分名字其实就是 brands.name (Yohji Yamamoto
--     既是设计师名也是品牌名), 这里把那张映射表直接搬过来,target 成 brands。
--   - 052 留着,免得对其他读 designers.primary_style_id 的代码造成回归。
-- =====================================================

ALTER TABLE brands ADD COLUMN IF NOT EXISTS primary_style_id BIGINT REFERENCES styles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_brands_primary_style ON brands(primary_style_id);

COMMENT ON COLUMN brands.primary_style_id IS
    '主风格,关联 styles.id。AI 发帖助手 Q2 用此列过滤;'
    '0 命中时降级到全表 top N,保证流程不死局。';


-- =====================================================
-- 同 052 的批量 seed,target = brands.name
-- =====================================================
WITH style_lookup AS (
    SELECT id, slug FROM styles
),
seed(brand_name, style_slug) AS (
    VALUES
        -- ==== avant_garde 先锋 ====
        ('Yohji Yamamoto',          'avant_garde'),
        ('Comme des Garçons',       'avant_garde'),
        ('Rick Owens',              'avant_garde'),
        ('Maison Martin Margiela',  'avant_garde'),
        ('Junya Watanabe',          'avant_garde'),
        ('Ann Demeulemeester',      'avant_garde'),
        ('Issey Miyake',            'avant_garde'),
        ('Walter Van Beirendonck',  'avant_garde'),
        ('Noir Kei Ninomiya',       'avant_garde'),
        ('Robert Wun',              'avant_garde'),
        ('Schiaparelli',            'avant_garde'),
        ('Uma Wang',                'avant_garde'),
        ('John Alexander Skelton',  'avant_garde'),

        -- ==== minimalism 极简 ====
        ('Jil Sander',              'minimalism'),
        ('Helmut Lang',             'minimalism'),
        ('Toteme',                  'minimalism'),
        ('Khaite',                  'minimalism'),
        ('Loro Piana',              'minimalism'),
        ('Brunello Cucinelli',      'minimalism'),
        ('Acne Studios',            'minimalism'),
        ('Aspesi',                  'minimalism'),
        ('Peter Do',                'minimalism'),

        -- ==== streetwear 街头 ====
        ('Off-White',               'streetwear'),
        ('Vetements',               'streetwear'),
        ('Kith',                    'streetwear'),
        ('Amiri',                   'streetwear'),
        ('Sacai',                   'streetwear'),
        ('Sunnei',                  'streetwear'),
        ('Coach',                   'streetwear'),
        ('Balenciaga',              'streetwear'),
        ('Kenzo',                   'streetwear'),
        ('Jacquemus',               'streetwear'),

        -- ==== workwear 工装 ====
        ('Diesel',                  'workwear'),
        ('Woolrich',                'workwear'),
        ('Our Legacy',              'workwear'),
        ('Maje',                    'workwear'),
        ('Sandro',                  'workwear'),

        -- ==== classic 经典 ====
        ('Brioni',                  'classic'),
        ('Ralph Lauren',            'classic'),
        ('Tom Ford',                'classic'),
        ('Hermès',                  'classic'),
        ('Paul Smith',              'classic'),
        ('Berluti',                 'classic'),
        ('Bally',                   'classic'),
        ('Salvatore Ferragamo',     'classic'),
        ('Max Mara',                'classic'),
        ('Loewe',                   'classic'),
        ('Bottega Veneta',          'classic'),
        ('Burberry',                'classic'),
        ('Thom Browne',             'classic'),
        ('Gucci',                   'classic'),
        ('Prada',                   'classic'),
        ('Louis Vuitton',           'classic'),
        ('Saint Laurent',           'classic'),

        -- ==== vintage 复古 ====
        ('Vivienne Westwood',       'vintage'),
        ('Roberto Cavalli',         'vintage'),
        ('Diane von Furstenberg',   'vintage'),
        ('Donna Karan',             'vintage'),
        ('Lanvin',                  'vintage'),
        ('Christian Dior',          'vintage'),
        ('Emilio Pucci',            'vintage'),
        ('Moschino',                'vintage'),

        -- ==== y2k Y2K ====
        ('Blumarine',               'y2k'),
        ('D&G',                     'y2k'),
        ('Dolce & Gabbana',         'y2k'),
        ('Mugler',                  'y2k'),
        ('Mui Mui',                 'y2k'),
        ('Versace',                 'y2k'),
        ('Paco Rabanne',            'y2k'),
        ('Courrèges',               'y2k'),

        -- ==== grunge 颓废 ====
        ('Enfants Riches Déprimés', 'grunge'),
        ('Martine Rose',            'grunge'),
        ('Undercover',              'grunge'),
        ('Antonio Marras',          'grunge'),

        -- ==== techwear 机能 ====
        ('Y-3',                     'techwear'),
        ('Dion Lee',                'techwear'),
        ('Kolor',                   'techwear'),
        ('Alexander Wang',          'techwear'),

        -- ==== romantic 浪漫 ====
        ('Chloe',                   'romantic'),
        ('Self-Portrait',           'romantic'),
        ('Zimmermann',              'romantic'),
        ('Romance Was Born',        'romantic'),
        ('Alberta Ferretti',        'romantic'),
        ('Valentino',               'romantic'),
        ('Givenchy',                'romantic'),
        ('Etro',                    'romantic'),
        ('Emporio Armani',          'romantic'),
        ('Chanel',                  'romantic'),
        ('Fendi',                   'romantic'),
        ('Marni',                   'romantic'),
        ('Missoni',                 'romantic'),
        ('Stella McCartney',        'romantic'),
        ('Balmain',                 'romantic'),
        ('Victoria Beckham',        'romantic'),
        ('Alexander McQueen',       'romantic'),
        ('Altuzarra',               'romantic'),
        ('Dries Van Noten',         'romantic')
)
UPDATE brands
   SET primary_style_id = sl.id
  FROM seed s
  JOIN style_lookup sl ON sl.slug = s.style_slug
 WHERE LOWER(brands.name) = LOWER(s.brand_name)
   AND brands.primary_style_id IS NULL;

-- 兜底: 名字带特殊字符 / 拼写微差异
DO $$
DECLARE
    pairs CONSTANT TEXT[][] := ARRAY[
        ['comme des garcons',   'avant_garde'],
        ['mui mui',             'y2k'],
        ['miu miu',             'y2k'],
        ['hermes',              'classic'],
        ['chloé',               'romantic'],
        ['saint-laurent',       'classic']
    ];
    pair TEXT[];
BEGIN
    FOREACH pair SLICE 1 IN ARRAY pairs LOOP
        UPDATE brands
           SET primary_style_id = (SELECT id FROM styles WHERE slug = pair[2])
         WHERE primary_style_id IS NULL
           AND LOWER(REPLACE(name, 'ç', 'c')) ILIKE '%' || pair[1] || '%';
    END LOOP;
END $$;

-- 跑完后 review 覆盖度:
--   SELECT s.slug, COUNT(b.id) FROM styles s
--    LEFT JOIN brands b ON b.primary_style_id = s.id
--    GROUP BY s.slug ORDER BY 2 DESC;
-- 期望每个 slug >= 5。
