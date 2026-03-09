# Phase 31: Server-Side Wizard State Persistence - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning
**Source:** PRD Express Path (OAUTH-WIZARD-PATTERNS.md Solution 7)

<domain>
## Phase Boundary

Persist all setup wizard progress to the database so the wizard survives page refreshes, tab closes, OAuth/Stripe redirects, and device switches. Replace fragile sessionStorage and React state with a server-side `setup_draft` JSONB column on the `organisations` table. Optionally add a `setup_draft_clients` staging table for large CSV import data.

**What this phase delivers:**
1. Database schema for wizard draft persistence
2. Server actions to read/write drafts
3. Wizard mount logic that hydrates from DB instead of sessionStorage
4. Draft save on every step transition
5. Draft cleanup on setup completion
6. Removal of legacy sessionStorage persistence code

**What this phase does NOT replace:**
- OAuth `state` parameter and CSRF validation (still needed for security)
- The `wizard_` prefix in OAuth state (still useful for callback routing)
- The `storage_connected` / `storage_error` URL params (still needed for OAuth result signaling)

</domain>

<decisions>
## Implementation Decisions

### Schema
- Add `setup_draft jsonb DEFAULT NULL` column to `organisations` table
- Column is NULLed out when setup completes (`markOrgSetupComplete`)
- No index needed — only read by the admin who owns the org
- Consider `setup_draft_clients` staging table for CSV import rows (separate table preferred over JSONB for large datasets that change frequently)

### Draft Shape
- `SetupDraft` interface with fields: `step`, `firmName`, `firmSlug`, `selectedTier`, `importRows` (or reference to staging table), `emailSubStep`, `portalEnabled`, `uploadCheckMode`, `sendHour`, `updatedAt`
- All fields optional except `step` and `updatedAt`
- Handle missing keys gracefully during hydration (draft schema evolution)

### Server Actions
- `getSetupDraft()` — reads `setup_draft` from `organisations` using admin client
- `saveSetupDraft(draft)` — writes to `organisations.setup_draft` with `updatedAt` timestamp
- Both scoped to current org via `getOrgId()`

### Wizard Mount Logic
- On mount: fetch draft from DB (single source of truth)
- URL params (`storage_connected`, `storage_error`) still take priority for OAuth returns
- If draft exists: hydrate all React state from it
- If no draft: start fresh at step 1
- Replace complex sessionStorage/URL-param detection with single draft load

### Step Transitions
- Every step transition saves current state to draft via `saveSetupDraft()` (fire-and-forget, non-blocking)
- `advanceToStep(nextStep)` collects all React state, sets `draft.step = nextStep`, saves

### Setup Completion
- `markOrgSetupComplete()` also sets `setup_draft = NULL`

### What Gets Removed
- `sessionStorage.wizard_admin_step` → replaced by `setup_draft.step`
- `sessionStorage.wizard_portal_enabled` → replaced by `setup_draft.portalEnabled`
- `sessionStorage.wizard_import_rows` → replaced by `setup_draft.importRows` or staging table
- `sessionStorage.wizard_return_step` → replaced by `setup_draft.step` + URL params
- The middleware `buildWizardRedirect` param preservation becomes non-critical

### CSV Import Data (Biggest Risk)
- Import rows are the most fragile and highest-value wizard state
- Current flow: CSV parsed → React state → sessionStorage → only written to `clients` table on final import
- sessionStorage has ~5MB limit; large CSVs can silently fail
- Preferred fix: `setup_draft_clients` staging table with `org_id`, `row_index`, `data jsonb`
- Alternative: store in `setup_draft.importRows` JSONB (simpler but bloats org row)
- RLS: only org's admin can read/write staging rows
- Staging rows cleaned up on setup complete or via `ON DELETE CASCADE`

### Edge Cases
- Stale drafts: cleaned up when setup completes; `setup_complete` boolean distinguishes finished vs unfinished
- Concurrent tabs: last-write-wins with `updatedAt` timestamp (acceptable for one-time admin flow)
- Large import data: cap at reasonable limit or use staging table
- Draft schema evolution: optional fields with sensible defaults

### Claude's Discretion
- Exact migration naming/timestamp
- Whether to implement staging table in same phase or defer
- Debouncing strategy for draft saves (on-transition vs debounced)
- Error handling for failed draft saves
- Loading state UX during draft hydration on mount

</decisions>

<specifics>
## Specific Ideas

- Use admin client for all draft operations (consistent with existing wizard patterns)
- The `hydrateFromDraft(draft, overrideStep?)` helper should restore all React state from draft
- The `collectCurrentState()` helper should gather all React state into a SetupDraft object
- Fire-and-forget pattern for saves (don't block step transitions on DB write)
- Clean URL after OAuth return: `window.history.replaceState({}, "", window.location.pathname)`

</specifics>

<deferred>
## Deferred Ideas

- Server-side pagination for large CSV import tables (staging table enables this but UI changes deferred)
- Multi-device resume notification (draft exists from another session)
- Draft conflict resolution beyond last-write-wins

</deferred>

---

*Phase: 31-server-side-wizard-state-persistence*
*Context gathered: 2026-03-09 via PRD Express Path*
