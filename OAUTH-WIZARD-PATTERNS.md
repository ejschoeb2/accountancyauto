# Setup Wizard — State Persistence & OAuth Return Patterns

Two related problems:
1. **OAuth return routing** — how to get the user back to the correct wizard step after an external OAuth redirect
2. **Wizard state persistence** — how to preserve all wizard progress (current step, form data) across refreshes, tab closures, OAuth redirects, and device switches

Approaches 1–6 address problem 1 only. Approach 7 addresses both problems together.

---

## 1. State Parameter Prefix (Current Approach)

Encode the return destination in the OAuth `state` parameter itself (`wizard_<csrf>` vs `<csrf>`). The callback checks the prefix to decide where to redirect.

**Pros:**
- Stateless routing decision — no extra DB reads beyond CSRF validation
- The OAuth spec guarantees `state` is returned unchanged
- Simple to implement, easy to reason about

**Cons:**
- Relies on the provider returning `state` intact (all major providers do, but edge cases exist in error flows)
- Routing logic is coupled to the CSRF token format
- Limited data capacity (just a prefix flag, not arbitrary metadata)

---

## 2. Server-Side Session / DB Lookup

Before initiating OAuth, store `{ returnTo: "/setup/wizard", step: "storage" }` in the database (keyed by org or user). The callback reads this after auth and redirects accordingly.

**Pros:**
- Completely decoupled from the `state` parameter
- Can store arbitrary metadata (step, form data, context)
- Survives any URL mangling or encoding issues

**Cons:**
- Extra DB write on connect, extra DB read on callback
- Must clean up stale entries
- Adds a new column or table

---

## 3. Signed / Encoded State (Base64 JSON or JWT)

Encode a full JSON payload in the `state` parameter: `base64url({ csrf: "token", returnTo: "/setup/wizard", step: "storage" })`. Optionally HMAC-sign it.

**Pros:**
- Stateless — no DB storage needed for routing
- Can carry arbitrary structured data
- IETF draft exists for JWT-encoded state (draft-bradley-oauth-jwt-encoded-state)

**Cons:**
- `state` has practical size limits (~2KB before URL length issues)
- Must use URL-safe Base64 (no `+`, `/`, `=`) to avoid encoding bugs
- Signing adds complexity; without signing, the state is tamperable
- Parsing errors on callback can be hard to debug

---

## 4. Cookie-Based Return URL

Set a cookie (`oauth_return_to=wizard`) before redirecting to the provider. The callback reads the cookie.

**Pros:**
- Simple to implement
- No DB changes needed

**Cons:**
- **Cross-subdomain cookie loss** — the connect route runs on `acme.app.domain.com` but the callback URL is `app.domain.com`. Cookies set on the org subdomain may not be readable on the callback domain unless the cookie domain is set to the root (`.domain.com`)
- SameSite cookie policies can block delivery after cross-origin redirects
- This was the original approach for CSRF in this project and it failed — migrated to DB in commit `591ded5`

---

## 5. URL Path Encoding

Encode the return destination in the callback URL path itself: `/api/auth/google-drive/callback/wizard` vs `/api/auth/google-drive/callback/settings`. Register both as valid redirect URIs with the provider.

**Pros:**
- No state parameter dependency
- No cookies or DB needed for routing
- Impossible to lose — it's the URL itself

**Cons:**
- Must register multiple redirect URIs with each OAuth provider
- Some providers (Google) are strict about exact URI matching — every new return destination needs a new URI registered
- Doesn't scale if you have many possible return destinations
- Violates OAuth best practice of having a single callback endpoint

---

## 6. sessionStorage + Query Params (Client-Side Only)

Save the wizard step to `sessionStorage` before OAuth. On return, the wizard page reads `sessionStorage` to restore position. The callback doesn't need to know about the wizard at all.

**Pros:**
- Zero backend changes
- Already partially implemented (the `wizard_return_step` sessionStorage key)

**Cons:**
- `sessionStorage` is per-origin — if the callback redirects to a different subdomain than where the wizard was, the data is lost
- Fragile: browser crashes, tab closures, or private browsing can clear it
- The callback still needs to know whether to redirect to `/setup/wizard` or `/settings`

