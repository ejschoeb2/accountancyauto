# Phase 31: Server-Side Wizard State Persistence - Research

**Researched:** 2026-03-09
**Domain:** Supabase JSONB persistence, Next.js server actions, wizard state management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `setup_draft jsonb DEFAULT NULL` column to `organisations` table
- Column is NULLed out when setup completes (`markOrgSetupComplete`)
- No index needed — only read by the admin who owns the org
- Consider `setup_draft_clients` staging table for CSV import rows (separate table preferred over JSONB for large datasets that change frequently)
- `SetupDraft` interface with fields: `step`, `firmName`, `firmSlug`, `selectedTier`, `importRows` (or reference to staging table), `emailSubStep`, `portalEnabled`, `uploadCheckMode`, `sendHour`, `updatedAt`
- All fields optional except `step` and `updatedAt`
- Handle missing keys gracefully during hydration (draft schema evolution)
- `getSetupDraft()` — reads `setup_draft` from `organisations` using admin client
- `saveSetupDraft(draft)` — writes to `organisations.setup_draft` with `updatedAt` timestamp
- Both scoped to current org via `getOrgId()`
- On mount: fetch draft from DB (single source of truth)
- URL params (`storage_connected`, `storage_error`) still take priority for OAuth returns
- If draft exists: hydrate all React state from it
- If no draft: start fresh at step 1
- Replace complex sessionStorage/URL-param detection with single draft load
- Every step transition saves current state to draft via `saveSetupDraft()` (fire-and-forget, non-blocking)
- `advanceToStep(nextStep)` collects all React state, sets `draft.step = nextStep`, saves
- `markOrgSetupComplete()` also sets `setup_draft = NULL`
- Import rows are the most fragile and highest-value wizard state
- Preferred fix: `setup_draft_clients` staging table with `org_id`, `row_index`, `data jsonb`
- RLS: only org's admin can read/write staging rows
- Staging rows cleaned up on setup complete or via `ON DELETE CASCADE`
- Concurrent tabs: last-write-wins with `updatedAt` timestamp
- Draft schema evolution: optional fields with sensible defaults

### Claude's Discretion
- Exact migration naming/timestamp
- Whether to implement staging table in same phase or defer
- Debouncing strategy for draft saves (on-transition vs debounced)
- Error handling for failed draft saves
- Loading state UX during draft hydration on mount

### Deferred Ideas (OUT OF SCOPE)
- Server-side pagination for large CSV import tables (staging table enables this but UI changes deferred)
- Multi-device resume notification (draft exists from another session)
- Draft conflict resolution beyond last-write-wins
</user_constraints>

## Summary

This phase replaces the fragile sessionStorage-based wizard state persistence with a server-side `setup_draft` JSONB column on the `organisations` table. The current wizard page (`app/(auth)/setup/wizard/page.tsx`, ~1200 lines) uses 6 distinct sessionStorage keys and ~15 React state variables to track progress. A page refresh preserves the step but loses all form data. A tab close or OAuth redirect can lose everything.

The implementation is straightforward: one migration to add the column, two server actions (`getSetupDraft`/`saveSetupDraft`), a refactored mount `useEffect` that hydrates from DB instead of sessionStorage, and save calls on every step transition. The CSV import staging table (`setup_draft_clients`) is the main complexity — it requires its own migration, RLS policies, and server actions for bulk insert/read/delete. The existing `markOrgSetupComplete()` already updates the `organisations` table and just needs `setup_draft: null` added to the update payload.

**Primary recommendation:** Implement in two plans — Plan 01 for the core `setup_draft` column + server actions + wizard refactor (storing importRows in JSONB initially), Plan 02 for the `setup_draft_clients` staging table migration. This lets the core persistence ship quickly while the staging table is a follow-up refinement.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS | Already installed | JSONB column read/write via PostgREST | Project standard |
| Next.js Server Actions | Already installed | `getSetupDraft()`/`saveSetupDraft()` | Project standard for mutations |

### Supporting
No new libraries needed. This phase uses only existing project dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB column on organisations | Separate `setup_drafts` table | More schema, more RLS policies, but cleaner separation — unnecessary since there's exactly one draft per org |
| Admin client for draft ops | Authenticated client | Admin client is correct — during early wizard steps, the user's JWT may not have org_id yet (consistent with all existing wizard actions) |

