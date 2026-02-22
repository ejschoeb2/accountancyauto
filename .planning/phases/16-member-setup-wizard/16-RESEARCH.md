# Phase 16: Member Setup Wizard - Research

**Researched:** 2026-02-22
**Domain:** Next.js wizard flow, app_settings flag gating, CSV import refactor, component reuse
**Confidence:** HIGH — based entirely on reading existing codebase source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Who sees the wizard?**
- Invited members only — org creators already have onboarding (steps 1-4)
- After invite acceptance, redirect to setup wizard instead of dashboard

**Is it skippable?**
- Not skippable — must complete all steps before accessing the dashboard

**Wizard Steps:**

Step 1: Import Clients (CSV)
- Full-page version of the existing CSV import dialog (`csv-import-dialog.tsx`)
- Same flow: upload → column mapping → edit/review data → import → results
- NOT inside a popup/dialog — rendered as a full page within the wizard
- Reuse the same server action (`importClientMetadata`) and validation logic

Step 2: Configuration
- Send hour picker — same pattern as settings page `SendHourPicker` (6am-9pm dropdown)
- Inbound email configuration — same pattern as settings page `InboundCheckerCard` (auto/recommend mode)
- Email settings — same pattern as `MemberSettingsCard` (sender name, sender email, reply-to)
  - Note: UI built now, backend already wired from Phase 15 (`updateUserSendHour`, `updateUserEmailSettings`)
- Look to settings page for how all of these should look in the wizard

**Post-wizard:**
- After completing both steps, redirect to dashboard
- Mark setup as complete (prevent re-showing wizard on future logins)

**Design Patterns:**
- Use existing `WizardStepper` component for progress indication
- Follow card layout patterns from settings page
- Follow DESIGN.md guidelines for all UI components

### Claude's Discretion

Not specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

Not specified in CONTEXT.md.
</user_constraints>

---

## Summary

Phase 16 builds a member-only post-invite setup wizard. All infrastructure for the wizard's two steps exists: the CSV import server action (`importClientMetadata` in `app/actions/csv.ts`), the member settings server actions (`updateUserSendHour`, `updateUserEmailSettings`, `updateInboundCheckerMode` in `app/actions/settings.ts`), and the WizardStepper component (`components/wizard-stepper.tsx`).

The primary implementation work is: (1) routing — creating an `/app/(auth)/setup` route group and a `/setup/wizard` page that redirects to dashboard on completion, (2) extracting the inner logic of `csv-import-dialog.tsx` into a standalone full-page component for Step 1, (3) lifting the Step 2 config fields (send hour, inbound mode, email identity) into a combined wizard step using the same patterns as `MemberSettingsCard`, (4) writing a `member_setup_complete` per-user flag in `app_settings` after step 2, and (5) gating the wizard: redirect from invite accept page to `/setup/wizard`, and block post-wizard dashboard access until the flag is set.

The gating strategy mirrors the existing onboarding gating pattern used in `app/(auth)/onboarding/layout.tsx` — a server-component layout that reads a flag and redirects if the wizard is incomplete. The middleware does NOT need to read DB for this check (too expensive); the layout gate pattern is correct.

