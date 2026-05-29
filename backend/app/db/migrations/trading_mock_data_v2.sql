-- =====================================================
-- 交易系统 Mock Data V2 —— 大幅扩充，覆盖全状态
-- =====================================================
--
-- 适用范围：trading_consolidated_057_062.sql + trading_mock_data.sql 都已执行后再跑。
--   本文件是增量补充，不会删除/覆盖 V1 数据。
--
-- 新增内容：
--   * 额外 6 个个人卖家档案（共 9 个）
--   * 额外 24 条 listings（品牌更多样、价位跨度更大）
--   * 多状态 offers: pending / accepted / rejected / countered / expired
--   * 多状态 orders: pending_payment / paid / shipped / delivered / completed / disputed
--   * 物流、验收、纠纷、鉴定单
--   * 更多双盲互评（已 reveal + 未 reveal）
--   * 价格历史（多品牌）
--   * 履历事件（多件商品多阶段）
--   * archive items / collections / plus 覆盖更多用户
--
-- 幂等：全部 ON CONFLICT DO NOTHING / NOT EXISTS，可重复执行。
--
-- 清理：
--   DELETE FROM trade_reviews WHERE comment LIKE '%[MOCK-V2]%';
--   DELETE FROM disputes WHERE description LIKE '%[MOCK-V2]%';
--   DELETE FROM order_shipments WHERE tracking_no LIKE 'MOCKV2-%';
--   DELETE FROM orders WHERE order_no LIKE 'MOCKV2-%';
--   DELETE FROM offers WHERE message LIKE '%[MOCK-V2]%';
--   DELETE FROM store_products WHERE title LIKE '[MOCK-V2]%';
--   DELETE FROM seller_profiles WHERE bio LIKE '%[MOCK-V2]%';
-- =====================================================


-- =====================================================
-- 1. 额外卖家档案
-- =====================================================
INSERT INTO seller_profiles (user_id, display_name, bio, id_verified, credit_score, total_sales)
SELECT u.id,
       'Seller-V2-' || u.id,
       '[MOCK-V2] Archive collector. Specializes in CCP, A1923, Deepti and Layer-0.',
       (u.rn % 2 = 0),
       80 + (u.rn * 3) % 20,
       u.rn * 2
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM users
    WHERE NOT EXISTS (SELECT 1 FROM seller_profiles sp WHERE sp.user_id = users.id)
    ORDER BY id
    LIMIT 6
) u;


-- =====================================================
-- 2. 额外 Listings（24 条，更多品牌和价位）
-- =====================================================
WITH sellers AS (
    SELECT user_id AS id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn,
           COUNT(*) OVER () AS total
    FROM seller_profiles
    ORDER BY user_id
)
INSERT INTO store_products (
    store_id, merchant_id, seller_kind, seller_user_id,
    title, description, brand,
    images, price_cents, currency,
    is_new, tags, size, color, condition, accept_offer,
    favorite_count, like_count, view_count,
    status, published_at
)
SELECT
    NULL, NULL, 'individual',
    (SELECT id FROM sellers WHERE rn = ((m.idx - 1) % (SELECT total FROM sellers LIMIT 1)) + 1),
    '[MOCK-V2] ' || m.brand_name || ' ' || m.title_suffix,
    '[MOCK-V2] ' || m.desc_text,
    m.brand_name,
    ARRAY[m.cover_image],
    m.price_cents, 'CNY',
    (m.condition = 'BNWT'),
    ARRAY[m.brand_name, m.size]::text[],
    m.size, m.color, m.condition, TRUE,
    m.fav, m.fav + 3, m.fav * 8 + 20,
    m.prod_status,
    NOW() - (m.idx::text || ' hours')::interval
