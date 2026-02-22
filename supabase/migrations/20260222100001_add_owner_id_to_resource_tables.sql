-- Phase 15 Plan 01: Per-Accountant Configuration
-- Migration 1/3: Add owner_id to resource tables
--
-- This migration:
-- 1. Adds owner_id UUID REFERENCES auth.users(id) to four resource tables:
--    email_templates, schedules, schedule_steps, schedule_client_exclusions
-- 2. Backfills existing rows to the earliest admin per org
--    (same COALESCE pattern as clients migration 20260222000001)
-- 3. Sets owner_id NOT NULL on all four tables
-- 4. Creates owner_id indexes for owner-scoped queries
--
-- After this migration, every resource row has an explicit owner.

-- ============================================================================
-- TABLE: email_templates
-- ============================================================================

-- STEP 1: Add owner_id column (nullable for backfill)
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN email_templates.owner_id IS
  'The user (accountant) who owns this email template. Members only see templates '
  'they own; admins see all templates in the org. Set to the creating user on INSERT.';

-- STEP 2: Backfill existing rows to earliest admin per org
UPDATE email_templates
SET owner_id = COALESCE(
  -- Try: earliest admin in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = email_templates.org_id AND uo.role = 'admin'
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Try: earliest member of any role in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = email_templates.org_id
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Fallback: any user in the system (for orgs with no user_organisations rows yet)
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
)
WHERE owner_id IS NULL;

-- STEP 3: Set NOT NULL constraint (backfill must have populated all rows)
ALTER TABLE email_templates
  ALTER COLUMN owner_id SET NOT NULL;

-- STEP 4: Create index for owner-scoped queries
CREATE INDEX IF NOT EXISTS idx_email_templates_owner_id ON email_templates(owner_id);

-- ============================================================================
-- TABLE: schedules
-- ============================================================================

-- STEP 1: Add owner_id column (nullable for backfill)
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN schedules.owner_id IS
  'The user (accountant) who owns this schedule. Members only see schedules '
  'they own; admins see all schedules in the org. Set to the creating user on INSERT.';

-- STEP 2: Backfill existing rows to earliest admin per org
UPDATE schedules
SET owner_id = COALESCE(
  -- Try: earliest admin in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = schedules.org_id AND uo.role = 'admin'
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Try: earliest member of any role in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = schedules.org_id
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Fallback: any user in the system (for orgs with no user_organisations rows yet)
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
)
WHERE owner_id IS NULL;

-- STEP 3: Set NOT NULL constraint
ALTER TABLE schedules
  ALTER COLUMN owner_id SET NOT NULL;

-- STEP 4: Create index for owner-scoped queries
CREATE INDEX IF NOT EXISTS idx_schedules_owner_id ON schedules(owner_id);

-- ============================================================================
-- TABLE: schedule_steps
-- ============================================================================

-- STEP 1: Add owner_id column (nullable for backfill)
ALTER TABLE schedule_steps
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN schedule_steps.owner_id IS
  'The user (accountant) who owns this schedule step. Mirrors the owner_id of '
  'the parent schedule. Members only see steps they own; admins see all in the org.';

-- STEP 2: Backfill existing rows to earliest admin per org
UPDATE schedule_steps
SET owner_id = COALESCE(
  -- Try: earliest admin in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = schedule_steps.org_id AND uo.role = 'admin'
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Try: earliest member of any role in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = schedule_steps.org_id
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Fallback: any user in the system (for orgs with no user_organisations rows yet)
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
)
WHERE owner_id IS NULL;

-- STEP 3: Set NOT NULL constraint
ALTER TABLE schedule_steps
  ALTER COLUMN owner_id SET NOT NULL;

-- STEP 4: Create index for owner-scoped queries
CREATE INDEX IF NOT EXISTS idx_schedule_steps_owner_id ON schedule_steps(owner_id);

-- ============================================================================
-- TABLE: schedule_client_exclusions
-- ============================================================================

-- STEP 1: Add owner_id column (nullable for backfill)
ALTER TABLE schedule_client_exclusions
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN schedule_client_exclusions.owner_id IS
  'The user (accountant) who owns this schedule client exclusion. Mirrors the '
  'owner_id of the parent schedule. Members only see their own; admins see all.';

-- STEP 2: Backfill existing rows to earliest admin per org
UPDATE schedule_client_exclusions
SET owner_id = COALESCE(
  -- Try: earliest admin in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = schedule_client_exclusions.org_id AND uo.role = 'admin'
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Try: earliest member of any role in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = schedule_client_exclusions.org_id
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Fallback: any user in the system (for orgs with no user_organisations rows yet)
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
)
WHERE owner_id IS NULL;

-- STEP 3: Set NOT NULL constraint
ALTER TABLE schedule_client_exclusions
  ALTER COLUMN owner_id SET NOT NULL;

-- STEP 4: Create index for owner-scoped queries
CREATE INDEX IF NOT EXISTS idx_schedule_client_exclusions_owner_id ON schedule_client_exclusions(owner_id);