## Architecture Patterns

### Existing Wizard Actions Pattern
All existing wizard server actions in `app/(auth)/setup/wizard/actions.ts` follow the same pattern:
1. Get user via `createClient()` + `supabase.auth.getUser()`
2. Get org_id via admin client query on `user_organisations`
3. Perform operation via admin client

**The new `getSetupDraft`/`saveSetupDraft` MUST follow this same pattern** — NOT use `getOrgId()` from `lib/auth/org-context.ts`, because the wizard runs before the JWT has org_id in app_metadata (the user just created their org).

```typescript
// Source: existing pattern in app/(auth)/setup/wizard/actions.ts
export async function getSetupDraft(): Promise<SetupDraft | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return null;

  const { data } = await admin
    .from("organisations")
    .select("setup_draft")
    .eq("id", membership.org_id)
    .single();

  return data?.setup_draft ?? null;
}
```

### Pattern: Fire-and-Forget Save
Draft saves should not block step transitions. The user advances immediately; the save happens asynchronously.

```typescript
function advanceToStep(nextStep: AdminStep) {
  const draft = collectCurrentState();
  draft.step = nextStep;
  saveSetupDraft(draft); // no await — fire and forget
  setAdminStep(nextStep);
}
```

### Pattern: URL Params Override Draft on OAuth Return
The mount logic has a clear priority order:
1. URL params (`storage_connected`, `storage_error`, `from`) — signal OAuth/Stripe result
2. DB draft — restore full state
3. No draft — start fresh

```typescript
useEffect(() => {
  (async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sc = urlParams.get("storage_connected");
    const se = urlParams.get("storage_error");
    const fromStripeComplete = urlParams.get("from") === "stripe-complete";

    const draft = await getSetupDraft();

    if (fromStripeComplete) {
      // Stripe checkout complete — clean up and redirect to dashboard
      // ...
    } else if (sc || se) {
      // OAuth return — hydrate from draft, override step to "storage"
      hydrateFromDraft(draft, "storage");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (draft) {
      // Normal resume — hydrate all state from draft
      hydrateFromDraft(draft);
    } else {
      // First visit — start fresh
      setAdminStep("firm");
    }
  })();
}, []);
```

### Pattern: Hydration Helper
A single function restores all React state from a draft object:

```typescript
function hydrateFromDraft(draft: SetupDraft | null, overrideStep?: AdminStep) {
  if (!draft) return;
  setAdminStep(overrideStep ?? draft.step as AdminStep);
  if (draft.firmName) setFirmName(draft.firmName);
  if (draft.firmSlug) setSlug(draft.firmSlug);
  if (draft.selectedTier) setSelectedTier(draft.selectedTier);
  if (draft.importRows) setSavedImportRows(draft.importRows);
  if (draft.portalEnabled !== undefined) setClientPortalEnabled(draft.portalEnabled);
  if (draft.uploadCheckMode) setUploadCheckSelection(draft.uploadCheckMode);
  if (draft.sendHour !== undefined) setSendHour(draft.sendHour);
  if (draft.emailSubStep) setEmailInitialSubStep(draft.emailSubStep as EmailSubStep);
  setOrgCreated(true);
}
```

### Pattern: Collect Current State
A single function gathers all React state into a draft:

```typescript
function collectCurrentState(): SetupDraft {
  return {
    step: adminStep,
    firmName,
    firmSlug: slug,
    selectedTier: selectedTier ?? undefined,
    importRows: savedImportRows ?? undefined,
    portalEnabled: clientPortalEnabled,
    uploadCheckMode: uploadCheckSelection,
    emailSubStep: emailInitialSubStep,
    sendHour: sendHour ?? undefined,
    updatedAt: new Date().toISOString(),
  };
}
```

