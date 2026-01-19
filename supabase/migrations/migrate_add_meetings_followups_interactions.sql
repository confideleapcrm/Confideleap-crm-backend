
-- followups
DROP TABLE IF EXISTS followups;
CREATE TABLE IF NOT EXISTS followups (
  id BIGSERIAL PRIMARY KEY,
  investor_id TEXT NOT NULL,
  created_by TEXT,
  company_id TEXT,
  followup_datetime TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_followups_investor ON followups (investor_id);
CREATE INDEX IF NOT EXISTS idx_followups_created_at ON followups (created_at);

-- interactions
DROP TABLE IF EXISTS interactions;
CREATE TABLE IF NOT EXISTS interactions (
  id BIGSERIAL PRIMARY KEY,
  investor_id TEXT NOT NULL,
  created_by TEXT,
  company_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('meeting','followup','manual')),
  outcome TEXT NOT NULL CHECK (outcome IN ('interested','not_interested','follow_up')),
  notes TEXT,
  related_id BIGINT,  -- optional meeting/followup id
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interactions_investor ON interactions (investor_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions (created_at);




-- =============================================
-- POSTGRESQL SETUP & UTILITIES
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Standard trigger function for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MIGRATION START
-- =============================================

BEGIN;

-- =======================
-- 1) MEETINGS
-- =======================

ALTER TABLE IF EXISTS meetings
  ADD COLUMN IF NOT EXISTS meet_link TEXT;

ALTER TABLE IF EXISTS meetings
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

ALTER TABLE IF EXISTS meetings
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE IF EXISTS meetings
  ADD COLUMN IF NOT EXISTS meeting_external_id TEXT;

ALTER TABLE IF EXISTS meetings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- copy meeting_status → status if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings'
      AND column_name = 'meeting_status'
  ) THEN
    EXECUTE 'UPDATE meetings SET status = COALESCE(status, meeting_status)';
  END IF;
END;
$$;

-- safe index (only created if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='meetings' AND column_name='investor_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_meetings_investor ON meetings (investor_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings (created_at);

-- =======================
-- 2) FOLLOWUPS
-- =======================

ALTER TABLE IF EXISTS followups
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

ALTER TABLE IF EXISTS followups
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='followups' AND column_name='investor_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_followups_investor ON followups (investor_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_followups_created_at ON followups (created_at);

-- =======================
-- 3) INTERACTIONS
-- =======================

ALTER TABLE IF EXISTS interactions
  ADD COLUMN IF NOT EXISTS source VARCHAR(40);

ALTER TABLE IF EXISTS interactions
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(40);

ALTER TABLE IF EXISTS interactions
  ADD COLUMN IF NOT EXISTS related_id BIGINT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='interactions' AND column_name='investor_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_interactions_investor ON interactions (investor_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions (created_at);

-- =======================
-- 4) INVESTOR LISTS
-- =======================

CREATE TABLE IF NOT EXISTS investor_lists (
  id BIGSERIAL PRIMARY KEY,
  investor_id TEXT NOT NULL,
  list_type TEXT NOT NULL CHECK (list_type IN ('interested','followups','not_interested','maybe')),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

DROP INDEX IF EXISTS ux_investor_lists_investor_listtype_user;

CREATE UNIQUE INDEX ux_investor_lists_investor_listtype_user
  ON investor_lists(investor_id, list_type, created_by);

CREATE INDEX IF NOT EXISTS idx_investor_lists_listtype ON investor_lists(list_type);
CREATE INDEX IF NOT EXISTS idx_investor_lists_investor ON investor_lists(investor_id);

COMMIT;

-- =======================
-- TRIGGERS
-- =======================

DROP TRIGGER IF EXISTS tr_meetings_updated_at ON meetings;
CREATE TRIGGER tr_meetings_updated_at
BEFORE UPDATE ON meetings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_followups_updated_at ON followups;
CREATE TRIGGER tr_followups_updated_at
BEFORE UPDATE ON followups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