**Primary recommendation:** Build the wizard as `app/(auth)/setup/wizard/page.tsx` (client component, mirrors onboarding page structure), with a layout gate in `app/(auth)/setup/layout.tsx`. Add a `member_setup_complete` per-user flag in `app_settings` (key: `"member_setup_complete"`, `user_id` = user's UUID, org-scoped). Redirect the invite accept page to `/setup/wizard` instead of `/`. Gate the dashboard layout to redirect members who have no `member_setup_complete` flag to `/setup/wizard`.

---

## Standard Stack

### Core (all already installed)
| Library | Purpose | Already Used |
|---------|---------|--------------|
| Next.js App Router | Route groups, layouts, server/client components | Yes |
| `papaparse` | CSV parsing in import dialog | Yes (`csv-import-dialog.tsx`) |
| `xlsx` | Excel parsing in import dialog | Yes (`csv-import-dialog.tsx`) |
| Supabase SSR client | Server actions, auth, app_settings | Yes |
| React `useTransition` | Optimistic UI for save actions | Yes (all settings cards) |

**No new npm packages required.** All dependencies are present.

### Key Server Actions (already exist, reuse directly)
| Action | Location | Purpose in Wizard |
|--------|----------|-------------------|
| `importClientMetadata` | `app/actions/csv.ts` | Step 1 import |
| `updateUserSendHour` | `app/actions/settings.ts` | Step 2 send hour |
| `updateUserEmailSettings` | `app/actions/settings.ts` | Step 2 email identity |
| `updateInboundCheckerMode` | `app/actions/settings.ts` | Step 2 inbound mode |
| `getUserSendHour` | `app/actions/settings.ts` | Prefill Step 2 defaults |
| `getUserEmailSettings` | `app/actions/settings.ts` | Prefill Step 2 defaults |
| `getInboundCheckerMode` | `app/actions/settings.ts` | Prefill Step 2 defaults |

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── (auth)/
│   ├── setup/
│   │   ├── layout.tsx              # Server component — wizard completion gate
│   │   └── wizard/
│   │       ├── page.tsx            # Client component — wizard shell + WizardStepper
│   │       └── components/
│   │           ├── csv-import-step.tsx     # Step 1: full-page CSV import (extracted from dialog)
│   │           └── config-step.tsx         # Step 2: send hour + inbound + email identity
│   └── invite/
│       └── accept/
│           ├── page.tsx            # MODIFIED: redirect to /setup/wizard instead of /
│           └── actions.ts          # UNMODIFIED
app/
├── (dashboard)/
│   └── layout.tsx                  # MODIFIED: gate members with no member_setup_complete
```

### Pattern 1: Wizard Completion Flag in app_settings

**What:** Per-user, per-org flag stored in `app_settings` table.
**Key:** `"member_setup_complete"`, value `"true"`, `user_id` = user UUID, `org_id` = org UUID.
**When to use:** After both wizard steps complete successfully and user clicks "Go to Dashboard".

The `app_settings` table already supports per-user rows via the `(org_id, user_id, key)` UNIQUE constraint (with NULLS NOT DISTINCT so null = org-level). This is exactly how `updateUserSendHour` and `updateUserEmailSettings` work — use the identical upsert pattern.

```typescript
// Source: app/actions/settings.ts — updateUserSendHour pattern
// New action to add to app/actions/settings.ts:
export async function markMemberSetupComplete(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: user.id, key: "member_setup_complete", value: "true" },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}

export async function getMemberSetupComplete(): Promise<boolean> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("key", "member_setup_complete")
    .maybeSingle();

  return data?.value === "true";
}
```

### Pattern 2: Wizard Layout Gate (Server Component)

**What:** `app/(auth)/setup/layout.tsx` checks wizard completion and redirects already-complete users to dashboard. Mirrors exactly the `app/(auth)/onboarding/layout.tsx` approach.

```typescript
// Source: app/(auth)/onboarding/layout.tsx pattern
// app/(auth)/setup/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberSetupComplete } from "@/app/actions/settings";
import { getOrgId } from "@/lib/auth/org-context";

export default async function SetupLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If wizard already complete, redirect to dashboard
  try {
    const complete = await getMemberSetupComplete();
    if (complete) {
      const orgId = await getOrgId();
      // Resolve org slug and redirect (same pattern as onboarding layout)
      // ...
      redirect("/"); // simplified — resolve org slug for full redirect
    }
  } catch {
    // Not authenticated or no org — let wizard handle it
  }

  return <>{children}</>;
}
```

### Pattern 3: Dashboard Layout Gate for Incomplete Members

**What:** `app/(dashboard)/layout.tsx` checks `member_setup_complete` for members (role !== "admin") and redirects to wizard if not set.

**CRITICAL CONSTRAINT:** This check must only apply to members, not admins. Admins went through onboarding, not the wizard. Check `orgRole` (already fetched in the layout) before checking the flag.

```typescript
// Source: app/(dashboard)/layout.tsx — add after existing orgRole fetch
if (orgRole === "member") {
  const setupComplete = await getMemberSetupComplete();
  if (!setupComplete) {
    const isDev = process.env.NODE_ENV === "development";
    // Redirect to setup wizard (org subdomain already established at this point)
    redirect("/setup/wizard");
  }
}
```

**Warning:** Only call `getMemberSetupComplete()` inside the `try` block where `getOrgContext()` succeeds. The existing layout already has a try/catch for org context failures — extend that.

### Pattern 4: Invite Accept Redirect

**What:** After `acceptInvite` succeeds and `supabase.auth.refreshSession()` completes, redirect to `/setup/wizard` instead of `/`.

**Current code** (in `app/(auth)/invite/accept/page.tsx`, `handleAccept` function):
```typescript
// CURRENT (line 86-89):
if (isDev) {
  window.location.href = `/?org=${orgSlug}`;
} else {
  window.location.href = `https://${orgSlug}.app.phasetwo.uk/`;
}

