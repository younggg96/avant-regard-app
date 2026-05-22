-- =====================================================
-- Buyer Shop Mock Data —— 买手店 Tab 演示数据
-- =====================================================
--
-- 适用范围：在 buyer_stores 已有数据（import_buyer_stores.py 或手工导入）
-- 且 migrations 008 / 040 / 055 / trading_consolidated_057_062 已执行后运行。
--
-- 设计要点：
--   * 幂等：NOT EXISTS / ON CONFLICT DO NOTHING，可反复执行。
--   * 不写死 user id：从 users 表循环分配 merchant 账号。
--   * 优先 seed 设计稿常见店铺：Aleluya / SVD / Darklands / Gate194 / darklands-x；
--     若不存在则回退到 buyer_stores 前 5 条。
--   * 所有 mock 文案带 [MOCK-BOUTIQUE] 前缀，便于清理。
--
-- 前置最小要求：
--   * buyer_stores 至少 1 行
--   * users 至少 1 行
--
-- 清理 mock 数据：
--   DELETE FROM posts WHERE title LIKE '[MOCK-BOUTIQUE]%';
--   DELETE FROM buyer_store_favorites WHERE store_id IN (
--     SELECT store_id FROM store_merchants WHERE contact_name LIKE '[MOCK-BOUTIQUE]%'
--   );
--   DELETE FROM store_products WHERE title LIKE '[MOCK-BOUTIQUE]%';
--   DELETE FROM store_banners WHERE title LIKE '[MOCK-BOUTIQUE]%';
--   DELETE FROM store_entry_cards WHERE label LIKE '[MOCK-BOUTIQUE]%';
--   DELETE FROM store_product_categories WHERE name LIKE '[MOCK-BOUTIQUE]%';
--   DELETE FROM store_profile_configs WHERE short_description LIKE '[MOCK-BOUTIQUE]%';
--   DELETE FROM store_merchants WHERE contact_name LIKE '[MOCK-BOUTIQUE]%';
-- =====================================================


-- =====================================================
-- 0. 目标店铺（优先设计稿店铺，不足 5 家则补齐）
-- =====================================================
-- 用 CTE 贯穿全文，避免 TEMP TABLE 在同 session 重复执行时脏读。
-- =====================================================
-- 1. store_merchants —— APPROVED 商家入驻
-- =====================================================
WITH priority_ids AS (
    SELECT id, ord FROM (VALUES
        ('es-003', 0),
        ('es-001', 1),
        ('de-004', 2),
        ('de-006', 3),
        ('de-007', 4)
    ) AS v(id, ord)
),
matched AS (
    SELECT bs.id, bs.name, p.ord AS priority
    FROM buyer_stores bs
    JOIN priority_ids p ON p.id = bs.id
),
fallback AS (
    SELECT bs.id, bs.name, 100 + ROW_NUMBER() OVER (ORDER BY bs.name) AS priority
    FROM buyer_stores bs
    WHERE NOT EXISTS (SELECT 1 FROM matched m WHERE m.id = bs.id)
    LIMIT GREATEST(0, 5 - (SELECT COUNT(*)::int FROM matched))
),
target_stores AS (
    SELECT id, name
    FROM (
        SELECT id, name, priority FROM matched
        UNION ALL
        SELECT id, name, priority FROM fallback
    ) s
    ORDER BY priority
    LIMIT 5
),
numbered_stores AS (
    SELECT id, name, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM target_stores
),
numbered_users AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY id) AS rn,
           GREATEST(COUNT(*) OVER (), 1) AS total
    FROM users
)
INSERT INTO store_merchants (store_id, user_id, contact_name, contact_email, status, merchant_level)
SELECT
    ns.id,
    nu.id,
    '[MOCK-BOUTIQUE] Merchant · ' || ns.name,
    'mock-boutique+' || ns.id || '@example.com',
    'APPROVED',
    'PREMIUM'
FROM numbered_stores ns
JOIN numbered_users nu
  ON nu.rn = ((ns.rn - 1) % nu.total) + 1
WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
  AND NOT EXISTS (
      SELECT 1 FROM store_merchants sm WHERE sm.store_id = ns.id
  );


-- =====================================================
-- 2. store_profile_configs —— 店铺主页配置
-- =====================================================
INSERT INTO store_profile_configs (
    store_id, merchant_id,
    logo_image, cover_image,
    short_description, long_description,
    tags
)
SELECT
    sm.store_id,
    sm.id,
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&q=80',
    'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80',
    '[MOCK-BOUTIQUE] Curated avant-garde selection from ' || bs.name || '.',
    '[MOCK-BOUTIQUE] ' || bs.name || ' is a destination boutique for Rick Owens, Guidi, Julius and emerging designers. Visit us for trunk shows, archive pieces and seasonal edits.',
    ARRAY['Avant-garde', 'Designer', 'Archive']
