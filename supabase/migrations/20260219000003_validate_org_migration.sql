-- Phase 10 Plan 01: Multi-Tenant Foundation
-- Migration 3/3: Validation checks for org migration integrity
-- This migration runs assertions to confirm everything is correct.
-- If any check fails, the migration aborts and prevents further migrations.

-- ============================================================================
-- CHECK 1: Founding org exists with correct attributes
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organisations
    WHERE slug = 'peninsula'
    AND plan_tier = 'firm'
    AND subscription_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Founding org not found or has incorrect attributes (expected slug=peninsula, plan_tier=firm, subscription_status=active)';
  END IF;
END $$;

-- ============================================================================
-- CHECK 2: No NULL org_ids in any data table
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

-- ============================================================================
-- CHECK 3: All FK constraints valid — no orphaned org_ids
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  orphan_count INT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clients', 'email_templates', 'schedules', 'schedule_steps',
      'schedule_client_exclusions', 'client_email_overrides', 'client_schedule_overrides',
      'client_filing_assignments', 'client_deadline_overrides', 'client_filing_status_overrides',
      'reminder_queue', 'email_log', 'inbound_emails', 'app_settings', 'locks'
    ])
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I t WHERE NOT EXISTS (SELECT 1 FROM organisations o WHERE o.id = t.org_id)',
      tbl
    ) INTO orphan_count;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Table % has % rows with orphaned org_id (no matching organisation)', tbl, orphan_count;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- CHECK 4: user_organisations links exist
-- ============================================================================

DO $$ BEGIN
  IF (SELECT count(*) FROM user_organisations) = 0 THEN
    RAISE EXCEPTION 'No user-organisation links found — expected at least one admin link';
  END IF;
END $$;

-- ============================================================================
-- CHECK 5: app_settings has unique constraint on (org_id, key)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app_settings'::regclass
    AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'app_settings is missing a unique constraint (expected UNIQUE on org_id, key)';
  END IF;
END $$;

-- ============================================================================
-- CHECK 6: invitations table exists with required columns
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invitations'
    AND column_name = 'token_hash'
  ) THEN
    RAISE EXCEPTION 'invitations table missing token_hash column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invitations'
    AND column_name = 'expires_at'
  ) THEN
    RAISE EXCEPTION 'invitations table missing expires_at column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'invitations'
    AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'invitations table missing org_id column';
  END IF;
END $$;

-- ============================================================================
-- SUCCESS: Record migration completion
-- ============================================================================

INSERT INTO app_settings (org_id, key, value)
SELECT id, 'v3_migration_complete', 'true'
FROM organisations WHERE slug = 'peninsula'
ON CONFLICT ON CONSTRAINT app_settings_org_id_key_unique DO NOTHING;
