# Phase 32: Expandable Deadline System & MTD Quarterly Updates - Research

**Researched:** 2026-03-15
**Domain:** Database schema extension, UK HMRC filing deadlines, wizard UX, deadline catalogue management
**Confidence:** HIGH

---

## Summary

The current system has exactly 5 hardcoded filing types seeded globally in `filing_types` (a TEXT PK reference table shared across all orgs). The dispatcher in `lib/deadlines/calculators.ts` uses a `switch` on `filingTypeId` string, and `rollover.ts` does the same. The type system enforces the 5 known IDs via the `FilingTypeId` union type in `lib/types/database.ts`.

Phase 32 expands this in two dimensions: (1) the global `filing_types` catalogue grows from 5 to 13+ entries, and (2) a new per-org junction table `org_filing_type_selections` lets each practice choose which types are active. The 5 original types are auto-activated for existing orgs (backward-compatible). A new wizard step lets new practices select which types apply at onboarding. The Deadlines page gains activate/deactivate controls. The queue builder, scheduler, and rollover logic must all respect org selections.

MTD ITSA is the primary new deadline. It has four quarterly deadlines per tax year (5 Jul, 5 Oct, 5 Jan, 5 Apr as period ends; due 33/33/33/32 days later). This is the most complex new calculator because it is tax-year-periodic (not company-year-end-periodic) and has 4 deadlines per cycle rather than 1. MTD launches April 2026 — this is production-relevant immediately after shipping.

**Primary recommendation:** Keep `filing_types` as a global reference table (no `org_id`); add `org_filing_type_selections` junction table; extend `calculateDeadline` and `rolloverDeadline` switch statements; widen `FilingTypeId` union type; add `is_seeded_default` boolean to `filing_types` to distinguish the original 5 (auto-active for all orgs) from new opt-in types.

---

## Standard Stack

### Core (already in project — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `date-fns` | existing | Date arithmetic for deadline calculators | Already used throughout `lib/deadlines/` |
| `@date-fns/utc` | existing | UTC-safe date operations | `UTCDate` used in all existing calculators |
| `@supabase/supabase-js` | existing | DB queries via server/admin clients | Project standard |
| shadcn/ui Checkbox | existing | Deadline selection checklist in wizard step | DESIGN.md patterns |

No new npm packages required for this phase.

---

## Architecture Patterns

### Existing filing_types Table Structure

```sql
CREATE TABLE filing_types (
  id TEXT PRIMARY KEY,          -- e.g. 'corporation_tax_payment'
  name TEXT NOT NULL,
  description TEXT,
  applicable_client_types client_type_enum[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key facts:**
- No `org_id` column — it is global reference data (D-10-01-03 decision)
- RLS: read-only for authenticated, writes via service_role
- 5 existing entries: `corporation_tax_payment`, `ct600_filing`, `companies_house`, `vat_return`, `self_assessment`

### New Table: org_filing_type_selections

```sql
CREATE TABLE org_filing_type_selections (
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, filing_type_id)
);
```

**Activation logic:**
- Row present + `is_active = true` → type active for org
- Row absent OR `is_active = false` → type inactive for org
- The original 5 types are inserted as `is_active = true` for all existing orgs via a migration data backfill. New orgs get them inserted via the wizard or `seedOrgDefaults`.
- New types (MTD, P11D, PAYE, etc.) are NOT auto-activated; they require explicit org selection.

**Alternative considered:** Adding `is_org_default` flag to `filing_types` and activating by that flag. Rejected — the original 5 must always be available but a new org can still deactivate them later. An explicit junction row is cleaner.

### filing_types Schema Additions

Two new columns needed on `filing_types`:

```sql
ALTER TABLE filing_types
  ADD COLUMN is_seeded_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN deadline_formula TEXT,          -- human-readable for descriptions.ts replacement
  ADD COLUMN calculator_type TEXT NOT NULL DEFAULT 'fixed_annual',
  ADD COLUMN sort_order INTEGER DEFAULT 99;
