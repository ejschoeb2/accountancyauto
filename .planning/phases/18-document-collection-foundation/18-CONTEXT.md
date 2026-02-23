# Phase 18: Document Collection Foundation - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Every backend artifact needed before documents can be collected: five database tables, a private Supabase Storage bucket with org-scoped RLS, HMRC document seed data, the portal token security model, core storage utility functions, and privacy policy + terms amendments deployed. Nothing is collected or displayed in this phase — that is Phase 19.

</domain>

<decisions>
## Implementation Decisions

### Document type catalog
- Seed data should cover all 4 filing types fully (SA100, CT600, VAT, Companies House) — not just the 6 types named in success criteria
- Researcher determines the complete but minimal catalog for each filing type based on HMRC documentation
- Each document type row has: a machine code (e.g. `P60`), a display label (e.g. `P60 End-of-Year Certificate`), and a description field for portal checklist text (e.g. "Your employer provides this after the tax year ends")
- `filing_document_requirements` uses a binary `is_mandatory` flag (not a condition enum)
- Researcher populates the description text for all seeded document types

### Portal token behaviour
- Default token expiry: **7 days** from generation
- Tokens are **multi-use until expiry** — the same link can be used across multiple upload sessions (client may need to upload several files over multiple visits)
- Tokens are **filing-type + tax-year scoped** — each token is issued for a specific client + filing type + tax year combination; the portal shows only that filing's checklist
- No explicit revocation column in Phase 18 (`revoked_at` deferred to Phase 19 — see Deferred Ideas)
- Token storage: SHA-256 hash only, raw token never persisted (as per roadmap)

### Retention model
- Filing type classification: **SA100 = individual**, all others (CT600, VAT, Companies House) = company
- SA100 (individual): `retain_until = january_31_deadline + 5 years`, where `january_31_deadline` is **January 31 immediately following the tax year end** (e.g. tax year ends Apr 5 2025 → deadline Jan 31 2026 → retain until Jan 31 2031)
- All other filing types (company): `retain_until = tax_period_end_date + 6 years`
- `calculateRetainUntil` signature: `(filingType: FilingType, taxPeriodEndDate: Date) => Date`
- `retain_until` is **persisted to `client_documents`** at upload time; the retention cron compares the stored column to `NOW()`

### Privacy policy integration
- Amendments are edited **inline** into the existing `/privacy` page — no separate amendment section, no version changelog visible to users
- Terms Section 6 amendment goes into the **separate `/terms` page**, not `/privacy`
- Researcher **drafts the exact amendment language** for all 7 items; language is reviewed by the user before the task is committed
- Privacy policy + terms updates are a **single plan task** (not split)

### Claude's Discretion
- Exact schema column types and constraints (beyond what the success criteria specifies)
- Index strategy for the 5 tables
- Order of migrations within the phase

</decisions>

<specifics>
## Specific Ideas

- The `revoked_at` column noted in Phase 19 success criteria ("expired or revoked token shows expiry message") will be needed — it was deferred out of Phase 18 to keep the schema minimal, but Phase 19 must add it before the portal UI is built
- Researcher should confirm HMRC statutory retention periods for VAT records (commonly 6 years for VAT-registered businesses) to validate the company formula

</specifics>

<deferred>
## Deferred Ideas

- `revoked_at` column on `upload_portal_tokens` — Phase 19 needs this for the "revoked token" error state; add as first task in Phase 19 schema work
- Token expiry configurability (per-token expiry set by accountant) — could be added in Phase 19 or later if needed

</deferred>

---

*Phase: 18-document-collection-foundation*
*Context gathered: 2026-02-23*
