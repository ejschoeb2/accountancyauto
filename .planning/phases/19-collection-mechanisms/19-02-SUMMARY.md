---
phase: 19-collection-mechanisms
plan: 02
subsystem: document-collection
tags: [portal, file-upload, react-dropzone, supabase-storage, token-auth, checklist]

requires:
  - phase: 19-01-SUMMARY.md
    provides: [classifyDocument, upload_portal_tokens schema, client_document_checklist_customisations table]
  - phase: 18-02-SUMMARY.md
    provides: [uploadDocument, calculateRetainUntil, prompt-documents bucket]
provides:
  - public /portal/[token] page (no auth required, no-referrer meta)
  - POST /api/portal/[token]/upload (file upload + classification + Storage proxy)
  - GET /api/portal/[token]/route (token validation + checklist build)
  - POST/DELETE /api/clients/[id]/portal-token (generate/revoke portal tokens)
  - GeneratePortalLink UI component on client detail page
  - ChecklistCustomisation UI component (toggle + ad-hoc items)
  - react-dropzone checklist UI (drag-drop per item)
  - ProgressBar component (X of Y items provided)
affects: [19-03-dashboard-integration, ACTV-01, ACTV-02, ACTV-03, ACTV-04]

tech-stack:
  added: [react-dropzone@^15.0.0]
  patterns:
    - Server proxy upload pattern (portal page reads service client; upload API proxies file bytes to Storage using admin client — no anon Storage RLS required)
    - SHA-256 token hash stored in DB; raw token returned once and discarded
    - PostgREST document_types join returned as array; normalised in server component before passing to client

key-files:
  created:
    - app/portal/[token]/page.tsx
    - app/portal/[token]/components/portal-checklist.tsx
    - app/portal/[token]/components/checklist-item.tsx
    - app/portal/[token]/components/progress-bar.tsx
    - app/api/portal/[token]/route.ts
    - app/api/portal/[token]/upload/route.ts
    - app/api/clients/[id]/portal-token/route.ts
    - app/(dashboard)/clients/[id]/components/generate-portal-link.tsx
    - app/(dashboard)/clients/[id]/components/checklist-customisation.tsx
  modified:
    - lib/supabase/middleware.ts (added /portal to PUBLIC_ROUTES)
    - app/(dashboard)/clients/[id]/page.tsx (added GeneratePortalLink + ChecklistCustomisation)
    - package.json (react-dropzone added)

key-decisions:
  - "[D-19-02-01] Portal page validates token inline via createServiceClient (no internal API fetch) — avoids extra network hop and keeps server component pattern"
  - "[D-19-02-02] PostgREST FK join for document_types returns array — normalised to single object in normaliseRequirements() before passing to client"
  - "[D-19-02-03] Button variants use IconButtonWithText (violet/green) — standard Button component only has default/outline/secondary/destructive variants"
  - "[D-19-02-04] used_at update is fire-and-forget (.then(() => {})) in server component — non-critical; does not block page render"
  - "[D-19-02-05] Checklist customisation upsert uses onConflict: 'client_id,filing_type_id,document_type_id' — matches unique constraint in Phase 19 schema"
  - "condition_description removed from filing_document_requirements select — column does not exist in Phase 18 schema; PostgREST silently returns null for unknown columns, causing empty checklist"

requirements-completed: [ACTV-01, ACTV-02, ACTV-03, ACTV-04]

duration: 11min + checkpoint verification
completed: 2026-02-24
---

# Phase 19 Plan 02: Active Document Collection Portal Summary

**Public /portal/[token] page with react-dropzone checklist, portal upload API proxying to Supabase Storage, token generation/revocation, and per-client checklist customisation UI — complete active document collection pipeline.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-02-23T16:46:48Z
- **Completed:** 2026-02-23T16:57:25Z
- **Tasks:** 3 complete (Tasks 1 + 2 auto; Task 3 checkpoint verified by human 2026-02-24)
- **Files modified:** 12 (+ 2 modified in bugfix commit 3865549)

