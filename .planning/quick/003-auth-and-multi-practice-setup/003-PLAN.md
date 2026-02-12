---
phase: quick-003
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(auth)/login/page.tsx
  - app/(auth)/login/actions.ts
  - app/(auth)/signup/page.tsx
  - app/(auth)/signup/actions.ts
  - app/auth/callback/route.ts
  - lib/supabase/middleware.ts
  - app/page.tsx
  - app/(dashboard)/layout.tsx
  - app/(auth)/onboarding/page.tsx
  - supabase/migrations/20260212000001_auth_rls_switchover.sql
  - scripts/setup-new-practice.sh
  - MULTI-TENANCY.md
autonomous: false

must_haves:
  truths:
    - "Unauthenticated visitors see login page, not dashboard"
    - "User can log in with email/password and reach dashboard"
    - "User can sign up, confirm email, and access the app"
    - "Onboarding wizard requires authentication before access"
    - "All dashboard pages are protected behind authentication"
    - "Cron jobs and webhooks continue working (service_role unaffected)"
    - "A deployment script exists for setting up new practice instances"
  artifacts:
    - path: "app/(auth)/login/page.tsx"
      provides: "Login form UI"
    - path: "app/(auth)/signup/page.tsx"
      provides: "Signup form UI"
    - path: "lib/supabase/middleware.ts"
      provides: "Auth-aware route protection"
    - path: "supabase/migrations/20260212000001_auth_rls_switchover.sql"
      provides: "Drop anon policies, add authenticated where missing"
    - path: "scripts/setup-new-practice.sh"
      provides: "New practice deployment automation"
  key_links:
    - from: "lib/supabase/middleware.ts"
      to: "app/(auth)/login/page.tsx"
      via: "redirect unauthenticated users"
      pattern: "redirect.*login"
    - from: "app/(auth)/login/actions.ts"
      to: "supabase.auth.signInWithPassword"
      via: "server action"
      pattern: "signInWithPassword"
    - from: "app/page.tsx"
      to: "/dashboard or /onboarding"
      via: "auth check then setup_mode check"
      pattern: "getUser.*redirect"
---

<objective>
Add Supabase Auth (email/password login + signup), protect all routes behind authentication, switch RLS policies from anon to authenticated role, and create a deployment automation script for new accounting practice instances.

Purpose: The app is currently wide open with no authentication. Before deploying to real clients, every route must require login, and the database must reject unauthenticated access. The deployment script enables repeatable setup of new practice instances (separate Supabase project per client, as decided in MULTI-TENANCY.md).

Output: Login/signup pages, auth-aware middleware, RLS migration, deployment script.
</objective>

<execution_context>
@C:\Users\ejsch\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\ejsch\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@MULTI-TENANCY.md
@lib/supabase/server.ts
@lib/supabase/client.ts
@lib/supabase/admin.ts
@lib/supabase/middleware.ts
@middleware.ts
@app/page.tsx
@app/(auth)/onboarding/page.tsx
@app/(dashboard)/layout.tsx
@supabase/migrations/20260207000001_create_phase1_schema.sql
@supabase/migrations/20260207131000_add_anon_clients_policies.sql
@supabase/migrations/20260207193244_add_anon_phase2_policies.sql
@supabase/migrations/20260207194239_add_anon_write_reminder_templates.sql
@supabase/migrations/20260208000001_create_v11_normalized_tables.sql
@supabase/migrations/20260209120000_create_app_settings.sql
@supabase/migrations/20260209210000_add_schedule_client_exclusions.sql
@supabase/migrations/20260209230000_add_app_settings_insert_policy.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create login and signup pages with Supabase Auth</name>
  <files>
    app/(auth)/login/page.tsx
    app/(auth)/login/actions.ts
    app/(auth)/signup/page.tsx
    app/(auth)/signup/actions.ts
    app/auth/callback/route.ts
  </files>
  <action>
Create a login page and signup page under the existing `(auth)` route group.

**Login page (`app/(auth)/login/page.tsx`):**
- Server component with a client form component
- Simple centered card layout matching the onboarding design aesthetic (centered, max-w-md, clean)
- Fields: email (type=email), password (type=password)
- Submit button "Sign in"
- Link to /signup ("Don't have an account? Sign up")
- Show error messages from server action (invalid credentials, etc.)
- On success, redirect to "/" (which will then route to /dashboard or /onboarding)
- Use Peninsula Accounting branding (logo at top, same as dashboard header uses `logofini.png` and `peninsulaccountinglogo.jpg`)

