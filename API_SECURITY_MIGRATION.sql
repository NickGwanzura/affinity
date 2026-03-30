-- =============================================================================
-- API SECURITY MIGRATION
-- 
-- This migration adds tables and columns needed for the secure API architecture
-- Run this AFTER the FINANCIAL_TABLES_MIGRATION.sql
-- =============================================================================

-- =============================================================================
-- 1. ADD PASSWORD HASH TO USER PROFILES
-- =============================================================================

-- Add password_hash column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN password_hash TEXT;
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- =============================================================================
-- 2. PASSWORD RESETS TABLE
-- =============================================================================

DROP TABLE IF EXISTS public.password_resets CASCADE;

CREATE TABLE public.password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for token lookups
CREATE INDEX idx_password_resets_token ON password_resets(token);

-- Index for cleanup of old records
CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);

-- =============================================================================
-- 3. API AUDIT LOG TABLE (Optional but recommended)
-- =============================================================================

DROP TABLE IF EXISTS public.audit_logs CASCADE;

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queries
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- =============================================================================
-- 4. UNIQUE CONSTRAINTS FOR INVOICE/QUOTE NUMBERS
-- =============================================================================

-- Add unique constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'invoices' AND indexname = 'idx_invoices_number_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_invoices_number_unique ON invoices(invoice_number);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_indexes 
        WHERE tablename = 'quotes' AND indexname = 'idx_quotes_number_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_quotes_number_unique ON quotes(quote_number);
    END IF;
END $$;

-- =============================================================================
-- 5. TRIGGER FUNCTION FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. CLEANUP FUNCTION FOR EXPIRED TOKENS
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL '24 hours';
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 'Migration complete' as status;

-- Verify tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'password_resets', 'audit_logs', 'invoices', 'quotes');