## Accomplishments

- Public portal at `/portal/[token]` accessible without auth; expired/revoked tokens show appropriate error states with no-referrer meta tag
- File upload proxy through Next.js to Supabase Storage using admin client (Pattern 4 from 19-RESEARCH.md) — token validated, file classified via `classifyDocument`, stored at `orgs/{org_id}/clients/{client_id}/{filing_type_id}/{tax_year}/{uuid}.{ext}`, client_documents row inserted with `source=portal_upload`
- Token generation API sets `revoked_at` on previous tokens before inserting new one; 7-day expiry (per Phase 18 decision)
- GeneratePortalLink component on client detail page with filing type/tax year selector, copy button, and expiry display
- ChecklistCustomisation component with toggle per requirement and ad-hoc item input; optimistic UI with immediate upsert

## Task Commits

1. **Task 1: Backend APIs (middleware + portal token + upload)** - `eb0cb32` (feat)
2. **Task 2: Portal page + checklist UI + dashboard components** - `b385320` (feat)
3. **Task 3: Checkpoint — Verify portal end-to-end** - approved by human; bug fix committed as `3865549` (fix)

**Note:** The Task 1 API files (portal route + upload route + portal-token route) were partially pre-committed by a prior session in `18fc60c` (feat(19-03) — mislabeled). The `eb0cb32` commit adds react-dropzone to package.json and middleware PUBLIC_ROUTES change.

## Files Created/Modified

- `app/portal/[token]/page.tsx` — Server component; SHA-256 token lookup, no-referrer metadata, expired/revoked error states, checklist build with customisation merge
- `app/portal/[token]/components/portal-checklist.tsx` — Client component managing uploaded state per item; calls /api/portal/[token]/upload
- `app/portal/[token]/components/checklist-item.tsx` — react-dropzone per item; drag-drop + click-to-browse; spinner; green check on success
- `app/portal/[token]/components/progress-bar.tsx` — "X of Y items provided" with violet/green percentage bar
- `app/api/portal/[token]/route.ts` — GET: validates token, builds merged checklist, returns existingDocs and org/client names
- `app/api/portal/[token]/upload/route.ts` — POST: token validation, MIME allowlist, classifyDocument, uploadDocument, client_documents INSERT, used_at update
- `app/api/clients/[id]/portal-token/route.ts` — POST: revokes previous tokens, generates 256-bit raw token, stores SHA-256 hash, returns 7-day portal URL; DELETE: revokes all active tokens
- `app/(dashboard)/clients/[id]/components/generate-portal-link.tsx` — Filing type + tax year selector; copy button with Sonner toast; expiry display
- `app/(dashboard)/clients/[id]/components/checklist-customisation.tsx` — Toggle per standard requirement, add ad-hoc items; immediate upsert with optimistic UI; useTransition for non-blocking state
- `lib/supabase/middleware.ts` — Added /portal to PUBLIC_ROUTES array
- `app/(dashboard)/clients/[id]/page.tsx` — Added GeneratePortalLink and ChecklistCustomisation components

## Decisions Made

| ID | Decision |
|----|----------|
| D-19-02-01 | Portal page validates token inline (createServiceClient) — no internal API fetch needed |
| D-19-02-02 | PostgREST document_types join returns array; normalised in normaliseRequirements() |
| D-19-02-03 | Button variants use IconButtonWithText (violet/green) — standard Button lacks these variants |
| D-19-02-04 | used_at update is fire-and-forget in server component — non-critical |
| D-19-02-05 | Checklist upsert onConflict matches unique constraint from Phase 19 schema |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PostgREST FK join returns document_types as array, not single object**
- **Found during:** Task 2 (portal page TypeScript check)
- **Issue:** The plan's code assumed `document_types` from a Supabase FK join would be a single object. PostgREST returns it as an array. TypeScript caught this mismatch.
- **Fix:** Added `normaliseRequirements()` helper in portal page that uses `Array.isArray()` check and takes `[0]` element.
- **Files modified:** `app/portal/[token]/page.tsx`
- **Verification:** `npx tsc --noEmit` — clean
- **Committed in:** b385320