**Login server action (`app/(auth)/login/actions.ts`):**
- "use server" action
- Import `createClient` from `@/lib/supabase/server`
- Call `supabase.auth.signInWithPassword({ email, password })`
- On success: `redirect("/")`
- On error: return `{ error: "Invalid email or password" }` (generic message for security)
- Use `revalidatePath("/", "layout")` before redirect to clear server-side cache

**Signup page (`app/(auth)/signup/page.tsx`):**
- Same layout as login page
- Fields: email, password, confirm password
- Client-side validation: passwords match, min 6 chars
- Submit button "Create account"
- Link to /login ("Already have an account? Sign in")
- After successful signup, show a "Check your email" confirmation message (Supabase sends confirmation email by default)
- Do NOT auto-redirect after signup (user needs to confirm email first)

**Signup server action (`app/(auth)/signup/actions.ts`):**
- "use server" action
- Import `createClient` from `@/lib/supabase/server`
- Validate password length >= 6
- Call `supabase.auth.signUp({ email, password })`
- On success: return `{ success: true }` (page shows confirmation message)
- On error: return `{ error: error.message }`

**Auth callback route (`app/auth/callback/route.ts`):**
- This handles the email confirmation redirect from Supabase
- Extract `code` from URL search params
- Call `supabase.auth.exchangeCodeForSession(code)`
- Redirect to "/" on success
- This is the standard Supabase Auth PKCE callback handler

Important: Use the existing `(auth)` route group layout (`app/(auth)/onboarding/layout.tsx` pattern) for login/signup. Both pages should use the same centered, minimal layout.
  </action>
  <verify>
    - `npm run build` compiles without errors
    - Visit /login - see login form
    - Visit /signup - see signup form
    - Both pages render with Peninsula Accounting branding
  </verify>
  <done>Login and signup pages exist with server actions wired to Supabase Auth. Auth callback route handles email confirmation.</done>
</task>

<task type="auto">
  <name>Task 2: Update middleware to enforce authentication on all routes</name>
  <files>
    lib/supabase/middleware.ts
    app/page.tsx
    app/(dashboard)/layout.tsx
  </files>
  <action>
**Update `lib/supabase/middleware.ts`:**
The existing middleware only refreshes auth tokens. Update it to enforce authentication:

1. After `await supabase.auth.getUser()`, check if user exists
2. Define public routes that do NOT require auth: `/login`, `/signup`, `/auth/callback`, `/api/webhooks/*`, `/api/cron/*`
3. If no user AND route is NOT public: redirect to `/login`
4. If user IS authenticated AND route is `/login` or `/signup`: redirect to `/` (prevent logged-in users from seeing login page)
5. Return `supabaseResponse` as before (preserves cookie handling)