```

`calculator_type` values:
- `year_end_annual` — existing: Corp Tax, CT600, Companies House
- `vat_quarterly` — existing: VAT Return (stagger-based)
- `fixed_annual` — Self Assessment, P11D, Payroll Year-End, SA Payment on Account
- `mtd_quarterly` — MTD Quarterly Update (4× per tax year, fixed tax-year dates)
- `confirmation_statement` — Confirmation Statement (incorporation date + 12m)
- `monthly_22nd` — PAYE Monthly
- `monthly_19th` — CIS Monthly Return
- `partnership_annual` — Partnership Tax Return (same formula as SA but different applicable types)

This `calculator_type` field allows `calculateDeadline` to route correctly without a giant switch on the string ID, and allows the UI to show the right "formula" label for any new type.

### Recommended Project Structure Changes

```
lib/deadlines/
├── calculators.ts          -- EXTEND: add new calculator functions + expand switch
├── rollover.ts             -- EXTEND: add cases for new filing type IDs
├── descriptions.ts         -- REPLACE Record<FilingTypeId, string> with dynamic lookup
│                              or extend the type to include new IDs
└── working-days.ts         -- unchanged

lib/types/
└── database.ts             -- EXTEND FilingTypeId union + add new interfaces

supabase/migrations/
└── YYYYMMDD_phase32_schema.sql   -- filing_types columns + org_filing_type_selections
```

### Pattern 1: MTD Quarterly Calculator

MTD ITSA follows the UK tax year (6 April to 5 April). Four quarters per year:

| Quarter | Period end | Due (period end + N days) |
|---------|-----------|--------------------------|
| Q1 | 5 July | 7 August (+ 33 days) |
| Q2 | 5 October | 7 November (+ 33 days) |
| Q3 | 5 January | 7 February (+ 33 days) |
| Q4 | 5 April | 7 May (+ 32 days) |

```typescript
// Source: Phase 32 additional_context + HMRC MTD ITSA technical spec
// MTD quarter end dates are FIXED calendar dates (not relative to client year-end)

const MTD_QUARTER_ENDS = [
  { month: 7, day: 5 },   // 5 July   (July is month index 6 in 0-based)
  { month: 10, day: 5 },  // 5 October
  { month: 1, day: 5 },   // 5 January (next year)
  { month: 4, day: 5 },   // 5 April   (next year)
];
const MTD_QUARTER_OFFSETS = [33, 33, 33, 32]; // days after quarter end

export function getNextMTDQuarterDeadline(fromDate: Date): Date {
  const utcFrom = new UTCDate(fromDate);
  const year = utcFrom.getUTCFullYear();

  // Build all 4 quarter deadlines for the current tax year
  // Tax year starting 6 Apr YEAR: Q1=5 Jul YEAR, Q2=5 Oct YEAR, Q3=5 Jan YEAR+1, Q4=5 Apr YEAR+1
  const quarters = [
    { end: new UTCDate(year, 6, 5),   offset: 33 }, // 5 Jul
    { end: new UTCDate(year, 9, 5),   offset: 33 }, // 5 Oct
    { end: new UTCDate(year + 1, 0, 5), offset: 33 }, // 5 Jan next year
    { end: new UTCDate(year + 1, 3, 5), offset: 32 }, // 5 Apr next year
  ];

  for (const q of quarters) {
    const deadline = addDays(q.end, q.offset);
    if (deadline > utcFrom) return deadline;
  }

  // All deadlines in the current tax cycle passed; advance to next year's Q1
  return addDays(new UTCDate(year + 1, 6, 5), 33);
}
```

**Important:** MTD deadlines do NOT depend on client `year_end_date` or `vat_stagger_group`. They are purely calendar-date-driven. The `calculateDeadline` dispatcher must not require those fields for `mtd_quarterly_update`.

### Pattern 2: Confirmation Statement Calculator

```typescript
// Source: Companies House guidance — incorporation date + 12 months
export function calculateConfirmationStatementDeadline(
  incorporationDate: Date,
  fromDate: Date = new Date()
): Date {
  // Each year's review period = incorporation anniversary. Due 14 days after.
  // Simplified: treat as annual from incorporation date, due date = incorporation + N years + 14 days
  const utcInc = new UTCDate(incorporationDate);
  let deadline = addDays(addYears(utcInc, 1), 14);
  while (deadline <= new UTCDate(fromDate)) {
    deadline = addYears(deadline, 1);
  }
  return deadline;
}
```

**Note on client schema:** Confirmation Statement needs `incorporation_date` on the client, which does NOT currently exist. Two options:
1. Store it as a new column on `clients` (requires migration + UI edit)
2. Use `year_end_date` as a proxy (wrong — year-end and incorporation date differ)
3. Allow `client_deadline_overrides` to handle it initially (practical fallback — accountant sets the correct date manually)

**Recommendation:** Add `incorporation_date DATE` nullable column to `clients` in Plan 01. The calculator falls back gracefully to null (no deadline) if not set, matching the existing pattern for `year_end_date`.

### Pattern 3: Fixed Annual Deadlines (P11D, Payroll Year-End, SA Payment)

```typescript
// P11D: always 6 July each year
export function calculateP11DDeadline(fromDate: Date = new Date()): Date {
  const utc = new UTCDate(fromDate);
  let year = utc.getUTCFullYear();
  let deadline = new UTCDate(year, 6, 6); // July 6
  if (deadline <= utc) deadline = new UTCDate(year + 1, 6, 6);
  return deadline;
}

