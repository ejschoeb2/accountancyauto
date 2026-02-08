---
phase: 09-queue-integration
plan: 02
subsystem: database
tags: [migration, cleanup, supabase, typescript]

# Dependency graph
requires:
  - phase: 09-01
    provides: Queue builder, scheduler, and send-emails cron rewired to v1.1 tables
provides:
  - All v1.0 reminder_templates code removed from application
  - reminder_templates and client_template_overrides tables dropped via migration
  - Clean codebase with zero references to old JSONB template structure
affects: [future-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clean break migrations: drop old tables only after full rewiring verified"
    - "Independent rollback units: DROP TABLE migration separate from queue rewiring"

key-files:
  created:
    - supabase/migrations/20260208100002_drop_reminder_templates.sql
  modified:
    - lib/types/database.ts
    - app/(dashboard)/clients/[id]/page.tsx
    - app/(dashboard)/schedules/[id]/edit/page.tsx

key-decisions:
  - "All v1.0 code removed in single commit for atomic clean break"
  - "UrgencyLevel type updated to remove 'low' level per decision [07-01]"
  - "Template overrides section intentionally removed from client detail page (no per-client overrides per user decision)"
  - "DROP TABLE migration as independent rollback unit from queue rewiring"

patterns-established:
  - "Deletion audit pattern: grep entire codebase for references before considering cleanup complete"
  - "Type cleanup after schema changes: remove old interfaces when tables drop"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 9 Plan 2: v1.0 Code Cleanup Summary

**All v1.0 reminder_templates code deleted, old tables dropped via migration, codebase exclusively uses v1.1 normalized structure**

## Performance

- **Duration:** 5 minutes
- **Started:** 2026-02-08T14:25:55Z
- **Completed:** 2026-02-08T14:30:34Z
- **Tasks:** 2
- **Files modified:** 3 modified, 9 deleted, 1 created

## Accomplishments
- Deleted all v1.0 API routes, components, libraries, and validation schemas
- Removed TemplateStep, ReminderTemplate, and ClientTemplateOverride interfaces from types
- Created DROP TABLE migration for reminder_templates and client_template_overrides
- Zero application references to old template system remain
- TypeScript compilation clean with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete old v1.0 routes, components, and library files** - `8321ec9` (chore)
2. **Task 2: Drop reminder_templates table and final verification** - `7fbc466` (feat)

## Files Created/Modified

**Created:**
- `supabase/migrations/20260208100002_drop_reminder_templates.sql` - Drops client_template_overrides and reminder_templates tables

**Modified:**
- `lib/types/database.ts` - Removed TemplateStep, ReminderTemplate, ClientTemplateOverride interfaces; updated UrgencyLevel to exclude 'low'
- `app/(dashboard)/clients/[id]/page.tsx` - Removed template-overrides import and component usage
- `app/(dashboard)/schedules/[id]/edit/page.tsx` - Removed defensive 'low' urgency level mapping

**Deleted:**
- `app/api/templates/route.ts` - v1.0 /api/templates GET/POST
- `app/api/templates/[id]/route.ts` - v1.0 /api/templates/[id] GET/PUT/DELETE
- `app/api/clients/[id]/template-overrides/route.ts` - v1.0 template overrides API
- `app/(dashboard)/clients/[id]/components/template-overrides.tsx` - v1.0 template overrides UI
- `app/(dashboard)/templates/components/template-step-editor.tsx` - Unused v1.0 component
- `lib/templates/inheritance.ts` - resolveTemplateForClient() and getOverriddenFieldNames()
- `lib/templates/inheritance.test.ts` - Tests for inheritance library
- `lib/validations/template.ts` - templateSchema and templateStepSchema
- `scripts/verify-migration.ts` - One-time migration verification script

## Decisions Made

1. **All deletions in single commit** - Atomic clean break ensures no partial state exists
2. **UrgencyLevel type cleanup** - Removed 'low' level to match decision [07-01] (three levels only: normal, high, urgent)
3. **Template overrides section removed** - Per user decision from Phase 7, no per-client overrides in v1.1
4. **Independent DROP TABLE migration** - Separate from queue rewiring (20260208000002) for independent rollback
5. **Keep helpful comments** - Comment in queue-builder.ts clarifying "Points to schedule (not old reminder_templates)" is helpful context, not dead code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deleted unused template-step-editor.tsx**
- **Found during:** Task 1 (TypeScript compilation after deletions)
- **Issue:** app/(dashboard)/templates/components/template-step-editor.tsx imported deleted lib/validations/template but was itself unused
- **Fix:** Deleted the entire file (not referenced anywhere in codebase)
- **Files modified:** app/(dashboard)/templates/components/template-step-editor.tsx (deleted)
- **Verification:** Grep confirmed no imports of template-step-editor, TypeScript compilation passes
- **Committed in:** 8321ec9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue - unused file importing deleted module)
**Impact on plan:** Necessary to achieve clean compilation. No scope creep.

## Issues Encountered

- **Next.js type validator cache:** .next/types/validator.ts initially showed errors for deleted routes, but resolved after TypeScript recompilation (cache issue, not actual problem)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**v1.1 migration fully complete:**
- All v1.0 code removed from application
- All v1.0 tables dropped via migration
- Codebase exclusively uses v1.1 normalized structure
- Queue builder, scheduler, and send-emails cron operational with v1.1 tables
- Rich text rendering pipeline active (TipTap → generateHTML → React Email)

**Phase 9 Complete:**
Phase 9 (Queue Integration) is now complete with both plans executed:
- 09-01: Rewired queue builder, scheduler, and send-emails cron to v1.1 tables
- 09-02: Removed all v1.0 code and dropped old tables

**System Status:**
The reminder system is now fully operational on v1.1 architecture with zero legacy code remaining. Git history preserves all v1.0 implementation for reference.

## Self-Check: PASSED

All created files exist:
- supabase/migrations/20260208100002_drop_reminder_templates.sql ✓

All commits exist:
- 8321ec9 ✓
- 7fbc466 ✓

---
*Phase: 09-queue-integration*
*Completed: 2026-02-08*
