-- 2025_11_12_extend_companies_and_create_company_employees.sql
-- Converted for pgAdmin / Standard PostgreSQL compatibility

-- Ensure the extension for UUID generation exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- 1) Add / ensure company fields in the public schema
ALTER TABLE IF EXISTS public.companies
  ADD COLUMN IF NOT EXISTS register_address TEXT,
  ADD COLUMN IF NOT EXISTS company_register_address TEXT,
  ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS social_media JSONB;

-- 2) Drop youtube_url if present (as requested in migration logic)
ALTER TABLE IF EXISTS public.companies
  DROP COLUMN IF EXISTS youtube_url;

-- 3) Create company_employees table
CREATE TABLE IF NOT EXISTS public.company_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  first_name VARCHAR(150) NOT NULL,
  last_name VARCHAR(150),
  email VARCHAR(255),
  designation VARCHAR(150),
  phone VARCHAR(50),
  linkedin_url VARCHAR(255),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4) Idempotent check for foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.constraint_schema = kcu.constraint_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'company_employees'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'company_id'
  ) THEN
    ALTER TABLE public.company_employees
      ADD CONSTRAINT company_employees_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

-- 5) Trigger function to update updated_at on company_employees
CREATE OR REPLACE FUNCTION public.trg_set_company_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_company_employees_updated_at ON public.company_employees;
CREATE TRIGGER trg_company_employees_updated_at
BEFORE UPDATE ON public.company_employees
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_company_employees_updated_at();

-- 6) Trigger function to update updated_at on companies
CREATE OR REPLACE FUNCTION public.trg_set_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_companies_updated_at();

COMMIT;
























