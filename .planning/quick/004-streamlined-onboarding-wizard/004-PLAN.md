---
phase: quick
plan: 004
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260212100000_add_onboarding_complete_setting.sql
  - app/page.tsx
  - app/(auth)/onboarding/page.tsx
  - app/(auth)/onboarding/layout.tsx
  - app/(auth)/onboarding/components/onboarding-client-table.tsx
  - app/(auth)/onboarding/components/email-config-form.tsx
  - app/(auth)/onboarding/callback/route.ts
  - app/(auth)/login/actions.ts
  - app/actions/settings.ts
  - lib/supabase/middleware.ts
autonomous: true

must_haves:
  truths:
    - "After QuickBooks OAuth or first login, user sees onboarding wizard (not dashboard)"
    - "Wizard has exactly 3 steps: Clients, Email, Complete"
    - "User can skip steps 1 and 2 freely"
    - "After completing or skipping through step 3, user never sees onboarding again"
    - "Demo users skip onboarding entirely (go straight to dashboard)"
    - "Onboarding UI matches the dashboard design system (cards, spacing, typography)"
  artifacts:
    - path: "supabase/migrations/20260212100000_add_onboarding_complete_setting.sql"
      provides: "Seed onboarding_complete=false in app_settings"
    - path: "app/page.tsx"
      provides: "Root redirect logic checking onboarding_complete"
    - path: "app/(auth)/onboarding/page.tsx"
      provides: "Streamlined 3-step wizard"
  key_links:
    - from: "app/page.tsx"
      to: "app_settings.onboarding_complete"
      via: "Supabase query"
      pattern: "onboarding_complete"
    - from: "app/(auth)/onboarding/page.tsx"
      to: "app/actions/settings.ts"
      via: "markOnboardingComplete server action"
      pattern: "markOnboardingComplete"
---

<objective>
Reimplement the onboarding wizard as a streamlined 3-step flow (Clients -> Email -> Complete), removing the mode selection and QuickBooks connect steps (those now happen at login). Track onboarding completion in `app_settings` so onboarding only shows once. Demo users bypass onboarding entirely.

Purpose: After quick/003 moved auth to the login page, the onboarding wizard still has redundant mode/connect steps. This strips it down to just the configuration steps that matter, with polished UI matching the dashboard design system.

Output: A working 3-step onboarding wizard that appears once after first login, then never again.
</objective>

<execution_context>
@C:\Users\ejsch\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\ejsch\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

Key reference files (read before implementing):
@app/page.tsx
@app/(auth)/onboarding/page.tsx
@app/(auth)/onboarding/layout.tsx
@app/(auth)/onboarding/components/onboarding-client-table.tsx
@app/(auth)/onboarding/components/email-config-form.tsx
@app/(auth)/onboarding/callback/route.ts
@app/(auth)/login/actions.ts
@app/actions/settings.ts
@app/(dashboard)/layout.tsx
@app/(dashboard)/settings/page.tsx
@app/(dashboard)/settings/components/email-settings-card.tsx
@components/wizard-stepper.tsx
@lib/supabase/middleware.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add onboarding_complete flag and update redirect logic</name>
  <files>
    supabase/migrations/20260212100000_add_onboarding_complete_setting.sql
    app/actions/settings.ts
    app/page.tsx
    app/(auth)/login/actions.ts
    app/(auth)/onboarding/callback/route.ts
    lib/supabase/middleware.ts
  </files>
  <action>
1. **Create migration** `supabase/migrations/20260212100000_add_onboarding_complete_setting.sql`:
   - Insert a seed row: `INSERT INTO app_settings (key, value) VALUES ('onboarding_complete', 'false') ON CONFLICT (key) DO NOTHING;`
   - No schema change needed -- `app_settings` already exists with TEXT key/value and authenticated RLS policies.

2. **Add server actions to `app/actions/settings.ts`:**
   - `getOnboardingComplete(): Promise<boolean>` -- queries `app_settings` where key = `onboarding_complete`, returns `value === 'true'`. Default to `false` if row missing.
   - `markOnboardingComplete(): Promise<{ error?: string }>` -- upserts `app_settings` key `onboarding_complete` to `'true'`.