// Payroll Year-End: 19 April each year
export function calculatePayrollYearEndDeadline(fromDate: Date = new Date()): Date {
  const utc = new UTCDate(fromDate);
  let year = utc.getUTCFullYear();
  let deadline = new UTCDate(year, 3, 19); // April 19
  if (deadline <= utc) deadline = new UTCDate(year + 1, 3, 19);
  return deadline;
}

// SA Payment on Account: 31 July each year
export function calculateSAPaymentOnAccount(fromDate: Date = new Date()): Date {
  const utc = new UTCDate(fromDate);
  let year = utc.getUTCFullYear();
  let deadline = new UTCDate(year, 6, 31); // July 31
  if (deadline <= utc) deadline = new UTCDate(year + 1, 6, 31);
  return deadline;
}
```

### Pattern 4: Monthly Deadlines (PAYE, CIS)

```typescript
// PAYE Monthly: 22nd of each month
export function calculatePAYEMonthlyDeadline(fromDate: Date = new Date()): Date {
  const utc = new UTCDate(fromDate);
  let year = utc.getUTCFullYear();
  let month = utc.getUTCMonth();
  let deadline = new UTCDate(year, month, 22);
  if (deadline <= utc) {
    month++;
    if (month > 11) { month = 0; year++; }
    deadline = new UTCDate(year, month, 22);
  }
  return deadline;
}

// CIS Monthly Return: 19th of each month
export function calculateCISMonthlyDeadline(fromDate: Date = new Date()): Date {
  const utc = new UTCDate(fromDate);
  let year = utc.getUTCFullYear();
  let month = utc.getUTCMonth();
  let deadline = new UTCDate(year, month, 19);
  if (deadline <= utc) {
    month++;
    if (month > 11) { month = 0; year++; }
    deadline = new UTCDate(year, month, 19);
  }
  return deadline;
}
```

**Monthly rollover:** These simply advance by 1 month — `addMonths(currentDeadline, 1)` in `rolloverDeadline`.

### Pattern 5: org_filing_type_selections RLS

Since this is org-scoped data (unlike the global `filing_types` table):

```sql
-- RLS: org members can SELECT their org's selections
-- Writes go through service_role actions (wizard, settings server actions)
ALTER TABLE org_filing_type_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select" ON org_filing_type_selections
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());

-- Admin-only mutations via service_role; no authenticated INSERT/UPDATE/DELETE policies
```

### Pattern 6: Queue Builder Integration

`buildReminderQueue` in `queue-builder.ts` currently fetches ALL `client_filing_assignments` where `is_active = true`. It does NOT filter by org-level filing type activation. After Phase 32, it must JOIN through `org_filing_type_selections`:

```typescript
// In buildReminderQueue — add filter:
// Only include assignments for filing types the org has active
const { data: orgActiveTypes } = await supabase
  .from('org_filing_type_selections')
  .select('filing_type_id')
  .eq('org_id', org.id)
  .eq('is_active', true);

