-- Auth issue reports: user-submitted reports about login/register problems.
-- Reporters are typically NOT logged in (OTP not received, register/login failed),
-- so this table intentionally has no FK to users. Staff triage via contact_value.

CREATE TABLE IF NOT EXISTS auth_issue_reports (
    id SERIAL PRIMARY KEY,
    issue_type VARCHAR(30) NOT NULL
        CHECK (issue_type IN (
            'OTP_NOT_RECEIVED',
            'REGISTER_FAILED',
            'LOGIN_FAILED',
            'OTHER'
        )),
    contact_type VARCHAR(10) NOT NULL
        CHECK (contact_type IN ('PHONE', 'EMAIL', 'OTHER')),
    contact_value VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    app_version VARCHAR(32) DEFAULT '',
    platform VARCHAR(16) DEFAULT '',
    device_info TEXT DEFAULT '',
    client_ip VARCHAR(64) DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CONTACTED', 'RESOLVED', 'DISMISSED')),
    staff_note TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_issue_reports_status
    ON auth_issue_reports(status);
CREATE INDEX IF NOT EXISTS idx_auth_issue_reports_created_at
    ON auth_issue_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_issue_reports_contact
    ON auth_issue_reports(contact_value);
CREATE INDEX IF NOT EXISTS idx_auth_issue_reports_issue_type
    ON auth_issue_reports(issue_type);