### Anti-Patterns to Avoid
- **Using `getOrgId()` from `lib/auth/org-context.ts`:** This throws when no org exists. The wizard server actions MUST use the `user_organisations` lookup pattern from existing actions, which returns null gracefully.
- **Saving draft before org creation:** The draft lives on the `organisations` row, which doesn't exist until the user completes the "Plan" step. Steps before org creation (account, firm, plan) CANNOT save drafts. This is acceptable because those steps only collect firmName/slug/planTier which are quick to re-enter.
- **Blocking step transitions on save:** `saveSetupDraft()` should be fire-and-forget. If the save fails, the user's React state is still correct — they just lose persistence. A console.warn is sufficient.
- **Removing sessionStorage too early:** Keep sessionStorage writes during the transition period so if the DB save fails, the user still has a fallback. Remove sessionStorage code only as the final cleanup step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONB column persistence | Custom REST endpoint | Supabase `.update()` with JSONB | PostgREST handles JSONB natively; `organisations` already has RLS + service_role policies |
| Draft type validation | Runtime schema validator | TypeScript interface + optional fields | Draft is trusted (written by our own code); runtime validation adds complexity for no benefit |
| Staging table bulk ops | Row-by-row insert | Supabase `.insert([...rows])` | Single round trip for bulk insert of CSV rows |

**Key insight:** The entire persistence layer is just two Supabase queries — one SELECT, one UPDATE. No new libraries, no new patterns, no new infrastructure.

## Common Pitfalls

### Pitfall 1: Saving Draft Before Org Exists
**What goes wrong:** The `setup_draft` column is on `organisations`, but the org isn't created until the "Plan" step (step 3). Calling `saveSetupDraft()` on steps 1-2 would fail.
**Why it happens:** The wizard starts at "account" or "firm" — before `createOrgAndJoinAsAdmin()` runs.
**How to avoid:** Only start saving drafts from the "import" step onward (after `orgCreated === true`). Steps 1-3 (account/firm/plan) are quick to re-enter and don't need persistence.
**Warning signs:** `saveSetupDraft` returns an error about no matching row.

### Pitfall 2: Draft Hydration Missing orgCreated Flag
**What goes wrong:** The wizard hydrates step position from the draft but `orgCreated` stays `false`, causing the plan step to try re-creating the org.
**Why it happens:** `orgCreated` is not in the draft — it's derived from whether the user has a `user_organisations` row.
**How to avoid:** When hydrating from a draft, also set `orgCreated = true` (if a draft exists, the org must exist). Also set `orgId` from the JWT `app_metadata.org_id`.

### Pitfall 3: JSONB Size for Large CSV Imports
**What goes wrong:** An `EditableRow` has ~7 fields. 500 rows * ~200 bytes = ~100KB of JSONB. This is well within Postgres limits (1GB per JSONB value) but makes the `organisations` row large and every `setup_draft` update rewrites the full JSONB.
**Why it happens:** CSV import rows are stored inline in the JSONB column.
**How to avoid:** For Plan 01, inline JSONB is fine (most imports are <100 rows). The staging table (Plan 02) solves this for large imports.
**Warning signs:** Slow wizard step transitions, Supabase timeout on large updates.

### Pitfall 4: Race Between Draft Save and markOrgSetupComplete
**What goes wrong:** Fire-and-forget `saveSetupDraft()` from the last step transition could arrive after `markOrgSetupComplete()` sets `setup_draft = NULL`, re-populating it.
**Why it happens:** Fire-and-forget means we don't await the save, so it could be in-flight when the complete action fires.
**How to avoid:** Don't save draft on the transition TO the "complete" step (or at least don't save when advancing to complete). The complete step is terminal — no need to persist it.

### Pitfall 5: `wizard_pending_email` in sessionStorage Must Stay
**What goes wrong:** Removing all sessionStorage code also removes `wizard_pending_email`, which the `/signup` page sets before redirecting to the wizard.
**Why it happens:** Over-zealous cleanup.
**How to avoid:** `wizard_pending_email` is NOT wizard draft state — it's the signup flow signal. It MUST remain in sessionStorage (it's set before the user has an account, let alone an org).

### Pitfall 6: Member Wizard Path Not Affected
**What goes wrong:** Implementing draft persistence for the member wizard (2-step flow) when it's not needed.
**Why it happens:** The member wizard shares the same page component.
**How to avoid:** The member wizard is only 2 steps (import + config) with no OAuth/Stripe redirects. Draft persistence is for the admin wizard only. The `userType === "invited-member"` branch should remain unchanged.

## Code Examples

### Migration: Add setup_draft Column

```sql
-- Phase 31: Server-Side Wizard State Persistence
-- Add setup_draft JSONB column to organisations table

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS setup_draft jsonb DEFAULT NULL;

-- No index needed — only read by the org's admin during setup
-- Column is NULLed when markOrgSetupComplete runs
```

