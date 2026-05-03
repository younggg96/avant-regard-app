-- =====================================================
-- 046: 商家品牌点击聚合缓存表 (V2 看板用)
-- =====================================================
--
-- 看板需求 (V3 #16 扩展):
--   "店主知道哪些品牌在自己店里最受欢迎,直接决定进货方向"
--
-- 单店 × 单品牌 × 单时间窗 一行,接口只查这张表;后台 cron / lazy compute
-- 每小时刷新一次 —— 避免每次商家打开看板都跑 5 张表的多 JOIN 聚合.
--
-- 设计要点:
--   - window_days 取离散枚举 (7 / 30 / 0=全部),不存连续值;前端只暴露这 3 档.
--     这样缓存命中率最高,而不至于"每个商家自定义日期都触发一次重算".
--   - total_count 是 GENERATED STORED 列 = sum of 5 项,便于直接 ORDER BY
--     total_count DESC 取 Top N,无需在 Python 层再排.
--   - want / favorite / like / comment 4 项可按 created_at 切窗 (有事件表),
--     view_count 取 store_products.view_count 累计列 (无事件日志),
--     所以 window != 0 时 view_count 仍是该 brand 下商品的累计总浏览,
--     这是已知妥协,前端会在 UI 上提示"浏览数据为累计值".
--   - computed_at 用于判断缓存是否过期 (> 1h 触发重算);可被异步 cron 主动
--     刷新或被请求路径上 lazy 刷新.
--   - 不带 merchant_id 列 —— store_id 唯一确定店铺;商家变更不会影响数据.
-- =====================================================


CREATE TABLE IF NOT EXISTS store_brand_stats (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL REFERENCES buyer_stores(id) ON DELETE CASCADE,
    brand VARCHAR(200) NOT NULL,
    window_days INTEGER NOT NULL,           -- 7 / 30 / 0 (=all)
    want_count INTEGER NOT NULL DEFAULT 0,
    favorite_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,  -- 累计 (没有事件表),不参与窗口过滤
    total_count INTEGER GENERATED ALWAYS AS (
        want_count + favorite_count + like_count + comment_count + view_count
    ) STORED,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, brand, window_days)
);


-- 拉看板 Top N 走的复合索引: 同店 + 同窗口 + total_count 倒序
CREATE INDEX IF NOT EXISTS idx_store_brand_stats_lookup
    ON store_brand_stats(store_id, window_days, total_count DESC);

-- 缓存清理 / 找过期窗用的索引
CREATE INDEX IF NOT EXISTS idx_store_brand_stats_computed
    ON store_brand_stats(computed_at);


COMMENT ON TABLE store_brand_stats IS
    '商家品牌点击聚合缓存。每店铺 × 每品牌 × 每时间窗口 一行；'
    'API 端只读这张表，后台/请求路径 lazy 写。'
    'window_days = 0 表示「全部时间」。';

COMMENT ON COLUMN store_brand_stats.view_count IS
    '商品累计浏览数 (取自 store_products.view_count 列汇总)。'
    '无事件表无法窗口过滤，所有 window_days 行下该值都是累计总浏览。';
