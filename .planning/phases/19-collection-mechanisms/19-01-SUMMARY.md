---
phase: 19-collection-mechanisms
plan: 01
subsystem: document-collection
tags: [schema, classification, postmark, inbound-email, storage, rls]
dependency_graph:
  requires: [18-04-SUMMARY.md]
  provides: [phase19-schema, classifyDocument, processAttachments]
  affects: [app/api/postmark/inbound/route.ts, lib/documents/classify.ts, supabase/migrations/20260224100000_phase19_schema.sql]
tech_stack:
  added: []
  patterns: [fire-and-forget-webhook, keyword-map-classification, idempotent-migration]
key_files:
  created:
    - supabase/migrations/20260224100000_phase19_schema.sql
    - lib/documents/classify.ts
  modified:
    - app/api/postmark/inbound/route.ts
decisions:
  - "[D-19-01-01] inbound_email_id excluded from client_documents INSERT — column not present in Phase 18 schema (20260224000001); plan note confirmed this was expected"
  - "[D-19-01-02] BANK_STATEMENT keyword pattern restricted to 'bank statement' phrase (not bare 'statement') — prevents false positives on unrelated documents"
  - "[D-19-01-03] KEYWORD_MAP uses actual seed codes (CT600_ACCOUNTS, CT600_TAX_COMPUTATION, PAYROLL_SUMMARY) not the alias codes in plan text (COMPANY_ACCOUNTS, CT600, PAYSLIP)"
  - "[D-19-01-04] Migration history repair applied (20260210) — idempotent ADD COLUMN IF NOT EXISTS ran without error; consistent with D-15-01-04 pattern"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-02-23"
  tasks: 3
  files_changed: 3
---

# Phase 19 Plan 01: Schema Prerequisites + Passive Document Collection Summary

**One-liner:** Phase 19 schema migration (revoked_at, checklist customisations, Realtime), deterministic filename-based document classification covering 23 catalog codes, and fire-and-forget Postmark attachment extraction pipeline storing documents to client_documents.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Phase 19 schema migration | 7c504f8 | supabase/migrations/20260224100000_phase19_schema.sql |
| 2 | classifyDocument utility | 9fb77bd | lib/documents/classify.ts |
| 3 | Postmark webhook attachment extraction | a1d0a1c | app/api/postmark/inbound/route.ts |

## What Was Built

### Task 1 — Phase 19 Schema Migration
Applied `supabase/migrations/20260224100000_phase19_schema.sql` to the remote Supabase project:
- **`upload_portal_tokens.revoked_at TIMESTAMPTZ`** — deferred from Phase 18; needed by ACTV-03 portal token revocation. Partial index on non-null values.
- **`client_document_checklist_customisations` table** — per-client, per-filing-type document checklist overrides for ACTV-04. Org-scoped RLS with 5 policies (SELECT/INSERT/UPDATE/DELETE for authenticated + ALL for service_role).
- **`ALTER PUBLICATION supabase_realtime ADD TABLE client_documents`** — enables Realtime for DASH-03 live document counts.

Migration history repair required: remote-only `20260210` entry (bare timestamp, no suffix) conflicted with local `20260210_add_schedule_send_hour.sql`. Applied `migration repair --status applied` per D-15-01-04 pattern. The idempotent migration ran cleanly.

### Task 2 — Document Classification Utility
Created `lib/documents/classify.ts` exporting `classifyDocument` and `ClassificationResult`:
- **KEYWORD_MAP** covers all 23 seeded `document_types` codes using regex patterns on filenames
- **Confidence levels:** `high` (filename + MIME match), `medium` (filename only), `low` (PDF, no keyword), `unclassified` (unknown MIME + no keyword)
- Single `document_types` table fetch per call — ~23 rows cached in a Map for the duration of the call
- Degrades gracefully if `document_types` query fails (returns `unclassified`)
- TypeScript compiles without errors (`npx tsc --noEmit` — clean)

### Task 3 — Postmark Webhook Attachment Extraction
Extended `app/api/postmark/inbound/route.ts`:
- Added `year_end_date` to the client select query for tax period derivation
- Added `import type { FilingTypeId }` from `@/lib/types/database`
- Added **Step 6** fire-and-forget call: `processAttachments(...).catch(err => console.error(...))`
- Added module-level `processAttachments` function:
  - Decodes base64 attachment content to `Buffer`
  - Calls `classifyDocument` for documentTypeId + confidence
  - Derives `taxPeriodEndDate` from `client.year_end_date`; falls back to previous 5 April
  - Calls `uploadDocument` to store in Storage at `orgs/{org_id}/clients/{client_id}/...`
  - Calls `calculateRetainUntil` for retention date
  - Inserts `client_documents` row with `source: 'inbound_email'`
  - Skips unmatched emails (no client — cannot scope Storage path)
  - Per-attachment try/catch — one failed attachment never blocks others
  - Webhook always returns 200 regardless of attachment outcome

## Decisions Made

| ID | Decision |
|----|----------|
| D-19-01-01 | `inbound_email_id` excluded from INSERT — not in Phase 18 schema |
| D-19-01-02 | BANK_STATEMENT pattern requires 'bank' prefix — prevents false positives |
| D-19-01-03 | KEYWORD_MAP uses actual seed codes, not plan alias names |
| D-19-01-04 | Migration history repair (20260210) — consistent with D-15-01-04 pattern |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one expected schema clarification:

The plan noted: "Check the Phase 18 migration for the exact column list. If `inbound_email_id` is not a column, remove it from the INSERT." Confirmed `client_documents` has no `inbound_email_id` column in `20260224000001_document_collection_tables.sql`. Removed from INSERT as instructed. This is a documented expected deviation, not an auto-fix.

## Verification Results

All success criteria confirmed:

- `upload_portal_tokens.revoked_at` — REST API returns 200 on `?select=revoked_at` query
- `client_document_checklist_customisations` — REST API returns 200 on `?select=id` query
- `lib/documents/classify.ts` — exports `classifyDocument` and `ClassificationResult`; `npx tsc --noEmit` clean
- `app/api/postmark/inbound/route.ts` — contains `processAttachments`, fire-and-forget call, `source: 'inbound_email'`

## Self-Check: PASSED