---

## Verdict

**The current approach (State Parameter Prefix + DB fallback) is the best fit for this project.** Here's why:

| Criterion | Winner |
|---|---|
| Simplicity | State prefix |
| Reliability | DB lookup |
| No extra infra | State prefix |
| Cross-subdomain safe | State prefix & DB lookup (cookies fail) |
| Already implemented | State prefix |

The hybrid you have now — state prefix as the primary signal, with the DB-stored state as an authoritative fallback after CSRF validation — gives you the best of approaches 1 and 2 without the downsides of either. The middleware safety net (preserving query params on wizard redirects) covers the remaining edge case where routing fails entirely.

**Don't switch to**: cookies (already failed for you), JWT-encoded state (overengineered for a binary wizard/settings flag), or URL path encoding (registration overhead with 3 providers).

**Only consider switching to** a full DB lookup (approach 2) if you later need to preserve more context across OAuth redirects (e.g., which wizard step, partial form data). For a simple "wizard or settings" routing decision, the state prefix is ideal.

---
---

## 7. Server-Side Wizard State Persistence (Recommended Future Enhancement)

This is a fundamentally different approach from 1–6. Instead of solving "how do I route back to the wizard after OAuth," it solves the broader problem: **"how do I make the entire wizard resilient to any interruption."**

The idea: persist ALL wizard progress to the database on every step transition. The wizard becomes a stateful server-side draft that can be resumed from anywhere — after OAuth, after a page refresh, after closing the laptop, even from a different device.

### Current State (What We Have Now)

The wizard currently stores progress in two places:

| Data | Storage | Survives Refresh | Survives Tab Close | Survives OAuth Redirect | Survives Device Switch |
|---|---|---|---|---|---|
| Current step (`wizard_admin_step`) | sessionStorage | Yes | No | Only if same origin | No |
| Portal toggle (`wizard_portal_enabled`) | sessionStorage | Yes | No | Only if same origin | No |
| Import rows (`wizard_import_rows`) | sessionStorage | Yes | No | Only if same origin | No |
| OAuth return step (`wizard_return_step`) | sessionStorage | Yes | No | Only if same origin | No |
| Firm name, slug | React state | No | No | No | No |
| Selected plan tier | React state | No | No | No | No |
| Email/Postmark config | React state | No | No | No | No |
| Upload check mode | React state | No | No | No | No |
| Send hour preference | React state | No | No | No | No |

**The gap**: A refresh keeps you on the right step but loses all form data. Closing the tab loses everything. OAuth redirects lose React state.

### Proposed Architecture

Store a `setup_draft` JSON column on the `organisations` table. The wizard reads it on mount and writes to it on every step transition.

#### Schema Change

```sql
-- Single migration
ALTER TABLE organisations
  ADD COLUMN setup_draft jsonb DEFAULT NULL;

-- The column is NULLed out when setup completes (markOrgSetupComplete)
-- No index needed — only read by the admin who owns the org
```

#### Draft Shape

```typescript
interface SetupDraft {
  // Current position
  step: "firm" | "plan" | "import" | "email" | "portal" | "upload-checks" | "storage" | "complete";

  // Firm step
  firmName?: string;
  firmSlug?: string;

  // Plan step
  selectedTier?: PlanTier;

  // Import step — client rows from CSV
  importRows?: EditableRow[];

  // Email step — sub-step progress
  emailSubStep?: string;

  // Portal step
  portalEnabled?: boolean;

  // Upload checks step
  uploadCheckMode?: UploadCheckMode;

  // Config
  sendHour?: number;

  // Timestamps
  updatedAt: string; // ISO timestamp for staleness detection
}
```

#### Read/Write Flow

```
Mount:
  1. Fetch setup_draft from organisations (server action)
  2. If draft exists, hydrate all React state from it
  3. If no draft, start fresh at step 1

Step transition (e.g., "firm" → "plan"):
  1. Collect all current form state into a SetupDraft object
  2. Write to organisations.setup_draft via server action (debounced or on-transition)
  3. Advance to next step

OAuth redirect:
  1. Draft is already saved (written on the last step transition)
  2. User goes through OAuth flow
  3. Callback redirects to /setup/wizard?storage_connected=google_drive
  4. Wizard mounts, reads draft from DB, restores to storage step
  5. No sessionStorage needed — DB is the source of truth

Page refresh:
  1. Wizard mounts, reads draft from DB
  2. All state restored — step, form data, everything

Setup complete:
  1. markOrgSetupComplete() also sets setup_draft = NULL
  2. Clean slate — no stale drafts
```

