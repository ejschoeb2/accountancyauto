-- Phase 10 Plan 05: Verification & Activation
-- Migration: Seed a second test organisation with sample data for isolation testing
--
-- Purpose: Create 'Acme Accounting (Test)' org with a test client and a distinct
-- app_setting value so we can verify RLS isolation between orgs.

-- ============================================================================
-- STEP 1: Create test organisation
-- ============================================================================

INSERT INTO organisations (name, slug, plan_tier, subscription_status)
VALUES (
  'Acme Accounting (Test)',
  'acme-test',
  'practice',
  'active'
);

-- ============================================================================
-- STEP 2: Create a test client in the test org
-- ============================================================================

INSERT INTO clients (id, company_name, primary_email, org_id, quickbooks_id)
SELECT
  gen_random_uuid(),
  'Acme Test Client',
  'test@acme-accounting.example.com',
  o.id,
  'ACME_TEST_001'
FROM organisations o WHERE o.slug = 'acme-test';

-- ============================================================================
-- STEP 3: Create a test app_setting for the test org
-- Uses reminder_send_hour = '10' (Peninsula uses '9') so isolation is visible.
-- ============================================================================

INSERT INTO app_settings (org_id, key, value)
SELECT o.id, 'reminder_send_hour', '10'
FROM organisations o WHERE o.slug = 'acme-test';

-- ============================================================================
-- ISOLATION TEST QUERIES (run as service_role to verify)
-- ============================================================================
--
-- 1. Both orgs exist:
--    SELECT name, slug FROM organisations ORDER BY created_at;
--    Expected: 'Peninsula Accounting' (slug: peninsula) and 'Acme Accounting (Test)' (slug: acme-test)
--
-- 2. Each org has its own clients:
--    SELECT c.company_name, o.slug
--    FROM clients c JOIN organisations o ON c.org_id = o.id
--    ORDER BY o.slug;
--    Expected: Peninsula's clients under 'peninsula', 'Acme Test Client' under 'acme-test'
--
-- 3. Each org has its own app_settings:
--    SELECT a.key, a.value, o.slug
--    FROM app_settings a JOIN organisations o ON a.org_id = o.id
--    WHERE a.key = 'reminder_send_hour'
--    ORDER BY o.slug;
--    Expected: acme-test = '10', peninsula = '9'
--
-- 4. RLS isolation test (as authenticated user with Peninsula JWT):
--    SELECT count(*) FROM clients;
--    Expected: Only Peninsula's clients (Acme Test Client should NOT appear)
--
-- 5. app_settings unique constraint test:
--    INSERT INTO app_settings (org_id, key, value)
--    VALUES ((SELECT id FROM organisations WHERE slug = 'peninsula'), 'reminder_send_hour', 'duplicate');
--    Expected: ERROR - violates unique constraint "app_settings_org_id_key_unique"
