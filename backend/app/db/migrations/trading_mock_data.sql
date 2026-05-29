-- =====================================================
-- 交易系统 Mock Data —— 一次性灌入足够测试用的数据
-- =====================================================
--
-- 适用范围：把 `trading_consolidated_057_062.sql` 执行成功后，再跑这份脚本。
--
-- 设计要点：
--   * 完全幂等：所有 INSERT 都带 ON CONFLICT DO NOTHING / 或基于 NOT EXISTS。
--     可以反复执行而不会产生重复数据。
--   * 不写死用户/商品/品牌 ID：用子查询从已有数据里取最早的 N 个用户、
--     已有的品牌、买手店等，这样无论是 Supabase 还是 MemFire、无论是
--     已 seed 过用户的库都能跑通。
--   * 数据量：覆盖「热门品牌」「最新上架」「精选推荐」三段 UI 所需的
--     横向多样化（不同品牌 / 卖家 / 成色），并预置少量 offer / order /
--     dispute / review / archive / plus_subscription 用于联调。
--
-- 前置最小要求：
--   * users 表至少有 3 个真实用户行（任意 status，不一定要登录态）。
--   * 没有可用用户时，下面所有 INSERT 都会被跳过（自动短路），不会报错。
--
-- 调试小贴士：
--   * 想清空 mock 数据，执行：
--       DELETE FROM trade_reviews WHERE comment LIKE '%[MOCK]%';
--       DELETE FROM orders WHERE order_no LIKE 'MOCK-%';
--       DELETE FROM offers WHERE message LIKE '%[MOCK]%';
--       DELETE FROM store_products WHERE title LIKE '%[MOCK]%';
--       DELETE FROM seller_profiles WHERE bio LIKE '%[MOCK]%';
--       DELETE FROM brand_images WHERE image_url LIKE '%avantregards-mock/%';
--       DELETE FROM brands WHERE name IN
--         ('Rick Owens', 'Julius', 'Guidi', 'Maison Margiela',
--          'Yohji Yamamoto', 'Junya Watanabe');
-- =====================================================


-- =====================================================
-- 1. 品牌 + 品牌封面图
-- =====================================================
-- 6 个先锋设计师品牌；前端的「热门品牌」横滑列表会按当前在售单品数量
-- 从中挑出前 5–6 个展示。
INSERT INTO brands (name, category, founded_year, founder, country)
VALUES
    ('Rick Owens',       'avant_garde', '1994', 'Rick Owens',         'USA'),
    ('Julius',           'avant_garde', '2001', 'Tatsuro Horikawa',   'Japan'),
    ('Guidi',            'leather',     '1896', 'Ruggero Guidi',      'Italy'),
    ('Maison Margiela',  'luxury',      '1988', 'Martin Margiela',    'France'),
    ('Yohji Yamamoto',   'avant_garde', '1972', 'Yohji Yamamoto',     'Japan'),
    ('Junya Watanabe',   'avant_garde', '1992', 'Junya Watanabe',     'Japan')
ON CONFLICT DO NOTHING;


-- 品牌封面图：每个品牌 1 张已审核 + is_selected。前端「热门品牌」用它。
INSERT INTO brand_images (brand_id, image_url, sort_order, status, is_selected)
SELECT b.id,
       'https://images.unsplash.com/photo-' ||
       (CASE b.name
            WHEN 'Rick Owens'      THEN '1490481651871-ab68de25d43d'
            WHEN 'Julius'          THEN '1485518882345-15568b007705'
            WHEN 'Guidi'           THEN '1519415510236-718bdfcd89c8'
            WHEN 'Maison Margiela' THEN '1469334031218-e382a71b716b'
            WHEN 'Yohji Yamamoto'  THEN '1503342217505-b0a15ec3261c'
            WHEN 'Junya Watanabe'  THEN '1507003211169-0a1dd7228f2d'
        END) ||
       '?w=200&q=80',
       0,
       'APPROVED',
       TRUE
FROM brands b
WHERE b.name IN (
    'Rick Owens', 'Julius', 'Guidi', 'Maison Margiela',
    'Yohji Yamamoto', 'Junya Watanabe'
)
AND NOT EXISTS (
    SELECT 1 FROM brand_images bi
    WHERE bi.brand_id = b.id AND bi.is_selected = TRUE
);


-- =====================================================
-- 2. 个人卖家档案（seller_profiles）
-- =====================================================
-- 给前 3 个用户挂上个人卖家档案；用 NOT EXISTS 防重复。
INSERT INTO seller_profiles (user_id, display_name, bio, id_verified, credit_score, total_sales)
SELECT u.id,
       'Seller-' || u.id,
       '[MOCK] Dark / deconstructed style collector. Long-time seller of Rick Owens / Julius.',
       TRUE,
       96,
       12
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.user_id = u.id)
ORDER BY u.id
LIMIT 3;


