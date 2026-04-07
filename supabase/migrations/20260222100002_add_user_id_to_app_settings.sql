-- Downtime risk: LOW — brief table lock expected (<1s for small tables)
-- Phase 15 Plan 01: Per-Accountant Configuration
-- Migration 2/3: Add user_id to app_settings for per-accountant settings
--
-- This migration:
-- 1. Adds nullable user_id UUID REFERENCES auth.users(id) to app_settings
-- 2. Drops the old unique constraint: UNIQUE(org_id, key)
-- 3. Adds new unique constraint with NULLS NOT DISTINCT: UNIQUE(org_id, user_id, key)
-- 4. Creates an index on user_id for user-scoped queries
--
-- CRITICAL: user_id must remain NULLABLE:
--   user_id = NULL  → org-level default (admin sets, all users inherit)
--   user_id = <uuid> → user-specific override (only that user sees it)
--
-- IMPORTANT: Do NOT backfill user_id. Existing rows remain NULL (they are
-- org-level defaults, which is the correct interpretation).
--
-- CRITICAL: The NULLS NOT DISTINCT modifier (PostgreSQL 15+) ensures that
-- (org_id, NULL, key) is truly unique. Without it, duplicate org-level
-- default rows would be allowed (PostgreSQL treats NULL as distinct by default
-- in unique constraints).

-- ============================================================================
-- STEP 1: Add user_id column (nullable — must stay nullable)
-- ============================================================================

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN app_settings.user_id IS
  'The user whose setting this is. NULL means org-level default (shared by all). '
  'UUID means user-specific override. Application code reads user row first, '
  'falls back to org default (user_id IS NULL) if no override exists.';

-- ============================================================================
-- STEP 2: Drop the old unique constraint
-- (was created in Phase 10 migration as UNIQUE(org_id, key))
-- ============================================================================

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_org_id_key_unique;

-- ============================================================================
-- STEP 3: Add new unique constraint with NULLS NOT DISTINCT
-- (org_id, NULL, key) must be unique — one org-level default per key per org
-- (org_id, user_id, key) must be unique — one user override per key per user per org
-- ============================================================================

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_org_user_key_unique
  UNIQUE NULLS NOT DISTINCT (org_id, user_id, key);

-- ============================================================================
-- STEP 4: Create index for user-scoped queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON app_settings(user_id);

-- ============================================================================
-- VALIDATION: Verify the new constraint exists and column is nullable
-- ============================================================================

DO $$
DECLARE
  constraint_count integer;
  col_nullable text;
BEGIN
  -- Check new constraint exists
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint
  WHERE conrelid = 'app_settings'::regclass
    AND conname = 'app_settings_org_user_key_unique';

  IF constraint_count = 0 THEN
    RAISE EXCEPTION 'VALIDATION FAILED: app_settings_org_user_key_unique constraint not found';
  END IF;

  -- Check user_id is nullable
  SELECT is_nullable INTO col_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'app_settings'
    AND column_name = 'user_id';

  IF col_nullable != 'YES' THEN
    RAISE EXCEPTION 'VALIDATION FAILED: app_settings.user_id must be nullable (is_nullable = %)', col_nullable;
  END IF;

  RAISE NOTICE 'VALIDATION PASSED: app_settings.user_id added with NULLS NOT DISTINCT unique constraint';
END $$;
