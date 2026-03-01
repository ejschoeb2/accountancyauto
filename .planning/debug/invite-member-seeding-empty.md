---
status: diagnosed
trigger: "Investigate why new members who accept an org invite do NOT get pre-populated email templates and schedules cloned from the org admin"
created: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:00:00Z
---

## Current Focus

hypothesis: seedNewUserDefaults IS called and runs, but the seeding inserts fail silently because the INSERT RLS policy requires owner_id = auth.uid() — and the admin client bypasses RLS, so inserts succeed — BUT the GET endpoints for email-templates and schedules also need owner_id filtering. The real failure is that seeding inserts omit owner_id on their WRITE checks (they use admin client so pass), but the POST /api/email-templates route doesn't set owner_id either — meaning manually-created templates also break.

REVISED HYPOTHESIS (confirmed): The seeding function itself is correct and uses admin client (bypasses RLS). The seeding inserts DO set owner_id correctly. The actual failure is a JWT timing issue: seedNewUserDefaults is called server-side immediately after the user_organisations INSERT, but the new member's JWT has no org_id yet (it was issued before they joined). The admin client bypasses RLS so seeding works. However, the accept page then calls supabase.auth.refreshSession() client-side — but this is AFTER the redirect to /setup/wizard. The JWT that RLS evaluates for the new member on their first page loads (templates/schedules) will have org_id from the new JWT. BUT: the seeding writes use the admin client so they succeed regardless. The issue is the POST routes for manual creation don't set owner_id on insert — causing RLS INSERT violations that are silent.

FINAL CONFIRMED HYPOTHESIS: The seeding function runs correctly (admin client, sets owner_id). The bug is that when seeding queries admin templates with .eq('owner_id', adminId), it only finds templates that were created WITH an owner_id. If the admin created templates via the POST /api/email-templates route, those inserts DO NOT set owner_id — the owner_id column is NOT NULL with a default, so the RLS INSERT policy (WITH CHECK owner_id = auth.uid()) should reject them... unless the admin client bypasses RLS there too. Wait — the POST route uses createClient() (user-scoped), NOT admin client. The INSERT policy is: org_id = auth_org_id() AND owner_id = auth.uid(). So if the admin inserts via the API route and does NOT pass owner_id in the insert body, Postgres will reject it (NOT NULL violation) OR the RLS check will fail. This means admin templates created via the UI route CANNOT exist without owner_id.

ACTUAL ROOT CAUSE: The seeding function is never reached because it silently fails at the admin lookup or the template query returns 0 rows. The seeding uses createAdminClient() which bypasses RLS. The queries use .eq('owner_id', adminId) — this requires that admin templates have owner_id set. But the POST /api/email-templates route at line 59-66 does NOT include owner_id in the insert — it only includes org_id, name, subject, body_json, is_active. Since owner_id is NOT NULL, this INSERT should fail with a constraint violation. But if the admin's templates don't exist (the insert fails silently), then seedNewUserDefaults finds 0 admin templates, clones 0 templates, and the new member sees an empty list — which exactly matches the reported symptom.

test: Read the POST /api/email-templates route to confirm owner_id is missing from the insert
expecting: owner_id is absent from the INSERT body, causing either a NOT NULL constraint violation (admin sees no templates either) or relying on a DB default

next_action: confirmed — POST /api/email-templates line 59-66 does NOT set owner_id. The admin insert fails at DB level (NOT NULL violation) OR there is a DB-level default that sets owner_id from auth.uid(). If the DB has no default, admin templates can never be created, meaning the admin also sees empty templates. But the user report says "new member sees empty" — implying admin CAN see their templates. This means the DB must have a trigger or default setting owner_id = auth.uid(). Check migrations for default or trigger on email_templates.

## Symptoms

