-- =====================================================
-- 038: 用户等级系统 (Lv1 - Lv5)
--
-- 设计红线:
--   1) 只升不降:  current_level 只允许 >= 旧值的更新 (触发器强制).
--   2) 极简驱动:  所有任务只记录"累计计数",不做积分/打卡/签到.
--   3) 人工管控:  Lv4 走 level_upgrade_requests 审批; Lv5 仅 admin 直接写入;
--                抽奖开奖严禁系统自动,仅暴露 admin 手动接口.
-- =====================================================

-- ---------------------------------------------------------------
-- A) 等级主表:  每个用户一行,记录当前等级与升级时间戳
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_levels (
    user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_level     SMALLINT NOT NULL DEFAULT 0
                        CHECK (current_level BETWEEN 0 AND 5),
    last_level_up_at  TIMESTAMPTZ,
    -- Lv4 达标待审核时写入 4;审核通过后清零; 其他等级不用
    pending_level     SMALLINT CHECK (pending_level IS NULL
                                      OR pending_level BETWEEN 1 AND 5),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_levels_level
    ON user_levels(current_level);

-- 只升不降触发器:  阻止 current_level 减少
CREATE OR REPLACE FUNCTION user_levels_enforce_monotonic()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_level < OLD.current_level THEN
        RAISE EXCEPTION
            'user_levels.current_level is monotonic (old=%, new=%)',
            OLD.current_level, NEW.current_level;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_levels_monotonic ON user_levels;
CREATE TRIGGER trg_user_levels_monotonic
    BEFORE UPDATE ON user_levels
    FOR EACH ROW
    EXECUTE FUNCTION user_levels_enforce_monotonic();


-- ---------------------------------------------------------------
-- B) 任务进度表:  每个用户一行,用 JSONB counters 记录累计行为
-- 结构示例:
--   counters = {
--     "post_created": 3,
--     "community_followed": 1,
--     "post_liked": 12,
--     "user_followed": 4,
--     "want_clicked": 10,
--     "store_commented": 5,
--     "archive_uploaded": 2
--   }
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_level_progress (
    user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    counters    JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------
-- C) Lv4 升级审批队列:  达标后进入 PENDING, Admin 人工审批
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS level_upgrade_requests (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_level  SMALLINT NOT NULL CHECK (target_level BETWEEN 1 AND 5),
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    reviewed_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at   TIMESTAMPTZ,
    remark        TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 一个用户同一目标等级同时只能有一条 PENDING 记录
CREATE UNIQUE INDEX IF NOT EXISTS ux_level_upgrade_requests_pending
    ON level_upgrade_requests(user_id, target_level)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_level_upgrade_requests_status
    ON level_upgrade_requests(status);


-- ---------------------------------------------------------------
-- D) 月度抽奖期数:  每月 1 号自动建期 (status=OPEN),
--                  25 号 Admin 手动开奖 (status=DRAWN).
--                  奖品完全由 JSONB 配置,示例:
--   prize_config = [
--     { "prize_id": "p1", "name": "免费门票 x1", "quota": 3 },
--     { "prize_id": "p2", "name": "优惠券 ¥100",  "quota": 10 }
--   ]
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lottery_rounds (
    id            BIGSERIAL PRIMARY KEY,
    month         CHAR(7) NOT NULL UNIQUE,  -- 'YYYY-MM'
    prize_config  JSONB NOT NULL DEFAULT '[]'::jsonb,
    status        VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                   CHECK (status IN ('OPEN','DRAWN','CLOSED')),
    drawn_at      TIMESTAMPTZ,
    drawn_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lottery_rounds_status
    ON lottery_rounds(status);


-- ---------------------------------------------------------------
-- E) 抽奖参与名单 & 中奖状态
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lottery_entries (
    id          BIGSERIAL PRIMARY KEY,
    round_id    BIGINT NOT NULL REFERENCES lottery_rounds(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_winner   BOOLEAN NOT NULL DEFAULT FALSE,
    prize_id    VARCHAR(64),   -- 对应 prize_config 里的 prize_id
    prize_name  VARCHAR(200),
    prize_meta  JSONB DEFAULT '{}'::jsonb,
    UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_entries_round
    ON lottery_entries(round_id);
CREATE INDEX IF NOT EXISTS idx_lottery_entries_user
    ON lottery_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_lottery_entries_winner
    ON lottery_entries(round_id, is_winner)
    WHERE is_winner = TRUE;


-- ---------------------------------------------------------------
-- F) 权益定义:  benefit_type 唯一,config 存灵活配置
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS level_benefits (
    id              BIGSERIAL PRIMARY KEY,
    benefit_type    VARCHAR(32) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    level_required  SMALLINT NOT NULL CHECK (level_required BETWEEN 1 AND 5),
    default_quota   INTEGER NOT NULL DEFAULT 1,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO level_benefits (benefit_type, name, description, level_required, default_quota, config)
VALUES
    ('FREE_TICKET_LV4', 'Lv4 免费活动门票', '每次晋升 Lv4 赠送 1 次线下活动免费门票', 4, 1,
     '{"scope": "EVENT", "auto_replace_pay_button": true}'::jsonb),
    ('ANNUAL_LV5',      'Lv5 年度权益',     '全年专属权益,线下对接,线上仅展示入口',       5, 1,
     '{"scope": "OFFLINE", "display": "联系运营使用"}'::jsonb)
ON CONFLICT (benefit_type) DO NOTHING;


-- ---------------------------------------------------------------
-- G) 用户持有的权益:  一个用户一个 benefit_id 一行
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_level_benefits (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    benefit_id  BIGINT NOT NULL REFERENCES level_benefits(id) ON DELETE CASCADE,
    quota       INTEGER NOT NULL CHECK (quota >= 0),
    used        INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, benefit_id),
    CHECK (used <= quota)
);

CREATE INDEX IF NOT EXISTS idx_user_level_benefits_user
    ON user_level_benefits(user_id);


-- ---------------------------------------------------------------
-- H) 权益核销流水:  每次使用一次记一行
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS benefit_redemptions (
    id                    BIGSERIAL PRIMARY KEY,
    user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_benefit_id       BIGINT NOT NULL REFERENCES user_level_benefits(id) ON DELETE CASCADE,
    benefit_type          VARCHAR(32) NOT NULL,
    redeemed_object_type  VARCHAR(32) NOT NULL DEFAULT 'EVENT',
    redeemed_object_id    VARCHAR(64),
    redeemed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meta                  JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_benefit_redemptions_user
    ON benefit_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_benefit_redemptions_type
    ON benefit_redemptions(benefit_type);
