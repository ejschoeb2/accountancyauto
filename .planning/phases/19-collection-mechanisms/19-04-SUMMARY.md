---
phase: 19-collection-mechanisms
plan: 04
subsystem: api
tags: [cron, retention, dsar, jszip, postmark, compliance, gdpr]

# Dependency graph
requires:
  - phase: 19-01
    provides: client_documents schema with retention_flagged, retain_until, retention_hold columns
  - phase: 18-04
    provides: document_access_log table, storage.ts with getSignedDownloadUrl
provides:
  - Weekly retention cron that flags expired documents and emails org admins (COMP-02)
  - DSAR export API that generates ZIP with all client documents + JSON manifest (COMP-03)
  - DsarExportButton component on client detail page Compliance section
affects:
  - vercel.json (new weekly cron schedule)
  - client detail page (Compliance section added)

# Tech tracking
tech-stack:
  added:
    - jszip@^3.10.1 (ZIP generation for DSAR export)
  patterns:
    - retention-cron-pattern: idempotent cron using retention_flagged=false filter to prevent re-flagging
    - dsar-zip-export: arraybuffer JSZip output for Web API Response compatibility
    - postmark-system-notification: platform POSTMARK_SERVER_TOKEN for system emails (not org token)

key-files:
  created:
    - app/api/cron/retention/route.ts
    - lib/documents/notifications.ts
    - app/api/clients/[id]/documents/dsar/route.ts
    - app/(dashboard)/clients/[id]/components/dsar-export-button.tsx
  modified:
    - vercel.json (weekly retention cron added)
    - app/(dashboard)/clients/[id]/page.tsx (Compliance section with DsarExportButton)

key-decisions:
  - "[D-19-04-01] JSZip arraybuffer type used instead of nodebuffer/uint8array — BodyInit compatibility with Web API Response in Next.js TypeScript strictmode"
  - "[D-19-04-02] PostgREST FK join returns clients as array; normalised inline in cron route (pick first element) rather than changing FlaggedDocument interface"
  - "[D-19-04-03] DSAR manifest excludes storage_path — raw storage paths must never be exposed per DOCS-05; document metadata only"

patterns-established:
  - "retention-cron-pattern: Flag-and-notify, never delete. Idempotency via retention_flagged=false filter in WHERE clause."
  - "dsar-zip-arraybuffer: Use type:'arraybuffer' with JSZip.generateAsync() for Next.js Route Handler compatibility"

requirements-completed:
  - COMP-02
  - COMP-03

# Metrics
duration: ~35min
completed: 2026-02-24
---

# Phase 19 Plan 04: Retention Enforcement + DSAR Export Summary

**Weekly retention cron flags expired client documents and emails org admins; DSAR export endpoint generates a JSZip of all client documents with a manifest.json including metadata and access log entries.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-02-23T16:47:18Z
- **Completed:** 2026-02-24
- **Tasks:** 3 complete (2 auto + 1 checkpoint: human verification passed)
- **Files modified:** 6

## Accomplishments

- Retention enforcement cron at `/api/cron/retention` — flags documents past `retain_until` with `retention_flagged=true`, groups by org, sends one batch email per org admin listing newly flagged documents; idempotent (WHERE retention_flagged=false prevents re-flagging on re-run); never auto-deletes
- `sendRetentionFlaggedEmail` notification helper in `lib/documents/notifications.ts` following same pattern as `lib/billing/notifications.ts` (platform Postmark token, auth.admin.getUserById for email resolution, individual per-admin send with error isolation)
- DSAR export API at `GET /api/clients/[id]/documents/dsar` — builds JSZip of all client documents fetched via signed URLs + manifest.json with document metadata and document_access_log entries; storage_path excluded from manifest per DOCS-05
- `DsarExportButton` client component with loading state and toast feedback on client detail page in new Compliance card section
- Weekly Vercel cron schedule `0 8 * * 1` (Monday 8:00 UTC) added to `vercel.json`

## Task Commits

Each task was committed atomically:

