
-- 20251125_add_google_tokens_and_cols.sql
-- Converted for pgAdmin / Standard PostgreSQL compatibility

BEGIN;

-- 1) Add google_refresh_token column to users
-- Note: In standard PostgreSQL, we use the public schema unless you have a custom auth schema.
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

-- 2) Add google_event_id column to meetings
ALTER TABLE IF EXISTS public.meetings
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- 3) Ensure meet_link exists
ALTER TABLE IF EXISTS public.meetings
  ADD COLUMN IF NOT EXISTS meet_link TEXT;

-- 4) Add updated_at if missing
ALTER TABLE IF EXISTS public.meetings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 5) Trigger logic for updated_at on meetings
-- Ensure the helper function exists
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Apply trigger to meetings table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'meetings') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'meetings_touch_updated_at') THEN
      CREATE TRIGGER meetings_touch_updated_at
      BEFORE UPDATE ON public.meetings
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
    END IF;
  END IF;
END
$$;

COMMIT;
