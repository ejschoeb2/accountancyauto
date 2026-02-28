# Phase 28: Settings UI & Token Lifecycle - Research

**Researched:** 2026-02-28
**Domain:** Settings UI polish, cron health-check, privacy policy update
**Confidence:** HIGH — all findings based directly on reading existing codebase files

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOKEN-01 | Settings page Storage tab with connect/disconnect cards for all three providers (Google Drive, OneDrive, Dropbox) showing connected account email, root folder path, and token health indicator | StorageCard has Google Drive + OneDrive; DropboxConnectCard exists as separate component — needs wiring into StorageCard or StorageTab unified rendering |
| TOKEN-02 | Persistent re-auth banner in dashboard layout when `storage_backend_status = 'reauth_required'`; links to Settings > Storage; disappears once reconnected; follows Postmark failed-email banner pattern | Re-auth banner IS already implemented in `app/(dashboard)/layout.tsx` — but hardcoded to say "Google Drive connection has expired"; needs to be provider-generic |
| TOKEN-03 | Disconnect confirmation modal shows document count for that provider; requires explicit confirmation before clearing tokens | Disconnect actions exist in `settings.ts` but are called directly — no confirmation modal; document count query via `client_documents WHERE storage_backend = '{provider}'` |
| TOKEN-04 | Daily health-check cron performs lightweight API call per org with active non-Supabase backend; on failure sets `storage_backend_status = 'error'`, emails org admin; idempotent (no duplicate emails) | No health-check cron exists yet — must be built from scratch following the pattern of existing cron routes |
| TOKEN-05 | Privacy policy sub-processor list updated to include Google LLC, Microsoft Corporation, and Dropbox Inc. | Privacy policy exists at `app/(marketing)/privacy/page.tsx`; sub-processor table currently lists Supabase, Postmark, Stripe, Vercel only — three providers must be added |
</phase_requirements>

---

## Summary

Phase 28 is primarily a **finishing and integration phase** rather than a greenfield build. The majority of the UI components already exist from Phases 25-27. The key finding is that the work is more about wiring existing pieces together correctly and filling three specific gaps: (1) making the re-auth banner provider-generic, (2) adding the disconnect confirmation modal with document count, and (3) building the health-check cron.

**What already exists and works:**
- `StorageCard` component with Google Drive and OneDrive sections (`app/(dashboard)/settings/components/storage-card.tsx`)
- `DropboxConnectCard` as a separate component (`app/(dashboard)/settings/components/dropbox-connect-card.tsx`)
- Storage tab in `SettingsTabs` — renders `StorageCard` but NOT `DropboxConnectCard` yet
- Re-auth banner in `app/(dashboard)/layout.tsx` — fully wired but provider-specific text
- All three disconnect actions in `app/actions/settings.ts` — `disconnectGoogleDrive`, `disconnectOneDrive`, `disconnectDropbox`
- Settings page server component fetches `storage_backend`, `storage_backend_status`, `google_drive_folder_id`, `ms_home_account_id` but NOT Dropbox connection indicator