#### Server Actions Needed

```typescript
// app/(auth)/setup/wizard/actions.ts

export async function getSetupDraft(): Promise<SetupDraft | null> {
  const admin = createAdminClient();
  const orgId = await getOrgId();
  const { data } = await admin
    .from("organisations")
    .select("setup_draft")
    .eq("id", orgId)
    .single();
  return data?.setup_draft ?? null;
}

export async function saveSetupDraft(draft: SetupDraft): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const orgId = await getOrgId();
  const { error } = await admin
    .from("organisations")
    .update({ setup_draft: { ...draft, updatedAt: new Date().toISOString() } })
    .eq("id", orgId);
  if (error) return { error: error.message };
  return {};
}
```

#### Wizard Page Changes

The wizard page mount logic would change from the current complex sessionStorage/URL-param detection to:

```typescript
useEffect(() => {
  (async () => {
    const user = await getUser();
    if (!user) { /* handle unauthenticated */ return; }

    // URL params still take priority for OAuth/Stripe returns
    const urlParams = new URLSearchParams(window.location.search);
    const sc = urlParams.get("storage_connected");
    const se = urlParams.get("storage_error");

    // Load draft from DB — single source of truth
    const draft = await getSetupDraft();

    if (sc || se) {
      // OAuth return — update draft with storage result, stay on storage step
      setStorageConnected(sc);
      setStorageError(se);
      hydrateFromDraft(draft, "storage"); // restore all state, override step to "storage"
      window.history.replaceState({}, "", window.location.pathname);
    } else if (draft) {
      // Normal mount — restore full state from draft
      hydrateFromDraft(draft);
    } else {
      // First visit — start fresh
      setAdminStep("firm");
    }
  })();
}, []);
```

And every step transition would save:

```typescript
function advanceToStep(nextStep: AdminStep) {
  const draft = collectCurrentState(); // gather all React state into SetupDraft
  draft.step = nextStep;
  saveSetupDraft(draft); // fire-and-forget (non-blocking)
  setAdminStep(nextStep);
}
```

### What This Eliminates

With server-side draft persistence, the following current mechanisms become unnecessary:

- `sessionStorage.wizard_admin_step` — replaced by `setup_draft.step`
- `sessionStorage.wizard_portal_enabled` — replaced by `setup_draft.portalEnabled`
- `sessionStorage.wizard_import_rows` — replaced by `setup_draft.importRows`
- `sessionStorage.wizard_return_step` — replaced by `setup_draft.step` + URL params
- The `wizard_` prefix in OAuth state — still useful as a fast routing hint in the callback, but no longer critical since the wizard can self-heal from the DB draft
- The middleware `buildWizardRedirect` param preservation — the wizard doesn't rely on URL params for state anymore (only for the OAuth success/error signal)

### What This Does NOT Replace

