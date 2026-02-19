-- Phase 10 Plan 01: Multi-Tenant Foundation
-- Migration 2/3: Add org_id to all data tables and backfill to founding org
-- This migration adds org_id FK to every tenant-scoped data table,
-- backfills existing rows to the founding org, and sets NOT NULL.
--
-- Tables receiving org_id (15 total):
--   clients, email_templates, schedules, schedule_steps,
--   schedule_client_exclusions, client_email_overrides, client_schedule_overrides,
--   client_filing_assignments, client_deadline_overrides, client_filing_status_overrides,
--   reminder_queue, email_log, inbound_emails, app_settings, locks
--
-- Tables SKIPPED (global reference data):
--   filing_types, bank_holidays_cache, oauth_tokens

BEGIN;

-- ============================================================================
-- STEP 1: Get founding org ID for backfill
-- ============================================================================

DO $$
DECLARE
  founding_org_id UUID;
BEGIN
  SELECT id INTO founding_org_id FROM organisations WHERE slug = 'peninsula';
  IF founding_org_id IS NULL THEN
    RAISE EXCEPTION 'Founding org (peninsula) not found — migration 1 must run first';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add org_id to standard tables (UUID PK tables)
-- Pattern: add nullable -> backfill -> set NOT NULL -> add index
-- ============================================================================

-- 1. clients
ALTER TABLE clients ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE clients SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE clients ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_clients_org_id ON clients(org_id);

-- 2. email_templates
ALTER TABLE email_templates ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE email_templates SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE email_templates ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_email_templates_org_id ON email_templates(org_id);

-- 3. schedules
ALTER TABLE schedules ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE schedules SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE schedules ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_schedules_org_id ON schedules(org_id);

-- 4. schedule_steps
ALTER TABLE schedule_steps ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE schedule_steps SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE schedule_steps ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_schedule_steps_org_id ON schedule_steps(org_id);

-- 5. schedule_client_exclusions (composite PK: schedule_id, client_id)
ALTER TABLE schedule_client_exclusions ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE schedule_client_exclusions SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE schedule_client_exclusions ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_schedule_client_exclusions_org_id ON schedule_client_exclusions(org_id);

-- 6. client_email_overrides
ALTER TABLE client_email_overrides ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE client_email_overrides SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE client_email_overrides ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_client_email_overrides_org_id ON client_email_overrides(org_id);

-- 7. client_schedule_overrides
ALTER TABLE client_schedule_overrides ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE client_schedule_overrides SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE client_schedule_overrides ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_client_schedule_overrides_org_id ON client_schedule_overrides(org_id);

-- 8. client_filing_assignments
ALTER TABLE client_filing_assignments ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE client_filing_assignments SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE client_filing_assignments ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_client_filing_assignments_org_id ON client_filing_assignments(org_id);

-- 9. client_deadline_overrides
ALTER TABLE client_deadline_overrides ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE client_deadline_overrides SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE client_deadline_overrides ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_client_deadline_overrides_org_id ON client_deadline_overrides(org_id);

-- 10. client_filing_status_overrides
ALTER TABLE client_filing_status_overrides ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE client_filing_status_overrides SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE client_filing_status_overrides ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_client_filing_status_overrides_org_id ON client_filing_status_overrides(org_id);

-- 11. reminder_queue
ALTER TABLE reminder_queue ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE reminder_queue SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE reminder_queue ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_reminder_queue_org_id ON reminder_queue(org_id);

-- 12. email_log
ALTER TABLE email_log ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE email_log SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE email_log ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_email_log_org_id ON email_log(org_id);

-- 13. inbound_emails
ALTER TABLE inbound_emails ADD COLUMN org_id UUID REFERENCES organisations(id);
UPDATE inbound_emails SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');
ALTER TABLE inbound_emails ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_inbound_emails_org_id ON inbound_emails(org_id);

-- ============================================================================
-- STEP 3: Special handling for app_settings
-- Currently: key TEXT PRIMARY KEY, value TEXT NOT NULL
-- Target: id UUID PK, org_id UUID NOT NULL FK, key TEXT, value TEXT
--         UNIQUE(org_id, key)
-- ============================================================================

-- Add id column (UUID, will become new PK)
ALTER TABLE app_settings ADD COLUMN id UUID DEFAULT gen_random_uuid();

-- Backfill id for existing rows
UPDATE app_settings SET id = gen_random_uuid() WHERE id IS NULL;

-- Add org_id column
ALTER TABLE app_settings ADD COLUMN org_id UUID REFERENCES organisations(id);

-- Backfill org_id for existing rows
UPDATE app_settings SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula');

-- Set NOT NULL constraints
ALTER TABLE app_settings ALTER COLUMN id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN org_id SET NOT NULL;

-- Drop old PRIMARY KEY on key column
ALTER TABLE app_settings DROP CONSTRAINT app_settings_pkey;

-- Add new PRIMARY KEY on id
ALTER TABLE app_settings ADD PRIMARY KEY (id);

-- Add UNIQUE constraint on (org_id, key) — the new multi-tenant uniqueness
ALTER TABLE app_settings ADD CONSTRAINT app_settings_org_id_key_unique UNIQUE (org_id, key);

-- Add index for RLS performance
CREATE INDEX idx_app_settings_org_id ON app_settings(org_id);

-- ============================================================================
-- STEP 4: Special handling for locks
-- Currently: id TEXT PRIMARY KEY, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ
-- Keep the TEXT PK; just add org_id for scoping.
-- Lock IDs will be made org-scoped in application code (e.g., cron_reminders_${org_id}).
-- ============================================================================

ALTER TABLE locks ADD COLUMN org_id UUID REFERENCES organisations(id);

-- Locks table may be empty — backfill any existing rows
UPDATE locks SET org_id = (SELECT id FROM organisations WHERE slug = 'peninsula') WHERE org_id IS NULL;

-- Set NOT NULL (locks created after this migration must specify org_id)
ALTER TABLE locks ALTER COLUMN org_id SET NOT NULL;

-- Add index for RLS performance
CREATE INDEX idx_locks_org_id ON locks(org_id);

-- ============================================================================
-- STEP 5: Validate no NULL org_ids remain
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  null_count INT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clients', 'email_templates', 'schedules', 'schedule_steps',
      'schedule_client_exclusions', 'client_email_overrides', 'client_schedule_overrides',
      'client_filing_assignments', 'client_deadline_overrides', 'client_filing_status_overrides',
      'reminder_queue', 'email_log', 'inbound_emails', 'app_settings', 'locks'
    ])
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE org_id IS NULL', tbl) INTO null_count;
    IF null_count > 0 THEN
      RAISE EXCEPTION 'Table % has % rows with NULL org_id', tbl, null_count;
    END IF;
  END LOOP;
END $$;

COMMIT;
