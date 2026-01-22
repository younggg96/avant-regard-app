-- =====================================================
-- 商家入驻系统数据库迁移
-- 包含：商家认证、公告、活动、折扣、Banner 功能
-- =====================================================

-- =====================================================
-- 1. 商家认证表 (store_merchants)
-- 关联买手店与商家用户
-- =====================================================

CREATE TABLE IF NOT EXISTS store_merchants (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL UNIQUE,  -- 关联买手店ID
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,  -- 商家用户ID
    -- 商家信息
    contact_name VARCHAR(100),  -- 联系人姓名
    contact_phone VARCHAR(50),  -- 联系电话
    contact_email VARCHAR(200),  -- 联系邮箱
    business_license TEXT,  -- 营业执照图片URL
    -- 认证状态
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, SUSPENDED
    reject_reason TEXT,
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    -- 商家等级和权益
    merchant_level VARCHAR(20) DEFAULT 'BASIC',  -- BASIC, PREMIUM, VIP
    can_post_banner BOOLEAN DEFAULT TRUE,
    can_post_announcement BOOLEAN DEFAULT TRUE,
    can_post_activity BOOLEAN DEFAULT TRUE,
    can_post_discount BOOLEAN DEFAULT TRUE,
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. 商家公告表 (store_announcements)
-- =====================================================

CREATE TABLE IF NOT EXISTS store_announcements (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,  -- 关联买手店ID
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    -- 公告内容
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    -- 发布状态
    is_pinned BOOLEAN DEFAULT FALSE,  -- 是否置顶
    status VARCHAR(20) DEFAULT 'PUBLISHED',  -- DRAFT, PUBLISHED, HIDDEN
    -- 有效期
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. 商家 Banner 表 (store_banners)
-- =====================================================

CREATE TABLE IF NOT EXISTS store_banners (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,  -- 关联买手店ID
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    -- Banner 内容
    title VARCHAR(200),
    image_url TEXT NOT NULL,  -- 图片URL
    link_url TEXT,  -- 点击跳转链接
    link_type VARCHAR(50),  -- INTERNAL, EXTERNAL, NONE
    -- 排序和状态
    sort_order INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PUBLISHED',  -- DRAFT, PUBLISHED, HIDDEN
    -- 有效期
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    -- 统计
    click_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. 商家活动表 (store_activities)
-- =====================================================

CREATE TABLE IF NOT EXISTS store_activities (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,  -- 关联买手店ID
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    -- 活动内容
    title VARCHAR(200) NOT NULL,
    description TEXT,
    cover_image TEXT,  -- 封面图片
    images TEXT[] DEFAULT '{}',  -- 活动图片列表
    -- 活动时间
    activity_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    activity_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    -- 活动地点（可以与店铺地址不同）
    location VARCHAR(500),
    -- 活动类型
    activity_type VARCHAR(50),  -- TRUNK_SHOW, POP_UP, SALE, EVENT, OTHER
    -- 状态
    status VARCHAR(20) DEFAULT 'PUBLISHED',  -- DRAFT, PUBLISHED, HIDDEN, ENDED
    -- 报名相关（可选）
    need_registration BOOLEAN DEFAULT FALSE,
    registration_limit INTEGER,
    registration_count INTEGER DEFAULT 0,
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. 商家折扣表 (store_discounts)
-- =====================================================

CREATE TABLE IF NOT EXISTS store_discounts (
    id BIGSERIAL PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,  -- 关联买手店ID
    merchant_id BIGINT REFERENCES store_merchants(id) ON DELETE CASCADE,
    -- 折扣内容
    title VARCHAR(200) NOT NULL,
    description TEXT,
    cover_image TEXT,  -- 封面图片
    -- 折扣类型和数值
    discount_type VARCHAR(50) NOT NULL,  -- PERCENTAGE, FIXED, SPECIAL
    discount_value VARCHAR(100),  -- 折扣值，如 "20%" 或 "满1000减200"
    -- 适用范围
    applicable_brands TEXT[] DEFAULT '{}',  -- 适用品牌
    applicable_categories TEXT[] DEFAULT '{}',  -- 适用品类
    -- 折扣时间
    discount_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    discount_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    -- 使用条件
    min_purchase_amount DECIMAL(10, 2),  -- 最低消费金额
    terms_and_conditions TEXT,  -- 使用条款
    -- 状态
    status VARCHAR(20) DEFAULT 'PUBLISHED',  -- DRAFT, PUBLISHED, HIDDEN, ENDED
    -- 是否需要优惠码
    need_code BOOLEAN DEFAULT FALSE,
    discount_code VARCHAR(50),
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. 活动报名表 (store_activity_registrations)
-- =====================================================

CREATE TABLE IF NOT EXISTS store_activity_registrations (
    id BIGSERIAL PRIMARY KEY,
    activity_id BIGINT REFERENCES store_activities(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    -- 报名信息
    contact_name VARCHAR(100),
    contact_phone VARCHAR(50),
    note TEXT,
    -- 状态
    status VARCHAR(20) DEFAULT 'REGISTERED',  -- REGISTERED, CANCELLED, ATTENDED
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(activity_id, user_id)
);

-- =====================================================
-- 7. 索引
-- =====================================================

-- 商家认证表索引
CREATE INDEX IF NOT EXISTS idx_store_merchants_store_id ON store_merchants(store_id);
CREATE INDEX IF NOT EXISTS idx_store_merchants_user_id ON store_merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_store_merchants_status ON store_merchants(status);

-- 公告表索引
CREATE INDEX IF NOT EXISTS idx_store_announcements_store_id ON store_announcements(store_id);
CREATE INDEX IF NOT EXISTS idx_store_announcements_merchant_id ON store_announcements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_announcements_status ON store_announcements(status);

-- Banner表索引
CREATE INDEX IF NOT EXISTS idx_store_banners_store_id ON store_banners(store_id);
CREATE INDEX IF NOT EXISTS idx_store_banners_merchant_id ON store_banners(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_banners_status ON store_banners(status);

-- 活动表索引
CREATE INDEX IF NOT EXISTS idx_store_activities_store_id ON store_activities(store_id);
CREATE INDEX IF NOT EXISTS idx_store_activities_merchant_id ON store_activities(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_activities_status ON store_activities(status);
CREATE INDEX IF NOT EXISTS idx_store_activities_time ON store_activities(activity_start_time, activity_end_time);

-- 折扣表索引
CREATE INDEX IF NOT EXISTS idx_store_discounts_store_id ON store_discounts(store_id);
CREATE INDEX IF NOT EXISTS idx_store_discounts_merchant_id ON store_discounts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_store_discounts_status ON store_discounts(status);
CREATE INDEX IF NOT EXISTS idx_store_discounts_time ON store_discounts(discount_start_time, discount_end_time);

-- 活动报名表索引
CREATE INDEX IF NOT EXISTS idx_store_activity_registrations_activity_id ON store_activity_registrations(activity_id);
CREATE INDEX IF NOT EXISTS idx_store_activity_registrations_user_id ON store_activity_registrations(user_id);

-- =====================================================
-- 8. 触发器：自动更新 updated_at
-- =====================================================

CREATE TRIGGER update_store_merchants_updated_at 
    BEFORE UPDATE ON store_merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_announcements_updated_at 
    BEFORE UPDATE ON store_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_banners_updated_at 
    BEFORE UPDATE ON store_banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_activities_updated_at 
    BEFORE UPDATE ON store_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_discounts_updated_at 
    BEFORE UPDATE ON store_discounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_activity_registrations_updated_at 
    BEFORE UPDATE ON store_activity_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. 活动报名数量更新触发器
-- =====================================================

CREATE OR REPLACE FUNCTION update_activity_registration_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE store_activities
        SET registration_count = registration_count + 1
        WHERE id = NEW.activity_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE store_activities
        SET registration_count = GREATEST(registration_count - 1, 0)
        WHERE id = OLD.activity_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_activity_registration_count
    AFTER INSERT OR DELETE ON store_activity_registrations
    FOR EACH ROW EXECUTE FUNCTION update_activity_registration_count();

-- =====================================================
-- 10. 注释
-- =====================================================

COMMENT ON TABLE store_merchants IS '商家认证表';
COMMENT ON TABLE store_announcements IS '商家公告表';
COMMENT ON TABLE store_banners IS '商家Banner表';
COMMENT ON TABLE store_activities IS '商家活动表';
COMMENT ON TABLE store_discounts IS '商家折扣表';
COMMENT ON TABLE store_activity_registrations IS '活动报名表';
