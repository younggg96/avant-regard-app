-- Brand Submissions: user-submitted brands pending admin review
CREATE TABLE IF NOT EXISTS brand_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    founded_year VARCHAR(10),
    founder VARCHAR(200),
    country VARCHAR(100),
    website TEXT,
    cover_image TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reject_reason TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_submissions_user_id ON brand_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_submissions_status ON brand_submissions(status);

CREATE OR REPLACE TRIGGER update_brand_submissions_updated_at
    BEFORE UPDATE ON brand_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