// CHANGE TO:
if (isDev) {
  window.location.href = `/setup/wizard?org=${orgSlug}`;
} else {
  window.location.href = `https://${orgSlug}.app.phasetwo.uk/setup/wizard`;
}
```

### Pattern 5: CSV Import Step (Full-Page Extraction)

**What:** Extract the internal state machine from `CsvImportDialog` into a standalone `CsvImportStep` component that renders full-page (no Dialog wrapper).

**Key insight from reading the dialog source:** The dialog uses internal `DialogState = "upload" | "mapping" | "edit-data" | "importing" | "results"` with `useState`. All logic (file parsing, column mapping, `importClientMetadata` call) is self-contained. The only dialog-specific code is:
- The `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogFooter>` wrappers
- The `open`/`onOpenChange` props
- The `handleOpenChange` (close/reset logic)

**Extraction strategy:** Copy the component body, replace Dialog wrappers with `<div>` / `<Card>` wrappers, replace `onOpenChange(false)` + reset with a call to `onComplete()` prop, replace `handleDone` with navigation to step 2 (or `onComplete()` callback).

The `csv-import-dialog.tsx` should remain UNCHANGED. The wizard uses a new `CsvImportStep` component that duplicates the logic without the Dialog shell. This avoids breaking the existing clients page dialog.

### Pattern 6: Config Step (Step 2)

**What:** A single-card (or multi-card) step with send hour, inbound checker mode, and email identity fields. Uses the same patterns as `MemberSettingsCard` but adapted for the wizard context.

**Key insight from `MemberSettingsCard`:** It already combines all three settings in one card with a single "Save Changes" button. The wizard Config Step should use this same layout — essentially render what `MemberSettingsCard` renders but with a "Save & Continue" button instead of "Save Changes".

The wizard needs to save all three settings and then call `markMemberSetupComplete()` + redirect to dashboard. Use the same `updateUserSendHour` + `updateUserEmailSettings` + `updateInboundCheckerMode` pattern.

**Prefilling:** Fetch current defaults server-side in `setup/wizard/page.tsx` (or as a server action called on mount) using `getUserSendHour()`, `getUserEmailSettings()`, `getInboundCheckerMode()`. These return org-level defaults for new users — a good starting point.

### Pattern 7: WizardStepper Usage

**What:** The existing `WizardStepper` component in `components/wizard-stepper.tsx` is already perfect. Takes `steps` array and 0-indexed `currentStep`.

```typescript
// Source: components/wizard-stepper.tsx
import { WizardStepper } from "@/components/wizard-stepper";

const STEPS = [
  { label: "Import Clients" },
  { label: "Configuration" },
];