**2. [Rule 1 - Bug] Button component does not support violet/green variants**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** Plan specified `variant="violet"` and `variant="green"` on Button component; these variants don't exist on the standard Button component (only on ButtonBase/IconButtonWithText).
- **Fix:** Replaced `Button` with `IconButtonWithText` which is the project-standard component with those variants (per DESIGN.md patterns).
- **Files modified:** `app/(dashboard)/clients/[id]/components/generate-portal-link.tsx`, `app/(dashboard)/clients/[id]/components/checklist-customisation.tsx`
- **Verification:** `npx tsc --noEmit` — clean
- **Committed in:** b385320

---

**3. [Rule 1 - Bug] Removed non-existent `condition_description` column from PostgREST select**
- **Found during:** Task 3 checkpoint verification (portal rendered empty checklist)
- **Issue:** `filing_document_requirements` schema (Phase 18) does not have a `condition_description` column. The plan's code samples referenced it in `.select()`. PostgREST silently returns `data: null` when an unknown column is requested, causing the checklist to render as empty with "No documents are required for this filing."
- **Fix:** Removed `condition_description` from the `.select()` string in both `app/api/portal/[token]/route.ts` and `app/portal/[token]/page.tsx`
- **Files modified:** `app/api/portal/[token]/route.ts`, `app/portal/[token]/page.tsx`
- **Verification:** Portal checklist renders items correctly after fix; human verification approved
- **Committed in:** `3865549`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 - Bug)
**Impact on plan:** All fixes necessary for TypeScript correctness, type safety, and correct runtime behaviour. No scope creep.

## Issues Encountered

- Prior session had already committed the three API route files (`app/api/portal/[token]/route.ts`, `app/api/portal/[token]/upload/route.ts`, `app/api/clients/[id]/portal-token/route.ts`) under a mislabeled `feat(19-03)` commit. These files matched the plan spec exactly so no changes were needed. The Task 1 commit (`eb0cb32`) captures the remaining Task 1 work: react-dropzone installation and middleware PUBLIC_ROUTES update.

## User Setup Required

None — no additional external service configuration required beyond what Phase 18 established (Storage bucket already created, RLS already configured).

## Next Phase Readiness

- All ACTV requirements (ACTV-01 through ACTV-04) verified by human and complete
- Phase 19 Plan 03 (dashboard integration — document cards, live alert feed, Realtime notifications) is already complete
- Phase 19 Plan 04 (retention cron + DSAR export) is the only remaining plan in Phase 19 — it is paused at a human-verify checkpoint

---
*Phase: 19-collection-mechanisms*
*Completed: 2026-02-24*

## Self-Check: PASSED

All files verified present on disk. All commits verified in git log.
- `app/portal/[token]/page.tsx` — FOUND
- `app/portal/[token]/components/portal-checklist.tsx` — FOUND
- `app/portal/[token]/components/checklist-item.tsx` — FOUND
- `app/portal/[token]/components/progress-bar.tsx` — FOUND
- `app/api/portal/[token]/route.ts` — FOUND
- `app/api/portal/[token]/upload/route.ts` — FOUND
- `app/api/clients/[id]/portal-token/route.ts` — FOUND
- `app/(dashboard)/clients/[id]/components/generate-portal-link.tsx` — FOUND
- `app/(dashboard)/clients/[id]/components/checklist-customisation.tsx` — FOUND
- Commits `eb0cb32`, `b385320`, `3865549` — FOUND
- `no-referrer` metadata in portal page — FOUND
- `uploadDocument` in upload route — FOUND
- `revoked_at` in portal-token route — FOUND
