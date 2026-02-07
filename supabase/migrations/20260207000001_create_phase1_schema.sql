-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Client type enum
CREATE TYPE client_type_enum AS ENUM ('Limited Company', 'Sole Trader', 'Partnership', 'LLP');

-- VAT quarter enum
CREATE TYPE vat_quarter_enum AS ENUM ('Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec');

-- VAT scheme enum
CREATE TYPE vat_scheme_enum AS ENUM ('Standard', 'Flat Rate', 'Cash Accounting', 'Annual Accounting');

-- OAuth tokens table
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'quickbooks',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Distributed locks table
CREATE TABLE locks (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients table (synced from QuickBooks + metadata)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quickbooks_id TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  display_name TEXT,
  primary_email TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,

  -- Filing metadata (set by accountant)
  client_type client_type_enum,
  year_end_date DATE,
  vat_registered BOOLEAN DEFAULT false,
  vat_quarter vat_quarter_enum,
  vat_frequency TEXT DEFAULT 'quarterly',
  vat_scheme vat_scheme_enum,

  -- Timestamps
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for company name matching (CSV import)
CREATE INDEX idx_clients_company_name_lower ON clients (LOWER(company_name));

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Lock cleanup function (delete expired locks)
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
  DELETE FROM locks WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Bulk update function for CSV import and bulk edit
CREATE OR REPLACE FUNCTION bulk_update_client_metadata(
  updates jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  update_record jsonb;
BEGIN
  FOR update_record IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE clients
    SET
      client_type = COALESCE((update_record->'metadata'->>'client_type')::client_type_enum, client_type),
      year_end_date = COALESCE((update_record->'metadata'->>'year_end_date')::date, year_end_date),
      vat_registered = COALESCE((update_record->'metadata'->>'vat_registered')::boolean, vat_registered),
      vat_quarter = COALESCE((update_record->'metadata'->>'vat_quarter')::vat_quarter_enum, vat_quarter),
      vat_scheme = COALESCE((update_record->'metadata'->>'vat_scheme')::vat_scheme_enum, vat_scheme),
      updated_at = now()
    WHERE id = (update_record->>'id')::uuid;
  END LOOP;
END;
$$;

-- RLS policies (basic -- single-tenant but future-proof)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE locks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (single-tenant)
CREATE POLICY "Authenticated users can read clients" ON clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON clients
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON clients
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage tokens" ON oauth_tokens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage locks" ON locks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role bypass for background jobs (sync, token refresh)
CREATE POLICY "Service role full access to clients" ON clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to tokens" ON oauth_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to locks" ON locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
