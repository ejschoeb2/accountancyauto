-- Downtime risk: MODERATE — requires backfill; may lock during constraint application
-- Quick Task 5: Accountant-Scoped Client Isolation
-- Migration 1/2: Add owner_id to clients, drop user_count_limit from organisations
--
-- This migration:
-- 1. Adds owner_id to clients (nullable first, for backfill)
-- 2. Backfills owner_id to the oldest admin of each org
-- 3. Sets owner_id NOT NULL
-- 4. Creates an index on owner_id
-- 5. Drops user_count_limit from organisations

-- ============================================================================
-- STEP 1: Add owner_id column (nullable for backfill)
-- ============================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN clients.owner_id IS
  'The user (accountant) who owns this client record. Members only see clients '
  'they own; admins see all clients in the org. Set to the creating user on INSERT.';

-- ============================================================================
-- STEP 2: Backfill existing clients
--
-- Priority: earliest admin in the org > earliest member > any auth user.
-- The final fallback handles orgs with no user_organisations rows yet
-- (e.g. the founding org seeded before the membership table existed).
-- This is a one-time backfill — all future inserts will set owner_id from
-- the authenticated user via application code.
-- ============================================================================

UPDATE clients
SET owner_id = COALESCE(
  -- Try: earliest admin in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = clients.org_id AND uo.role = 'admin'
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Try: earliest member of any role in the org
  (SELECT uo.user_id FROM user_organisations uo
   WHERE uo.org_id = clients.org_id
   ORDER BY uo.created_at ASC LIMIT 1),
  -- Fallback: any user in the system (for orgs with no user_organisations rows yet)
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
)
WHERE owner_id IS NULL;

-- ============================================================================
-- STEP 3: Set NOT NULL constraint (backfill must have populated all rows)
-- ============================================================================

ALTER TABLE clients
  ALTER COLUMN owner_id SET NOT NULL;

-- ============================================================================
-- STEP 4: Create index for owner-scoped queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON clients(owner_id);

-- ============================================================================
-- STEP 5: Drop user_count_limit from organisations
--
-- User seat limits are removed from the product entirely.
-- Pricing is based solely on client count going forward.
-- ============================================================================

ALTER TABLE organisations
  DROP COLUMN IF EXISTS user_count_limit;