**What is genuinely missing:**
1. `DropboxConnectCard` not rendered in the Storage tab (it's built but orphaned)
2. Re-auth banner text is Google-specific; should be provider-generic
3. No confirmation modal on disconnect — currently calls server action directly
4. No document count shown before disconnect
5. No health-check cron route or vercel.json entry
6. Privacy policy missing Google LLC, Microsoft Corporation, Dropbox Inc. rows

**Primary recommendation:** The plan should have three focused tasks: (1) StorageCard + DropboxConnectCard unification into one Storage tab, (2) disconnect confirmation modal, (3) health-check cron + privacy policy update.

---

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| React/Next.js | 15.x | UI components, server actions | No new packages |
| `@googleapis/drive` | ^20.1.0 | Google Drive API calls in health-check | Already installed Phase 25 |
| `@azure/msal-node` | ^5.0.5 | OneDrive token validation in health-check | Already installed Phase 26 |
| `dropbox` | latest | Dropbox API calls in health-check | Already installed Phase 27 |
| Supabase admin client | existing | Admin queries for cron | Already in `lib/supabase/admin.ts` |
| `postmark` | existing | System notification email in health-check | Already in `lib/email/client.ts` |

**Installation:** No new npm packages required for this phase.

---

## Architecture Patterns

### Recommended Project Structure (Phase 28 additions)

```
app/
├── (dashboard)/
│   ├── layout.tsx                          # MODIFY: make re-auth banner provider-generic
│   └── settings/
│       └── components/
│           ├── storage-card.tsx            # MODIFY: add Dropbox section + confirmation modal
│           ├── disconnect-confirm-modal.tsx # NEW: shared confirmation modal component
│           └── settings-tabs.tsx           # MODIFY: pass dropbox connection flag
├── (marketing)/
│   └── privacy/
│       └── page.tsx                        # MODIFY: add three provider rows to sub-processor table
└── api/
    └── cron/
        └── storage-health-check/
            └── route.ts                    # NEW: daily health-check cron

vercel.json                                 # MODIFY: add storage-health-check schedule
```

### Pattern 1: Unified StorageCard (TOKEN-01)

**What:** Merge Google Drive and OneDrive sections from `StorageCard` with the existing `DropboxConnectCard` into a single unified component.

**Current state of StorageCard props:**
```typescript
interface StorageCardProps {
  storageBackend: string | null;        // 'supabase' | 'google_drive' | 'onedrive' | 'dropbox'
  googleDriveFolderExists: boolean;
  storageBackendStatus: string | null;  // 'active' | 'error' | 'reauth_required' | null
  oneDriveConnected: boolean;           // derived from ms_home_account_id IS NOT NULL
  // dropboxConnected prop is MISSING — needs to be added
}
```

**Required change to settings page.tsx:** The `orgResult` query already fetches `storage_backend`, but to detect Dropbox connection, the plan must determine what indicates "Dropbox connected". Based on Phase 27 implementation, `dropbox_refresh_token_enc IS NOT NULL` or `storage_backend === 'dropbox'` is the indicator. The safest is `storageBackend === 'dropbox'` (same pattern used for `isOneDriveConnected` in the StorageCard: `storageBackend === 'onedrive'`).

**Note on TOKEN-01 "connected account email" requirement:** No provider stores the connected account email in the `organisations` table. Google Drive, OneDrive, and Dropbox do not persist user email — only tokens. The current StorageCard shows folder path for Google Drive (`Prompt/`) and OneDrive (`Apps/Prompt/`), and DropboxConnectCard shows the Prompt app folder. This is the available data — the requirement to show "connected account email" cannot be met without an additional DB column or a live API call. The plan should document this gap and either defer the email display or decide to skip it (folder path + token health indicator is the realistic deliverable).

**Current connected-state display:**
- Google Drive: Shows "Connected" badge + "Files stored in Prompt/ folder"
- OneDrive: Shows "Connected" badge + "Files stored in Apps/Prompt/ folder"
- Dropbox: Shows "Connected" badge + "Files stored in Prompt folder in your Dropbox"

**Token health indicator:** `storageBackendStatus === 'error'` state is not currently shown in any card — only `reauth_required` is shown. TOKEN-04 sets `storage_backend_status = 'error'` on health-check failure; TOKEN-01 requires showing this. The card must handle both statuses.

### Pattern 2: Provider-Generic Re-Auth Banner (TOKEN-02)

**Current implementation** in `app/(dashboard)/layout.tsx` (lines 101-113):
```typescript
{needsReauth && (
  <div className="bg-red-50 border-b border-red-200 px-8 py-3">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <p className="text-sm text-red-800">
        Your Google Drive connection has expired. Re-connect to continue storing documents in Google Drive.
      </p>
      <a href="/settings?tab=storage" className="text-sm font-medium text-red-900 hover:text-red-700 underline">
        Reconnect Google Drive
      </a>
    </div>
  </div>
)}
```

**Problem:** Text hardcodes "Google Drive" — this banner fires for all providers via `storage_backend_status = 'reauth_required'`, so OneDrive and Dropbox revocations get the wrong message.

**Fix:** The layout already fetches `org.name` and `org.storage_backend_status`. The fix requires also fetching `org.storage_backend` to construct the correct provider name. Change the query at line 48 to also select `storage_backend`, then derive a human-readable provider name:
```typescript
const providerName = org?.storage_backend === 'google_drive' ? 'Google Drive'
  : org?.storage_backend === 'onedrive' ? 'Microsoft OneDrive'
  : org?.storage_backend === 'dropbox' ? 'Dropbox'
  : 'your storage provider';
```

**Important:** The banner currently only fires for `reauth_required`. TOKEN-02 specifies only `reauth_required`. TOKEN-04 sets `error` status — the banner wording for `error` vs `reauth_required` should differ ("connection check failed, verify your account" vs "re-authentication required"). The plan must decide whether to handle both in the banner or just `reauth_required`. Based on the requirements, `reauth_required` is the primary case for TOKEN-02.

**Visual pattern:** Matches existing read-only mode banner pattern exactly — `bg-red-50 border-b border-red-200 px-8 py-3` with `flex items-center justify-between` inside `max-w-7xl mx-auto`.

### Pattern 3: Disconnect Confirmation Modal (TOKEN-03)

**Current state:** Disconnect buttons call server actions directly via `useTransition` — no confirmation step.

**Modal pattern for this project:** Look at existing dialog patterns. The project uses `@radix-ui/react-dialog` via the shadcn `Dialog` component (already installed). The `create-client-dialog.tsx` and `csv-import-dialog.tsx` in `app/(dashboard)/clients/components/` show the established pattern.

**Document count query:** To show the count of documents in a specific provider before disconnect:
```typescript
// In a new server action: getDocumentCountByBackend(backend: StorageBackend)
const { count } = await admin
  .from('client_documents')
  .select('*', { count: 'exact', head: true })
  .eq('org_id', orgId)
  .eq('storage_backend', backend);
```

**Modal design:** The modal must:
1. Show the provider name
2. Show the document count (fetched when the disconnect button is first clicked)
3. Warn that documents will remain in the provider after disconnect (no auto-delete — confirmed out of scope per REQUIREMENTS.md)
4. Require the user to click "Disconnect" again to confirm
5. Show a loading spinner on the confirm button while the server action runs

**Implementation approach:** A shared `DisconnectConfirmModal` component in `settings/components/disconnect-confirm-modal.tsx` that accepts `provider`, `documentCount`, `onConfirm`, `isLoading`, `isOpen`, `onClose` props. This avoids duplicating modal logic for each provider.

**Critical UX detail from STATE.md decision:** "Disconnect modal shows document count before clearing tokens — prevents accidental permanent inaccessibility." This was a design decision made in v5.0 research — it MUST be implemented as described.

### Pattern 4: Storage Health-Check Cron (TOKEN-04)

**Pattern:** Follows exactly the same structure as `app/api/cron/trial-reminder/route.ts` — CRON_SECRET auth, admin client, iterate orgs, idempotency guard, send email on failure.

**What the cron does:**
1. Authenticate via `CRON_SECRET` bearer token
2. Fetch all orgs where `storage_backend != 'supabase'` AND `subscription_status IN ('active', 'trialing')`
3. For each org, perform a lightweight provider API call:
   - **Google Drive:** `drive.about.get({ fields: 'user' })` — lightweight, no file listing
   - **OneDrive:** Microsoft Graph `GET /me/drive` — lightweight drive metadata
   - **Dropbox:** `filesListFolder({ path: '' })` — lightweight app folder listing; OR use `usersGetCurrentAccount()` from `dropbox.users` namespace — even lighter
4. On success: ensure `storage_backend_status` is NOT `'error'` (set to `'active'` if it was `'error'`)
5. On failure: set `storage_backend_status = 'error'`, then check if `storage_health_error_notified` flag is set in `app_settings`; if NOT set, send notification email and set the flag
6. Idempotency: use `app_settings` key `storage_health_error_notified` (same pattern as `trial_reminder_sent` in trial-reminder cron)
7. On success after error: clear the `storage_health_error_notified` flag so future failures send a fresh notification

**Email delivery for health-check notification:** Use `POSTMARK_SERVER_TOKEN` platform token (system notification, not org-specific — same decision as `D-13-02-04` for invite emails). Fetch org admin email via `admin.auth.admin.getUserById()` for users with `role = 'admin'` in `user_organisations`.

**Lightweight API call choices — confidence assessment:**
- Google Drive `drive.about.get`: HIGH confidence — minimal quota usage, no file access needed
- OneDrive `GET /me/drive`: HIGH confidence — standard Graph endpoint, establishes token validity
- Dropbox `usersGetCurrentAccount()`: HIGH confidence — Dropbox SDK method, lightest possible call

**vercel.json schedule:** Add `"path": "/api/cron/storage-health-check"` with `"schedule": "0 6 * * *"` (6am UTC daily — before business hours, gives time to fix before clients use the system).

### Pattern 5: Privacy Policy Update (TOKEN-05)

**Current sub-processor table** (`app/(marketing)/privacy/page.tsx`, section 7, lines 150-172):
| Sub-processor | Location | Purpose |
|---|---|---|
| Supabase Inc. | USA | Database hosting, authentication, RLS, encrypted file storage |
| MessageBird B.V. / Postmark | Netherlands / USA | Transactional email delivery |
| Stripe Inc. | USA | Payment processing, subscription management |
| Vercel Inc. | USA | Application hosting, CDN, serverless functions |

**Three rows to add** (from v5.0 research decisions — these are optional sub-processors, only active when org enables the integration):
| Sub-processor | Entity | Location | Purpose |
|---|---|---|---|
| Google LLC | Google LLC | USA | Optional document storage — client documents stored in accountant's Google Drive when Google Drive integration is enabled |
| Microsoft Corporation | Microsoft Corporation | USA | Optional document storage — client documents stored in accountant's OneDrive when OneDrive integration is enabled |
| Dropbox Inc. | Dropbox Inc. | USA | Optional document storage — client documents stored in accountant's Dropbox App Folder when Dropbox integration is enabled |

**UK GDPR legal note:** These are conditional sub-processors (only engaged when the feature is enabled by the org admin). The privacy policy should note these are optional/elective sub-processors. The date "Last updated: February 2026" should remain accurate for this update.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialog | Custom modal from scratch | Radix `Dialog` via shadcn (already installed) | Already used throughout the app |
| Document count query | Custom SQL | Supabase `.select('*', { count: 'exact', head: true })` | Standard Supabase count pattern |
| Health-check email | New email system | Platform `POSTMARK_SERVER_TOKEN` + `ServerClient.sendEmail()` | Same pattern as trial-reminder, payment-failed emails |
| Provider health call logic | Separate health SDK | Use existing provider SDKs (`@googleapis/drive`, MSAL, dropbox) | Already installed, already imported in providers |

---

## Common Pitfalls

### Pitfall 1: Disconnect Without Confirmation Causes Data Loss Risk
**What goes wrong:** Current disconnect actions fire immediately on button click. If a user has 500 documents in Google Drive and disconnects accidentally, those documents are inaccessible (org switches to Supabase, new uploads go there, but old docs are in Drive).
**Why it happens:** `disconnectGoogleDrive()` sets `storage_backend = 'supabase'` and clears all tokens — documents are not deleted but become inaccessible without tokens.
**How to avoid:** The modal must fire BEFORE calling the server action, not after. The confirm button in the modal calls the action.
**Warning signs:** Test by checking if clicking Disconnect immediately triggers the action without a modal appearing.

### Pitfall 2: Re-Auth Banner Shows Wrong Provider Name
**What goes wrong:** The current banner says "Google Drive connection has expired" even when the active backend is OneDrive or Dropbox.
**Why it happens:** Banner text was written when only Google Drive existed (Phase 25); never updated for Phase 26/27.
**How to avoid:** The layout.tsx query must also SELECT `storage_backend` from organisations, and the banner text must be derived dynamically.
**Warning signs:** Check the banner by triggering `reauth_required` for a Dropbox org — if it says "Google Drive", the fix wasn't applied.

### Pitfall 3: DropboxConnectCard Orphaned — Not Rendered
**What goes wrong:** `DropboxConnectCard` was built in Phase 27 but is NOT imported or used anywhere in the settings tab. The Storage tab only renders `<StorageCard>`, which has no Dropbox section.
**Why it happens:** Phase 27 built the component but the integration into `StorageCard` or `SettingsTabs` was left for Phase 28.
**How to avoid:** Either (a) merge Dropbox into `StorageCard` as a third section, or (b) render `DropboxConnectCard` separately inside the Storage tab content alongside `StorageCard`. Option (a) is cleaner but requires passing a `dropboxConnected` prop through the chain.
**Warning signs:** Navigate to Settings > Storage tab — if no Dropbox card appears, it's not wired.

### Pitfall 4: Health-Check Cron Sets 'error' When Storage Is 'reauth_required'
**What goes wrong:** If an org has `storage_backend_status = 'reauth_required'` (token permanently revoked), the health-check will also fail its API call — it should NOT overwrite `reauth_required` with `error`, and should NOT send a duplicate notification email.
**Why it happens:** Health-check makes an API call, gets 401, tries to set `error` — but `reauth_required` is a stronger signal that should not be overwritten.
**How to avoid:** In the cron, skip orgs where `storage_backend_status = 'reauth_required'` — they've already been flagged for admin action. Only check orgs where `storage_backend_status IN ('active', 'error', null)`.
**Warning signs:** Check that cron does NOT update `storage_backend_status` from `reauth_required` to `error`.

### Pitfall 5: Dropbox Connection Indicator Missing from settings/page.tsx
**What goes wrong:** `settings/page.tsx` fetches `ms_home_account_id` as the OneDrive connection indicator but has no equivalent for Dropbox. The `orgResult` query must be extended.
**Why it happens:** Phase 27 built DropboxConnectCard but didn't update the settings page data fetching chain.
**How to avoid:** Add `dropbox_refresh_token_enc` to the `organisations` select in `settings/page.tsx`. The connected indicator for Dropbox is `!!orgResult.data?.dropbox_refresh_token_enc`.
**Warning signs:** DropboxConnectCard always shows "Not connected" even after a successful OAuth flow.

### Pitfall 6: Health-Check Cron Email Idempotency Flag Not Reset
**What goes wrong:** After the initial `error` notification is sent and flagged, if the provider comes back online, the flag must be cleared. Otherwise, the NEXT time the provider fails, no notification is sent.
**Why it happens:** Idempotency flags that are "set and forgotten" prevent future notifications.
**How to avoid:** When a health-check SUCCEEDS for an org that previously had an `error` status, explicitly DELETE the `storage_health_error_notified` app_settings row (or set it to 'false') AND set `storage_backend_status = 'active'`.
**Warning signs:** Manually set `storage_backend_status = 'error'` in DB; trigger a successful cron run; manually set `storage_backend_status = 'error'` again; run cron again — if no email is sent, the flag wasn't reset.

---

## Code Examples

### Document Count Query for Disconnect Modal
```typescript
// Source: established Supabase count pattern used throughout codebase
// New server action to add to app/actions/settings.ts
export async function getDocumentCountByBackend(
  backend: 'google_drive' | 'onedrive' | 'dropbox'
): Promise<number> {
  const orgId = await getOrgId();
  const admin = createAdminClient();
  const { count } = await admin
    .from('client_documents')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('storage_backend', backend);
  return count ?? 0;
}
```

### Banner Provider Name Derivation
```typescript
// In app/(dashboard)/layout.tsx — update the org query and banner section
const { data: org } = await supabase
  .from('organisations')
  .select('name, storage_backend_status, storage_backend')  // ADD storage_backend
  .eq('id', orgId)
  .single();

orgName = org?.name || '';
needsReauth = org?.storage_backend_status === 'reauth_required';

// Derive human-readable name from storage_backend
const providerName =
  org?.storage_backend === 'google_drive' ? 'Google Drive'
  : org?.storage_backend === 'onedrive' ? 'Microsoft OneDrive'
  : org?.storage_backend === 'dropbox' ? 'Dropbox'
  : 'your storage provider';
```

### Health-Check Cron Structure
```typescript
// app/api/cron/storage-health-check/route.ts
// Pattern mirrors app/api/cron/trial-reminder/route.ts

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // 1. Verify CRON_SECRET (same pattern as all other cron routes)
  // 2. Fetch orgs where storage_backend != 'supabase' AND status != 'reauth_required'
  //    AND subscription_status IN ('active', 'trialing')
  // 3. For each org: try lightweight provider API call
  //    - Success: if storage_backend_status was 'error', set to 'active',
  //               DELETE app_settings storage_health_error_notified
  //    - Failure: set storage_backend_status = 'error',
  //               check app_settings storage_health_error_notified,
  //               if not set: send notification email, set the flag
  // 4. Return JSON summary
}
```

### vercel.json Addition
```json
{
  "path": "/api/cron/storage-health-check",
  "schedule": "0 6 * * *"
}
```

### Storage Tab Rendering with Dropbox
```typescript
// In settings-tabs.tsx — Storage tab content
<TabsContent value="storage" className="space-y-8 mt-6">
  <StorageCard
    storageBackend={storageBackend}
    googleDriveFolderExists={googleDriveFolderExists}
    storageBackendStatus={storageBackendStatus}
    oneDriveConnected={oneDriveConnected}
    dropboxConnected={dropboxConnected}  // ADD
  />
</TabsContent>
```

Note: Either add Dropbox as a third section inside `StorageCard` (most consistent), OR render `DropboxConnectCard` separately inside the tab. The first option is cleaner and avoids prop-drilling `onDisconnect` callbacks separately.

---

## Exact What Exists vs What's Missing

### TOKEN-01: Settings Storage Tab

| Item | Status | Notes |
|------|--------|-------|
| Storage tab in SettingsTabs | EXISTS | `value="storage"` tab already renders |
| Google Drive card | EXISTS | Full connect/disconnect/reauth logic in StorageCard |
| OneDrive card | EXISTS | Full connect/disconnect/reauth logic in StorageCard |
| Dropbox card component | EXISTS but ORPHANED | `dropbox-connect-card.tsx` built in Phase 27 but not rendered |
| Dropbox wired into StorageTab | MISSING | Neither StorageCard nor SettingsTabs references DropboxConnectCard |
| Dropbox connected prop in settings/page.tsx | MISSING | `dropbox_refresh_token_enc` not fetched in orgResult query |
| Connected account email display | MISSING — NOT in DB | No `google_connected_email` / `ms_connected_email` / `dropbox_connected_email` column exists; this was never stored; decision needed |
| Token health indicator for 'error' status | MISSING | Cards only show `reauth_required` badge; `error` state not surfaced in UI |

### TOKEN-02: Re-Auth Banner

| Item | Status | Notes |
|------|--------|-------|
| Banner exists in layout | EXISTS | Lines 101-113 of `app/(dashboard)/layout.tsx` |
| Banner triggers on `reauth_required` | EXISTS | `needsReauth = org?.storage_backend_status === 'reauth_required'` |
| Banner links to `/settings?tab=storage` | EXISTS | `href="/settings?tab=storage"` |
| Banner text is provider-generic | MISSING | Text hardcodes "Google Drive connection has expired" |
| `storage_backend` fetched in layout | MISSING | Layout only selects `name, storage_backend_status` — needs `storage_backend` too |

### TOKEN-03: Disconnect Confirmation Modal

| Item | Status | Notes |
|------|--------|-------|
| `disconnectGoogleDrive` server action | EXISTS | In `app/actions/settings.ts` |
| `disconnectOneDrive` server action | EXISTS | In `app/actions/settings.ts` |
| `disconnectDropbox` server action | EXISTS | In `app/actions/settings.ts` |
| Confirmation modal component | MISSING | No modal exists — disconnect is immediate |
| Document count before disconnect | MISSING | No `getDocumentCountByBackend` action exists |

### TOKEN-04: Health-Check Cron

| Item | Status | Notes |
|------|--------|-------|
| Cron route | MISSING | No `app/api/cron/storage-health-check/route.ts` exists |
| vercel.json entry | MISSING | Only 6 existing cron entries; health-check not among them |
| Idempotency pattern | EXISTS as pattern | `trial_reminder_sent` in app_settings is the established pattern to copy |

### TOKEN-05: Privacy Policy

| Item | Status | Notes |
|------|--------|-------|
| Privacy policy page | EXISTS | `app/(marketing)/privacy/page.tsx` |
| Sub-processor table | EXISTS | Section 7, lines 141-173 |
| Google LLC row | MISSING | Not in current table |
| Microsoft Corporation row | MISSING | Not in current table |
| Dropbox Inc. row | MISSING | Not in current table |

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Single-provider storage | Three-provider abstraction via `resolveProvider()` | Phase 24 foundation; all providers share StorageProvider interface |
| Immediate disconnect | Needs confirmation modal with document count | Phase 28 requirement |
| Google-only re-auth banner | Provider-generic banner | Phase 28 fix |

**No deprecated patterns in this phase** — all additions follow established codebase conventions.

---

## Open Questions

1. **Connected account email display (TOKEN-01)**
   - What we know: No provider stores connected account email in the DB. StorageCard shows folder paths instead.
   - What's unclear: Is "connected account email" a hard requirement or a nice-to-have? Showing it requires either a DB column (stored at OAuth connect time) or a live API call (latency, failure risk).
   - Recommendation: If the planner wants to show the email, add `google_connected_email TEXT`, `ms_connected_email TEXT`, `dropbox_connected_email TEXT` columns to `organisations` and populate them in the respective OAuth callback routes. If that's too complex for Phase 28, document it and show folder path as the "account" indicator instead.

2. **Token health indicator for 'error' status (TOKEN-01)**
   - What we know: `storage_backend_status = 'error'` is set by the new health-check cron. Current cards only show `reauth_required` badge.
   - What's unclear: Should `error` show a different badge than `reauth_required`? `error` is a transient failure (may resolve); `reauth_required` is permanent.
   - Recommendation: Show distinct badges: `reauth_required` = "Re-authentication required" (red); `error` = "Connection error — checking automatically" (amber).

3. **Health-check API call for OneDrive via MSAL**
   - What we know: MSAL requires a fresh `ConfidentialClientApplication` per request with the `PostgresMsalCachePlugin`. The health-check is a cron — it must instantiate MSAL correctly.
   - What's unclear: Whether a simple `acquireTokenSilent` call (without an actual Graph API call) is sufficient to detect token validity, or if a real Graph API call is needed.
   - Recommendation: Make a real lightweight Graph call (`GET https://graph.microsoft.com/v1.0/me/drive`) using the acquired token. `acquireTokenSilent` succeeds even when the refresh token is valid but the account has lost permissions. A real API call confirms end-to-end access.

4. **`disconnectGoogleDrive` missing admin role guard**
   - What we know: `disconnectOneDrive` uses `getOrgContext()` and `disconnectDropbox` has explicit `orgRole !== 'admin'` guard. `disconnectGoogleDrive` uses only `getOrgId()` with no role check (noted in STATE.md at `D-27-02`).
   - Recommendation: Fix `disconnectGoogleDrive` to use `getOrgContext()` and add the same admin-only guard during Phase 28 since the disconnect actions are being refactored for the modal anyway.

---

## Validation Architecture

> Skipped: `workflow.nyquist_validation` is false in `.planning/config.json`

---

## Sources

### Primary (HIGH confidence)
- Direct file reads of `app/(dashboard)/settings/components/storage-card.tsx` — current component state
- Direct file reads of `app/(dashboard)/settings/components/dropbox-connect-card.tsx` — orphaned Dropbox component
- Direct file reads of `app/(dashboard)/settings/components/settings-tabs.tsx` — Storage tab wiring
- Direct file reads of `app/(dashboard)/settings/page.tsx` — server data fetching
- Direct file reads of `app/(dashboard)/layout.tsx` — re-auth banner implementation
- Direct file reads of `app/actions/settings.ts` — disconnect server actions
- Direct file reads of `app/(marketing)/privacy/page.tsx` — privacy policy current state
- Direct file reads of `app/api/cron/trial-reminder/route.ts` — idempotency cron pattern
- Direct file reads of `app/api/cron/send-emails/route.ts` — org-iteration cron pattern
- Direct file reads of `lib/storage/token-refresh.ts` — Google token refresh pattern
- Direct file reads of `supabase/migrations/20260228000001_storage_abstraction_layer.sql` — schema truth
- Direct file reads of `vercel.json` — existing cron schedule

### Secondary (MEDIUM confidence)
- STATE.md decisions — context for why existing patterns were chosen (D-27-02, D-25-05, v5.0 research decisions)
- REQUIREMENTS.md — authoritative requirement text for TOKEN-01 through TOKEN-05

---

## Metadata

**Confidence breakdown:**
- What exists vs what's missing: HIGH — verified by direct file reading
- StorageCard Dropbox gap: HIGH — storage-card.tsx has no Dropbox code; dropbox-connect-card.tsx exists but is unimported
- Re-auth banner gap: HIGH — layout.tsx hardcodes "Google Drive" in banner text
- Disconnect modal pattern: HIGH — Radix Dialog already used in the project
- Health-check cron structure: HIGH — follows exact established pattern of trial-reminder cron
- Connected account email requirement: LOW — unclear if it's a hard requirement; no mechanism exists to fulfill it without schema additions
- OneDrive health-check MSAL specifics: MEDIUM — `acquireTokenSilent` vs real Graph call decision needs implementation judgement

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable codebase — no external API changes expected)