3. **Update `app/page.tsx`:**
   - After auth check (keep existing redirect to /login for unauthenticated), check if user email matches the demo pattern (`demo@peninsula-internal.local`). If demo user, redirect straight to `/dashboard`.
   - For non-demo users, call `getOnboardingComplete()`. If false, redirect to `/onboarding`. If true, redirect to `/dashboard`.

4. **Update `app/(auth)/login/actions.ts`:**
   - In `signInAsDemo()`, keep redirecting to `/dashboard` (unchanged -- demo users skip onboarding). The comment already says "skips onboarding" -- this is correct behavior.

5. **Update `app/(auth)/onboarding/callback/route.ts`:**
   - Change the final redirect from `/dashboard` to `/` (the root). The root page.tsx will then check onboarding status and redirect appropriately.
   - This way, after QuickBooks OAuth + client sync, the user hits `/` which sees `onboarding_complete=false` and sends them to `/onboarding`.

6. **Update `lib/supabase/middleware.ts`:**
   - Add `/onboarding` to the list of routes that authenticated users can access (it is NOT a public route -- user must be logged in). Currently the middleware only has public routes for unauthenticated users. Since `/onboarding` requires auth and the middleware already allows all authenticated routes, no change is needed here. BUT verify that `/onboarding` is not being blocked -- the middleware only redirects unauthenticated users away from non-public routes, so authenticated users can already access `/onboarding`. Confirm this logic is correct and leave middleware as-is if so.
  </action>
  <verify>
    - Run `npx supabase db push` or apply migration manually to add the setting row.
    - Check `app/page.tsx` compiles: `npx next build --no-lint` (or just check for TypeScript errors).
    - Verify the redirect chain: unauthenticated -> /login, demo user -> /dashboard, new QB user -> /onboarding, returning QB user (onboarding_complete=true) -> /dashboard.
  </verify>
  <done>
    - `onboarding_complete` setting exists in app_settings with default `false`.
    - Root page correctly routes: demo -> dashboard, new real user -> onboarding, returning real user -> dashboard.
    - OAuth callback redirects to `/` instead of `/dashboard`.
    - `markOnboardingComplete` and `getOnboardingComplete` actions exist in settings.ts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite onboarding wizard as 3-step flow with polished UI</name>
  <files>
    app/(auth)/onboarding/page.tsx
    app/(auth)/onboarding/layout.tsx
    app/(auth)/onboarding/components/onboarding-client-table.tsx
    app/(auth)/onboarding/components/email-config-form.tsx
  </files>
  <action>
1. **Rewrite `app/(auth)/onboarding/layout.tsx`:**
   - Add Peninsula Accounting branding at the top (same logo pair as login page and dashboard header: `logofini.png` + `peninsulaccountinglogo.jpg` with divider).
   - Keep the centered layout: `min-h-screen bg-background flex flex-col items-center justify-center p-4`.
   - Increase max width slightly: `max-w-5xl` (was `max-w-4xl`) to give the client table room.
   - Add auth check: use `createClient()` from `@/lib/supabase/server`, call `getUser()`, redirect to `/login` if not authenticated.

2. **Rewrite `app/(auth)/onboarding/page.tsx` as a streamlined 3-step wizard:**
   - Remove ALL mode selection logic (`SetupMode`, `handleModeSelect`, demo vs real steps).
   - Remove ALL QuickBooks connect logic (`handleConnect`, `connectSubState`, OAuth initiation).
   - Remove `useSearchParams` and the OAuth callback parameter handling.
   - Remove the `Suspense` wrapper (no longer needed without search params).

   **New step definitions:**
   ```
   type WizardStep = "clients" | "email" | "complete";
   const STEPS = [
     { label: "Clients" },
     { label: "Email" },
     { label: "Complete" },
   ];
   ```

   **Step 1 - Configure Clients (index 0):**
   - Heading: "Configure Your Clients" with subtext: "Set client types, year-end dates, and VAT details. You can also import from a CSV file."
   - Render `<OnboardingClientTable>` (already fetches clients internally -- see update below).
   - Bottom bar: ghost "Skip" button on left, primary "Continue" button with ArrowRight icon on right. Both advance to step "email".

   **Step 2 - Configure Email (index 1):**
   - Heading: "Email Settings" with subtext: "Configure the sender details for your reminder emails."
   - Render `<EmailConfigForm>` with `onSaved={() => setWizardStep("complete")}` and `onSkip={() => setWizardStep("complete")}`.
   - The EmailConfigForm already has Skip and Save & Continue buttons so no extra nav needed here.

   **Step 3 - Complete (index 2):**
   - Green checkmark icon (CheckCircle) in a success-colored circle.
   - Heading: "You're all set!"
   - Subtext: "Your system is configured and ready to send reminders."
   - Single primary button: "Go to Dashboard" that calls `markOnboardingComplete()` from settings actions, then `router.push("/dashboard")`.
   - Also add a small "Go to Dashboard" link/button that appears on skip-through -- actually, the "Go to Dashboard" button IS the completion action regardless. Clicking it marks onboarding complete and redirects.

   **Data fetching:**
   - Fetch clients in a useEffect when step is "clients" (same pattern as current code).
   - Fetch email settings in a useEffect when step is "email" (same pattern as current code).
   - Show Loader2 spinner while loading.

   **Use WizardStepper component** (existing `@/components/wizard-stepper`): pass `STEPS` and `stepToIndex(wizardStep)` where clients=0, email=1, complete=2.

