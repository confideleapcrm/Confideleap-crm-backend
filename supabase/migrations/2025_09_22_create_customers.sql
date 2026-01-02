-- 2025_09_22_create_customers.sql
-- Adds fields to companies and creates company_employees table.
-- NOTE: Customers are treated as companies, so all customer references are removed.

-- 1) Ensure extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Create companies table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  industry VARCHAR(255),
  size VARCHAR(50),
  description TEXT,
  website VARCHAR(255),
  logo_url TEXT,
  headquarters VARCHAR(255),
  founded_year INTEGER,
  funding_stage VARCHAR(50),
  total_funding NUMERIC(15,2),
  employee_count INTEGER,

  -- additional company fields
  company_register_address TEXT,
  gst_number VARCHAR(64),
  pan_number VARCHAR(64),
  contact_number VARCHAR(64),
  linkedin VARCHAR(255),
  social_media TEXT,

  -- status and timestamps
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3) Add columns to companies if table already existed
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_register_address TEXT,
  ADD COLUMN IF NOT EXISTS gst_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS pan_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS contact_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255),
  ADD COLUMN IF NOT EXISTS social_media TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 4) Create company_employees table (1-to-many relationship with companies)
CREATE TABLE IF NOT EXISTS public.company_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  email VARCHAR(320),
  designation VARCHAR(255),
  phone VARCHAR(64),
  linkedin VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_company_employees_company
    FOREIGN KEY (company_id)
    REFERENCES public.companies(id)
    ON DELETE CASCADE
);

-- 5) Index to speed lookups
CREATE INDEX IF NOT EXISTS idx_company_employees_company_id
  ON public.company_employees(company_id);

-- 6) Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 7) Apply updated_at triggers
DO $$
BEGIN
  -- Companies trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'companies_touch_updated_at'
  ) THEN
    CREATE TRIGGER companies_touch_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  -- Company employees trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'company_employees_touch_updated_at'
  ) THEN
    CREATE TRIGGER company_employees_touch_updated_at
    BEFORE UPDATE ON public.company_employees
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END
$$;
