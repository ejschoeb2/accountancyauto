---
phase: 02-reminder-engine
plan: 04
subsystem: api, ui
tags: [zod, react-hook-form, shadcn, accordion, next.js, supabase]

# Dependency graph
requires:
  - phase: 02-01
    provides: reminder_templates table schema and FilingTypeId types
  - phase: 02-03
    provides: AVAILABLE_PLACEHOLDERS for template variable reference

provides:
  - Full CRUD API for reminder templates with validation
  - Template list page with card grid UI
  - Template create/edit page with accordion step editor
  - React Hook Form integration with Zod validation
  - Filing types API endpoint

affects: [02-05, 02-06, 02-07, template-scheduling, reminder-queue]

# Tech tracking
tech-stack:
  added: [@hookform/resolvers, accordion component, textarea component]
  patterns: [API route validation with Zod, useFieldArray for dynamic forms, accordion UI for multi-step editing]

key-files:
  created:
    - lib/validations/template.ts
    - app/api/templates/route.ts
    - app/api/templates/[id]/route.ts
    - app/(dashboard)/templates/page.tsx
    - app/(dashboard)/templates/[id]/edit/page.tsx
    - app/(dashboard)/templates/components/template-step-editor.tsx
    - components/ui/accordion.tsx
    - components/ui/textarea.tsx
  modified:
    - app/(dashboard)/layout.tsx
    - lib/deadlines/calculators.ts
    - package.json

key-decisions:
  - "Zod enum without type casting for better TypeScript inference"
  - "React Hook Form useFieldArray for 1-5 dynamic steps"
  - "Accordion UI pattern for collapsible step editing"
  - "Display AVAILABLE_PLACEHOLDERS reference directly in editor"

patterns-established:
  - "Template validation: templateSchema with nested templateStepSchema"
  - "API routes return 409 on conflict, 404 on not found"
  - "Client components use zodResolver with react-hook-form"
  - "Accordion items show step number and subject in trigger"

# Metrics
duration: 7min
completed: 2026-02-06
---

# Phase 02 Plan 04: Template Management Summary

**Full CRUD API for reminder templates with Zod validation, card grid list page, and accordion-based step editor using React Hook Form**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-06T20:59:39Z
- **Completed:** 2026-02-06T21:06:26Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Complete template CRUD API with validation (GET/POST/PUT/DELETE)
- Template list page showing active/inactive templates with filing types
- Accordion-based step editor allowing 1-5 reminder steps per template
- React Hook Form integration with Zod validation for client-side forms
- AVAILABLE_PLACEHOLDERS displayed in editor for user reference

## Task Commits

Each task was committed atomically:

1. **Task 1: Template API routes and validation** - `094ebe7` (feat)
   - Zod schemas for template steps and templates
   - GET/POST /api/templates for listing and creating
   - GET/PUT/DELETE /api/templates/[id] for single template operations

2. **Task 2: Template list page and accordion editor** - `84fd2d6` (feat)
   - Templates navigation link in dashboard layout
   - Template list page with card grid
   - Template-step-editor component with useFieldArray
   - Template edit/create page with full form
   - Installed accordion, textarea shadcn components and @hookform/resolvers

## Files Created/Modified

**API Layer:**
- `lib/validations/template.ts` - Zod schemas for template validation (1-5 steps, field length constraints)
- `app/api/templates/route.ts` - GET all templates, POST new template with conflict handling
- `app/api/templates/[id]/route.ts` - GET/PUT/DELETE single template by UUID

**UI Layer:**
- `app/(dashboard)/templates/page.tsx` - Template list with card grid, create button
- `app/(dashboard)/templates/[id]/edit/page.tsx` - Template create/edit form with filing type selector
- `app/(dashboard)/templates/components/template-step-editor.tsx` - Accordion-based step editor component
- `app/(dashboard)/layout.tsx` - Added Templates navigation link
- `components/ui/accordion.tsx` - Shadcn accordion component
- `components/ui/textarea.tsx` - Shadcn textarea component

**Bug Fixes:**
- `lib/deadlines/calculators.ts` - Fixed filing type IDs from dashes to underscores (corporation-tax-payment → corporation_tax_payment)

## Decisions Made

**1. Removed Zod type casting for enum**
- Changed from `z.enum([...] as const) as z.ZodType<FilingTypeId>` to just `z.enum([...] as const)`
- Reason: Type casting was causing TypeScript inference issues with react-hook-form resolver
- Better TypeScript inference without casting, form validation works correctly

**2. Default filing type in form**
- Set default filing_type_id to "corporation_tax_payment" instead of undefined
- Reason: React Hook Form requires valid default value for Zod enum validation
- Prevents form validation errors on initial render

**3. Accordion UI for step editing**
- Used shadcn Accordion component for collapsible step editing
- Each accordion item shows step number and subject in trigger
- Reason: Cleaner UI for managing multiple steps, reduces visual clutter
- Users can focus on one step at a time while seeing all step summaries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed filing type ID format in deadline calculators**
- **Found during:** Task 2 (building failed due to type mismatches)
- **Issue:** lib/deadlines/calculators.ts used dashed IDs (corporation-tax-payment) instead of underscored (corporation_tax_payment) from schema
- **Fix:** Updated all case statements in calculateDeadline() to use underscore format
- **Files modified:** lib/deadlines/calculators.ts
- **Verification:** Build passes, TypeScript validation succeeds
- **Committed in:** 84fd2d6 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added missing dependencies**
- **Found during:** Task 2 (React Hook Form zodResolver import failing)
- **Issue:** @hookform/resolvers package not installed, required for Zod integration
- **Fix:** Ran `npm install @hookform/resolvers`
- **Files modified:** package.json, package-lock.json
- **Verification:** Import succeeds, form validation works
- **Committed in:** 84fd2d6 (Task 2 commit)

**3. [Rule 2 - Missing Critical] Installed shadcn UI components**
- **Found during:** Task 2 (accordion and textarea components missing)
- **Issue:** Accordion and textarea components needed for step editor UI
- **Fix:** Ran `npx shadcn@latest add accordion textarea --yes`
- **Files modified:** components/ui/accordion.tsx, components/ui/textarea.tsx (created)
- **Verification:** Components render correctly, accordion behavior works
- **Committed in:** 84fd2d6 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for functionality and correctness. No scope creep.

## Issues Encountered

**TypeScript inference with Zod enum and react-hook-form**
- Initial type casting of Zod enum to FilingTypeId caused resolver type mismatch
- Solution: Removed type casting, let Zod infer the type naturally
- Result: TypeScript compilation succeeds, form validation works correctly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for next phases:**
- Template CRUD API complete and validated
- Template editor UI functional with 1-5 steps
- AVAILABLE_PLACEHOLDERS integrated for user reference
- Ready for client assignment (02-05) and reminder scheduling (02-07)

**No blockers or concerns**

## Self-Check: PASSED

All key files verified to exist:
- lib/validations/template.ts
- app/api/templates/route.ts
- app/api/templates/[id]/route.ts
- app/(dashboard)/templates/page.tsx
- app/(dashboard)/templates/[id]/edit/page.tsx
- app/(dashboard)/templates/components/template-step-editor.tsx
- components/ui/accordion.tsx
- components/ui/textarea.tsx

All commits verified in git log:
- 094ebe7 (Task 1)
- 84fd2d6 (Task 2)

---
*Phase: 02-reminder-engine*
*Completed: 2026-02-06*