The existing `middleware.ts` matcher already excludes static files, images, and webhook routes. Keep that matcher but ensure `/api/cron/*` and `/api/webhooks/*` are also excluded (cron uses CRON_SECRET, webhooks use HMAC - they don't need user auth).

Updated matcher should be:
```
"/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
```

**Update `app/page.tsx` (root route):**
The root page currently checks `setup_mode` and redirects. Update the flow:
1. Get user with `supabase.auth.getUser()` (user is guaranteed by middleware, but double-check)
2. If no user, redirect to `/login` (safety net)
3. Check `setup_mode` from `app_settings` as before
4. If no `setup_mode`, redirect to `/onboarding`
5. If `setup_mode` exists, redirect to `/dashboard`

**Update `app/(dashboard)/layout.tsx`:**
Add a server-side auth check as a safety net (middleware handles the redirect, but belt-and-suspenders):
1. Import `createClient` from `@/lib/supabase/server`
2. Call `supabase.auth.getUser()`
3. If no user, `redirect("/login")`
4. Add a simple user indicator in the header: show user email and a "Sign out" button (or link)
5. Sign out action: call `supabase.auth.signOut()` then redirect to `/login`

For the sign out, create a small client component `components/sign-out-button.tsx` that:
- Uses `createClient` from `@/lib/supabase/client` (browser client)
- Calls `supabase.auth.signOut()` on click
- Then `router.push("/login")` and `router.refresh()`
- Styled as a subtle ghost button with a LogOut icon from lucide-react

Place the sign-out button in the dashboard header, after the SettingsLink.
  </action>
  <verify>
    - `npm run build` compiles without errors
    - Visit /dashboard without being logged in -> redirected to /login
    - Visit /onboarding without being logged in -> redirected to /login
    - Visit /clients without being logged in -> redirected to /login
    - /api/cron/reminders still accessible with CRON_SECRET (not blocked by auth middleware)
    - /api/webhooks/postmark still accessible (not blocked by auth middleware)
  </verify>
  <done>All dashboard and onboarding routes require authentication. Public routes (login, signup, cron, webhooks) remain accessible. Sign out button visible in dashboard header.</done>
</task>

<task type="auto">
  <name>Task 3: RLS migration - drop anon policies, add authenticated where missing</name>
  <files>
    supabase/migrations/20260212000001_auth_rls_switchover.sql
  </files>
  <action>
Create a single migration that switches RLS from anon to authenticated role.

**Context:** The app has a mix of RLS policies:
- Phase 1 tables (`clients`, `oauth_tokens`, `locks`) already have `authenticated` policies. `clients` also has `anon` policies added in migration `20260207131000`.
- Phase 2 tables (`filing_types`, `client_filing_assignments`, `client_deadline_overrides`, `reminder_templates`, `client_template_overrides`, `bank_holidays_cache`, `reminder_queue`) have both `authenticated` and `anon` policies.
- Phase 3 (`email_log`) has both `authenticated` and `anon`.
- v1.1 tables (`email_templates`, `schedules`, `schedule_steps`, `client_email_overrides`, `client_schedule_overrides`) have `authenticated`, `service_role`, and `anon`.
- `app_settings` has `anon` ONLY - needs `authenticated` added.
- `schedule_client_exclusions` has `anon` ONLY - needs `authenticated` added.

**Migration steps:**

1. **Add authenticated policies where missing:**

```sql
-- app_settings: add authenticated policies (currently anon-only)
CREATE POLICY "Authenticated users can read app_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update app_settings" ON app_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can insert app_settings" ON app_settings
  FOR INSERT TO authenticated WITH CHECK (true);

-- schedule_client_exclusions: add authenticated + service_role
CREATE POLICY "Authenticated users full access to schedule_client_exclusions" ON schedule_client_exclusions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to schedule_client_exclusions" ON schedule_client_exclusions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- app_settings: add service_role
CREATE POLICY "Service role full access to app_settings" ON app_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

2. **Drop ALL anon policies across all tables:**

```sql
-- Phase 1: clients (from 20260207131000)
DROP POLICY IF EXISTS "Anon users can read clients" ON clients;
DROP POLICY IF EXISTS "Anon users can insert clients" ON clients;
DROP POLICY IF EXISTS "Anon users can update clients" ON clients;

-- Phase 2: (from 20260207193244)
DROP POLICY IF EXISTS "Anon users can read filing_types" ON filing_types;
DROP POLICY IF EXISTS "Anon users can read client_filing_assignments" ON client_filing_assignments;
DROP POLICY IF EXISTS "Anon users can modify client_filing_assignments" ON client_filing_assignments;
DROP POLICY IF EXISTS "Anon users can read client_deadline_overrides" ON client_deadline_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_deadline_overrides" ON client_deadline_overrides;
DROP POLICY IF EXISTS "Anon users can read reminder_templates" ON reminder_templates;
DROP POLICY IF EXISTS "Anon users can modify reminder_templates" ON reminder_templates;  -- from 20260207194239
DROP POLICY IF EXISTS "Anon users can read client_template_overrides" ON client_template_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_template_overrides" ON client_template_overrides;
DROP POLICY IF EXISTS "Anon users can read bank_holidays_cache" ON bank_holidays_cache;
DROP POLICY IF EXISTS "Anon users can modify bank_holidays_cache" ON bank_holidays_cache;
DROP POLICY IF EXISTS "Anon users can read reminder_queue" ON reminder_queue;
DROP POLICY IF EXISTS "Anon users can modify reminder_queue" ON reminder_queue;
DROP POLICY IF EXISTS "Anon users can read email_log" ON email_log;
DROP POLICY IF EXISTS "Anon users can modify email_log" ON email_log;

-- v1.1 tables (from 20260208000001)
DROP POLICY IF EXISTS "Anon users can read email_templates" ON email_templates;
DROP POLICY IF EXISTS "Anon users can modify email_templates" ON email_templates;
DROP POLICY IF EXISTS "Anon users can read schedules" ON schedules;
DROP POLICY IF EXISTS "Anon users can modify schedules" ON schedules;
DROP POLICY IF EXISTS "Anon users can read schedule_steps" ON schedule_steps;
DROP POLICY IF EXISTS "Anon users can modify schedule_steps" ON schedule_steps;
DROP POLICY IF EXISTS "Anon users can read client_email_overrides" ON client_email_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_email_overrides" ON client_email_overrides;
DROP POLICY IF EXISTS "Anon users can read client_schedule_overrides" ON client_schedule_overrides;
DROP POLICY IF EXISTS "Anon users can modify client_schedule_overrides" ON client_schedule_overrides;

-- app_settings (from 20260209120000 and 20260209230000)
DROP POLICY IF EXISTS "Anon users can read app_settings" ON app_settings;
DROP POLICY IF EXISTS "Anon users can update app_settings" ON app_settings;
DROP POLICY IF EXISTS "Anon users can insert app_settings" ON app_settings;

-- schedule_client_exclusions (from 20260209210000)
DROP POLICY IF EXISTS "Allow anon full access to schedule_client_exclusions" ON schedule_client_exclusions;
```

Add a comment at the top of the migration:
```sql
-- Auth RLS Switchover: Drop all anon policies, ensure authenticated + service_role exist on all tables.
-- After this migration, unauthenticated requests via the anon key can read/write NOTHING.
-- Cron jobs and webhooks use createAdminClient() (service_role), so they are unaffected.
-- The regular server client (lib/supabase/server.ts) uses the anon key, but when a user is
-- authenticated via Supabase Auth, PostgREST automatically elevates to the 'authenticated' role.
```

**IMPORTANT:** Order matters - add authenticated/service_role policies FIRST, then drop anon policies. This way if the migration is partially applied, data remains accessible.
  </action>
  <verify>
    - Migration file has valid SQL syntax
    - All `DROP POLICY` statements use `IF EXISTS` (safe to re-run)
    - All tables that had anon-only access now have authenticated policies
    - Count: All anon policies across all tables are dropped
    - Cron/webhook routes use `createAdminClient()` (service_role) so they bypass RLS entirely
  </verify>
  <done>Single migration drops all anon RLS policies and adds authenticated+service_role policies where they were missing (app_settings, schedule_client_exclusions). Database now rejects unauthenticated access.</done>
</task>

<task type="auto">
  <name>Task 4: Create deployment script for new practice instances</name>
  <files>
    scripts/setup-new-practice.sh
    MULTI-TENANCY.md
  </files>
  <action>
**Create `scripts/setup-new-practice.sh`:**

A bash script that serves as a guided checklist + automation helper for setting up a new accounting practice client. Since each practice gets a separate Supabase project (per MULTI-TENANCY.md decision), the script should:

1. Accept a practice name as argument: `./scripts/setup-new-practice.sh "Smith & Co Accountants"`
2. Print a step-by-step checklist with instructions:

```
=== New Practice Setup: Smith & Co Accountants ===

Step 1: Create Supabase Project
  - Go to https://supabase.com/dashboard
  - Create new project: "peninsula-smithco" (or similar)
  - Region: EU West (London)
  - Note down:
    * Project URL
    * Anon key
    * Service role key
  - Enable Email Auth in Authentication > Providers

Step 2: Link and Run Migrations
  After creating the project, run:
    npx supabase link --project-ref <PROJECT_REF>
    npx supabase db push

Step 3: Create First User
  In Supabase Dashboard > Authentication > Users:
  - Click "Add User"
  - Enter the practice owner's email and a temporary password
  - They will be prompted to change it on first login

Step 4: Deploy to Vercel
  Option A - New Vercel project:
    vercel --yes
  Option B - Add to existing project as preview:
    Set environment variables in Vercel dashboard

Step 5: Set Environment Variables (in Vercel)
  NEXT_PUBLIC_SUPABASE_URL=<from step 1>
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<from step 1>
  SUPABASE_SERVICE_ROLE_KEY=<from step 1>
  CRON_SECRET=<generate: openssl rand -base64 32>
  POSTMARK_SERVER_TOKEN=<shared or practice-specific>

Step 6: Configure Postmark (if practice-specific sender)
  - Add practice domain to Postmark
  - Set up DKIM + return-path DNS records
  - Verify domain

Step 7: Configure QuickBooks (if using real mode)
  - Register app at https://developer.intuit.com
  - Set redirect URL to: https://<practice-domain>/onboarding/callback
  - Note Client ID and Client Secret
  - Add to env vars:
    QUICKBOOKS_CLIENT_ID=<from Intuit>
    QUICKBOOKS_CLIENT_SECRET=<from Intuit>
    QUICKBOOKS_REDIRECT_URI=https://<practice-domain>/onboarding/callback

Step 8: Verify Setup
  - Visit the deployed URL
  - Should see login page
  - Log in with the user from Step 3
  - Complete onboarding wizard
  - Verify cron is running (check Vercel Cron tab)
```

3. Generate a random CRON_SECRET and print it:
   ```bash
   CRON_SECRET=$(openssl rand -base64 32)
   echo "Generated CRON_SECRET: $CRON_SECRET"
   ```

4. Create a `.env.example` snippet for easy copy-paste

Make the script executable with proper shebang (`#!/usr/bin/env bash`).

**Update `MULTI-TENANCY.md`:**
- Update the "Action Items" section at the bottom to check off completed items
- Add a "Deployment Script" section referencing `scripts/setup-new-practice.sh`
- Add a "Authentication" section noting that auth is now implemented (Supabase Auth email/password)
- Update "Current Codebase State" section to reflect that auth is now in place
- Keep the migration path section as-is (future consideration)
  </action>
  <verify>
    - `bash -n scripts/setup-new-practice.sh` passes (valid bash syntax)
    - Script is executable (has shebang line)
    - Running `bash scripts/setup-new-practice.sh "Test Practice"` prints the full checklist without errors
    - MULTI-TENANCY.md reflects updated status
  </verify>
  <done>Deployment script provides step-by-step guide for new practice setup. MULTI-TENANCY.md updated with current auth status and script reference.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Verify full auth flow end-to-end</name>
  <what-built>
    Complete authentication system: login page, signup page, route protection middleware, RLS policy migration, sign-out functionality, and deployment script.
  </what-built>
  <how-to-verify>
    1. Run `npm run dev` and open http://localhost:3000
    2. Verify you are redirected to /login (not dashboard)
    3. Click "Sign up" link, create a test account
    4. Check email for Supabase confirmation link (or use Supabase dashboard to confirm user manually if running locally)
    5. Log in with the created account
    6. Verify you reach the dashboard (or onboarding if setup_mode not set)
    7. Verify the "Sign out" button appears in the header
    8. Click "Sign out" and verify you return to /login
    9. Try accessing /dashboard directly while logged out - verify redirect to /login
    10. Apply the migration to your Supabase project:
        - Review the SQL in `supabase/migrations/20260212000001_auth_rls_switchover.sql`
        - Run via Supabase dashboard SQL editor or `npx supabase db push`
        - After applying, verify the app still works when logged in
        - Verify that cron endpoints still work (they use service_role, should be unaffected)

    NOTE: The migration MUST be applied AFTER you have a working login, because once anon policies are dropped, the app will not work without authentication.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues with the auth flow</resume-signal>
</task>

</tasks>

<verification>
- `npm run build` completes without errors
- /login renders a login form
- /signup renders a signup form
- Unauthenticated access to any dashboard route redirects to /login
- Authenticated access reaches dashboard as before
- /api/cron/* and /api/webhooks/* remain accessible without user auth
- Sign out works and returns to /login
- Migration SQL is syntactically valid
- scripts/setup-new-practice.sh runs without errors
</verification>

<success_criteria>
- Authentication gate: No dashboard access without login
- Login/signup: Working Supabase Auth email/password flow
- RLS hardened: All anon policies removed, authenticated role required
- Background jobs safe: Cron and webhooks use service_role (unaffected)
- Deployment repeatable: Script documents full setup for new practice instances
- Sign out: User can log out from dashboard header
</success_criteria>

<output>
After completion, create `.planning/quick/003-auth-and-multi-practice-setup/003-SUMMARY.md`
</output>
