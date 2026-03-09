# Plan: Move Stripe Checkout from Plan Step to Complete Step

## Goal
Make the plan step selection-only (no Stripe). Move Stripe checkout to the final "Complete" step so users configure everything before paying. Prevents duplicate subscriptions, allows free plan changes mid-wizard, and enforces client limits before payment.

## Current State
- `handleSelectPlan` in `app/(auth)/setup/wizard/page.tsx` creates the org AND redirects to Stripe for paid plans
- The "Complete" step just calls `seedOrgDefaultsForWizard`, `markOrgSetupComplete`, `refreshWizardSession`, then redirects to dashboard
- `committedTier` tracks what plan was paid for (to avoid re-checkout)
- `updateOrgPlanTier` server action updates `plan_tier` + `client_count_limit`

## Files Modified
- `app/(auth)/setup/wizard/page.tsx` — main wizard logic
- `app/(auth)/setup/wizard/actions.ts` — may need minor changes

## Tasks

### Task 1: Make plan step selection-only
**File:** `app/(auth)/setup/wizard/page.tsx`

In `handleSelectPlan`:
1. Remove the entire Stripe checkout block (the `fetch("/api/stripe/create-checkout-session"...)` and redirect logic)
2. For ALL tiers (free and paid): create org (idempotent), call `updateOrgPlanTier(tier)`, set `orgCreated(true)`, advance to import
3. Keep `selectedTier` state — it tracks the user's plan choice throughout the wizard
4. Remove `committedTier` state entirely — no longer needed since Stripe doesn't happen mid-wizard
5. Remove `sessionStorage.getItem/setItem("wizard_committed_tier")` references
6. Remove the `committedTier` check from the "Next Step" button — button should now just call `handleSelectPlan(selectedTier)` if tier changed, or advance if same tier and org exists

Simplified `handleSelectPlan` should be:
```typescript
const handleSelectPlan = async (tier: PlanTier) => {
  setSelectedTier(tier);
  setIsCreatingOrg(true);
  setPlanError(null);
  try {
    await createOrgAndJoinAsAdmin(firmName, slug, tier);
    await supabase.auth.refreshSession();
    await updateOrgPlanTier(tier);
    prefetchConfigDefaults();
    setIsCreatingOrg(false);
    setOrgCreated(true);
    setAdminStep("import");
  } catch (err) {
    setPlanError(err instanceof Error ? err.message : "Failed to create organisation. Please try again.");
    setSelectedTier(null);
    setIsCreatingOrg(false);
  }
};
```

The "Next Step" button on the plan step:
```typescript
onClick={() => {
  if (!selectedTier) return;
  if (orgCreated && selectedTier === selectedTier_last) {
    // Same plan, just advance
    setAdminStep("import");
  } else {
    handleSelectPlan(selectedTier);
  }
}}
```
Actually simpler: always call `handleSelectPlan` — `createOrgAndJoinAsAdmin` is idempotent, `updateOrgPlanTier` is idempotent. Just always run it. The only optimization is skipping the server calls if nothing changed, but it's fine to always run them.

### Task 2: Update the Complete step to handle Stripe checkout for paid plans
**File:** `app/(auth)/setup/wizard/page.tsx`

The "Complete" step currently shows a "Go to Dashboard" button. Change it to:
- If `selectedTier === "free"`: show "Go to Dashboard" button (existing behavior — calls `handleGoToDashboard`)
- If `selectedTier` is a paid tier: show "Subscribe & Launch" button that:
  1. Calls `seedOrgDefaultsForWizard(clientPortalEnabled)`
  2. Calls `markOrgSetupComplete()`
  3. Calls `refreshWizardSession()`
  4. Creates a Stripe checkout session via `fetch("/api/stripe/create-checkout-session", ...)`
  5. Sets `sessionStorage.setItem("wizard_return_step", "stripe-complete")` (new value to distinguish from old flow)
  6. Redirects to Stripe checkout URL
  7. On return from Stripe (detected by `?from=stripe` URL param), user lands on dashboard (not back in wizard)

Wait — actually, the success URL should go to the DASHBOARD, not back to the wizard. The wizard is done. So:
- `successUrl` should be the dashboard URL (use `getWizardDashboardUrl()` to get it)
- No need to return to the wizard at all

But we need to call `markOrgSetupComplete` BEFORE redirecting to Stripe, otherwise if the user returns and the middleware checks `setup_complete`, they'd be sent back to the wizard.

Updated flow for paid plans on Complete step:
1. `await seedOrgDefaultsForWizard(clientPortalEnabled)`
2. `await markOrgSetupComplete()`
3. `await refreshWizardSession()`
4. Get dashboard URL via `await getWizardDashboardUrl()`
5. Create Stripe checkout session with `successUrl` = dashboard URL (relative path)
6. Clean up sessionStorage
7. Redirect to Stripe

For the Stripe success URL — since the dashboard is on a subdomain in production, we need the full URL. But `create-checkout-session` prepends `NEXT_PUBLIC_APP_URL`. So we need to handle this:
- In dev: `/dashboard?org=slug` — works with `NEXT_PUBLIC_APP_URL` prefix
- In prod: `https://slug.app.prompt.accountants/dashboard` — this is a full URL, can't prepend `NEXT_PUBLIC_APP_URL`

Solution: pass the full dashboard URL as `successUrl` to the API route, and modify the API route to use it directly if it starts with `http`.

OR simpler: have the Stripe success URL go to `/setup/wizard?from=stripe-complete`, and in the wizard mount logic, detect this and redirect to dashboard immediately after cleaning up.

**Recommended approach (simpler):**
- Success URL: `/setup/wizard?from=stripe-complete`
- In the wizard mount effect, detect `?from=stripe-complete`:
  - Clean up all sessionStorage
  - Redirect to dashboard URL via `getWizardDashboardUrl()`
