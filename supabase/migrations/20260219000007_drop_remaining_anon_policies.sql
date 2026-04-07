-- Downtime risk: NONE — safe for zero-downtime deployment
-- Phase 10 Plan 02: Drop remaining anon policies
-- Patch migration: These anon policies should have been removed by the auth
-- switchover (20260212000001) but were re-created when older migrations were
-- re-applied due to --include-all migration push ordering.
--
-- Security fix: Anon users must have zero access to any data tables.

-- clients
DROP POLICY IF EXISTS "Anon users can read clients" ON clients;
DROP POLICY IF EXISTS "Anon users can insert clients" ON clients;
DROP POLICY IF EXISTS "Anon users can update clients" ON clients;

-- email_templates
DROP POLICY IF EXISTS "Anon users can read email_templates" ON email_templates;
DROP POLICY IF EXISTS "Anon users can modify email_templates" ON email_templates;

-- schedules
DROP POLICY IF EXISTS "Anon users can read schedules" ON schedules;
DROP POLICY IF EXISTS "Anon users can modify schedules" ON schedules;

-- schedule_steps
DROP POLICY IF EXISTS "Anon users can read schedule_steps" ON schedule_steps;
DROP POLICY IF EXISTS "Anon users can modify schedule_steps" ON schedule_steps;

-- client_filing_assignments
DROP POLICY IF EXISTS "Anon users can read client_filing_assignments" ON client_filing_assignments;
DROP POLICY IF EXISTS "Anon users can modify client_filing_assignments" ON client_filing_assignments;

-- client_deadline_overrides
DROP POLICY IF EXISTS "Anon users can read client_deadline_overrides" ON client_deadline_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_deadline_overrides" ON client_deadline_overrides;

-- client_email_overrides
DROP POLICY IF EXISTS "Anon users can read client_email_overrides" ON client_email_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_email_overrides" ON client_email_overrides;

-- client_schedule_overrides
DROP POLICY IF EXISTS "Anon users can read client_schedule_overrides" ON client_schedule_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_schedule_overrides" ON client_schedule_overrides;

-- schedule_client_exclusions
DROP POLICY IF EXISTS "Allow anon full access to schedule_client_exclusions" ON schedule_client_exclusions;

-- reminder_queue
DROP POLICY IF EXISTS "Anon users can read reminder_queue" ON reminder_queue;
DROP POLICY IF EXISTS "Anon users can modify reminder_queue" ON reminder_queue;

-- email_log
DROP POLICY IF EXISTS "Anon users can read email_log" ON email_log;
DROP POLICY IF EXISTS "Anon users can modify email_log" ON email_log;

-- bank_holidays_cache
DROP POLICY IF EXISTS "Anon users can read bank_holidays_cache" ON bank_holidays_cache;
DROP POLICY IF EXISTS "Anon users can modify bank_holidays_cache" ON bank_holidays_cache;

-- filing_types
DROP POLICY IF EXISTS "Anon users can read filing_types" ON filing_types;

-- Also drop the temporary debug function
DROP FUNCTION IF EXISTS public._debug_list_policies();

-- ============================================================================
-- VALIDATION: Verify zero anon policies remain on any data table
-- ============================================================================
DO $$
DECLARE
  bad_policy record;
  bad_count integer := 0;
BEGIN
  FOR bad_policy IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text LIKE '%anon%'
  LOOP
    RAISE WARNING 'REMAINING ANON policy: % on % (cmd: %)', bad_policy.policyname, bad_policy.tablename, bad_policy.cmd;
    bad_count := bad_count + 1;
  END LOOP;

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'VALIDATION FAILED: % anon policies still remain', bad_count;
  END IF;

  RAISE NOTICE 'VALIDATION PASSED: Zero anon policies remain';
END $$;
