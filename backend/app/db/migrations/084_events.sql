-- =====================================================
-- Migration 084: 活动日历 (PRD 论坛改造 M1 / P0)
-- =====================================================
--
-- 对应 PRD 第 3 节「活动日历」：
--   (a) events                 全局活动（仅管理员发布；后期可开放用户提交 + 审核）
--   (b) event_favorites        收藏活动（同时作为用户兴趣信号：城市 + 活动类型）
--   (c) event_reservations     预约活动（活动开始前 2 小时推送提醒）
--   (d) event_comments         评论 + 评分（无点赞）；活动结束后作为「活动回顾」返图区
--
-- 与 store_activities（商家自营活动）区分：events 是平台级活动日历。
-- =====================================================


-- ---------------------------------------------------------
-- (a) events
-- ---------------------------------------------------------
-- event_type: MARKET(市集) / SALE(特卖会) / EXHIBITION(展览) / POPUP(快闪) / ONLINE(线上)
-- status:     DRAFT / PUBLISHED / ENDED(活动回顾) / HIDDEN
--   * ENDED 由调度器在 end_at 过后自动写入，也允许管理员手动切换
-- 线上活动 (ONLINE) 无物理地点：只进日历，不进地图（is_online = TRUE 且不返回坐标）
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    cover_image TEXT,
    images TEXT[] DEFAULT '{}',
    event_type VARCHAR(20) NOT NULL DEFAULT 'MARKET'
        CHECK (event_type IN ('MARKET', 'SALE', 'EXHIBITION', 'POPUP', 'ONLINE')),
    -- 时间
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- 地点（线上活动可全部为空）
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    location_name VARCHAR(200),
    address VARCHAR(500),
    city VARCHAR(100),
    country VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    -- 活动地点关联买手店实体（可空）：地图店铺 pin 下方可直接展示活动预告
    store_id VARCHAR(100),
    -- 举办者 / 外链
    organizer VARCHAR(200),
    organizer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    link_url TEXT,
    -- 关联品牌（可选，用于品牌专区聚合）
    brand_ids BIGINT[] DEFAULT '{}',
    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'ENDED', 'HIDDEN')),
    -- 冗余计数
    favorite_count INTEGER NOT NULL DEFAULT 0,
    reservation_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    -- 审计
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT events_time_check CHECK (end_at >= start_at)
);

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_events_time ON events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_events_status_start ON events(status, start_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_store ON events(store_id) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city) WHERE city IS NOT NULL;


-- ---------------------------------------------------------
-- (b) event_favorites
-- ---------------------------------------------------------
-- 冗余 city / event_type 快照，方便后续做「巴黎 + 特卖会」兴趣画像
CREATE TABLE IF NOT EXISTS event_favorites (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city_snapshot VARCHAR(100),
    event_type_snapshot VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_favorites_user ON event_favorites(user_id, created_at DESC);


-- ---------------------------------------------------------
-- (c) event_reservations
-- ---------------------------------------------------------
-- reminder_sent_at: 活动开始前 2 小时推送后写入，保证幂等
CREATE TABLE IF NOT EXISTS event_reservations (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_reservations_user ON event_reservations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_reservations_pending_reminder
    ON event_reservations(event_id) WHERE reminder_sent_at IS NULL;


-- ---------------------------------------------------------
-- (d) event_comments
-- ---------------------------------------------------------
-- rating: 1-5 可空（评分）；images: 返图；archive_item_id: 返图可关联「我的档案」单品
CREATE TABLE IF NOT EXISTS event_comments (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    rating SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    images TEXT[] DEFAULT '{}',
    archive_item_id BIGINT REFERENCES user_archive_items(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_event_comments_updated_at ON event_comments;
CREATE TRIGGER trg_event_comments_updated_at
    BEFORE UPDATE ON event_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_event_comments_event ON event_comments(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_comments_user ON event_comments(user_id, created_at DESC);


-- ---------------------------------------------------------
-- 计数触发器：favorite_count / reservation_count / comment_count
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_event_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE events SET favorite_count = favorite_count + 1 WHERE id = NEW.event_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE events SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_favorites_count ON event_favorites;
CREATE TRIGGER trg_event_favorites_count
    AFTER INSERT OR DELETE ON event_favorites
    FOR EACH ROW EXECUTE FUNCTION trg_event_favorite_count();


CREATE OR REPLACE FUNCTION trg_event_reservation_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE events SET reservation_count = reservation_count + 1 WHERE id = NEW.event_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE events SET reservation_count = GREATEST(reservation_count - 1, 0) WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_reservations_count ON event_reservations;
CREATE TRIGGER trg_event_reservations_count
    AFTER INSERT OR DELETE ON event_reservations
    FOR EACH ROW EXECUTE FUNCTION trg_event_reservation_count();


CREATE OR REPLACE FUNCTION trg_event_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.is_deleted = FALSE THEN
        UPDATE events SET comment_count = comment_count + 1 WHERE id = NEW.event_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
        UPDATE events SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.event_id;
    ELSIF TG_OP = 'DELETE' AND OLD.is_deleted = FALSE THEN
        UPDATE events SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_comments_count ON event_comments;
CREATE TRIGGER trg_event_comments_count
    AFTER INSERT OR UPDATE OR DELETE ON event_comments
    FOR EACH ROW EXECUTE FUNCTION trg_event_comment_count();