FROM store_merchants sm
JOIN buyer_stores bs ON bs.id = sm.store_id
WHERE sm.contact_name LIKE '[MOCK-BOUTIQUE]%'
  AND NOT EXISTS (
      SELECT 1 FROM store_profile_configs c WHERE c.store_id = sm.store_id
  );


-- =====================================================
-- 3. store_product_categories —— 商品分类
-- =====================================================
INSERT INTO store_product_categories (store_id, merchant_id, name, sort_order)
SELECT sm.store_id, sm.id, cat.name, cat.ord
FROM store_merchants sm
CROSS JOIN (VALUES
    ('[MOCK-BOUTIQUE] Outerwear', 0),
    ('[MOCK-BOUTIQUE] Footwear',  1),
    ('[MOCK-BOUTIQUE] Accessories', 2)
) AS cat(name, ord)
WHERE sm.contact_name LIKE '[MOCK-BOUTIQUE]%'
  AND NOT EXISTS (
      SELECT 1 FROM store_product_categories c
      WHERE c.store_id = sm.store_id AND c.name = cat.name
  );


-- =====================================================
-- 4. store_entry_cards —— CategoryCards 四入口
-- =====================================================
INSERT INTO store_entry_cards (
    store_id, merchant_id,
    card_type, label, label_en,
    image_url, sort_order, status
)
SELECT
    sm.store_id,
    sm.id,
    card.card_type,
    card.label,
    card.label_en,
    card.image_url,
    card.sort_order,
    'PUBLISHED'
