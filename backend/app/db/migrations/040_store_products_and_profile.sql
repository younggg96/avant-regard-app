-- =====================================================
-- Migration 040: 商家商品系统 & 店铺主页可配置项
-- =====================================================
--
-- 新增表：
--   1. store_profile_configs      —— 买手店 Tab 里 StoreProfileCard 的数据源
--                                     (logo / cover / tags / 描述)
--   2. store_entry_cards          —— CategoryCards 数据源（4 类 × N 张，
--                                     商家可增删改、调序、换背景图）
--   3. store_product_categories   —— 商家自定义的商品分类（上衣/裤子/男/女 等）
--   4. store_products             —— 商家发布的商品（价格/折扣/新品/图片）
--   5. store_product_likes        —— 用户点"喜欢"
--   6. store_product_comments     —— 商品评论（镜像 buyer_store_comments 结构）
--   7. store_product_comment_likes
--
-- 设计要点：
--   - price 统一用 `price_cents` 存整数（分），规避浮点精度；展示层保留 2 位小数。
--   - has_discount 是 GENERATED STORED 列，便于 WHERE has_discount = TRUE 的索引。
--   - 所有 store 相关外键 ON DELETE CASCADE，保证店铺被删时附属数据一起回收。
--   - 商品评论独立建表而不是复用 post_comments：商品不是 posts 表的行，
--     共用同一张评论表会强行塞入 post_id 可空列，破坏原模型；同构写入
--     新表反而更简单直接。
-- =====================================================


-- ---------------------------------------------------------
-- 1. store_profile_configs —— StoreProfileCard 可配置项
-- ---------------------------------------------------------
-- 一个 store 最多一行（PRIMARY KEY = store_id），未配置则前端回退 Mock。
CREATE TABLE IF NOT EXISTS store_profile_configs (
    store_id VARCHAR(100) PRIMARY KEY REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE SET NULL,
    logo_image TEXT,
    cover_image TEXT,
    short_description TEXT,
    long_description TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_store_profile_configs_updated_at ON store_profile_configs;
CREATE TRIGGER trg_store_profile_configs_updated_at
    BEFORE UPDATE ON store_profile_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------
-- 2. store_entry_cards —— CategoryCards 数据源
-- ---------------------------------------------------------
-- card_type 约束见应用层（枚举 ProductEntryCardType）：
--   CLASSIFICATION / DISCOUNT / EVENT / NEW_ARRIVAL
-- 若 card_type = CLASSIFICATION，可选关联 target_category_id；NULL 表示"全部单品"。
CREATE TABLE IF NOT EXISTS store_entry_cards (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    card_type VARCHAR(20) NOT NULL,
    label VARCHAR(50) NOT NULL,
    label_en VARCHAR(50),
    image_url TEXT NOT NULL,
    target_category_id BIGINT,
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_entry_cards_store
    ON store_entry_cards(store_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_store_entry_cards_published
    ON store_entry_cards(store_id) WHERE status = 'PUBLISHED';

DROP TRIGGER IF EXISTS trg_store_entry_cards_updated_at ON store_entry_cards;
CREATE TRIGGER trg_store_entry_cards_updated_at
    BEFORE UPDATE ON store_entry_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------
-- 3. store_product_categories —— 商家自定义分类
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_product_categories (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    cover_image TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_store_product_categories_store
    ON store_product_categories(store_id, sort_order);

DROP TRIGGER IF EXISTS trg_store_product_categories_updated_at ON store_product_categories;
CREATE TRIGGER trg_store_product_categories_updated_at
    BEFORE UPDATE ON store_product_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- store_entry_cards.target_category_id 的外键延迟挂到 categories 建完之后
ALTER TABLE store_entry_cards
    DROP CONSTRAINT IF EXISTS fk_store_entry_cards_target_category;
ALTER TABLE store_entry_cards
    ADD CONSTRAINT fk_store_entry_cards_target_category
    FOREIGN KEY (target_category_id)
    REFERENCES store_product_categories(id)
    ON DELETE SET NULL;


-- ---------------------------------------------------------
-- 4. store_products —— 商品
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_products (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES buyer_stores(id) ON DELETE CASCADE,
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES store_product_categories(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    brand VARCHAR(200),
    images TEXT[] DEFAULT '{}',
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    currency VARCHAR(10) DEFAULT 'CNY',
    discount_price_cents BIGINT CHECK (discount_price_cents IS NULL OR discount_price_cents >= 0),
    has_discount BOOLEAN GENERATED ALWAYS AS (discount_price_cents IS NOT NULL) STORED,
    is_new BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PUBLISHED',
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 店铺 + 状态 + 时间序：列表最常用的查询模式
CREATE INDEX IF NOT EXISTS idx_store_products_store_status
    ON store_products(store_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_products_category
    ON store_products(category_id) WHERE category_id IS NOT NULL;
-- 部分索引：新品 / 折扣 的入口列表页命中率最高
CREATE INDEX IF NOT EXISTS idx_store_products_is_new
    ON store_products(store_id, published_at DESC)
    WHERE is_new = TRUE AND status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_store_products_discount
    ON store_products(store_id, published_at DESC)
    WHERE has_discount = TRUE AND status = 'PUBLISHED';

DROP TRIGGER IF EXISTS trg_store_products_updated_at ON store_products;
CREATE TRIGGER trg_store_products_updated_at
    BEFORE UPDATE ON store_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------
-- 5. store_product_likes —— 用户"喜欢"
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_product_likes (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_product_likes_user
    ON store_product_likes(user_id, created_at DESC);


-- ---------------------------------------------------------
-- 6. store_product_comments —— 商品评论（镜像 buyer_store_comments）
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_product_comments (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES store_product_comments(id) ON DELETE CASCADE,
    reply_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_product_comments_product
    ON store_product_comments(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_product_comments_parent
    ON store_product_comments(parent_id) WHERE parent_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_store_product_comments_updated_at ON store_product_comments;
CREATE TRIGGER trg_store_product_comments_updated_at
    BEFORE UPDATE ON store_product_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------
-- 7. store_product_comment_likes
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_product_comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES store_product_comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);