FROM (VALUES
    -- Active listings
    (1,  'Carol Christian Poell', 'Object Dyed Tornado Boots',  'Handmade in Italy. OD finish, size stamped on sole.', 1480000, '43',  'black',   'NEW_99', 41, 'active',   'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80'),
    (2,  'A1923',                 'Kangaroo Leather Derby',      'Cordovan processed. Barely worn.',                     680000, '42',  'brown',   'NEW_95', 19, 'active',   'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80'),
    (3,  'Deepti',                'Raw-Cut Linen Blazer',        'Hand stitched. Unique piece.',                         420000, 'M',   'charcoal','NEW_95', 12, 'active',   'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80'),
    (4,  'Layer-0',               'Cordovan Biker Jacket',       'Full grain horse leather. Heavy patina.',              2380000,'L',   'black',   'USED_8', 55, 'active',   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80'),
    (5,  'Incarnation',           'Horse Leather Backzip',       'Custom last. Perfect condition.',                      520000, '41',  'black',   'BNWT',   23, 'active',   'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80'),
    (6,  'MA+',                   'One-Piece Leather Belt',      'Full grain calf. Hand-burnished edge.',                180000, '85cm','black',   'NEW_99', 8,  'active',   'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80'),
    (7,  'The Viridi-anne',       'Destroyed Knit Pullover',     'Intentional distressing. Oversized fit.',              280000, 'L',   'gray',    'NEW_95', 7,  'active',   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),
    (8,  'DEVOA',                 'Cashmere Coat',               'Premium Japanese cashmere. Barely worn once.',         960000, 'M',   'black',   'NEW_99', 31, 'active',   'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80'),
    (9,  'Rick Owens',            'DRKSHDW Geobasket',          'Canvas / leather combo. Scuffed sole.',                380000, '43',  'milk',    'USED_8', 15, 'active',   'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80'),
    (10, 'Julius',                'Gas Mask Cargo Pants',        'SS 2009 iconic piece. Museum condition.',              450000, 'M',   'black',   'NEW_99', 28, 'active',   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80'),
    (11, 'Guidi',                 'PL2 Horse Leather Backpack',  'Soft tumbled horse. Beautiful grain.',                 860000, 'ONE', 'black',   'NEW_95', 37, 'active',   'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80'),
    (12, 'Boris Bidjan Saberi',   'Blood-Dyed J4 Jacket',       'Pig blood finish. One-off piece.',                     1120000,'M',   'oxblood', 'NEW_99', 44, 'active',   'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80'),
    -- Frozen (in transaction)
    (13, 'Rick Owens',            'Bauhaus Leather SS14',        'Iconic silhouette. Currently in transaction.',         1680000,'L',   'black',   'NEW_99', 52, 'frozen',   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80'),
    -- Sold
    (14, 'Maison Margiela',       'Artisanal Painted Coat',      'Sold. FW 2012 runway piece.',                         2200000,'M',   'white',   'NEW_99', 66, 'sold',     'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80'),
    (15, 'Yohji Yamamoto',        'Pour Homme Long Shirt',       'Sold. Classic oversized drape.',                       380000,'L',   'black',   'NEW_95', 20, 'sold',     'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),
    (16, 'Julius',                'AW 2011 Rider Jacket',        'Sold. Waxed cotton shell.',                            560000,'M',   'black',   'USED_8', 18, 'sold',     'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80'),
    -- Offline
    (17, 'Guidi',                 '992 Horse Derby (Offline)',    'Taken offline by seller.',                             480000,'42',  'black',   'NEW_95', 9,  'offline',  'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80'),
    -- More active for feed variety
    (18, 'Ann Demeulemeester',    'Asymmetric Leather Jacket',   'Deconstructed seams. Runway sample.',                  1050000,'S',   'black',   'NEW_99', 33, 'active',   'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80'),
    (19, 'Haider Ackermann',     'Velvet Smoking Jacket',       'Rich emerald velvet. Pristine.',                       720000, 'M',   'emerald', 'BNWT',   25, 'active',   'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80'),
    (20, 'Undercover',            'SCAB Graphic Hoodie',         'SS 2003. Iconic archive print.',                       360000, 'L',   'white',   'NEW_95', 16, 'active',   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),
    (21, 'Comme des Garcons',     'Lumps & Bumps Jacket',        'FW 1997 Body Meets Dress collection.',                1900000,'M',   'black',   'NEW_99', 71, 'active',   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80'),
    (22, 'Issey Miyake',          'Pleats Please Bomber',        'Archive Pleats. Near-new condition.',                  480000, 'M',   'forest',  'NEW_95', 14, 'active',   'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80'),
    (23, 'Raf Simons',            'Riot Riot Riot Parka',        'AW 2001. Grail piece. Buyer-verified.',               3200000,'L',   'olive',   'NEW_99', 89, 'active',   'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80'),
    (24, 'Helmut Lang',           'Astro Biker Jacket',          'FW 1999. Bondage strap detail.',                       1350000,'M',   'black',   'USED_8', 47, 'active',   'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80')
) AS m(idx, brand_name, title_suffix, desc_text, price_cents, size, color, condition, fav, prod_status, cover_image)
WHERE (SELECT COUNT(*) FROM seller_profiles) > 0
  AND NOT EXISTS (
      SELECT 1 FROM store_products sp
      WHERE sp.title = '[MOCK-V2] ' || m.brand_name || ' ' || m.title_suffix
  );


-- =====================================================
-- 3. Offers（多种状态）
-- =====================================================

-- 3a. Pending offers (3 条)
INSERT INTO offers (product_id, buyer_user_id, seller_user_id, price_cents, currency, message, status, expires_at)
SELECT sp.id, buyer.id, sp.seller_user_id,
       (sp.price_cents * 0.80)::bigint, 'CNY',
       '[MOCK-V2] Interested — would you do 80%? Serious buyer.',
       'pending', NOW() + INTERVAL '24 hours'
FROM store_products sp
CROSS JOIN LATERAL (
    SELECT u.id FROM users u WHERE u.id <> sp.seller_user_id ORDER BY u.id OFFSET 1 LIMIT 1
) buyer
WHERE sp.title LIKE '[MOCK-V2]%' AND sp.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.product_id = sp.id AND o.message LIKE '%[MOCK-V2]%')
ORDER BY sp.price_cents DESC
LIMIT 3;

-- 3b. Accepted offer (1 条, 对应 frozen 商品)
INSERT INTO offers (product_id, buyer_user_id, seller_user_id, price_cents, currency, message, status, resolved_at)
SELECT sp.id, buyer.id, sp.seller_user_id,
       sp.price_cents, 'CNY',
       '[MOCK-V2] Full price, lets do this.',
       'accepted', NOW() - INTERVAL '2 hours'
FROM store_products sp
CROSS JOIN LATERAL (
    SELECT u.id FROM users u WHERE u.id <> sp.seller_user_id ORDER BY u.id LIMIT 1
) buyer
WHERE sp.title LIKE '[MOCK-V2]%' AND sp.status = 'frozen'
  AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.product_id = sp.id AND o.message LIKE '%[MOCK-V2]%')
LIMIT 1;

-- 3c. Rejected offer (1 条)
INSERT INTO offers (product_id, buyer_user_id, seller_user_id, price_cents, currency, message, status, resolved_at)
SELECT sp.id, buyer.id, sp.seller_user_id,
       (sp.price_cents * 0.50)::bigint, 'CNY',
       '[MOCK-V2] How about half off? Too low?',
       'rejected', NOW() - INTERVAL '6 hours'
FROM store_products sp
CROSS JOIN LATERAL (
    SELECT u.id FROM users u WHERE u.id <> sp.seller_user_id ORDER BY u.id OFFSET 2 LIMIT 1
) buyer
WHERE sp.title LIKE '[MOCK-V2]%' AND sp.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.product_id = sp.id AND o.message LIKE '%[MOCK-V2] How about half%')
ORDER BY sp.id
LIMIT 1;

-- 3d. Countered offer (1 条)
INSERT INTO offers (product_id, buyer_user_id, seller_user_id, price_cents, currency, message, status, resolved_at)
SELECT sp.id, buyer.id, sp.seller_user_id,
       (sp.price_cents * 0.70)::bigint, 'CNY',
       '[MOCK-V2] 70%? I can counter.',
       'countered', NOW() - INTERVAL '3 hours'
FROM store_products sp
CROSS JOIN LATERAL (
    SELECT u.id FROM users u WHERE u.id <> sp.seller_user_id ORDER BY u.id OFFSET 3 LIMIT 1
) buyer
WHERE sp.title LIKE '[MOCK-V2]%' AND sp.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.product_id = sp.id AND o.message LIKE '%[MOCK-V2] 70%')
ORDER BY sp.id DESC
LIMIT 1;

-- 3e. Expired offer (1 条)
INSERT INTO offers (product_id, buyer_user_id, seller_user_id, price_cents, currency, message, status, expires_at, resolved_at)
SELECT sp.id, buyer.id, sp.seller_user_id,
       (sp.price_cents * 0.75)::bigint, 'CNY',
       '[MOCK-V2] 75%? Let me know within 24h.',
       'expired', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
FROM store_products sp
CROSS JOIN LATERAL (
    SELECT u.id FROM users u WHERE u.id <> sp.seller_user_id ORDER BY u.id OFFSET 4 LIMIT 1
) buyer
WHERE sp.title LIKE '[MOCK-V2]%' AND sp.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.product_id = sp.id AND o.message LIKE '%[MOCK-V2] 75%')
ORDER BY sp.id
LIMIT 1;