FROM store_merchants sm
CROSS JOIN (VALUES
    ('CLASSIFICATION', '[MOCK-BOUTIQUE] Shop All',    'Shop All',    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80', 0),
    ('DISCOUNT',       '[MOCK-BOUTIQUE] Sale',        'Sale',        'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80', 1),
    ('EVENT',          '[MOCK-BOUTIQUE] Events',      'Events',      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', 2),
    ('NEW_ARRIVAL',    '[MOCK-BOUTIQUE] New In',      'New In',      'https://images.unsplash.com/photo-1485518882345-15568b007705?w=400&q=80', 3)
) AS card(card_type, label, label_en, image_url, sort_order)
WHERE sm.contact_name LIKE '[MOCK-BOUTIQUE]%'
  AND NOT EXISTS (
      SELECT 1 FROM store_entry_cards ec
      WHERE ec.store_id = sm.store_id
        AND ec.card_type = card.card_type
        AND ec.label = card.label
  );


-- =====================================================
-- 5. store_banners —— 上新 Banner
-- =====================================================
INSERT INTO store_banners (
    store_id, merchant_id,
    title, image_url, link_type,
    sort_order, status
)
SELECT
    sm.store_id,
    sm.id,
    '[MOCK-BOUTIQUE] SS26 New Arrivals · ' || bs.name,
    'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=1200&q=80',
    'NONE',
    0,
    'PUBLISHED'
FROM store_merchants sm
JOIN buyer_stores bs ON bs.id = sm.store_id
WHERE sm.contact_name LIKE '[MOCK-BOUTIQUE]%'
  AND NOT EXISTS (
      SELECT 1 FROM store_banners b
      WHERE b.store_id = sm.store_id
        AND b.title LIKE '[MOCK-BOUTIQUE]%'
  );


-- =====================================================
-- 6. store_products —— 商家单品（买手店 Tab 商品网格）
-- =====================================================
WITH merchants AS (
    SELECT sm.id AS merchant_id, sm.store_id, sm.user_id, bs.name AS store_name
    FROM store_merchants sm
    JOIN buyer_stores bs ON bs.id = sm.store_id
    WHERE sm.contact_name LIKE '[MOCK-BOUTIQUE]%'
),
catalog AS (
    SELECT * FROM (VALUES
        (1, 'Rick Owens DRKSHDW Pod Shorts',      'Rick Owens',      128000, NULL::bigint, FALSE, TRUE,  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80'),
        (2, 'Guidi 788Z Back-Zip Boots',         'Guidi',           980000, NULL::bigint, FALSE, FALSE, 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80'),
        (3, 'Julius SS2010 Structured Jacket',   'Julius',          328000, 288000::bigint, TRUE, FALSE, 'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80'),
        (4, 'Maison Margiela Replica Sneakers',  'Maison Margiela', 420000, NULL::bigint, FALSE, TRUE,  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80'),
        (5, 'Yohji Yamamoto Wide Trousers',      'Yohji Yamamoto',  560000, NULL::bigint, FALSE, FALSE, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80'),
        (6, 'Layer-0 Leather Biker',           'Layer-0',         890000, 790000::bigint, TRUE, FALSE, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),
        (7, 'Carol Christian Poell Boots',       'CCP',             720000, NULL::bigint, FALSE, TRUE,  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80'),
        (8, 'Boris Bidjan Saberi Layered Tee',   'BBS',             98000,  NULL::bigint, FALSE, FALSE, 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80')
    ) AS t(sku, title, brand, price_cents, discount_price_cents, has_discount_flag, is_new_flag, image_url)
)
INSERT INTO store_products (
    store_id, merchant_id, seller_kind,
    title, description, brand,
    images, price_cents, currency,
    discount_price_cents, is_new,
    like_count, favorite_count, view_count,
    status, published_at
)
SELECT
    m.store_id,
    m.merchant_id,
    'merchant',
    '[MOCK-BOUTIQUE] ' || c.title,
    '[MOCK-BOUTIQUE] Archive piece from ' || m.store_name || '. Authentic, lightly worn, ships worldwide.',
    c.brand,
    ARRAY[c.image_url],
    c.price_cents,
    'CNY',
    CASE WHEN c.has_discount_flag THEN c.discount_price_cents ELSE NULL END,
    c.is_new_flag,
    (c.sku * 3 + 5),
    (c.sku * 2 + 1),
    (c.sku * 17 + 40),
    'active',
    NOW() - ((c.sku + ROW_NUMBER() OVER (PARTITION BY m.store_id ORDER BY c.sku)) || ' days')::interval
FROM merchants m
CROSS JOIN catalog c
WHERE NOT EXISTS (
    SELECT 1 FROM store_products p
    WHERE p.store_id = m.store_id
      AND p.title = '[MOCK-BOUTIQUE] ' || c.title
);


-- =====================================================
-- 7. posts —— 店铺帖子（Posts 子 Tab）
-- =====================================================
WITH merchants AS (
    SELECT sm.id AS merchant_id, sm.store_id, sm.user_id, bs.name AS store_name
    FROM store_merchants sm
    JOIN buyer_stores bs ON bs.id = sm.store_id
    WHERE sm.contact_name LIKE '[MOCK-BOUTIQUE]%'
),
post_seed AS (
    SELECT * FROM (VALUES
        (1, 'SS26 Trunk Show Recap',        'Highlights from our latest trunk show — Rick Owens, Guidi and more on the floor.', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80'),
        (2, 'New Rack: Archive Outerwear', 'Fresh rack edit — structured jackets and draped layers just in.',                  'https://images.unsplash.com/photo-1485518882345-15568b007705?w=800&q=80'),
        (3, 'Store Visit · Berlin Edit',   'A quick walkthrough of this week''s Berlin arrivals.',                             'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=800&q=80')
    ) AS p(sku, title, body, image_url)
)
INSERT INTO posts (
    user_id, store_id,
    post_type, status, audit_status,
    title, content_text, image_urls,
    like_count, favorite_count, comment_count,
    created_at
)
SELECT
    m.user_id,
    m.store_id,
    'DAILY_SHARE',
    'PUBLISHED',
    'APPROVED',
    '[MOCK-BOUTIQUE] ' || ps.title || ' · ' || m.store_name,
    '[MOCK-BOUTIQUE] ' || ps.body,
    ARRAY[ps.image_url],
    ps.sku * 11 + 8,
    ps.sku * 4 + 2,
    ps.sku,
    NOW() - ((ps.sku + 1) || ' days')::interval
FROM merchants m
CROSS JOIN post_seed ps
WHERE m.user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM posts p
      WHERE p.store_id = m.store_id
        AND p.title = '[MOCK-BOUTIQUE] ' || ps.title || ' · ' || m.store_name
  );


-- =====================================================
-- 8. buyer_store_favorites —— 粉丝数
-- =====================================================
INSERT INTO buyer_store_favorites (store_id, user_id)
SELECT sm.store_id, u.id
FROM store_merchants sm
JOIN LATERAL (
    SELECT id FROM users ORDER BY id LIMIT 12
) u ON TRUE
WHERE sm.contact_name LIKE '[MOCK-BOUTIQUE]%'
  AND NOT EXISTS (
      SELECT 1 FROM buyer_store_favorites f
      WHERE f.store_id = sm.store_id AND f.user_id = u.id
  );


-- =====================================================
-- 9. 自检查询（可选）
-- =====================================================
-- SELECT sm.store_id, bs.name,
--        (SELECT COUNT(*) FROM store_products p WHERE p.store_id = sm.store_id AND p.status = 'active') AS products,
--        (SELECT COUNT(*) FROM posts po WHERE po.store_id = sm.store_id AND po.status = 'PUBLISHED') AS posts,
--        (SELECT COUNT(*) FROM buyer_store_favorites f WHERE f.store_id = sm.store_id) AS followers
-- FROM store_merchants sm
-- JOIN buyer_stores bs ON bs.id = sm.store_id
-- WHERE sm.contact_name LIKE '[MOCK-BOUTIQUE]%'
-- ORDER BY bs.name;
