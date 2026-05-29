-- =====================================================================
-- 079_reset_and_seed_per_user_listings.sql
-- =====================================================================
-- 用途:
--   一次性「清空所有交易数据 → 为每个真实用户重新生成 3~5 件 active
--   在售商品」, 让交易模块测试有一个干净又均匀分布的初始态。
--
-- 背景:
--   旧 mock (trading_mock_data.sql / v2.sql) 只给前 9 个用户挂了
--   seller_profile + listings, 其他真实用户的「在售」一栏永远是空,
--   联调 / Demo 时容易误以为是 bug。本脚本把所有用户都灌满, 每人
--   3~5 件单品 (按 user_id 三段分配), 品牌池按错峰方式分散开。
--
-- =====================================================================
-- 执行影响 (危险, 不可逆):
--   清空范围 (按依赖顺序 DELETE):
--     · plus_benefits_ledger / pending_payouts / wallet_withdrawals
--     · settlement_ledger / tracking_events
--     · order_shipments / order_inspections
--     · trade_reviews / disputes / authentication_orders
--     · orders / offers / stock_holds
--     · archive_holding_history / user_archive_items
--     · store_product_favorites / store_product_likes / store_product_wants
--     · store_product_comment_likes / store_product_comments
--     · product_provenance_events / product_price_history
--     · product_review_audits
--     · store_products
--   保留 + 归零:
--     · seller_profiles (保留行, total_sales / total_gmv_cents 归零)
--     · seller_balances (保留行, available/pending/total_payout/total_withdrawn 归零)
--   不动:
--     · users / user_collections / plus_subscriptions / payout_accounts
--     · seller_kyc / stripe_connect_accounts / authentication_packages
--
-- 幂等:
--   重复执行结果一致, 因为先 DELETE 再 INSERT, 没有 ON CONFLICT 依赖。
--   生成的 store_products 标题统一带 [MOCK-RESET] 前缀, 便于后期定位 / 清理:
--     DELETE FROM store_products WHERE title LIKE '[MOCK-RESET]%';
--
-- 手动执行:
--   1) 打开 Supabase Dashboard → SQL Editor
--   2) 粘贴本文件全部内容 → Run
--   3) 自检: 见文末 SELECT 查询块
-- =====================================================================

BEGIN;

-- =====================================================================
-- Phase 1 · 清空所有 trading 数据 (按依赖顺序 DELETE)
-- =====================================================================
-- 用 DELETE 而非 TRUNCATE CASCADE: 后者会把 user_collections / 等仅靠
-- ON DELETE SET NULL 引用 store_products 的表也一并清掉, 误伤面太大。

-- 1.1 钱包 / 结算 / Plus 收益 (引用 orders / authentication_orders)
DELETE FROM plus_benefits_ledger;
DELETE FROM pending_payouts;
DELETE FROM wallet_withdrawals;
DELETE FROM settlement_ledger;

-- 1.2 物流 / 验货
DELETE FROM tracking_events;
DELETE FROM order_shipments;
DELETE FROM order_inspections;

-- 1.3 售后 / 评价 / 鉴定
DELETE FROM trade_reviews;
DELETE FROM disputes;
DELETE FROM authentication_orders;

-- 1.4 订单 / 出价 / 库存锁
DELETE FROM orders;
DELETE FROM offers;
DELETE FROM stock_holds;

-- 1.5 Archive (买家收藏夹 / 持有历史)
DELETE FROM archive_holding_history;
DELETE FROM user_archive_items;

-- 1.6 单品互动 (点赞 / 收藏 / 想要 / 评论)
DELETE FROM store_product_favorites;
DELETE FROM store_product_likes;
DELETE FROM store_product_wants;
DELETE FROM store_product_comment_likes;
DELETE FROM store_product_comments;

-- 1.7 履历 / 价格历史 / 审核记录
DELETE FROM product_provenance_events;
DELETE FROM product_price_history;
DELETE FROM product_review_audits;

-- 1.8 单品 (cover_product_id 在 user_collections 自动 SET NULL)
DELETE FROM store_products;


-- =====================================================================
-- Phase 2 · 重置卖家档案 / 余额统计 (保留行)
-- =====================================================================
UPDATE seller_profiles
SET    total_sales      = 0,
       total_gmv_cents  = 0;

UPDATE seller_balances
SET    available_cents      = 0,
       pending_cents        = 0,
       total_payout_cents   = 0,
       total_withdrawn_cents = 0,
       last_release_at      = NULL;


