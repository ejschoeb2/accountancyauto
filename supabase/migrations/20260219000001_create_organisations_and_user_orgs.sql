-- Phase 10 Plan 01: Multi-Tenant Foundation
-- Migration 1/3: Create organisations, user_organisations, and invitations tables
-- This is the foundational migration for multi-tenancy.

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE plan_tier_enum AS ENUM ('lite', 'sole_trader', 'practice', 'firm');
CREATE TYPE org_role_enum AS ENUM ('admin', 'member');
CREATE TYPE subscription_status_enum AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'unpaid');

-- ============================================================================
-- TABLE: organisations
-- ============================================================================

CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan_tier plan_tier_enum NOT NULL DEFAULT 'lite',
  client_count_limit INT,          -- NULL = unlimited
  user_count_limit INT,            -- NULL = unlimited
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status subscription_status_enum DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  postmark_server_token TEXT,
  postmark_sender_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Slug must be URL-safe, lowercase, alphanumeric with hyphens, min 3 chars
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(slug) >= 3)
);

CREATE INDEX idx_organisations_slug ON organisations(slug);

CREATE TRIGGER organisations_updated_at
  BEFORE UPDATE ON organisations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- TABLE: user_organisations (junction table)
-- ============================================================================

CREATE TABLE user_organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role org_role_enum NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

CREATE INDEX idx_user_organisations_user_id ON user_organisations(user_id);
CREATE INDEX idx_user_organisations_org_id ON user_organisations(org_id);

-- ============================================================================
-- TABLE: invitations
-- ============================================================================

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role org_role_enum NOT NULL DEFAULT 'member',
  token_hash TEXT NOT NULL,        -- bcrypt/sha256 hash of the invite token; raw token sent only in email
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX idx_invitations_org_id ON invitations(org_id);

-- ============================================================================
-- SEED: Insert founding organisation
-- ============================================================================

INSERT INTO organisations (name, slug, plan_tier, client_count_limit, user_count_limit, subscription_status)
VALUES (
  'Peninsula Accounting',
  'peninsula',
  'firm',
  NULL,   -- unlimited clients
  NULL,   -- unlimited users
  'active'
);

-- ============================================================================
-- SEED: Link all existing users to founding org as admins
-- ============================================================================

INSERT INTO user_organisations (user_id, org_id, role)
SELECT u.id, o.id, 'admin'::org_role_enum
FROM auth.users u
CROSS JOIN organisations o
WHERE o.slug = 'peninsula';

-- ============================================================================
-- RLS: Temporary permissive policies (Plan 02 will replace with org-scoped)
-- ============================================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- organisations: authenticated can read, service_role full access
CREATE POLICY "Authenticated users can read organisations" ON organisations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access to organisations" ON organisations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- user_organisations: authenticated full access, service_role full access
CREATE POLICY "Authenticated users can manage user_organisations" ON user_organisations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to user_organisations" ON user_organisations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- invitations: authenticated full access, service_role full access
CREATE POLICY "Authenticated users can manage invitations" ON invitations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to invitations" ON invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- NOTE: Postmark token seeding
-- ============================================================================
-- After migration, run this to seed the Postmark token for the founding org:
--   UPDATE organisations SET postmark_server_token = '<your-token>' WHERE slug = 'peninsula';
-- This must be done manually or via a one-time script since SQL migrations cannot read env vars.
