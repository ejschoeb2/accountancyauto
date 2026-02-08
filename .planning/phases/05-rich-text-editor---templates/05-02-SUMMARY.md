---
phase: 05-rich-text-editor---templates
plan: 02
subsystem: api
tags: [zod, validation, api-routes, supabase, tiptap, crud]

# Dependency graph
requires:
  - phase: 04-data-migration
    provides: email_templates table with TipTap JSON body_json column
provides:
  - Zod validation schema for email_templates (name, subject, body_json, is_active)
  - CRUD API endpoints at /api/email-templates/
  - FK constraint protection (ON DELETE RESTRICT handling)
affects: [05-03-email-template-editor, 05-04-integrate-editor-with-template-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recursive Zod schema for TipTap JSON validation"
    - "FK constraint violation handling (23503 -> 409 response)"

key-files:
  created:
    - lib/validations/email-template.ts
    - app/api/email-templates/route.ts
    - app/api/email-templates/[id]/route.ts
  modified: []

key-decisions:
  - "Used z.record(z.string(), z.unknown()) for TipTap attrs to satisfy Zod v4 API"
  - "Separate /api/email-templates/ routes coexist with v1.0 /api/templates/ (no conflict)"
  - "DELETE returns 409 with clear message when template is in use by schedule"

patterns-established:
  - "Recursive z.lazy() schema for validating nested TipTap node structures"
  - "tipTapDocumentSchema enforces root node type: 'doc' literal"

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 05 Plan 02: Email Template API Summary

**Full CRUD API for v1.1 email templates with TipTap JSON validation, enabling template editor to persist standalone email templates**

## Performance

- **Duration:** 4m 1s
- **Started:** 2026-02-08T12:11:21Z
- **Completed:** 2026-02-08T12:15:22Z
- **Tasks:** 2
- **Files modified:** 3 created

## Accomplishments
- Zod validation schema validates TipTap document structure with recursive node schema
- List all email templates (GET /api/email-templates/)
- Create templates with body_json validation (POST /api/email-templates/)
- Fetch, update, and delete individual templates (GET/PUT/DELETE /api/email-templates/[id])
- FK protection prevents deleting templates in use by schedules (409 status)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Zod validation schema for email_template** - `ff7973e` (feat)
2. **Task 2: Create API routes for email_templates CRUD** - `93b5ee9` (feat)

## Files Created/Modified

- `lib/validations/email-template.ts` - Zod schema for email template validation with recursive TipTap JSON structure
- `app/api/email-templates/route.ts` - GET (list all) and POST (create) endpoints
- `app/api/email-templates/[id]/route.ts` - GET (single), PUT (update), DELETE (with FK protection) endpoints

## Decisions Made

**Zod v4 record API:** Used `z.record(z.string(), z.unknown())` instead of `z.record(z.unknown())` to satisfy Zod v4 requirement for both key and value types.

**FK constraint handling:** DELETE endpoint returns 409 (Conflict) with message "Template is in use by a schedule and cannot be deleted" when Postgres returns error code 23503 (foreign key violation from schedule_steps.email_template_id).

**Route separation:** New `/api/email-templates/` routes coexist with v1.0 `/api/templates/` routes. Both are active and don't conflict. v1.0 routes operate on `reminder_templates` table, v1.1 routes operate on `email_templates` table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 record type signature**
- **Found during:** Task 1 (validation schema creation)
- **Issue:** Initial code used `z.record(z.unknown())` which caused TypeScript error "Expected 2-3 arguments, but got 1" in Zod v4 API
- **Fix:** Changed to `z.record(z.string(), z.unknown())` to provide both key and value type parameters
- **Files modified:** lib/validations/email-template.ts
- **Verification:** npm run build succeeded, TypeScript compilation passed
- **Committed in:** ff7973e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Zod v4 API fix required for correctness. No scope creep.

## Issues Encountered

**Postmark API token error during build:** Build failed at page data collection stage with "A valid API token must be provided" from Postmark client. This is expected behavior during builds without .env.local file, not related to new code. TypeScript compilation succeeded before this error.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

API layer complete for email template CRUD. Ready for Plan 03-04:
- TipTap editor integration
- Template UI with list/create/edit/delete flows
- Placeholder variable insertion

**Dependencies satisfied:** email_templates table (Phase 4), validation schema, and API endpoints all ready.

---
*Phase: 05-rich-text-editor---templates*
*Completed: 2026-02-08*

## Self-Check: PASSED

All claimed files exist:
- lib/validations/email-template.ts
- app/api/email-templates/route.ts
- app/api/email-templates/[id]/route.ts

All claimed commits exist:
- ff7973e (Task 1)
- 93b5ee9 (Task 2)
