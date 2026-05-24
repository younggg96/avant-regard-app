-- ============================================================================
-- 065 · Marketplace「大家都在看」管理员策展 + 「精选推荐」信息完整度评级
-- ============================================================================
--
-- 设计稿（PRD 二期 p.4）针对 Discover 交易 Tab 的两段顶部模块：
--
-- 1) 「大家都在看」(原"最新上架")：
--    管理员后台手动选 4 个单品上架到首页一屏。新增两列：
--      - is_curated         : 是否被管理员选中
--      - curated_sort_order : 同一批策展内的相对顺序（asc，越小越靠前）
--    前端 GET /api/marketplace/curated 拉取这一段。
--
-- 2) 「精选推荐」(featured)：
--    按用户单品「信息完整度」从高到低排序——和论坛贴的 grade A→B→C→D
--    思路一致，但落到结构化字段：图片数量、品牌、分类、尺码、颜色、成色 +
--    成色说明、描述长度、标签、accept_offer 等。
--
--    新增 completeness_score INT，由 trigger 在 INSERT/UPDATE 时计算。
--    分数范围 0..100；featured 排序使用
--      ORDER BY completeness_score DESC, favorite_count DESC, published_at DESC
--    便于"信息齐全"的单品稳定排到前面。
--
-- 评分细则（合计 100 分）：
--    title         非空        +5
--    description ≥ 50 字      +10  ；≥ 200 字 +15
--    brand         非空        +10
--    category_id   非空        +8
--    size          非空        +6
--    color         非空        +6
--    condition     非空        +8
--    condition_note 非空（≥10字）+8
--    images count  ≥1          +5；≥3 +10；≥5 +15
--    photo_angles 5 视角图齐全  +10
--    tags          ≥1          +4
--    accept_offer  显式 TRUE   +2
--    original_show_id 非空     +3
--
-- 说明：以上权重之和大于 100，按"达标即得"叠加；最终值 LEAST(score, 100)。
-- ============================================================================

ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS is_curated BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS curated_sort_order INT,
    ADD COLUMN IF NOT EXISTS completeness_score INT DEFAULT 0 NOT NULL;

COMMENT ON COLUMN store_products.is_curated IS '管理员是否将此单品标记为「大家都在看」';
COMMENT ON COLUMN store_products.curated_sort_order IS '同批策展内的展示顺序，asc，NULL 视为最大';
COMMENT ON COLUMN store_products.completeness_score IS '信息完整度评分 0..100，trigger 自动计算';

-- 索引：策展段查询走 is_curated + sort_order
CREATE INDEX IF NOT EXISTS idx_store_products_curated
    ON store_products (is_curated, curated_sort_order, published_at DESC)
    WHERE is_curated = TRUE;

-- 索引：featured 段排序常用 completeness_score + favorite_count
CREATE INDEX IF NOT EXISTS idx_store_products_completeness
    ON store_products (completeness_score DESC, favorite_count DESC)
    WHERE status = 'active';


-- ============================================================================
-- Function : 计算 completeness_score
-- ============================================================================
CREATE OR REPLACE FUNCTION compute_store_product_completeness(p store_products)
RETURNS INT AS $$
DECLARE
    score INT := 0;
    img_count INT := 0;
    desc_len INT := 0;
    note_len INT := 0;
    tag_count INT := 0;
    angle JSONB;
    angles_filled INT := 0;
BEGIN
    IF p.title IS NOT NULL AND length(trim(p.title)) > 0 THEN
        score := score + 5;
    END IF;

    desc_len := COALESCE(length(p.description), 0);
    IF desc_len >= 200 THEN
        score := score + 15;
    ELSIF desc_len >= 50 THEN
        score := score + 10;
    END IF;

    IF p.brand IS NOT NULL AND length(trim(p.brand)) > 0 THEN
        score := score + 10;
    END IF;

    IF p.category_id IS NOT NULL THEN
        score := score + 8;
    END IF;

    IF p.size IS NOT NULL AND length(trim(p.size)) > 0 THEN
        score := score + 6;
    END IF;

    IF p.color IS NOT NULL AND length(trim(p.color)) > 0 THEN
        score := score + 6;
    END IF;

    IF p.condition IS NOT NULL AND length(trim(p.condition)) > 0 THEN
        score := score + 8;
    END IF;

    note_len := COALESCE(length(p.condition_note), 0);
    IF note_len >= 10 THEN
        score := score + 8;
    END IF;

    img_count := COALESCE(array_length(p.images, 1), 0);
    IF img_count >= 5 THEN
        score := score + 15;
    ELSIF img_count >= 3 THEN
        score := score + 10;
    ELSIF img_count >= 1 THEN
        score := score + 5;
    END IF;

    -- 5 视角图齐全（PRD 1.3）：front/back/wash_label/brand_label/flaw 都不为空
    angle := p.photo_angles;
    IF angle IS NOT NULL THEN
        IF (angle->>'front') IS NOT NULL AND length(angle->>'front') > 0 THEN
            angles_filled := angles_filled + 1;
        END IF;
        IF (angle->>'back') IS NOT NULL AND length(angle->>'back') > 0 THEN
            angles_filled := angles_filled + 1;
        END IF;
        IF (angle->>'wash_label') IS NOT NULL AND length(angle->>'wash_label') > 0 THEN
            angles_filled := angles_filled + 1;
        END IF;
        IF (angle->>'brand_label') IS NOT NULL AND length(angle->>'brand_label') > 0 THEN
            angles_filled := angles_filled + 1;
        END IF;
        IF (angle->>'flaw') IS NOT NULL AND length(angle->>'flaw') > 0 THEN
            angles_filled := angles_filled + 1;
        END IF;
    END IF;
    IF angles_filled >= 5 THEN
        score := score + 10;
    END IF;

    tag_count := COALESCE(array_length(p.tags, 1), 0);
    IF tag_count >= 1 THEN
        score := score + 4;
    END IF;

    IF p.accept_offer IS TRUE THEN
        score := score + 2;
    END IF;

    IF p.original_show_id IS NOT NULL AND length(trim(p.original_show_id)) > 0 THEN
        score := score + 3;
    END IF;

    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================================
-- Trigger : INSERT / UPDATE 时刷新 completeness_score
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_refresh_store_product_completeness()
RETURNS TRIGGER AS $$
BEGIN
    NEW.completeness_score := compute_store_product_completeness(NEW);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS store_products_completeness_trigger ON store_products;
CREATE TRIGGER store_products_completeness_trigger
    BEFORE INSERT OR UPDATE OF
        title, description, brand, category_id,
        size, color, condition, condition_note,
        images, photo_angles, tags, accept_offer, original_show_id
    ON store_products
    FOR EACH ROW
    EXECUTE FUNCTION trg_refresh_store_product_completeness();


-- ============================================================================
-- 回填存量数据（不会触发 BEFORE INSERT 的 trigger，但 UPDATE 会）
-- ============================================================================
UPDATE store_products
SET completeness_score = compute_store_product_completeness(store_products.*)
WHERE TRUE;