-- =====================================================
-- 4. Orders（多状态覆盖）
-- =====================================================

-- 4a. completed order (sold item #14)
WITH picked AS (
    SELECT sp.id AS pid, sp.seller_user_id, sp.price_cents
    FROM store_products sp
    WHERE sp.title LIKE '[MOCK-V2] Maison Margiela%' AND sp.status = 'sold'
    LIMIT 1
),
buyer_cte AS (
    SELECT u.id AS bid FROM users u, picked p WHERE u.id <> p.seller_user_id ORDER BY u.id LIMIT 1
)
INSERT INTO orders (
    order_no, product_id, buyer_user_id, seller_user_id,
    listing_price_cents, paid_price_cents,
    commission_rate_bps, commission_cents, seller_payout_cents,
    currency, status,
    paid_at, shipped_at, delivered_at, completed_at,
    payment_provider
)
SELECT 'MOCKV2-COMP-' || p.pid, p.pid, b.bid, p.seller_user_id,
       p.price_cents, p.price_cents,
       100, (p.price_cents * 0.01)::bigint, (p.price_cents * 0.99)::bigint,
       'CNY', 'completed',
       NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days',
       NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days',
       'mock_v2'
FROM picked p, buyer_cte b
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_no = 'MOCKV2-COMP-' || p.pid);