-- =====================================================================
-- Phase 3 · 序列重置 (清完表后让 id 从 1 开始, 仅美化 Demo / 排查)
-- =====================================================================
-- pg_get_serial_sequence 在序列不存在时返回 NULL, 用 DO 块兜底避免崩溃。
DO $$
DECLARE
    seq_name TEXT;
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'store_products', 'orders', 'offers', 'stock_holds',
        'order_shipments', 'order_inspections',
        'trade_reviews', 'disputes', 'authentication_orders',
        'tracking_events', 'settlement_ledger',
        'pending_payouts', 'wallet_withdrawals',
        'plus_benefits_ledger',
        'user_archive_items', 'archive_holding_history',
        'store_product_favorites', 'store_product_likes', 'store_product_wants',
        'store_product_comments', 'store_product_comment_likes',
        'product_provenance_events', 'product_price_history',
        'product_review_audits'
    ] LOOP
        seq_name := pg_get_serial_sequence(t, 'id');
        IF seq_name IS NOT NULL THEN
            EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
        END IF;
    END LOOP;
END $$;


-- =====================================================================
-- Phase 4 · 兜底为每个用户创建 seller_profile
-- =====================================================================
-- seller_profiles.user_id 是 PRIMARY KEY, ON CONFLICT DO NOTHING 即可。
INSERT INTO seller_profiles (
    user_id, display_name, bio,
    id_verified, credit_score, total_sales, total_gmv_cents
)
SELECT u.id,
       'Seller-' || u.id,
       '[MOCK-RESET] Avant-garde cabinet collector. Open to sensible offers.',
       TRUE,
       100,
       0,
       0
FROM   users u
ON CONFLICT (user_id) DO NOTHING;