- The OAuth `state` parameter and CSRF validation — still needed for security
- The `wizard_` prefix — still useful so the callback knows to redirect to `/setup/wizard` vs `/settings` (the callback runs before the wizard page mounts, so it can't read the draft)
- The `storage_connected` / `storage_error` URL params — still needed to signal the OAuth result to the wizard page on the current page load

### Migration Path

This can be implemented incrementally:

1. **Phase A**: Add `setup_draft` column, add `getSetupDraft`/`saveSetupDraft` actions, save draft on each step transition. Keep all existing sessionStorage logic as-is.
2. **Phase B**: On wizard mount, try loading draft from DB first, fall back to sessionStorage. This makes the feature backwards-compatible for users mid-setup during deployment.
3. **Phase C**: Remove sessionStorage persistence code. The DB draft is now the single source of truth.
4. **Phase D**: In `markOrgSetupComplete()`, set `setup_draft = NULL`.

### CSV Import Data — The Biggest Risk

The imported client CSV data is the most fragile and highest-value piece of wizard state. Currently:

1. User uploads a CSV (could be hundreds of rows with company names, UTRs, deadlines, etc.)
2. Data is parsed and held in React state (`savedImportRows`)
3. User edits rows in an inline table (correcting names, selecting VAT groups, etc.)
4. Edited rows are mirrored to `sessionStorage` as JSON (`wizard_import_rows`)
5. Rows are only written to the `clients` table when the user clicks the final import button inside `CsvImportStep`

**If anything interrupts between steps 1–4 and step 5 (refresh, OAuth redirect, tab close, browser crash), the user must re-upload and re-edit the entire CSV.** This is the single worst data-loss scenario in the wizard — a user who spent 20 minutes manually correcting 200 client rows loses all that work.

sessionStorage also has a ~5MB size limit. A large CSV with many columns could exceed this, silently failing to persist.

#### Recommended fix: `setup_draft_clients` staging table

Instead of holding import rows in client-side state, write them to a staging table immediately on parse/edit:

```sql
CREATE TABLE setup_draft_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  row_index integer NOT NULL,        -- preserves display order
  data jsonb NOT NULL,               -- the EditableRow object
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, row_index)
);

-- RLS: only the org's admin can read/write
ALTER TABLE setup_draft_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_admin_access" ON setup_draft_clients
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM user_organisations
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

**Flow with staging table:**

1. User uploads CSV → rows are parsed client-side (same as now)
2. Parsed rows are immediately bulk-inserted into `setup_draft_clients` via a server action
3. The edit table reads from / writes to `setup_draft_clients` (debounced updates on cell edit)
4. On final import confirmation, a server action copies rows from `setup_draft_clients` → `clients`, then deletes the staging rows
5. On setup complete (`markOrgSetupComplete`), any remaining staging rows are cleaned up

**What this gives you:**
- CSV data survives refresh, tab close, OAuth redirects, device switch
- No sessionStorage size limits
- The edit table can be paginated server-side for large imports
- `setup_draft_clients` is scoped to `org_id` with RLS — no data leakage
- Staging rows are cleaned up automatically via `ON DELETE CASCADE` if the org is deleted

**Alternatively**, the `setup_draft` JSONB column from the main proposal could hold the import rows directly (as `draft.importRows`). This is simpler (no new table) but has downsides: large JSONB updates on every cell edit are expensive, and the `organisations` row becomes bloated. A separate staging table is better for large datasets that change frequently.

### Edge Cases to Handle

- **Stale drafts**: If an admin creates an org but never finishes setup, the draft sits in the DB indefinitely. This is fine — it's cleaned up when setup completes, and the `organisations` table already has a `setup_complete` boolean to distinguish finished vs unfinished orgs.
- **Concurrent tabs**: Two tabs open on the wizard could overwrite each other's drafts. Mitigation: use `updatedAt` timestamp and last-write-wins. This is acceptable because setup is a one-time admin flow, not a collaborative editing scenario.
- **Large import data**: If the CSV import has thousands of rows, the `importRows` array could make the JSONB column large. Mitigation: cap at a reasonable limit (the wizard already caps imports), or store import rows in a separate table and only keep a reference in the draft.
- **Draft schema evolution**: If the wizard gains new steps or fields in the future, old drafts may not have the new keys. Mitigation: use optional fields with sensible defaults in the `SetupDraft` interface, and handle missing keys gracefully during hydration.

### Cost / Benefit Summary

| Cost | Impact |
|---|---|
| 1 migration (add column) | Trivial |
| 2 server actions | ~30 lines |
| Wizard page refactor | Medium — replace sessionStorage reads/writes with draft reads/writes |
| Testing | Must verify all step transitions save correctly |

| Benefit | Impact |
|---|---|
| Survives page refresh with full data | High UX improvement |
| Survives tab close | High UX improvement |
| Survives OAuth/Stripe redirects reliably | Eliminates the current class of bugs |
| Survives device switch | Nice-to-have for mobile→desktop |
| Simplifies wizard mount logic | Reduces the complex if/else chain to a single draft load |
| Single source of truth | Easier to debug — check the DB column |