3. **Update `app/(auth)/onboarding/components/onboarding-client-table.tsx`:**
   - Minor update: Change the text from "synced from QuickBooks" to just "{N} clients" since we no longer know the source at this point (could be demo or QB).
   - Keep all inline editing, CSV import functionality intact.

4. **Update `app/(auth)/onboarding/components/email-config-form.tsx`:**
   - No functional changes needed. The component already has Skip/Save & Continue buttons.
   - Optional: Add a "Back" button or pass an `onBack` callback. Actually, the wizard page handles navigation, and EmailConfigForm just calls `onSaved`/`onSkip`. This is fine as-is.

5. **Design system alignment:**
   - Use the same Card component (`@/components/ui/card`) for wrapping each step's content, matching the dashboard settings page style.
   - Use consistent spacing: `space-y-8` between major sections, `space-y-6` within cards.
   - Use the same heading hierarchy as dashboard: `text-2xl font-bold tracking-tight` for step headings, `text-muted-foreground` for subtexts.
   - Buttons: Use `Button` from `@/components/ui/button` consistently. Primary for "Continue"/"Go to Dashboard", ghost for "Skip".
   - Keep the `active:scale-[0.97]` micro-interaction on primary buttons (consistent with existing UI).
  </action>
  <verify>
    - Run `npx next dev` and navigate to `/onboarding` while logged in.
    - Verify 3-step wizard renders: Clients -> Email -> Complete.
    - Verify stepper shows correct progress (filled circles, connecting lines).
    - Verify client table loads and inline editing works.
    - Verify CSV import button works.
    - Verify email form loads with current settings.
    - Verify Skip buttons advance to next step.
    - Verify "Go to Dashboard" on complete step calls markOnboardingComplete and redirects.
    - After completing, visit `/` and verify redirect goes to `/dashboard` (not back to onboarding).
    - Verify demo login goes straight to dashboard, never seeing onboarding.
  </verify>
  <done>
    - Onboarding wizard has exactly 3 steps: Clients, Email, Complete.
    - No mode selection or QuickBooks connect steps.
    - UI matches dashboard design system (cards, spacing, typography, button styles).
    - Peninsula Accounting branding in layout.
    - Completing step 3 marks onboarding_complete=true and redirects to dashboard.
    - Demo users never see onboarding.
    - Returning users (onboarding_complete=true) skip onboarding.
  </done>
</task>

</tasks>

<verification>
1. **New QuickBooks user flow:** Login -> OAuth -> callback -> / -> /onboarding (3 steps) -> /dashboard. Subsequent visits to / go straight to /dashboard.
2. **Demo user flow:** Login -> "Try Demo" -> /dashboard. Never sees onboarding.
3. **Returning user flow:** Login (already has session) -> / -> /dashboard (onboarding_complete=true).
4. **No regressions:** Settings page email card still works. Client table on Clients page unaffected. Dashboard loads normally.
</verification>

<success_criteria>
- 3-step onboarding wizard (Clients -> Email -> Complete) renders correctly
- Onboarding appears once for new real users, never for demo users
- onboarding_complete flag persists in app_settings
- UI matches dashboard design system
- All existing functionality (inline editing, CSV import, email settings) works within wizard
- No TypeScript errors, no console errors
</success_criteria>

<output>
After completion, create `.planning/quick/004-streamlined-onboarding-wizard/004-SUMMARY.md`
</output>
