# TODO: Bulk Filing Type Assignments

## Goal
Allow bulk-assigning filing types to multiple clients via the bulk edit modal, solving the problem of clients showing as "inactive" because they have no active filing assignments.

## What's Needed

### 1. New Server Action
**File:** `app/actions/clients.ts` (or new `app/actions/filing-assignments.ts`)

- Create `bulkAssignFilingTypes(clientIds: string[], filingTypeIds: string[])` action
- For each client × filing type combination, upsert a row in `client_filing_assignments` with `is_active = true`
- Use Supabase's `.upsert()` with `onConflict: 'client_id,filing_type_id'` to avoid duplicates
- Validate that filing type IDs are from the known set: `corporation_tax_payment`, `ct600_filing`, `companies_house`, `vat_return`, `self_assessment`

### 2. UI in Bulk Edit Modal
**File:** `app/(dashboard)/clients/components/bulk-edit-modal.tsx`

- Add a "Filing Types" section with multi-select checkboxes for each of the 5 filing types
- Behaviour: **additive** — selected types get added to clients' existing assignments (doesn't remove anything)
- Show short labels: Corp Tax, CT600, Companies House, VAT Return, Self Assessment
- Include in the confirmation preview, e.g. "Filing Types → Add Corp Tax, CT600"

### 3. Considerations
- **Add vs Replace:** Default to "add" mode so users don't accidentally remove existing assignments. Could add a "Replace all" toggle later if needed.
- **VAT-only filings:** VAT Return should only be assignable to VAT-registered clients. Consider either: (a) warning if non-VAT clients are in the selection, or (b) silently skipping VAT assignment for non-VAT clients.
- **Refresh after save:** Filing assignments affect traffic light status (clients go from grey to green/amber/red). The page should refresh status data after bulk assignment.
- **No RPC needed:** Unlike the metadata bulk update (which uses a Postgres function), this can use standard Supabase `.upsert()` calls since it's inserting rows rather than updating columns.

### 4. Database
- No schema changes — `client_filing_assignments` table already exists with `(client_id, filing_type_id, is_active)` columns
- No new RPC function needed