const activeTypeIds = new Set((orgActiveTypes ?? []).map(r => r.filing_type_id));

// Then filter assignments:
for (const assignment of assignments) {
  if (!activeTypeIds.has(assignment.filing_type_id)) { skipped++; continue; }
  // ... existing logic
}
```

This is the minimal-impact change — the existing queue-builder logic is otherwise unchanged.

### Pattern 7: Wizard Deadline Selection Step

New wizard step inserted between `portal` and `upload-checks` (or after `email` for admin flow). Must:
- Display all `filing_types` grouped by category (company, personal, payroll, MTD)
- Show the original 5 pre-checked (they are defaults for all orgs)
- Allow checking/unchecking any type
- On "Continue" → upsert `org_filing_type_selections` rows
- Persist selection to `setup_draft.deadlineSelections` (array of type IDs)

Step name in `AdminStep` union: `"deadlines"`.

**Progress bar impact:** The stepper currently has 9 steps (portal enabled) or 7 steps (portal disabled). The new `deadlines` step adds 1 to both counts. `adminStepToIndex` function in `wizard/page.tsx` must be updated.

### Anti-Patterns to Avoid

- **Don't widen `FilingTypeId` type union for all new IDs immediately.** The `FilingTypeId` type is used as a typed enum in many places. Widen it carefully — consider whether downstream uses (ReminderQueueItem, ClientFilingAssignment) need the wider type or can use `string` with a DB FK constraint instead.
- **Don't hardcode new type IDs in `descriptions.ts` Record.** Replace with a dynamic lookup from `filing_types.deadline_formula` column, or extend the Record type carefully.
- **Don't apply org_filing_type_selections filter retroactively to existing queue entries.** Entries already in `reminder_queue` were scheduled when the type was active. Only filter at queue-build time, not at send time.
- **Don't assume MTD clients need `year_end_date`.** MTD deadlines are calendar-fixed. If the dispatcher receives an MTD type ID, it must not return null just because year_end_date is missing.
- **Don't block existing orgs at wizard re-entry.** The deadline selection wizard step must not appear for orgs that have already completed setup. Guard: `markOrgSetupComplete()` already nulls `setup_draft`. The step only shows during wizard flow.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Checkbox list with select-all | Custom state management | shadcn/ui Checkbox + React controlled state (existing pattern in CSV import step) |
| DB-backed toggle for org settings | Custom RPC | Standard `.upsert()` on `org_filing_type_selections` with `onConflict: 'org_id,filing_type_id'` |
| Date arithmetic for MTD quarters | Custom loop | `date-fns` `addDays` + hardcoded quarter-end dates (same pattern as existing VAT stagger logic) |
| Batch activation backfill for existing orgs | Per-org loop | Single `INSERT ... SELECT` migration that inserts all 5 default types for all existing orgs |

---

## Common Pitfalls

### Pitfall 1: FilingTypeId Type Union Breakage

**What goes wrong:** Widening the `FilingTypeId` union to include 8 new IDs causes TypeScript errors in every file that uses `FilingTypeId` as a type — `ClientFilingAssignment`, `ClientDeadlineOverride`, `rollover.ts` switch exhaustiveness, `descriptions.ts` Record key, etc.

**Why it happens:** The type is referenced in at least 8 files. A partial widening causes type errors on the switch statements that have exhaustive checks.

**How to avoid:** In Plan 01, widen `FilingTypeId` to include all new IDs. Fix `descriptions.ts` Record, `rollover.ts` switch default, and all other dependents in the same plan. Do NOT widen piecemeal across plans.

**Warning signs:** TypeScript error "Type 'X' is not assignable to type 'FilingTypeId'" in `rollover.ts` or `descriptions.ts`.

### Pitfall 2: Existing Orgs Missing org_filing_type_selections Rows

**What goes wrong:** After deploying the new schema, existing orgs have no rows in `org_filing_type_selections`. `buildReminderQueue` filters against active types and finds nothing — all reminders stop generating.

**Why it happens:** Migration creates the table but doesn't backfill existing orgs.

**How to avoid:** Include a data backfill in the Plan 01 migration:
```sql
INSERT INTO org_filing_type_selections (org_id, filing_type_id)
SELECT o.id, ft.id
FROM organisations o
CROSS JOIN filing_types ft
WHERE ft.is_seeded_default = true
ON CONFLICT (org_id, filing_type_id) DO NOTHING;
```

**Warning signs:** Reminders stop processing for existing orgs immediately after deployment.

### Pitfall 3: MTD Rollover Logic

**What goes wrong:** The MTD quarterly rollover just calls `addDays(currentDeadline, 90)` as an approximation, which drifts from the fixed 5 Jul/5 Oct/5 Jan/5 Apr anchor dates over time.

**Why it happens:** Treating quarterly as "every 3 months" ignores the fixed HMRC calendar dates.

**How to avoid:** MTD rollover must call `getNextMTDQuarterDeadline(currentDeadline)` — i.e., find the next fixed quarter deadline AFTER the current one. Never use addDays/addMonths for MTD.

### Pitfall 4: Wizard Step Count Mismatch

**What goes wrong:** Adding the `deadlines` step without updating `adminStepToIndex` and `getAdminSteps` causes the progress bar to render the wrong position or skip displaying the new step.

**Why it happens:** The progress bar is built from the ADMIN_STEPS array and index-mapped in `adminStepToIndex`. Both must be updated together.

**How to avoid:** In Plan 03, update `getAdminSteps()` to insert `{ label: "Deadlines" }` and update `adminStepToIndex` to return the correct index for `"deadlines"`.

### Pitfall 5: setup_draft Missing deadlineSelections on Return from External Redirect

**What goes wrong:** If the user leaves the wizard mid-deadline-step (unlikely but possible), returning from an OAuth redirect shows the step with no selections restored.

**Why it happens:** `SetupDraft` interface doesn't include `deadlineSelections`. `hydrateFromDraft()` doesn't restore it.

**How to avoid:** Add `deadlineSelections?: string[]` to the `SetupDraft` interface in `wizard/actions.ts` and restore it in `hydrateFromDraft()`.

### Pitfall 6: PAYE/CIS Monthly Types and the Rollover Cron

**What goes wrong:** The rollover cron (`scheduler.ts` Step 8) looks for `sent` reminders past their `deadline_date` and tries to roll them over. Monthly types will roll over every month — this is correct behaviour but may generate unexpected log volume.

**Why it happens:** The rollover is per-reminder, not per-type. Monthly types generate 12x the rollovers of annual types.

**How to avoid:** No code change needed — this is expected and correct. Document it so the planner doesn't try to add special-case logic.

---

## Code Examples

### Extending calculateDeadline Dispatcher

```typescript
// Source: lib/deadlines/calculators.ts (existing pattern, extended)
export function calculateDeadline(
  filingTypeId: string,
  clientMetadata: {
    year_end_date?: string;
    vat_stagger_group?: number;
    incorporation_date?: string;  // NEW: for confirmation_statement
  }
): Date | null {
  const { year_end_date, vat_stagger_group, incorporation_date } = clientMetadata;

  switch (filingTypeId) {
    // ... existing 5 cases unchanged ...

    case 'mtd_quarterly_update':
      return getNextMTDQuarterDeadline(new Date()); // no client metadata needed

    case 'confirmation_statement':
      if (!incorporation_date) return null;
      return calculateConfirmationStatementDeadline(new Date(incorporation_date));

    case 'p11d_filing':
      return calculateP11DDeadline();

    case 'paye_monthly':
      return calculatePAYEMonthlyDeadline();

    case 'cis_monthly_return':
      return calculateCISMonthlyDeadline();

    case 'payroll_year_end':
      return calculatePayrollYearEndDeadline();

    case 'sa_payment_on_account':
      return calculateSAPaymentOnAccount();

    case 'partnership_tax_return':
      const currentYear = new Date().getFullYear();
      return calculateSelfAssessmentDeadline(currentYear); // same formula

    case 'trust_tax_return':
      const y = new Date().getFullYear();
      return calculateSelfAssessmentDeadline(y); // same formula

    default:
      return null;
  }
}
```

### Upsert Org Filing Type Selection

```typescript
// Source: pattern from app/actions/settings.ts (.upsert pattern)
export async function updateOrgFilingTypeSelections(
  orgId: string,
  activeTypeIds: string[],
  adminClient: SupabaseClient
): Promise<void> {
  // Fetch all known filing types
  const { data: allTypes } = await adminClient
    .from('filing_types')
    .select('id');

  const rows = (allTypes ?? []).map((ft) => ({
    org_id: orgId,
    filing_type_id: ft.id,
    is_active: activeTypeIds.includes(ft.id),
  }));

  await adminClient
    .from('org_filing_type_selections')
    .upsert(rows, { onConflict: 'org_id,filing_type_id' });
}
```

### Deadline Selection Wizard Step (pattern sketch)

```typescript
// Source: pattern from components/client-portal-step.tsx
// New file: app/(auth)/setup/wizard/components/deadline-selection-step.tsx
"use client";

