-- =============================================
-- POSTGRESQL COMPATIBILITY SETUP
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema and uid function to mimic Supabase behavior in standard Postgres
-- This allows the RLS policies to remain functional
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS UUID AS $$
    -- In a standard app, you would set this via: SET LOCAL app.current_user_id = 'uuid';
    SELECT current_setting('app.current_user_id', true)::UUID;
$$ LANGUAGE sql STABLE;

-- Create the authenticated role if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END $$;

-- Standard trigger function for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- AUTHENTICATION ENHANCEMENTS
-- =============================================

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Login attempts tracking for security
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason VARCHAR(100),
    attempted_at TIMESTAMPTZ DEFAULT now()
);

-- Account lockouts
CREATE TABLE IF NOT EXISTS account_lockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    reason VARCHAR(100) NOT NULL,
    locked_at TIMESTAMPTZ DEFAULT now(),
    unlocked_at TIMESTAMPTZ,
    auto_unlock_at TIMESTAMPTZ,
    locked_by UUID REFERENCES users(id)
);

-- User preferences for login and app behavior
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    remember_me_duration INTEGER DEFAULT 2592000, -- 30 days in seconds
    session_timeout INTEGER DEFAULT 86400, -- 24 hours in seconds
    require_2fa BOOLEAN DEFAULT false,
    login_notifications BOOLEAN DEFAULT true,
    security_alerts BOOLEAN DEFAULT true,
    auto_logout_inactive BOOLEAN DEFAULT true,
    preferred_language VARCHAR(10) DEFAULT 'en',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(10) DEFAULT '12h',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Two-factor authentication secrets
CREATE TABLE IF NOT EXISTS user_2fa_secrets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret_key VARCHAR(255) NOT NULL,
    backup_codes TEXT[], -- Array of backup codes
    enabled_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES FOR AUTHENTICATION
-- =============================================

-- Password reset tokens indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Email verification tokens indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_email ON email_verification_tokens(email);

-- Login attempts indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at DESC);

-- Account lockouts indexes
CREATE INDEX IF NOT EXISTS idx_account_lockouts_user ON account_lockouts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_ip ON account_lockouts(ip_address);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_at ON account_lockouts(locked_at DESC);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on authentication tables
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa_secrets ENABLE ROW LEVEL SECURITY;

-- Users can only access their own authentication data
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can read own password reset tokens" ON password_reset_tokens;
    CREATE POLICY "Users can read own password reset tokens" ON password_reset_tokens
        FOR SELECT TO authenticated
        USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can read own email verification tokens" ON email_verification_tokens;
    CREATE POLICY "Users can read own email verification tokens" ON email_verification_tokens
        FOR SELECT TO authenticated
        USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
    CREATE POLICY "Users can read own preferences" ON user_preferences
        FOR ALL TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can manage own 2FA secrets" ON user_2fa_secrets;
    CREATE POLICY "Users can manage own 2FA secrets" ON user_2fa_secrets
        FOR ALL TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());

    -- Admins can view login attempts and lockouts for security monitoring
    DROP POLICY IF EXISTS "Admins can view login attempts" ON login_attempts;
    CREATE POLICY "Admins can view login attempts" ON login_attempts
        FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name = 'admin'
            )
        );

    DROP POLICY IF EXISTS "Admins can manage account lockouts" ON account_lockouts;
    CREATE POLICY "Admins can manage account lockouts" ON account_lockouts
        FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid() AND r.name = 'admin'
            )
        );
END $$;

-- =============================================
-- AUTHENTICATION FUNCTIONS
-- =============================================

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(user_email VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    user_uuid UUID;
    lockout_count INTEGER;
    recent_failures INTEGER;
BEGIN
    -- Get user ID
    SELECT id INTO user_uuid FROM users WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check for active lockouts
    SELECT COUNT(*) INTO lockout_count
    FROM account_lockouts
    WHERE user_id = user_uuid 
    AND unlocked_at IS NULL 
    AND (auto_unlock_at IS NULL OR auto_unlock_at > now());
    
    IF lockout_count > 0 THEN
        RETURN true;
    END IF;
    
    -- Check for too many recent failed attempts
    SELECT COUNT(*) INTO recent_failures
    FROM login_attempts
    WHERE email = user_email 
    AND success = false 
    AND attempted_at > now() - INTERVAL '15 minutes';
    
    -- Lock account if too many failures
    IF recent_failures >= 5 THEN
        INSERT INTO account_lockouts (user_id, reason, auto_unlock_at)
        VALUES (user_uuid, 'Too many failed login attempts', now() + INTERVAL '30 minutes');
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to record login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
    user_email VARCHAR,
    ip_addr INET,
    user_agent_str TEXT,
    is_success BOOLEAN,
    failure_reason_str VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
    VALUES (user_email, ip_addr, user_agent_str, is_success, failure_reason_str);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS VOID AS $$
BEGIN
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens WHERE expires_at < now();
    
    -- Clean up expired email verification tokens
    DELETE FROM email_verification_tokens WHERE expires_at < now();
    
    -- Clean up old login attempts (keep last 30 days)
    DELETE FROM login_attempts WHERE attempted_at < now() - INTERVAL '30 days';
    
    -- Auto-unlock expired account lockouts
    UPDATE account_lockouts 
    SET unlocked_at = now() 
    WHERE auto_unlock_at IS NOT NULL 
    AND auto_unlock_at <= now() 
    AND unlocked_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Apply updated_at trigger to new tables
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default user preferences for existing users
INSERT INTO user_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Insert default validation rules for import
-- Note: Assuming table 'data_validation_rules' exists as per your original schema
INSERT INTO data_validation_rules (rule_name, field_name, validation_type, validation_config, error_message) VALUES
('Email Required', 'email', 'required', '{}', 'Email address is required'),
('Email Format', 'email', 'format', '{"pattern": "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$"}', 'Please enter a valid email address'),
('Password Length', 'password', 'range', '{"min": 8, "max": 128}', 'Password must be between 8 and 128 characters'),
('Name Required', 'firstName', 'required', '{}', 'First name is required'),
('Name Required', 'lastName', 'required', '{}', 'Last name is required')
ON CONFLICT DO NOTHING;