// In wizard page:
<WizardStepper steps={STEPS} currentStep={currentStep} /> // 0 or 1
```

### Pattern 8: Middleware — /setup Routes

**What:** The middleware must allow `/setup` routes through (authenticated users with org context can reach `/setup/wizard`). The middleware's subscription enforcement in `access-gating.ts` redirects expired subscribers to `/billing` — this would also block `/setup/wizard`.

**Current `enforceSubscription` allows through:** `/billing`, `/auth`, `/login`, `/api/`.
**Must add:** `/setup` to the allowed-through list in `enforceSubscription`.

```typescript
// Source: lib/middleware/access-gating.ts — enforceSubscription
// Add to the "always allow through" check:
if (
  pathname.startsWith('/billing') ||
  pathname.startsWith('/auth') ||
  pathname.startsWith('/login') ||
  pathname.startsWith('/api/') ||
  pathname.startsWith('/setup')   // ADD THIS
) {
  return null;
}
```

Also, `/setup/wizard` is NOT a public route (requires auth + org), so it must NOT be added to `PUBLIC_ROUTES` in `lib/supabase/middleware.ts`. The normal auth flow (Steps 7-10) handles it correctly — user is authenticated, org is resolved, membership is validated.

### Anti-Patterns to Avoid

- **Gating in middleware with DB reads:** The middleware already runs many DB queries. Do NOT add `app_settings` reads to middleware for wizard gate. Use the layout.tsx server component pattern (same as onboarding) — it runs once per page load, not per request.
- **Modifying `csv-import-dialog.tsx`:** Keep it unchanged. The clients page dialog still needs it. Build a separate `CsvImportStep` component for the wizard.
- **Auto-save in Step 2:** Do NOT use auto-save (the way `SendHourPicker` saves immediately on select change). In the wizard context, save all Step 2 fields together via a single "Save & Continue" button. This mirrors `MemberSettingsCard`'s single-save pattern, not `SendHourPicker`'s auto-save pattern.
- **Gating admins in dashboard layout:** The `member_setup_complete` check must be SKIPPED for admins. Admins never go through the wizard — they went through onboarding. Always check `orgRole` before checking the flag.
- **Wizard flag with null user_id:** Do NOT store `member_setup_complete` as an org-level flag (user_id NULL). It is per-user. Each member must complete their own wizard. Use `user_id = user.id` (non-null).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom parser | `papaparse` + `xlsx` already in dialog | Edge cases in CSV quoting, Excel date serials, BOM markers |
| Column mapping logic | Custom string matching | Copy `autoSuggestMapping` from dialog | Already handles exact + partial match, normalises case/spaces |
| Date parsing | Custom date parser | Copy `parseDate` from dialog | Already handles Excel serials, DD/MM/YYYY, YYYY-MM-DD |
| App settings upsert | Custom flag table | `app_settings` with `(org_id, user_id, key)` unique constraint | Already has correct NULLS NOT DISTINCT constraint from Phase 15 |
| Wizard progress UI | Custom stepper | `WizardStepper` component | Already exists, already used in onboarding |

---

## Common Pitfalls

### Pitfall 1: Gating Admins Out of Dashboard
**What goes wrong:** The dashboard layout gate checks `member_setup_complete` for ALL users, including admins. Admins never set this flag, so they get redirected to `/setup/wizard` every login.
**Why it happens:** Flag only set for users who go through the wizard. Admins bypass it.
**How to avoid:** Only check `getMemberSetupComplete()` when `orgRole === "member"`. Add guard before the check.
**Warning signs:** Org admin gets redirected to wizard on login.

### Pitfall 2: Subscription Enforcement Blocking /setup/wizard
**What goes wrong:** A member accepts an invite to an org with an expired trial. They hit `/setup/wizard` and get redirected to `/billing` before completing wizard.
**Why it happens:** `enforceSubscription` in `access-gating.ts` does not exempt `/setup`.
**How to avoid:** Add `pathname.startsWith('/setup')` to the allow-through list in `enforceSubscription`.
**Warning signs:** Wizard redirect loops or ends up at `/billing`.

### Pitfall 3: Wizard Re-Entry for Existing Members
**What goes wrong:** A member who already completed the wizard can somehow reach `/setup/wizard` and re-do it.
**Why it happens:** No completion check in the setup layout.
**How to avoid:** In `app/(auth)/setup/layout.tsx`, check `getMemberSetupComplete()` — if true, redirect to `/` (dashboard).

### Pitfall 4: CSV Import Resets on Wizard Step Navigation
**What goes wrong:** User completes CSV import in Step 1, navigates forward, then back — import state is gone.
**Why it happens:** In a single-page wizard client component, going back re-mounts the step, resetting useState.
**How to avoid:** The wizard does not allow going BACK from Step 2 to Step 1 (CSV import is one-way). Once Step 1 is "complete" (user clicks Next: Configure), the wizard moves forward. No back button on Step 2. This is consistent with the CONTEXT.md decision "not skippable."

### Pitfall 5: Import Matches Against Unowned Clients
**What goes wrong:** In a multi-member org, the CSV import in `importClientMetadata` fetches ALL clients for the org (via RLS). The import matches against all org clients, not just the member's own clients.
**Why it happens:** The existing `importClientMetadata` action uses `supabase.from("clients").select("id, company_name")` — RLS scopes to org, but not to `owner_id`.
**How to avoid:** This is actually CORRECT behavior. The wizard CSV import should update client metadata for all clients the user has access to. The import is updating metadata fields (year_end, VAT, etc.), not ownership. No change needed.

### Pitfall 6: Session Not Refreshed After Invite Accept Before Wizard
**What goes wrong:** User accepts invite, gets redirected to `/setup/wizard`. The wizard tries to call `getOrgId()` which reads JWT `app_metadata.org_id`. But the JWT hasn't been refreshed yet, so `org_id` is missing.
**Why it happens:** The invite accept page calls `supabase.auth.refreshSession()` before redirecting. But a full page navigation (`window.location.href`) clears React state. The new page makes a fresh request. The refreshed token is in the cookie — so it should work.
**How to avoid:** Confirm the `refreshSession()` call in `invite/accept/page.tsx` fires before `window.location.href` is set. It does (line 78 before line 84 in the current code). No change needed. But verify in testing.

### Pitfall 7: Wizard `/setup` Not in PUBLIC_ROUTES but Needs Org Context
**What goes wrong:** Middleware tries to resolve org from slug for `/setup/wizard` but the user just accepted an invite and has a fresh JWT. The org_id is in JWT `app_metadata`, so Step 8 of middleware handles it correctly.
**How to avoid:** No special handling needed in middleware for `/setup` — the normal auth flow (Steps 7-10 in `lib/supabase/middleware.ts`) works correctly for authenticated, org-assigned users.

---

## Code Examples

### How app_settings upsert works (per-user flag)
```typescript
// Source: app/actions/settings.ts — updateUserSendHour
const { error } = await supabase
  .from("app_settings")
  .upsert(
    { org_id: orgId, user_id: user.id, key: "member_setup_complete", value: "true" },
    { onConflict: "org_id,user_id,key" }
  );