interface DeadlineSelectionStepProps {
  onComplete: (selectedIds: string[]) => void;
  onBack: () => void;
  filingTypes: Array<{ id: string; name: string; description: string | null; is_seeded_default: boolean }>;
  initialSelection?: string[];
}
// - Render grouped checklist (defaults pre-checked)
// - On Continue: call saveOrgFilingTypeSelections server action, then onComplete(selected)
```

### Migration Backfill Pattern

```sql
-- Backfill existing orgs with the 5 default filing types
INSERT INTO org_filing_type_selections (org_id, filing_type_id, is_active)
SELECT o.id, ft.id, true
FROM organisations o
CROSS JOIN filing_types ft
WHERE ft.is_seeded_default = true
ON CONFLICT (org_id, filing_type_id) DO NOTHING;
```

---

## Complete Filing Type Catalogue (13 types after Phase 32)

| ID | Name | Calculator Type | Applicable Client Types | Is Default |
|----|------|----------------|------------------------|-----------|
| `corporation_tax_payment` | Corporation Tax Payment | `year_end_annual` | Limited Company, LLP | YES |
| `ct600_filing` | CT600 Filing | `year_end_annual` | Limited Company, LLP | YES |
| `companies_house` | Companies House Accounts | `year_end_annual` | Limited Company, LLP | YES |
| `vat_return` | VAT Return | `vat_quarterly` | Limited Company, Sole Trader, Partnership, LLP | YES |
| `self_assessment` | Self Assessment | `fixed_annual` | Sole Trader, Partnership, Individual | YES |
| `mtd_quarterly_update` | MTD Quarterly Update | `mtd_quarterly` | Sole Trader, Partnership | NO |
| `confirmation_statement` | Confirmation Statement | `confirmation_statement` | Limited Company, LLP | NO |
| `p11d_filing` | P11D Filing | `fixed_annual` | Limited Company, LLP, Partnership | NO |
| `paye_monthly` | PAYE Monthly | `monthly_22nd` | Limited Company, LLP, Partnership, Sole Trader | NO |
| `cis_monthly_return` | CIS Monthly Return | `monthly_19th` | Limited Company, LLP, Partnership, Sole Trader | NO |
| `payroll_year_end` | Payroll Year-End | `fixed_annual` | Limited Company, LLP, Partnership, Sole Trader | NO |
| `sa_payment_on_account` | SA Payment on Account | `fixed_annual` | Sole Trader, Partnership, Individual | NO |
| `partnership_tax_return` | Partnership Tax Return | `fixed_annual` | Partnership | NO |
| `trust_tax_return` | Trust Tax Return | `fixed_annual` | Individual | NO |

That's 14 types total (5 defaults + 9 new). Meets the "12+" success criterion.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| 5 hardcoded filing types globally, no org customisation | Expandable catalogue + per-org selection table | Accountants can add/remove deadline types per practice |
| `FilingTypeId` as a closed union of 5 string literals | Widened union (14 IDs) + DB as source of truth | New types addable without major type surgery |
| `calculateDeadline` switch with 5 cases | Extended switch with 14 cases + new calculator functions | Full coverage of UK filing obligations |
| No wizard deadline step | `deadlines` wizard step between `email` and `portal` | Onboarding captures practice-specific filing mix upfront |

**Deprecated/outdated after Phase 32:**
- `DEADLINE_DESCRIPTIONS` as a `Record<FilingTypeId, string>` with 5 entries — must be extended or replaced with a dynamic lookup against `filing_types.deadline_formula`.
- Hardcoded `applicable_client_types` in seed migration — must be extended for new types.

---

## Open Questions

1. **clients table: `incorporation_date` column**
   - What we know: `confirmation_statement` requires incorporation date, not year-end date
   - What's unclear: Does Plan 01 add `incorporation_date` to `clients`, or does Phase 32 defer this and fall back to `client_deadline_overrides`?
   - Recommendation: Add `incorporation_date DATE NULL` to `clients` in Plan 01 migration. The UI for editing it can be minimal (date input in client edit form) or deferred to a future phase; the calculator simply returns null if not set.

2. **Wizard step position: before or after portal step?**
   - What we know: Deadline selection logically belongs before portal/storage setup (it's about practice configuration)
   - What's unclear: The portal step gates the upload-checks and storage steps. Inserting deadlines before portal keeps the flow logical.
   - Recommendation: Insert `deadlines` step between `email` and `portal`. New admin flow: `account → firm → plan → import → email → deadlines → portal → [upload-checks → storage] → complete`.

3. **Deadlines page: inline activate/deactivate vs separate management page**
   - What we know: Success criterion says "Deadlines page shows all active types with ability to activate/deactivate more"
   - What's unclear: Is this a modal, a separate `/deadlines/manage` page, or inline toggles on the existing filing-type-list?
   - Recommendation: Add a "Manage Filing Types" button on the Deadlines page that opens a sheet/drawer (shadcn Sheet component) with the full catalogue checklist. Saves via server action. This avoids rebuilding the deadlines page layout.

4. **PAYE Monthly and CIS Monthly — should these create 12 queue entries upfront or roll monthly?**
   - What we know: Monthly types use `getNextXxxDeadline()` which returns the immediately next monthly deadline.
   - What's unclear: The existing queue builder creates entries for the immediate next deadline; rollover handles next cycle. Monthly types will roll over 12x/year. This is correct but generates higher queue churn.
   - Recommendation: No special-case logic needed. The existing rollover pattern works correctly for monthly types. Flag this in plan comments only.

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis (`lib/deadlines/calculators.ts`, `rollover.ts`, `queue-builder.ts`, `scheduler.ts`) — full current implementation reviewed
- `supabase/migrations/20260207000002_create_phase2_schema.sql` — `filing_types` table definition
- `ARCHITECTURE.md` — reminder pipeline, RLS patterns, wizard step flow
- `app/(auth)/setup/wizard/page.tsx` + `actions.ts` — wizard step machine, `SetupDraft` interface, `seedOrgDefaults`
- `app/(dashboard)/deadlines/page.tsx` + `filing-type-list.tsx` — current deadlines page structure
- `lib/types/database.ts` — `FilingTypeId` union type scope of impact
- Phase 32 additional_context (MTD deadline dates verified against provided spec)

### Secondary (MEDIUM confidence)
- HMRC MTD ITSA technical guidance (from additional_context): Q1=5 Jul +33d, Q2=5 Oct +33d, Q3=5 Jan +33d, Q4=5 Apr +32d — treatment as tax-year-fixed calendar dates confirmed
- Companies House: Confirmation Statement filing window = 12 months after previous statement (or incorporation for first); due within 14 days of anniversary — simplified to `incorporation_date + 12m + 14d` annually
- HMRC: P11D due 6 July; CIS Monthly Return due 19th; PAYE Monthly due 22nd; Payroll Year-End due 19 April; SA Payment on Account due 31 July

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all patterns from existing code
- Architecture (schema design): HIGH — follows established patterns (D-10-01-03 global table, RLS patterns, junction table approach)
- Calculator logic: HIGH for most; MEDIUM for Confirmation Statement (incorporation date storage decision is an open question)
- Wizard integration: HIGH — full wizard code reviewed, step machine pattern understood
- MTD deadline dates: HIGH — provided in brief from HMRC technical spec

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain — MTD launching April 2026 is time-relevant but dates are locked)
