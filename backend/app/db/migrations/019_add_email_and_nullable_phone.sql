-- Add email column and make phone nullable for email/Apple sign-in users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200);

-- Allow phone to be NULL (email-only and Apple users have no phone)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ALTER COLUMN phone DROP DEFAULT;

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email != '';