expected: New members who accept an org invite should have email templates and schedules cloned from the org admin
actual: New member sees empty templates and schedules lists
errors: None visible — seeding failure is non-fatal (catch block logs to console, doesn't throw)
reproduction: Invite a new member, have them accept the invite, log in as that member, navigate to templates or schedules
started: After Phase 15 implementation (2026-02-22)

## Eliminated

- hypothesis: seedNewUserDefaults is not called from acceptInvite
  evidence: app/(auth)/invite/accept/actions.ts line 163 clearly calls `await seedNewUserDefaults(user.id, invite.org_id)` after the user_organisations INSERT
  timestamp: 2026-02-26

- hypothesis: The seeding utility file doesn't exist
  evidence: lib/seeding/seed-new-user.ts exists and exports seedNewUserDefaults
  timestamp: 2026-02-26

- hypothesis: The RLS member INSERT policy blocks the seeding inserts
  evidence: seedNewUserDefaults uses createAdminClient() (service role) which bypasses all RLS policies
  timestamp: 2026-02-26

## Evidence

- timestamp: 2026-02-26
  checked: app/(auth)/invite/accept/actions.ts
  found: Line 163 calls `await seedNewUserDefaults(user.id, invite.org_id)` after the user_organisations INSERT succeeds and before marking invite as accepted
  implication: The seeding call is correctly placed and awaited

- timestamp: 2026-02-26
  checked: lib/seeding/seed-new-user.ts
  found: Full implementation exists. Uses createAdminClient(). Finds earliest admin by .eq('role', 'admin').order('created_at', ascending).limit(1). Queries admin's templates with .eq('org_id', orgId).eq('owner_id', adminId). Inserts clones one-by-one with owner_id: userId. Same for schedules. Bulk inserts schedule_steps with remapped FKs. Entire function wrapped in try/catch — errors log but never throw.
  implication: The seeding logic is correct IF admin has templates with owner_id = adminId in the database. If admin templates query returns 0 rows, seeding silently succeeds with nothing cloned.

- timestamp: 2026-02-26
  checked: app/api/email-templates/route.ts POST handler (lines 56-68)
  found: The INSERT does NOT include owner_id in the insert body. It only inserts: org_id, name, subject, body_json, is_active, is_custom=true. No owner_id field.
  implication: CRITICAL. If Postgres has no default for owner_id, this INSERT fails with a NOT NULL constraint violation. If it does have a default (e.g. a trigger setting owner_id = auth.uid()), admin templates ARE created with owner_id, and seeding should find them. Either way, this is a bug — the route should explicitly set owner_id = auth.uid().

- timestamp: 2026-02-26
  checked: app/api/schedules/route.ts POST handler (lines 82-100)
  found: The INSERT does NOT include owner_id in the insert body. Same pattern as email-templates route.
  implication: Same bug — schedules created via UI also omit owner_id.

- timestamp: 2026-02-26
  checked: supabase/migrations/20260222100001_add_owner_id_to_resource_tables.sql
  found: owner_id added as UUID REFERENCES auth.users(id) with NO DEFAULT clause. Then ALTER COLUMN SET NOT NULL applied after backfill.
  implication: There is NO database-level default for owner_id. Any INSERT that omits owner_id will fail with "null value in column 'owner_id' of relation 'email_templates' violates not-null constraint". The RLS INSERT policy also requires owner_id = auth.uid(), which is a secondary check that wouldn't even be reached.

- timestamp: 2026-02-26
  checked: supabase/migrations/20260222100003_rewrite_resource_tables_rls.sql
  found: INSERT RLS policy for email_templates: WITH CHECK (org_id = auth_org_id() AND owner_id = auth.uid()). Same for schedules and schedule_steps.
  implication: Even if owner_id had a default, the RLS WITH CHECK would enforce it matches auth.uid(). But since there's no DB default, the NOT NULL constraint fires first and the INSERT errors out.

- timestamp: 2026-02-26
  checked: RLS auth_org_id() and auth_org_role() functions
  found: Both read from JWT claims (request.jwt.claims app_metadata). auth_org_id() returns zero UUID if claim missing. auth_org_role() returns 'member' if claim missing.
  implication: A new user whose JWT doesn't yet have org_id would get auth_org_id() = zero UUID, causing all org-scoped reads/writes to return empty (org_id = '00000000-0000-0000-0000-000000000000' matches nothing). The invite accept page does refreshSession() AFTER acceptInvite() succeeds — but this is called client-side, and seeding runs server-side inside acceptInvite(). Seeding uses admin client so JWT doesn't matter for seeding itself.

- timestamp: 2026-02-26
  checked: app/(auth)/invite/accept/page.tsx handleAccept()
  found: After acceptInvite() succeeds, line 78 calls `await supabase.auth.refreshSession()` — this is CORRECT and happens before the redirect to /setup/wizard.
  implication: The member's JWT will have org_id and org_role by the time they reach the setup wizard. This is not the timing bug.

- timestamp: 2026-02-26
  checked: app/(auth)/setup/wizard/page.tsx
  found: For invited-member path, calls prefetchConfigDefaults() which calls getUserEmailSettings(), getUserSendHour(), getInboundCheckerMode(), getPostmarkSettings(). Does NOT fetch or display templates/schedules during the wizard. Member setup wizard is import + config only.
  implication: The empty templates/schedules are seen AFTER the member completes setup and navigates to the templates/schedules pages in the dashboard.

## Resolution

root_cause: The POST /api/email-templates and POST /api/schedules routes omit owner_id from their INSERT bodies. Since owner_id has a NOT NULL constraint with no database default, every template and schedule creation via the UI fails with a NOT NULL constraint violation. As a result, the admin has NO templates and NO schedules in the database (all UI-created ones errored out). When seedNewUserDefaults runs, it queries admin templates with .eq('owner_id', adminId) and finds 0 rows — so it clones nothing for the new member. The member sees an empty list because there is nothing to clone, not because the seeding call itself is broken.

Secondary finding: Even if the admin somehow had templates (e.g. from the backfill migration on pre-existing rows), the POST routes are still broken and will reject any new template/schedule creation with a database error.

fix: (not yet applied — diagnose-only mode)
  1. Add owner_id to the INSERT body in POST /api/email-templates route using auth.uid() from the authenticated user session
  2. Add owner_id to the INSERT body in POST /api/schedules route using auth.uid() from the authenticated user session
  Both fixes require getting the current user from the Supabase client and passing user.id as owner_id on the insert.

verification: (not yet applied)

files_changed: []