```

### WizardStepper usage in wizard page
```typescript
// Source: app/(auth)/onboarding/page.tsx + components/wizard-stepper.tsx
import { WizardStepper } from "@/components/wizard-stepper";

const STEPS = [
  { label: "Import Clients" },
  { label: "Configuration" },
];

// step is 0-indexed: 0 = CSV import, 1 = config
<WizardStepper steps={STEPS} currentStep={step} />
```

### Invite accept redirect change
```typescript
// Source: app/(auth)/invite/accept/page.tsx — handleAccept (currently line 84-89)
// BEFORE:
if (isDev) {
  window.location.href = `/?org=${orgSlug}`;
} else {
  window.location.href = `https://${orgSlug}.app.phasetwo.uk/`;
}

// AFTER:
if (isDev) {
  window.location.href = `/setup/wizard?org=${orgSlug}`;
} else {
  window.location.href = `https://${orgSlug}.app.phasetwo.uk/setup/wizard`;
}
```

### Dashboard layout gate for incomplete members
```typescript
// Source: app/(dashboard)/layout.tsx — add inside the existing try block
// After: const { orgId, orgRole: role } = await getOrgContext();
if (role === "member") {
  const { getMemberSetupComplete } = await import("@/app/actions/settings");
  const setupComplete = await getMemberSetupComplete();
  if (!setupComplete) {
    redirect("/setup/wizard");
  }
}
```

### CsvImportStep skeleton (extracted from dialog)
```typescript
// app/(auth)/setup/wizard/components/csv-import-step.tsx
"use client";

// Same imports as csv-import-dialog.tsx but NO Dialog imports
// Same state: DialogState, ColumnMapping, ParsedCsvData, EditableRow
// Same handlers: parseFile, autoSuggestMapping, handleProceedWithMapping, etc.
// Same rendering for each state — but wrapped in <div> / <Card> instead of <DialogContent>

interface CsvImportStepProps {
  onComplete: () => void; // called after import results shown + user clicks "Next"
}