-- =====================================================
-- 3. Listings（store_products）—— 测试 marketplace 三段 UI
-- =====================================================
-- 这里造 12 条 active 的个人卖家单品，覆盖 5 个品牌、3 档成色、两类
-- 价位（低/中/高）。favorite_count 给出梯度，精选推荐排序就有看头。
--
-- 用一个 CTE 算出 seller_user_id（直接从刚刚 mock 出来的 3 个 [MOCK] 卖家档案里取）
WITH sellers AS (
    SELECT user_id AS id
    FROM seller_profiles
    WHERE bio LIKE '%[MOCK]%'
    ORDER BY user_id
    LIMIT 3
)
INSERT INTO store_products (
    store_id, merchant_id, seller_kind, seller_user_id,
    title, description, brand,
    images, price_cents, currency,
    is_new, tags,
    size, color, condition, accept_offer,
    photo_angles, favorite_count, like_count, view_count,
    status, published_at
)
SELECT
    NULL,
    NULL,
    'individual',
    (
        SELECT id FROM sellers ORDER BY id
        LIMIT 1
        OFFSET ((m.idx - 1) % GREATEST((SELECT COUNT(*) FROM sellers)::int, 1))
    ),
    '[MOCK] ' || m.brand_name || ' ' || m.title_suffix,
    '[MOCK] Lightly worn, no obvious flaws. Open to reasonable offers, ships via SF Express (COD available).',
    m.brand_name,
    ARRAY[m.cover_image],
    m.price_cents,
    'CNY',
    FALSE,
    ARRAY[m.brand_name, m.size]::text[],
    m.size,
    m.color,
    m.condition,
    TRUE,
    jsonb_build_object(
        'front',  m.cover_image,
        'back',   m.cover_image,
        'wash_label',  m.cover_image,
        'brand_label', m.cover_image,
        'flaw',   m.cover_image
    ),
    m.fav_count,
    m.fav_count + 2,
    m.fav_count * 10 + 30,
    'active',
    NOW() - (m.idx::text || ' hours')::interval
