---
status: resolved
trigger: "missing-email-log-table"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T02:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - Migration files don't follow Supabase naming convention
test: Rename migrations to follow <timestamp>_name.sql pattern and push to remote
expecting: Migrations applied successfully and email_log table created
next_action: rename migration files and apply via supabase db push

## Symptoms

expected: Dashboard loads successfully at /dashboard
actual: 500 error on GET /dashboard - "Could not find the table 'public.email_log' in the schema cache" (PGRST205)
errors: Error fetching audit log: { code: 'PGRST205', details: null, hint: null, message: "Could not find the table 'public.email_log' in the schema cache" }
reproduction: Run `npm run dev` and navigate to /dashboard
started: Current state - likely the table was never created via migration

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:05:00Z
  checked: Codebase grep for email_log
  found: Multiple references in lib/dashboard/metrics.ts, app/actions/audit-log.ts, app/api/cron/send-emails/route.ts, app/api/webhooks/postmark/route.ts
  implication: Code expects email_log table to exist

- timestamp: 2026-02-07T00:06:00Z
  checked: supabase/migrations directory
  found: create_phase3_schema.sql contains CREATE TABLE email_log with full schema (lines 8-23)
  implication: Migration file exists locally

- timestamp: 2026-02-07T00:07:00Z
  checked: .env.local configuration
  found: Using remote Supabase instance (zmsirxtgmdbbdxgxlato.supabase.co), not local Docker
  implication: Need to apply migrations to remote database, not local

- timestamp: 2026-02-07T00:08:00Z
  checked: supabase migration list --linked
  found: All migrations skipped with message "file name must match pattern <timestamp>_name.sql"
  implication: Migration files named incorrectly (create_phase1_schema.sql instead of YYYYMMDDHHMMSS_name.sql)

## Resolution

root_cause: Migration files don't follow Supabase naming convention. Files named create_phase1_schema.sql, create_phase2_schema.sql, create_phase3_schema.sql instead of required <timestamp>_name.sql pattern. Supabase CLI skips all migrations, so email_log table (and other Phase 2/3 tables) were never created.
fix:
  1. Renamed migrations to timestamp format (20260207000001_, 20260207000002_, 20260207000003_)
  2. Marked Phase 1 and 3 as applied (schema was partially created manually)
  3. Fixed Phase 2 migration (gen_random_uuid, CREATE IF NOT EXISTS, idempotent operations)
  4. Created new migration 20260207020738_add_email_log_table.sql with conditional foreign keys
  5. Applied Phase 2 and email_log migrations successfully
verification: Tables created and accessible via Supabase REST API. email_log, filing_types, reminder_queue, client_filing_assignments all confirmed to exist.
files_changed:
  - supabase/migrations/create_phase1_schema.sql → 20260207000001_create_phase1_schema.sql
  - supabase/migrations/create_phase2_schema.sql → 20260207000002_create_phase2_schema.sql (updated for idempotency)
  - supabase/migrations/create_phase3_schema.sql → 20260207000003_create_phase3_schema.sql
  - supabase/migrations/20260207020738_add_email_log_table.sql (new)