1. **Task 1: Install jszip + retention cron + retention email helper + vercel.json schedule** - `1cbd60b` (feat)
2. **Task 2: DSAR export API + download button on client detail page** - `12623e4` (feat)
3. **Task 3: Checkpoint — human verification** - approved by user (client_documents table empty in dev; "no documents" 404 is correct behaviour)

## Files Created/Modified

- `lib/documents/notifications.ts` — sendRetentionFlaggedEmail helper (platform Postmark token, system notification)
- `app/api/cron/retention/route.ts` — weekly cron: flags expired documents, groups by org, emails admins
- `app/api/clients/[id]/documents/dsar/route.ts` — GET: JSZip of all client documents + manifest.json
- `app/(dashboard)/clients/[id]/components/dsar-export-button.tsx` — client component, loading state, toast feedback
- `vercel.json` — added `/api/cron/retention` at `0 8 * * 1`
- `app/(dashboard)/clients/[id]/page.tsx` — DsarExportButton added in Compliance section

## Decisions Made

| ID | Decision |
|----|----------|
| D-19-04-01 | JSZip `arraybuffer` type for `generateAsync()` — `nodebuffer` and `uint8array<ArrayBufferLike>` fail TypeScript strict mode with `BodyInit`; `arraybuffer` (plain `ArrayBuffer`) passes |
| D-19-04-02 | PostgREST FK join returns `clients` as array; normalised inline (pick index 0) rather than changing `FlaggedDocument` interface — keeps interface clean and the normalisation is 1 line |
| D-19-04-03 | DSAR manifest excludes `storage_path` — raw Storage paths must never be exposed per DOCS-05; manifest contains only document metadata fields |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSZip output type for Web API Response compatibility**
- **Found during:** Task 2 (DSAR route TypeScript check)
- **Issue:** Plan used `type: 'nodebuffer'`; `Buffer<ArrayBufferLike>` is not assignable to `BodyInit` in Next.js TypeScript; then tried `uint8array` which became `Uint8Array<ArrayBufferLike>` — same problem with newer TypeScript
- **Fix:** Changed to `type: 'arraybuffer'` which produces a plain `ArrayBuffer` that is assignable to `BodyInit`
- **Files modified:** `app/api/clients/[id]/documents/dsar/route.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 12623e4 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed PostgREST clients FK join type mismatch**
- **Found during:** Task 1 (retention cron TypeScript check)
- **Issue:** Plan cast `docs` with `as Parameters<typeof sendRetentionFlaggedEmail>[1]` but PostgREST returns `clients` as an array `{ company_name, display_name }[]` not a single object; TypeScript TS2352 "neither type sufficiently overlaps"
- **Fix:** Added inline `normalised` map in the cron route to pick `clients[0] ?? null` before calling `sendRetentionFlaggedEmail` — the `FlaggedDocument` interface stays clean
- **Files modified:** `app/api/cron/retention/route.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 1cbd60b (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for TypeScript compilation. No scope creep — behaviour is identical to plan specification.

## Issues Encountered

- `git stash pop` failed due to working copy conflicts with uncommitted Phase 19-02/03 work (checklist-customisation, generate-portal-link). Resolved by dropping the stash and re-applying vercel.json edit manually. My new files were untracked and unaffected.

## User Setup Required

None — no new external service configuration required. CRON_SECRET and POSTMARK_SERVER_TOKEN are already in place from prior phases.

## Next Phase Readiness

- Phase 19 is fully complete — all 4 plans done: 19-01 (schema), 19-02 (upload portal), 19-03 (document UI), 19-04 (retention cron + DSAR)
- v4.0 Document Collection milestone is complete
- COMP-02 (retention enforcement) and COMP-03 (DSAR export) requirements fulfilled
- No blockers for future phases

## Self-Check: PASSED

- `app/api/cron/retention/route.ts` — FOUND
- `lib/documents/notifications.ts` — FOUND
- `app/api/clients/[id]/documents/dsar/route.ts` — FOUND
- `app/(dashboard)/clients/[id]/components/dsar-export-button.tsx` — FOUND
- Task 1 commit `1cbd60b` — verified in git log
- Task 2 commit `12623e4` — verified in git log

---
*Phase: 19-collection-mechanisms*
*Completed: 2026-02-24*
