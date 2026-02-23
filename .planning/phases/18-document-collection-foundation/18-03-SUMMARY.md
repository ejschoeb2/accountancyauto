---
phase: 18-document-collection-foundation
plan: "03"
subsystem: compliance
tags: [privacy-policy, terms-of-service, gdpr, comp-01, legal]
dependency_graph:
  requires: []
  provides: [COMP-01]
  affects: [phase-19-collection-mechanisms]
tech_stack:
  added: []
  patterns: [inline-policy-amendment]
key_files:
  modified:
    - app/(marketing)/privacy/page.tsx
    - .planning/phases/18-document-collection-foundation/18-03-SUMMARY.md
  created: []
decisions:
  - "[D-18-03-01] Amendments 1-6 applied inline — no visible changelog or amendment section added; last updated date unchanged (already February 2026)"
  - "[D-18-03-02] Amendment 7 (date) requires no change — both pages already show February 2026"
metrics:
  duration: ~10 min
  completed: 2026-02-23
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 18 Plan 03: Privacy and Terms Compliance Amendments Summary

**One-liner:** Inline UK GDPR compliance amendments to /privacy and /terms enabling lawful document collection under TMA 1970, HMRC CH14600, and Art. 13/14 transparency obligations.

## What Was Built

All 7 compliance amendments from RESEARCH.md applied inline to existing policy pages:

**`app/(marketing)/privacy/page.tsx` — 5 amendments:**
- **Amendment 1 (Section 3):** Financial documents data category added to Client Data bullet list (P60, P45, P11D, SA302, bank statements, dividend vouchers, statutory accounts, VAT records, Companies House documents)
- **Amendment 2 (Section 9):** TMA 1970 s12B + HMRC CH14600 statutory retention carve-out added to Data Retention list (5-year individual / 6-year company minimums; no deletion even on cancellation)
- **Amendment 3 (Section 4):** Processing scope sentence updated to include "storing and managing financial documents and tax records uploaded via the accountant portal or received as email attachments"
- **Amendment 4 (Section 4):** New paragraph added disclosing portal data subjects — clients accessing the portal via time-limited token links as direct data subjects
- **Amendment 5 (Section 7):** Supabase sub-processor Purpose updated from "Database hosting, authentication, row-level security" to include "and encrypted file storage for uploaded financial documents and tax records"

**`app/(marketing)/terms/page.tsx` — 1 amendment:**
- **Amendment 6 (Section 6):** Special category data bullet updated — removes ambiguous "financial beyond what is necessary" language; explicitly permits P60s, SA302s, bank statements, dividend vouchers for accountancy purposes

**Amendment 7:** Both pages already showed "Last updated: February 2026" — no change required.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Apply amendments | 1175445 | feat(18-03): apply privacy and terms compliance amendments (COMP-01) |

## Deviations from Plan

None — plan executed exactly as written. All 7 amendments applied using exact language from RESEARCH.md.

## Checkpoint Status

**Task 2 (checkpoint:human-verify)** — APPROVED by user (2026-02-23).

User confirmed all 7 amendments are present and readable on both /privacy and /terms pages.

## Self-Check

- [x] `app/(marketing)/privacy/page.tsx` — modified (commit 1175445)
- [x] `app/(marketing)/terms/page.tsx` — modified (commit 1175445)
- [x] `grep -c "TMA 1970"` → 1 (PASSED)
- [x] `grep -c "financial documents that are necessary"` → 1 (PASSED)
- [x] `grep -c "encrypted file storage"` → 1 (PASSED)
- [x] `grep -c "time-limited token"` → 1 (PASSED)

## Self-Check: PASSED