-- 4b. shipped order (sold item #15)
WITH picked AS (
    SELECT sp.id AS pid, sp.seller_user_id, sp.price_cents
    FROM store_products sp
    WHERE sp.title LIKE '[MOCK-V2] Yohji Yamamoto%' AND sp.status = 'sold'
    LIMIT 1
),
buyer_cte AS (
    SELECT u.id AS bid FROM users u, picked p WHERE u.id <> p.seller_user_id ORDER BY u.id OFFSET 1 LIMIT 1
)
INSERT INTO orders (
    order_no, product_id, buyer_user_id, seller_user_id,
    listing_price_cents, paid_price_cents,
    commission_rate_bps, commission_cents, seller_payout_cents,
    currency, status,
    paid_at, shipped_at,
    payment_provider
)
SELECT 'MOCKV2-SHIP-' || p.pid, p.pid, b.bid, p.seller_user_id,
       p.price_cents, p.price_cents,
       100, (p.price_cents * 0.01)::bigint, (p.price_cents * 0.99)::bigint,
       'CNY', 'shipped',
       NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days',
       'mock_v2'
FROM picked p, buyer_cte b
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_no = 'MOCKV2-SHIP-' || p.pid);

-- 4c. paid (awaiting shipment) order (sold item #16)
WITH picked AS (
    SELECT sp.id AS pid, sp.seller_user_id, sp.price_cents
    FROM store_products sp
    WHERE sp.title LIKE '[MOCK-V2] Julius%' AND sp.status = 'sold'
    LIMIT 1
),
buyer_cte AS (
    SELECT u.id AS bid FROM users u, picked p WHERE u.id <> p.seller_user_id ORDER BY u.id OFFSET 2 LIMIT 1
)
INSERT INTO orders (
    order_no, product_id, buyer_user_id, seller_user_id,
    listing_price_cents, paid_price_cents,
    commission_rate_bps, commission_cents, seller_payout_cents,
    currency, status,
    paid_at, shipping_due_at,
    payment_provider
)
SELECT 'MOCKV2-PAID-' || p.pid, p.pid, b.bid, p.seller_user_id,
       p.price_cents, p.price_cents,
       100, (p.price_cents * 0.01)::bigint, (p.price_cents * 0.99)::bigint,
       'CNY', 'paid',
       NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days',
       'mock_v2'
FROM picked p, buyer_cte b
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_no = 'MOCKV2-PAID-' || p.pid);


-- =====================================================
-- 5. Shipments for orders that have shipped
-- =====================================================
INSERT INTO order_shipments (order_id, carrier, tracking_no, signed_at)
SELECT o.id, 'SF Express', 'MOCKV2-SF-' || o.id,
       CASE WHEN o.status IN ('delivered', 'completed') THEN o.delivered_at ELSE NULL END
FROM orders o
WHERE o.payment_provider = 'mock_v2'
  AND o.status IN ('shipped', 'delivered', 'completed')
  AND NOT EXISTS (SELECT 1 FROM order_shipments os WHERE os.order_id = o.id);