### Migration: setup_draft_clients Staging Table

```sql
CREATE TABLE setup_draft_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, row_index)
);

ALTER TABLE setup_draft_clients ENABLE ROW LEVEL SECURITY;

-- Service role full access (used by admin client in server actions)
CREATE POLICY "Service role full access to setup_draft_clients"
  ON setup_draft_clients FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- No authenticated policy needed — all access goes through admin client
```

### markOrgSetupComplete Update

```typescript
// In app/(auth)/setup/wizard/actions.ts — markOrgSetupComplete
const { error } = await admin
  .from("organisations")
  .update({ setup_complete: true, setup_draft: null })
  .eq("id", membership.org_id);
```

### sessionStorage Keys to Remove

| Key | Current Purpose | Replaced By |
|-----|-----------------|-------------|
| `wizard_admin_step` | Current wizard step | `setup_draft.step` |
| `wizard_portal_enabled` | Portal toggle state | `setup_draft.portalEnabled` |
| `wizard_import_rows` | CSV import data | `setup_draft.importRows` / staging table |
| `wizard_return_step` | OAuth/Stripe return routing | `setup_draft.step` + URL params |
| `wizard_org_id` | Org ID cache | JWT `app_metadata.org_id` (already available) |

### sessionStorage Keys to KEEP

| Key | Why |
|-----|-----|
| `wizard_pending_email` | Set by `/signup` before user has account — cannot use DB |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sessionStorage for wizard state | DB JSONB column | This phase | Survives tab close, device switch, all redirects |
| Multiple sessionStorage keys | Single `setup_draft` JSONB | This phase | One source of truth instead of 5 fragmented keys |
| Complex mount if/else chain | Priority-based: URL params > draft > fresh | This phase | Simpler, more predictable mount logic |

## Open Questions

1. **Staging table in same phase or defer?**
   - What we know: CONTEXT.md says "Consider" staging table; user prefers it for large CSVs
   - What's unclear: Whether to ship in same phase or defer
   - Recommendation: Implement staging table in Plan 02 of this phase. The JSONB approach in Plan 01 handles most cases; staging table is a refinement. However, if the planner prefers a single-plan phase, inline JSONB for importRows is sufficient — the staging table can become Phase 32.

2. **Save timing: on-transition vs debounced?**
   - What we know: CONTEXT.md says "fire-and-forget on every step transition"
   - What's unclear: Whether to also save on form field changes (e.g., typing firm name)
   - Recommendation: Save on step transition only (not on every keystroke). The wizard steps are discrete with "Next" buttons — saving on transition is sufficient and avoids excessive DB writes. Within a step, React state is the source of truth.

3. **Loading state during draft hydration?**
   - What we know: The wizard already shows a `Loader2` spinner during `isCheckingAuth`
   - What's unclear: Whether draft fetch adds noticeable latency
   - Recommendation: Fold the `getSetupDraft()` call into the existing `isCheckingAuth` mount effect. The draft fetch is a single SELECT on a row the user already has access to — it adds negligible latency (~50ms). No additional loading state needed.

## Sources

### Primary (HIGH confidence)
- `app/(auth)/setup/wizard/page.tsx` — full wizard implementation, ~1200 lines, 6 sessionStorage keys, 15+ React state variables
- `app/(auth)/setup/wizard/actions.ts` — existing server actions pattern (user auth + admin client + user_organisations lookup)
- `supabase/migrations/20260219000001_create_organisations_and_user_orgs.sql` — organisations table schema
- `lib/auth/org-context.ts` — `getOrgId()` pattern (NOT suitable for wizard — throws on missing org)
- `OAUTH-WIZARD-PATTERNS.md` — Solution 7 specification for server-side draft persistence
- `app/(auth)/setup/wizard/components/csv-import-step.tsx` — `EditableRow` interface (7 fields per row)

### Secondary (MEDIUM confidence)
- Supabase JSONB support — Postgres natively handles JSONB columns up to 1GB; PostgREST reads/writes JSONB transparently
- `ON DELETE CASCADE` for staging table cleanup — standard Postgres FK behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - uses only existing project dependencies (Supabase, Next.js server actions)
- Architecture: HIGH - follows established wizard action patterns exactly; all code paths verified by reading source
- Pitfalls: HIGH - identified from direct code analysis of the 1200-line wizard page

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, no external dependencies)