-- =====================================================================
-- Phase 5 · 每个用户生成 3~5 件 active 在售商品
-- =====================================================================
-- 设计:
--   listings_count = 3 + (user_id % 3)  → 3 / 4 / 5 件交替
--   品牌池 12 个, 每个用户从不同起点开始挑 (错峰 7), 让相邻 user 的
--   商品不会都集中在同一个品牌, 前端「热门品牌」横滑列表才会自然 spread。
WITH brand_pool AS (
    SELECT slot, brand_name, title_suffix, sz, col, cond, base_price_cents, cover_image
    FROM (VALUES
        ( 1, 'Rick Owens',            'DRKSHDW Strobe Tee',         'M',   'black',   'NEW_99',  580000, 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80'),
        ( 2, 'Julius',                'AW10 Coated Cargo Pants',    'M',   'black',   'NEW_95',  320000, 'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80'),
        ( 3, 'Guidi',                 '992 Horse Leather Derby',    '42',  'black',   'NEW_95',  720000, 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80'),
        ( 4, 'Maison Margiela',       'Tabi Leather Ankle Boots',   '42',  'black',   'NEW_99',  980000, 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80'),
        ( 5, 'Yohji Yamamoto',        'Pour Homme Wool Long Coat',  'L',   'black',   'NEW_95',  820000, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80'),
        ( 6, 'Junya Watanabe',        'Patchwork Denim Jacket',     'M',   'indigo',  'NEW_99',  680000, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80'),
        ( 7, 'Carol Christian Poell', 'Object Dyed Tornado Boots',  '43',  'black',   'NEW_99', 1480000, 'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&q=80'),
        ( 8, 'A1923',                 'Kangaroo Leather Derby',     '42',  'brown',   'NEW_95',  680000, 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80'),
        ( 9, 'Layer-0',               'Cordovan Biker Jacket',      'L',   'black',   'USED_8', 2380000, 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80'),
        (10, 'Boris Bidjan Saberi',   'Blood-Dyed Henley',          'M',   'oxblood', 'NEW_99',  280000, 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80'),
        (11, 'Ann Demeulemeester',    'Asymmetric Cotton Shirt',    'M',   'black',   'NEW_95',  380000, 'https://images.unsplash.com/photo-1485518882345-15568b007705?w=600&q=80'),
        (12, 'Comme des Garcons',     'Homme Plus Wool Trousers',   'M',   'black',   'NEW_99',  420000, 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80')
    ) AS p(slot, brand_name, title_suffix, sz, col, cond, base_price_cents, cover_image)
),
users_ranked AS (
    SELECT u.id AS user_id,
           ROW_NUMBER() OVER (ORDER BY u.id) AS u_idx,
           (3 + (u.id % 3)::int) AS listings_count   -- 3 / 4 / 5
    FROM   users u
    JOIN   seller_profiles sp ON sp.user_id = u.id
),
user_slots AS (
    SELECT ur.user_id,
           ur.u_idx,
           ur.listings_count,
           gs AS pick_idx,
           -- 错峰挑品: 第 N 个用户从池子第 ((N-1)*7) 位开始, 1~12 循环
           (((ur.u_idx - 1) * 7 + (gs - 1)) % 12) + 1 AS brand_slot
    FROM   users_ranked ur
    CROSS  JOIN LATERAL generate_series(1, ur.listings_count) AS gs
)
INSERT INTO store_products (
    store_id, merchant_id, seller_kind, seller_user_id,
    title, description, brand,
    images, price_cents, currency,
    is_new, tags,
    size, color, condition, accept_offer,
    photo_angles,
    favorite_count, like_count, view_count, want_count,
    status, published_at,
    shipping_fee_mode, commission_rate_bps
)
SELECT
    NULL,
    NULL,
    'individual',
    us.user_id,
    '[MOCK-RESET] ' || bp.brand_name || ' ' || bp.title_suffix,
    '[MOCK-RESET] Lightly worn, kept in dust bag. Open to sensible offers; SF Express COD available.',
    bp.brand_name,
    ARRAY[bp.cover_image],
    -- 在底价基础上加点伪随机抖动, 让同品牌不同卖家价格不完全相同
    bp.base_price_cents + (((us.user_id * 17 + us.pick_idx * 31) % 6) * 10000),
    'CNY',
    (bp.cond = 'BNWT'),
    ARRAY[bp.brand_name, bp.sz]::text[],
    bp.sz,
    bp.col,
    bp.cond,
    TRUE,
    jsonb_build_object(
        'front',            bp.cover_image,
        'back',             bp.cover_image,
        'wash_label',       bp.cover_image,
        'wash_label_back',  bp.cover_image,
        'brand_label',      bp.cover_image,
        'brand_label_back', bp.cover_image,
        'flaw',             bp.cover_image
    ),
    ((us.user_id * 3 + us.pick_idx * 7) % 40),              -- favorite_count
    ((us.user_id * 3 + us.pick_idx * 7) % 40) + 3,          -- like_count
    (((us.user_id * 3 + us.pick_idx * 7) % 40) * 12) + 25,  -- view_count
    ((us.user_id * 5 + us.pick_idx * 11) % 8),              -- want_count
    'active',
    -- published_at 错开: 越靠后的用户越新, 同一用户内 pick_idx 越大越新
    NOW()
        - ((us.u_idx * 6 + us.pick_idx) || ' hours')::interval
        - ((us.pick_idx * 5) || ' minutes')::interval,
    'cod',
    100
FROM   user_slots us
JOIN   brand_pool bp ON bp.slot = us.brand_slot;


COMMIT;


-- =====================================================================
-- 自检查询 (跑完后在 SQL Editor 里挨条粘贴执行)
-- =====================================================================
-- -- 总览: 每个用户名下的在售件数
-- SELECT seller_user_id, COUNT(*) AS active_listings
-- FROM   store_products
-- WHERE  status = 'active' AND seller_kind = 'individual'
-- GROUP  BY seller_user_id
-- ORDER  BY seller_user_id;
--
-- -- 品牌分布
-- SELECT brand, COUNT(*) AS listings
-- FROM   store_products
-- WHERE  status = 'active'
-- GROUP  BY brand
-- ORDER  BY listings DESC, brand;
--
-- -- 应该都是 0 (确认 trading 表已清干净)
-- SELECT 'orders' AS tbl, COUNT(*) FROM orders
-- UNION ALL SELECT 'offers',                 COUNT(*) FROM offers
-- UNION ALL SELECT 'order_shipments',        COUNT(*) FROM order_shipments
-- UNION ALL SELECT 'trade_reviews',          COUNT(*) FROM trade_reviews
-- UNION ALL SELECT 'disputes',               COUNT(*) FROM disputes
-- UNION ALL SELECT 'pending_payouts',        COUNT(*) FROM pending_payouts
-- UNION ALL SELECT 'settlement_ledger',      COUNT(*) FROM settlement_ledger
-- UNION ALL SELECT 'authentication_orders',  COUNT(*) FROM authentication_orders;
-- =====================================================================