- This reuses existing infrastructure and handles both dev/prod

### Task 3: Update mount effect for stripe-complete return
**File:** `app/(auth)/setup/wizard/page.tsx`

In the mount `useEffect`, add handling for `?from=stripe-complete` BEFORE the existing `?from=stripe` check:

```typescript
const fromStripeComplete = urlParams.get("from") === "stripe-complete";

if (fromStripeComplete) {
  // Wizard already completed before Stripe redirect — go to dashboard
  sessionStorage.removeItem("wizard_admin_step");
  sessionStorage.removeItem("wizard_portal_enabled");
  sessionStorage.removeItem("wizard_return_step");
  const url = await getWizardDashboardUrl();
  isNavigatingAway.current = true;
  window.location.href = url;
  return; // Don't setIsCheckingAuth — we're navigating away
}
```

Also update/remove the existing `fromStripe` handling since it's no longer needed (Stripe doesn't happen at the plan step anymore). The `?from=stripe` case and `wizard_return_step === "stripe"` sessionStorage handling should be removed or converted to handle `stripe-complete` only.

### Task 4: Clean up unused code
**File:** `app/(auth)/setup/wizard/page.tsx`

Remove:
- `committedTier` state and its `useEffect` for sessionStorage persistence
- `sessionStorage.removeItem("wizard_committed_tier")` from `handleGoToDashboard`
- The `wizard_return_step === "stripe"` sessionStorage fallback in mount effect (the old plan-step Stripe flow)
- The `fromStripe` handling that sets `adminStep("import")` — no longer needed
- `isNavigatingAway` usage in `handleSelectPlan` (no longer navigating to Stripe from plan step)

Keep:
- `sessionStorage.setItem("wizard_return_step", "stripe")` is removed from plan step
- The `create-checkout-session` API route stays as-is (used from complete step now)

### Task 5: Update the Complete step UI
**File:** `app/(auth)/setup/wizard/page.tsx`

Find the complete step render section (look for `adminStep === "complete"`). Currently it has a "Go to Dashboard" button. Update:

- Show the selected plan name and price in the complete step summary
- If paid: button text = "Subscribe & Go to Dashboard" with a note "You'll be redirected to Stripe to complete payment"
- If free: button text = "Go to Dashboard" (unchanged)
- Both call the same `handleGoToDashboard` but the paid path includes Stripe checkout before redirect

Modify `handleGoToDashboard`:
```typescript
const handleGoToDashboard = async () => {
  setIsLeavingWizard(true);
  await seedOrgDefaultsForWizard(clientPortalEnabled);
  await markOrgSetupComplete();
  await refreshWizardSession();

  if (selectedTier && selectedTier !== "free") {
    // Paid plan — redirect to Stripe checkout, then to dashboard
    // Need orgId for checkout session
    const admin = createAdminClient(); // Can't use admin client here (client component)
    // Instead, get orgId from the user's JWT or a server action

    // Actually: we need the orgId. Options:
    // 1. Store it in component state when createOrgAndJoinAsAdmin returns
    // 2. Create a server action to get it
    // 3. Read from user.app_metadata.org_id

    // Best: store orgId in state from handleSelectPlan
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planTier: selectedTier,
        orgId: orgId, // need this in state
        successUrl: "/setup/wizard?from=stripe-complete",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setCompleteError(data.error || "Failed to start checkout.");
      setIsLeavingWizard(false);
      return;
    }
    if (data.url) {
      sessionStorage.removeItem("wizard_admin_step");
      sessionStorage.removeItem("wizard_portal_enabled");
      sessionStorage.removeItem("wizard_return_step");
      isNavigatingAway.current = true;
      window.location.href = data.url;
    }
  } else {
    // Free plan — go straight to dashboard
    sessionStorage.removeItem("wizard_admin_step");
    sessionStorage.removeItem("wizard_portal_enabled");
    sessionStorage.removeItem("wizard_return_step");
    isNavigatingAway.current = true;
    window.location.href = dashboardUrl;
  }
};
```

### Task 6: Store orgId in component state
**File:** `app/(auth)/setup/wizard/page.tsx`

Add `orgId` state:
```typescript
const [orgId, setOrgId] = useState<string | null>(null);
```

Set it in `handleSelectPlan` when `createOrgAndJoinAsAdmin` returns:
```typescript
const result = await createOrgAndJoinAsAdmin(firmName, slug, tier);
setOrgId(result.orgId);
```

Also restore it on mount when `orgCreated` is set to true (e.g., from sessionStorage restoration). For this, read `org_id` from the user's JWT `app_metadata`:
```typescript
// In the mount effect, when setting orgCreated(true):
const orgIdFromJwt = user.app_metadata?.org_id;
if (orgIdFromJwt) setOrgId(orgIdFromJwt);
```

Persist orgId in sessionStorage as `wizard_org_id` so it survives the Stripe redirect (needed for stripe-complete return, though we won't need it there since we go to dashboard).

## Verification
- [ ] Selecting any plan (free or paid) advances to import with no Stripe redirect
- [ ] Going back to plan step and changing plans updates client_count_limit correctly
- [ ] Import step shows correct client limit for selected plan
- [ ] Complete step shows "Subscribe & Go to Dashboard" for paid plans
- [ ] Complete step shows "Go to Dashboard" for free plans
- [ ] Clicking "Subscribe & Go to Dashboard" redirects to Stripe checkout
- [ ] After Stripe payment, user lands on their dashboard (not back in wizard)
- [ ] Free plan users go directly to dashboard from complete step
- [ ] No duplicate Stripe subscriptions possible
- [ ] sessionStorage is cleaned up properly on wizard completion
