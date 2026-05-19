-- App-level key/value config store.
-- Used by:
--   key = 'recommend_config'   -> recommendation algorithm configuration (admin tunable)
--   key = 'cs_auto_reply'      -> customer-service auto-reply template
--   key = 'curated_feed_ids'   -> curated post IDs for editorial feed
--   key = 'maintenance_mode'   -> global maintenance switch + message (MaintenanceService)
--   key = 'feature_flags'      -> global feature toggles, e.g. lotteryEnabled (FeatureFlagsService)
--
-- Value is a free-form JSONB blob; each consumer owns its own schema and
-- tolerates missing fields by falling back to service-side defaults.

CREATE TABLE IF NOT EXISTS app_config (
    key         VARCHAR(64)  PRIMARY KEY,
    value       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    updated_by  BIGINT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-update `updated_at` on any row change.
CREATE OR REPLACE FUNCTION app_config_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_config_touch_updated_at ON app_config;
CREATE TRIGGER trg_app_config_touch_updated_at
    BEFORE UPDATE ON app_config
    FOR EACH ROW
    EXECUTE FUNCTION app_config_touch_updated_at();

-- Seed default recommendation config so the admin UI loads populated values
-- instead of silently falling back to service defaults on first visit.
INSERT INTO app_config (key, value) VALUES (
    'recommend_config',
    '{
        "pool_ratios": {"core": 0.5, "discovery": 0.3, "random": 0.2},
        "core_pool": {"grades": ["A", "B", "C"]},
        "discovery_pool": {"enabled": true},
        "random_pool": {"grades": ["A", "B"]},
        "cold_start": {"days": 7, "grades": ["A", "B"]}
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Seed maintenance + feature_flags rows so the corresponding services'
-- `.maybe_single()` lookups always hit a row. Without these, PostgREST
-- returns 204 No Content, which postgrest-py surfaces as an APIError and
-- spams a WARN on every request (the service still falls back to safe
-- defaults, but the log noise is real). Defaults below MUST stay in sync
-- with MaintenanceService._default_config / FeatureFlagsService._default_config.
INSERT INTO app_config (key, value) VALUES (
    'maintenance_mode',
    '{
        "enabled": false,
        "message": "服务暂时不可用，正在恢复中\n请稍后再试"
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value) VALUES (
    'feature_flags',
    '{
        "lotteryEnabled": false
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;
