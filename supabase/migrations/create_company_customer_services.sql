
-- =============================================
-- POSTGRESQL SETUP & EXTENSIONS
-- =============================================

-- Enable pgcrypto for gen_random_uuid() support 
-- (Required for Postgres versions below 13, and good practice for compatibility)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the trigger function to handle the updated_at column auto-update
-- Supabase handles this via extensions, but standard Postgres requires a function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- TABLE DEFINITION
-- =============================================

-- create_customer_services.sql
CREATE TABLE IF NOT EXISTS customer_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Note: Ensure the 'companies' table exists before running this line
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_key text NOT NULL,
  service_label text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

-- optional index to speed up lookups by company
CREATE INDEX IF NOT EXISTS idx_customer_services_company_id ON customer_services(company_id);

-- =============================================
-- TRIGGERS
-- =============================================

-- Apply the trigger to the table to ensure updated_at changes on every row update
DROP TRIGGER IF EXISTS tr_customer_services_updated_at ON customer_services;
CREATE TRIGGER tr_customer_services_updated_at
    BEFORE UPDATE ON customer_services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();