FROM (
    VALUES
        (1,  'Rick Owens',      'BAUHAUS FLIGHT',        980000, 'M', 'black',  'NEW_99', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80', 18),
        (2,  'Julius',           'SS 2010 Strapped',     328000, 'M', 'gray',   'NEW_95', 'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80', 9),
        (3,  'Guidi',            'CALF LEATHER BAG',     560000, 'S', 'black',  'NEW_99', 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80', 26),
        (4,  'Maison Margiela',  'Leather Jacket',      1280000, 'L', 'black',  'NEW_95', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80', 32),
        (5,  'Yohji Yamamoto',   'Black Wool Coat',      820000, 'L', 'black',  'NEW_95', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80', 14),
        (6,  'Junya Watanabe',   'Patchwork Jacket',     960000, 'M', 'navy',   'NEW_99', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', 21),
        (7,  'Rick Owens',       'DRKSHDW Sweat',        180000, 'XL','black',  'USED_8', 'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80', 6),
        (8,  'Julius',           'Black Deconstructed Pants', 198000, 'M', 'black',  'NEW_95', 'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80', 4),
        (9,  'Guidi',            '988 Front Zip',        720000, '42','black',  'USED_8', 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80', 11),
        (10, 'Maison Margiela',  'Tabi Replica',         580000, '41','white',  'NEW_99', 'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80', 17),
        (11, 'Yohji Yamamoto',   'Sailor Shirt',         320000, 'M', 'black',  'NEW_99', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80', 8),
        (12, 'Rick Owens',       'Strobe Sneaker',       620000, '42','black',  'NEW_99', 'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80', 13)
) AS m(idx, brand_name, title_suffix, price_cents, size, color, condition, cover_image, fav_count)
WHERE (SELECT COUNT(*) FROM sellers) > 0
  AND NOT EXISTS (
      SELECT 1 FROM store_products sp
      WHERE sp.title = '[MOCK] ' || m.brand_name || ' ' || m.title_suffix
  );


-- =====================================================
-- 4. Offers —— 1 条 pending 出价（演示 IM 卡片 + 提醒）
-- =====================================================
-- 选一条 mock product + 一个非卖家的买家，造 1 条 pending 出价。
INSERT INTO offers (
    product_id, buyer_user_id, seller_user_id,
    price_cents, currency, message, status, expires_at
)
SELECT
    sp.id,
    buyer.id,
    sp.seller_user_id,
    (sp.price_cents * 0.85)::bigint,
    'CNY',
    '[MOCK] Would you take 15% off? Cash in hand.',
    'pending',
    NOW() + INTERVAL '24 hours'
FROM store_products sp
CROSS JOIN LATERAL (
    SELECT u.id FROM users u
    WHERE u.id <> sp.seller_user_id
    ORDER BY u.id
    LIMIT 1
) buyer
WHERE sp.title LIKE '[MOCK] Rick Owens%'
  AND sp.seller_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM offers o
      WHERE o.product_id = sp.id AND o.message = '[MOCK] Would you take 15% off? Cash in hand.'
  )
LIMIT 1;


-- =====================================================
-- 5. Orders + Shipment —— 1 条 completed 订单（演示已完成 / 互评）
-- =====================================================
-- 选一条 mock product，造个 completed 订单，再造一条物流凭证。
WITH picked AS (
    SELECT sp.id AS product_id, sp.seller_user_id, sp.price_cents
    FROM store_products sp
    WHERE sp.title LIKE '[MOCK] Guidi%'
      AND sp.seller_user_id IS NOT NULL
    ORDER BY sp.id
    LIMIT 1
),
buyer_cte AS (
    SELECT u.id AS buyer_id
    FROM users u, picked p
    WHERE u.id <> p.seller_user_id
    ORDER BY u.id
    LIMIT 1
),
ins AS (
    INSERT INTO orders (
        order_no, product_id, buyer_user_id, seller_user_id,
        listing_price_cents, paid_price_cents,
        commission_rate_bps, commission_cents, seller_payout_cents,
        currency, status,
        paid_at, shipped_at, delivered_at, completed_at,
        payment_provider
    )
    SELECT
        'MOCK-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || p.product_id,
        p.product_id, b.buyer_id, p.seller_user_id,
        p.price_cents, p.price_cents,
        100,
        (p.price_cents * 0.01)::bigint,
        (p.price_cents * 0.99)::bigint,
        'CNY',
        'completed',
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '8 days',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '2 days',
        'mock'
    FROM picked p, buyer_cte b
    WHERE NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.product_id = p.product_id AND o.payment_provider = 'mock'
    )
    RETURNING id
)
INSERT INTO order_shipments (order_id, carrier, tracking_no, signed_at)
SELECT id, 'SF Express', 'SF1234567890' || id, NOW() - INTERVAL '5 days'
FROM ins;


-- =====================================================
-- 6. Trade Reviews —— 一对双盲互评（trigger 自动 reveal）
-- =====================================================
INSERT INTO trade_reviews (
    order_id, reviewer_user_id, reviewer_role,
    target_user_id, rating, comment
)
SELECT o.id, o.buyer_user_id, 'buyer', o.seller_user_id, 5,
       '[MOCK] Item matches the listing photos exactly. Careful packaging. Five stars!'
FROM orders o
WHERE o.payment_provider = 'mock'
  AND o.status = 'completed'
  AND NOT EXISTS (
      SELECT 1 FROM trade_reviews tr
      WHERE tr.order_id = o.id AND tr.reviewer_role = 'buyer'
  )
LIMIT 1;

INSERT INTO trade_reviews (
    order_id, reviewer_user_id, reviewer_role,
    target_user_id, rating, comment
)
SELECT o.id, o.seller_user_id, 'seller', o.buyer_user_id, 5,
       '[MOCK] Smooth communication, no fuss. Welcome back anytime.'
FROM orders o
WHERE o.payment_provider = 'mock'
  AND o.status = 'completed'
  AND NOT EXISTS (
      SELECT 1 FROM trade_reviews tr
      WHERE tr.order_id = o.id AND tr.reviewer_role = 'seller'
  )
LIMIT 1;


-- =====================================================
-- 7. User Collection（多收藏夹）+ 把一条 favorite 加入夹
-- =====================================================
INSERT INTO user_collections (user_id, name, description, visibility)
SELECT u.id, 'My Avant-Garde', '[MOCK] Long-running avant-garde wishlist', 'public'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_collections uc
    WHERE uc.user_id = u.id AND uc.name = 'My Avant-Garde'
)
ORDER BY u.id
LIMIT 1;


-- =====================================================
-- 8. User Archive（My Archive 时间轴）
-- =====================================================
-- 给「订单买家」加一条订单完成的 archive item；用 source='order'。
INSERT INTO user_archive_items (
    user_id, product_id, order_id,
    title, brand_name, size, color, condition,
    acquired_price_cents, currency, photos,
    acquired_at, source, is_currently_owned
)
SELECT
    o.buyer_user_id, o.product_id, o.id,
    sp.title, sp.brand, sp.size, sp.color, sp.condition,
    o.paid_price_cents, o.currency, sp.images,
    o.completed_at::date,
    'order',
    TRUE
FROM orders o
JOIN store_products sp ON sp.id = o.product_id
WHERE o.payment_provider = 'mock'
  AND o.status = 'completed'
  AND NOT EXISTS (
      SELECT 1 FROM user_archive_items uai
      WHERE uai.order_id = o.id
  )
LIMIT 1;


-- 再给同一用户造一条 manual 上传的 archive item（不依赖订单）。
INSERT INTO user_archive_items (
    user_id, title, brand_name, size, color, condition,
    acquired_price_cents, currency, photos,
    acquired_at, source, is_currently_owned, storage_location, note
)
SELECT
    o.buyer_user_id,
    '[MOCK] Self-logged Maison Margiela Tabi',
    'Maison Margiela', '41', 'white', 'NEW_99',
    580000, 'CNY',
    ARRAY['https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80'],
    CURRENT_DATE - 90,
    'manual',
    TRUE,
    'Main cabinet A2',
    '[MOCK] Self-logged archive entry used for MY ARCHIVE testing'
FROM orders o
WHERE o.payment_provider = 'mock'
  AND NOT EXISTS (
      SELECT 1 FROM user_archive_items uai
      WHERE uai.user_id = o.buyer_user_id
        AND uai.title = '[MOCK] Self-logged Maison Margiela Tabi'
  )
LIMIT 1;


-- 给「自录入」那条加一段持有记录
INSERT INTO archive_holding_history (
    archive_item_id, user_id, held_from, status, note
)
SELECT uai.id, uai.user_id, uai.acquired_at, 'owned',
       '[MOCK] Bought on secondary market. Stored in main cabinet A2.'
FROM user_archive_items uai
WHERE uai.title = '[MOCK] Self-logged Maison Margiela Tabi'
  AND NOT EXISTS (
      SELECT 1 FROM archive_holding_history ahh
      WHERE ahh.archive_item_id = uai.id
  )
LIMIT 1;


-- =====================================================
-- 9. Plus 订阅（一个 active monthly）
-- =====================================================
INSERT INTO plus_subscriptions (
    user_id, plan, period_start, period_end,
    price_cents, currency, source, status, auto_renew
)
SELECT u.id, 'monthly', NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days',
       2900, 'CNY', 'mock', 'active', TRUE
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM plus_subscriptions ps
    WHERE ps.user_id = u.id AND ps.status = 'active'
)
ORDER BY u.id
LIMIT 1;


-- =====================================================
-- 10. Provenance Events（履历 strip）
-- =====================================================
-- 给「最贵的那条 Maison Margiela 皮夹克」造一条小履历。
INSERT INTO product_provenance_events (
    product_id, event_type, actor_kind, occurred_at, description
)
SELECT sp.id, 'on_sale_now', 'system', CURRENT_DATE,
       '[MOCK] Currently listed for sale'
FROM store_products sp
WHERE sp.title LIKE '[MOCK] Maison Margiela%'
  AND NOT EXISTS (
      SELECT 1 FROM product_provenance_events pe
      WHERE pe.product_id = sp.id AND pe.event_type = 'on_sale_now'
  )
LIMIT 1;


-- =====================================================
-- 11. Price History（基准柱状图数据）
-- =====================================================
-- 模拟 6 个月内 Rick Owens 的 5 单成交价
INSERT INTO product_price_history (
    brand_name, condition, price_cents, currency, sold_at, source
)
SELECT 'Rick Owens', cond, price, 'CNY', NOW() - (months || ' months')::interval, 'manual'
FROM (
    VALUES
        ('NEW_99',  920000, 1),
        ('NEW_99',  890000, 2),
        ('NEW_95',  820000, 3),
        ('USED_8',  650000, 4),
        ('NEW_99', 1050000, 5)
) AS p(cond, price, months)
WHERE NOT EXISTS (
    SELECT 1 FROM product_price_history ph
    WHERE ph.brand_name = 'Rick Owens' AND ph.source = 'manual'
);


-- =====================================================
-- 完成
-- =====================================================
-- 跑完后建议在 SQL 编辑器执行以下查询自检：
--
-- -- 热门品牌（应至少 5 个）
-- SELECT brand, COUNT(*) AS listings
-- FROM store_products
-- WHERE status = 'active' AND brand IS NOT NULL
-- GROUP BY brand
-- ORDER BY listings DESC, brand;
--
-- -- 最新上架（按 published_at 倒序）
-- SELECT id, brand, title, price_cents, published_at
-- FROM store_products
-- WHERE status = 'active'
-- ORDER BY published_at DESC
-- LIMIT 10;
--
-- -- 精选推荐（按 favorite_count 倒序）
-- SELECT id, brand, title, favorite_count, price_cents
-- FROM store_products
-- WHERE status = 'active'
-- ORDER BY favorite_count DESC, published_at DESC
-- LIMIT 10;
--
-- -- 鉴定 SKU
-- SELECT code, name, price_cents FROM authentication_packages ORDER BY sort_order;
--
-- -- 当前 active Plus 订阅
-- SELECT user_id, plan, period_end FROM plus_subscriptions WHERE status = 'active';
-- =====================================================