-- =====================================================
-- 6. Dispute (on the shipped order)
-- =====================================================
INSERT INTO disputes (
    order_id, opener_user_id, opener_role,
    reason, description, status
)
SELECT o.id, o.buyer_user_id, 'buyer',
       'item_not_as_described',
       '[MOCK-V2] The color looks different from photos — appears more gray than black. Requesting partial refund or return.',
       'open'
FROM orders o
WHERE o.payment_provider = 'mock_v2' AND o.status = 'shipped'
  AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.order_id = o.id)
LIMIT 1;


-- =====================================================
-- 7. Trade Reviews
-- =====================================================
-- Dual reviews on the completed order (auto-reveal via trigger)
INSERT INTO trade_reviews (order_id, reviewer_user_id, reviewer_role, target_user_id, rating, comment)
SELECT o.id, o.buyer_user_id, 'buyer', o.seller_user_id, 5,
       '[MOCK-V2] Flawless condition, exactly as described. 10/10 packaging. Would buy again.'
FROM orders o
WHERE o.payment_provider = 'mock_v2' AND o.status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM trade_reviews tr WHERE tr.order_id = o.id AND tr.reviewer_role = 'buyer')
LIMIT 1;

INSERT INTO trade_reviews (order_id, reviewer_user_id, reviewer_role, target_user_id, rating, comment)
SELECT o.id, o.seller_user_id, 'seller', o.buyer_user_id, 5,
       '[MOCK-V2] Quick payment, clear communication. Great buyer.'
FROM orders o
WHERE o.payment_provider = 'mock_v2' AND o.status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM trade_reviews tr WHERE tr.order_id = o.id AND tr.reviewer_role = 'seller')
LIMIT 1;


-- =====================================================
-- 8. Authentication Orders
-- =====================================================
INSERT INTO authentication_orders (
    order_no, user_id, package_id, product_id,
    brand_name, price_cents, currency, status, result,
    paid_at, completed_at
)
SELECT
    'MOCKV2-AUTH-' || sp.id,
    sp.seller_user_id,
    (SELECT id FROM authentication_packages WHERE code = 'pro' LIMIT 1),
    sp.id,
    sp.brand,
    19900, 'CNY', 'completed', 'authentic',
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days'
FROM store_products sp
WHERE sp.title LIKE '[MOCK-V2] Carol Christian Poell%'
  AND sp.seller_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM authentication_packages WHERE code = 'pro')
  AND NOT EXISTS (SELECT 1 FROM authentication_orders ao WHERE ao.order_no = 'MOCKV2-AUTH-' || sp.id)
LIMIT 1;


-- =====================================================
-- 9. Provenance Events (more items, more stages)
-- =====================================================
INSERT INTO product_provenance_events (product_id, event_type, actor_kind, occurred_at, description)
SELECT sp.id, ev.event_type, ev.actor_kind, CURRENT_DATE - ev.days_ago, ev.desc_text
FROM store_products sp
CROSS JOIN (VALUES
    ('authenticated',  'system',  30, '[MOCK-V2] Verified authentic by professional authenticator'),
    ('on_sale_now',    'system',   0, '[MOCK-V2] Currently listed for sale')
) AS ev(event_type, actor_kind, days_ago, desc_text)
WHERE sp.title LIKE '[MOCK-V2] Layer-0%'
  AND NOT EXISTS (
      SELECT 1 FROM product_provenance_events pe
      WHERE pe.product_id = sp.id AND pe.event_type = ev.event_type
  )
LIMIT 4;

INSERT INTO product_provenance_events (product_id, event_type, actor_kind, occurred_at, description)
SELECT sp.id, ev.event_type, ev.actor_kind, CURRENT_DATE - ev.days_ago, ev.desc_text
FROM store_products sp
CROSS JOIN (VALUES
    ('purchased',      'user',   60, '[MOCK-V2] Purchased from original retail'),
    ('authenticated',  'system', 45, '[MOCK-V2] Authenticated by expert panel'),
    ('on_sale_now',    'system',  0, '[MOCK-V2] Listed for resale')
) AS ev(event_type, actor_kind, days_ago, desc_text)
WHERE sp.title LIKE '[MOCK-V2] Comme des Garcons%'
  AND NOT EXISTS (
      SELECT 1 FROM product_provenance_events pe
      WHERE pe.product_id = sp.id AND pe.event_type = ev.event_type
  )
LIMIT 6;


