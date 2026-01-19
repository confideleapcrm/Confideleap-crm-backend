
-- =============================================
-- POSTGRESQL COMPATIBILITY SETUP
-- =============================================

-- Enable extension for UUID support (required for the company_id column)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CONTACT STATUS HISTORY
-- =============================================

BEGIN;

-- contact status history
DROP TABLE IF EXISTS investor_contact_statuses;
CREATE TABLE IF NOT EXISTS investor_contact_statuses (
  id BIGSERIAL PRIMARY KEY,
  investor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('called','messaged','not_picked','not_reachable')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investor_contact_statuses_investor
  ON investor_contact_statuses (investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_contact_statuses_created_at
  ON investor_contact_statuses (created_at);

-- =============================================
-- INVESTOR LISTS TABLE
-- =============================================

-- lists table (fresh)
DROP TABLE IF EXISTS investor_lists;
CREATE TABLE IF NOT EXISTS investor_lists (
  id BIGSERIAL PRIMARY KEY,
  investor_id TEXT NOT NULL,
  list_type TEXT NOT NULL CHECK (list_type IN ('interested','followups','not_interested','meeting')),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IMPORTANT: Unique per user
DROP INDEX IF EXISTS ux_investor_lists_investor_listtype;
CREATE UNIQUE INDEX IF NOT EXISTS ux_investor_lists_investor_listtype_user
  ON investor_lists(investor_id, list_type, created_by);

CREATE INDEX IF NOT EXISTS idx_investor_lists_listtype
  ON investor_lists(list_type);
CREATE INDEX IF NOT EXISTS idx_investor_lists_investor
  ON investor_lists(investor_id);

COMMIT;

-- =============================================
-- SCHEMA ALTERATIONS & RELATIONSHIPS
-- =============================================

-- Ensure the column exists
ALTER TABLE investor_lists ADD COLUMN IF NOT EXISTS company_id UUID;

-- Add Foreign Key Constraint
-- Note: This requires a 'companies' table with an 'id' column of type UUID to exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_investor_lists_company') THEN
        ALTER TABLE investor_lists
        ADD CONSTRAINT fk_investor_lists_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
    END IF;
END $$;

-- =============================================
-- DATA BACKFILL (JSONB PROCESSING)
-- =============================================

-- backfill company_id from snapshot JSON (Postgres JSONB)
-- Adjust path if snapshot column is TEXT. 
-- In this script, it is already defined as JSONB above.
UPDATE investor_lists
SET company_id = ( (snapshot::jsonb -> 'company' ->> 'id') )::uuid
WHERE company_id IS NULL
  AND snapshot IS NOT NULL
  AND (snapshot::jsonb -> 'company' ->> 'id') IS NOT NULL;