export function CsvImportStep({ onComplete }: CsvImportStepProps) {
  // ... all state and handlers from CsvImportDialog ...
  // Replace: handleDone → onComplete()
  // Replace: handleOpenChange(false) → onComplete() (for Cancel button — or remove Cancel entirely)
  // Replace: DialogContent wrapper → <div className="space-y-6"> wrapper
  // Replace: DialogHeader → <div> with title/description
  // Replace: DialogFooter → <div className="flex justify-end gap-3">
}
```

---

## State of the Art

| Concern | Current Approach | Wizard Approach |
|---------|------------------|-----------------|
| Wizard completion gate | `onboarding_complete` flag in `app_settings` (org-level, user_id null) | `member_setup_complete` flag in `app_settings` (per-user, user_id = member UUID) |
| Wizard layout guard | `app/(auth)/onboarding/layout.tsx` server component | `app/(auth)/setup/layout.tsx` server component (same pattern) |
| CSV import | Inside `<Dialog>` via `CsvImportDialog` | Extracted to full-page `CsvImportStep` (same logic, no dialog wrapper) |
| Settings in wizard | N/A | Lifted directly from `MemberSettingsCard` pattern |

---

## Open Questions

1. **Should the wizard allow "Skip" for Step 1 (CSV import)?**
   - What we know: CONTEXT.md says wizard is "not skippable — must complete all steps."
   - What's unclear: Does this mean the CSV import must succeed (clients must be imported), or just that the user must click through all wizard steps even if they skip the CSV upload?
   - Recommendation: Interpret as "must view all steps" not "must import at least one client." The "Import 0 Clients" / "Done" flow of the existing dialog already handles empty results gracefully. Allow the user to proceed to Step 2 even if they don't import any clients (show a "No file uploaded, skip import" or allow them to reach the results state with 0 rows).

2. **Where does `/setup/wizard` fit in the auth/layout route group structure?**
   - What we know: `app/(auth)/` is the route group for pre-dashboard flows (onboarding, invite accept). This is the correct home for the wizard. It uses the auth route group's lack of dashboard nav.
   - What's unclear: Does `app/(auth)/` have a shared layout.tsx? It does not appear to (no file found). Each sub-route has its own layout (onboarding/layout.tsx, invite/accept has none).
   - Recommendation: Create `app/(auth)/setup/layout.tsx` as the wizard gate (server component). The branding/centering from onboarding layout should be replicated — use `min-h-screen bg-background flex flex-col items-center justify-center`.

3. **Should the wizard be shown to admins who were invited (not org creators)?**
   - What we know: CONTEXT.md says "invited members only." An admin could theoretically be invited (role=admin in invitation). After accepting, they'd have `orgRole === "admin"`.
   - What's unclear: Should invited admins go through the wizard?
   - Recommendation: Gate by invite path, not role. The invite accept page redirect to `/setup/wizard` handles all invitees regardless of role. The dashboard layout gate only checks `orgRole === "member"` for admin-bypass. This means invited admins DO go through the wizard (good — they need their email settings). The dashboard gate skips the flag check for admins but they already set the flag via wizard completion. **Simpler alternative:** Make the dashboard gate check the flag for ALL roles (not just members). If the admin completed wizard, flag is set. If they created the org via onboarding, flag is not set — so the gate would also redirect them. This is wrong. **Conclusion:** Either (a) set `member_setup_complete = true` for org creators during `createOrgAndJoinAsAdmin`, or (b) only gate members in the dashboard layout. Option (b) is simpler — invited admins go through wizard but the gate only applies to members. If an invited admin has `orgRole="admin"`, they bypass the dashboard gate even without the flag. This is acceptable.

---

## Sources

### Primary (HIGH confidence — codebase source files)
- `components/wizard-stepper.tsx` — WizardStepper API, props, rendering
- `app/(dashboard)/clients/components/csv-import-dialog.tsx` — Full dialog source, all state/handlers
- `app/actions/csv.ts` — `importClientMetadata` server action
- `app/actions/settings.ts` — All settings server actions, `app_settings` upsert patterns
- `app/(dashboard)/settings/components/member-settings-card.tsx` — Step 2 reference UI
- `app/(dashboard)/settings/components/send-hour-picker.tsx` — Send hour pattern
- `app/(dashboard)/settings/components/inbound-checker-card.tsx` — Inbound mode pattern
- `app/(auth)/invite/accept/page.tsx` — Invite accept flow, redirect location
- `app/(auth)/invite/accept/actions.ts` — `acceptInvite` server action
- `app/(auth)/onboarding/layout.tsx` — Layout gate pattern to mirror
- `app/(auth)/onboarding/page.tsx` — WizardStepper usage pattern
- `lib/supabase/middleware.ts` — `updateSession` middleware, PUBLIC_ROUTES, auth flow steps
- `lib/middleware/access-gating.ts` — `enforceSubscription`, paths to add `/setup`
- `lib/auth/org-context.ts` — `getOrgId`, `getOrgContext`
- `app/(dashboard)/layout.tsx` — Dashboard layout, where to add member gate

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed by reading source files
- Architecture: HIGH — patterns confirmed by reading existing equivalent patterns (onboarding, settings)
- Pitfalls: HIGH — identified from reading actual code paths that would interact with wizard

**Research date:** 2026-02-22
**Valid until:** 60 days — this is internal codebase research, not external library research