-- =====================================================
-- 10. Price History (multiple brands)
-- =====================================================
INSERT INTO product_price_history (brand_name, condition, price_cents, currency, sold_at, source)
SELECT brand, cond, price, 'CNY', NOW() - (months || ' months')::interval, 'mock_v2'
FROM (VALUES
    ('Carol Christian Poell', 'NEW_99', 1380000, 1),
    ('Carol Christian Poell', 'USED_8', 1100000, 2),
    ('Carol Christian Poell', 'NEW_99', 1520000, 4),
    ('Layer-0',               'NEW_99',  850000, 1),
    ('Layer-0',               'USED_8',  680000, 3),
    ('Layer-0',               'NEW_95',  790000, 5),
    ('Julius',                'NEW_95',  310000, 1),
    ('Julius',                'NEW_99',  420000, 2),
    ('Julius',                'USED_8',  250000, 4),
    ('Guidi',                 'NEW_99',  720000, 1),
    ('Guidi',                 'NEW_95',  650000, 3),
    ('Guidi',                 'USED_8',  480000, 5),
    ('Comme des Garcons',     'NEW_99', 1800000, 1),
    ('Comme des Garcons',     'NEW_99', 2100000, 3),
    ('Raf Simons',            'NEW_99', 2800000, 2),
    ('Raf Simons',            'NEW_99', 3500000, 5),
    ('Helmut Lang',           'USED_8', 1100000, 1),
    ('Helmut Lang',           'NEW_99', 1450000, 4)
) AS p(brand, cond, price, months)
WHERE NOT EXISTS (
    SELECT 1 FROM product_price_history ph
    WHERE ph.brand_name = p.brand AND ph.source = 'mock_v2'
);


-- =====================================================
-- 11. User Collections (more users)
-- =====================================================
INSERT INTO user_collections (user_id, name, description, visibility)
SELECT u.id, col.name, col.desc_text, col.vis
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM users ORDER BY id LIMIT 5) u
CROSS JOIN (VALUES
    ('Dark Aesthetics', '[MOCK-V2] All black everything',                 'public'),
    ('Grails',          '[MOCK-V2] Dream pieces I am hunting for',        'private'),
    ('Investment Pieces','[MOCK-V2] Archive picks likely to appreciate',  'public')
) AS col(name, desc_text, vis)
WHERE NOT EXISTS (
    SELECT 1 FROM user_collections uc
    WHERE uc.user_id = u.id AND uc.name = col.name
);


-- =====================================================
-- 12. Archive Items (for completed order buyers)
-- =====================================================
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
    o.completed_at::date, 'order', TRUE
FROM orders o
JOIN store_products sp ON sp.id = o.product_id
WHERE o.payment_provider = 'mock_v2' AND o.status = 'completed'
  AND NOT EXISTS (SELECT 1 FROM user_archive_items uai WHERE uai.order_id = o.id)
LIMIT 3;


-- =====================================================
-- 13. Plus Subscriptions (more users)
-- =====================================================
INSERT INTO plus_subscriptions (user_id, plan, period_start, period_end, price_cents, currency, source, status, auto_renew)
SELECT u.id, plan.p, NOW() - INTERVAL '10 days', NOW() + plan.days * INTERVAL '1 day',
       plan.price, 'CNY', 'mock_v2', 'active', TRUE
FROM (SELECT id FROM users ORDER BY id OFFSET 1 LIMIT 2) u
CROSS JOIN (VALUES
    ('monthly', 20, 2900),
    ('annual',  355, 24900)
) AS plan(p, days, price)
WHERE NOT EXISTS (
    SELECT 1 FROM plus_subscriptions ps
    WHERE ps.user_id = u.id AND ps.status = 'active'
)
LIMIT 2;


-- =====================================================
-- 完成 · 自检查询
-- =====================================================
-- -- V2 listings
-- SELECT status, COUNT(*) FROM store_products WHERE title LIKE '[MOCK-V2]%' GROUP BY status ORDER BY status;
--
-- -- V2 offers by status
-- SELECT status, COUNT(*) FROM offers WHERE message LIKE '%[MOCK-V2]%' GROUP BY status;
--
-- -- V2 orders by status
-- SELECT status, COUNT(*) FROM orders WHERE order_no LIKE 'MOCKV2-%' GROUP BY status;
--
-- -- Disputes
-- SELECT d.status, o.order_no FROM disputes d JOIN orders o ON o.id = d.order_id WHERE d.description LIKE '%[MOCK-V2]%';
--
-- -- Price history brands
-- SELECT brand_name, COUNT(*) FROM product_price_history WHERE source = 'mock_v2' GROUP BY brand_name ORDER BY brand_name;
-- =====================================================
