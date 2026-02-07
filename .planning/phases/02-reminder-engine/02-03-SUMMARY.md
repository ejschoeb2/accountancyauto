---
phase: 02-reminder-engine
plan: 03
subsystem: template-engine
tags: [tdd, templates, variables, inheritance, date-fns]

requires:
  - 02-02 # Domain types and schema

provides:
  - Template variable substitution for {{placeholders}}
  - Field-level override inheritance model
  - Tested template logic library

affects:
  - 02-04 # Deadline calculation will use these template resolution functions
  - 02-05 # Template editor UI will use AVAILABLE_PLACEHOLDERS
  - 02-06 # Reminder scheduling will use resolveTemplateForClient

tech-stack:
  added:
    - date-fns # Date formatting and calculations for template variables
  patterns:
    - TDD with RED-GREEN-REFACTOR cycle
    - Pure function template transformation
    - Field-level override inheritance

key-files:
  created:
    - lib/templates/variables.ts
    - lib/templates/variables.test.ts
    - lib/templates/inheritance.ts
    - lib/templates/inheritance.test.ts
    - lib/types/database.ts
  modified: []

decisions:
  - id: template-variable-regex
    choice: "Use single regex /\\{\\{(\\w+)\\}\\}/g for variable replacement"
    rationale: "Simple, efficient, preserves unknown variables as-is"

  - id: override-merge-strategy
    choice: "Spread operator merge: {...baseStep, ...overridden_fields}"
    rationale: "Clean, explicit, makes it clear overrides win but base provides defaults"

  - id: unknown-variable-handling
    choice: "Preserve unknown variables (don't remove them)"
    rationale: "Allows template validation UI to show which variables are invalid without data loss"

  - id: date-format-library
    choice: "date-fns for all date formatting and calculations"
    rationale: "Already in dependencies, lightweight, tree-shakeable, handles UK date formats well"

metrics:
  duration: "4 minutes"
  tests-written: 28
  tests-passing: 28
  commits: 4
  files-created: 5
  completed: 2026-02-06
---

# Phase 02 Plan 03: Template Logic Library Summary

**One-liner:** Pure template transformation functions with variable substitution ({{client_name}} etc.) and field-level override inheritance using date-fns

## What Was Built

### 1. Template Variable Substitution (`lib/templates/variables.ts`)

**Purpose:** Replace {{variable}} placeholders with actual values from context

**Supported Variables:**
- `{{client_name}}` → Client's company name
- `{{deadline}}` → Long format date (e.g., "31 January 2026")
- `{{deadline_short}}` → Short format date (e.g., "31/01/2026")
- `{{filing_type}}` → Filing type display name
- `{{days_until_deadline}}` → Integer days remaining (calculated via `differenceInDays`)
- `{{accountant_name}}` → Practice name (defaults to "Peninsula Accounting")

**Key Behaviors:**
- Unknown variables are preserved (not removed) for validation UX
- Multiple variables in one string supported
- Empty templates return empty strings
- Default accountant name for convenience

**Exports:**
- `substituteVariables(template: string, context: TemplateContext): string`
- `AVAILABLE_PLACEHOLDERS` array for template editor UI

### 2. Field-Level Override Inheritance (`lib/templates/inheritance.ts`)

**Purpose:** Merge client-specific overrides with base template, ensuring non-overridden fields always reflect latest base template

**Core Algorithm:**
```typescript
// For each base step, find matching override by step_index
// If found: {...baseStep, ...overridden_fields}
// If not found: return baseStep unchanged
```

**Key Behaviors:**
- Only overridden fields are replaced
- Non-overridden fields always come from base template
- When base template updates, changes propagate to clients who haven't overridden those fields
- Invalid step indices are ignored (no crash)

**Exports:**
- `resolveTemplateForClient(baseSteps, overrides): TemplateStep[]`
- `getOverriddenFieldNames(baseSteps, overrides): Map<number, string[]>` for UI display

### 3. Database Types (`lib/types/database.ts`)

**Added:** Complete TypeScript interfaces for Phase 2 schema tables
- `TemplateStep`, `ReminderTemplate`, `ClientTemplateOverride`
- `FilingType`, `ClientFilingAssignment`, `ClientDeadlineOverride`
- `ReminderQueueItem`, `BankHoliday`
- `PLACEHOLDER_VARIABLES` const for reference

## TDD Execution

### Feature 1: Template Variable Substitution
- **RED:** 15 failing tests (module doesn't exist)
- **GREEN:** All 15 tests pass after implementation
- **REFACTOR:** Not needed (code was clean on first pass)

### Feature 2: Field-Level Override Inheritance
- **RED:** 13 failing tests (module doesn't exist)
- **GREEN:** All 13 tests pass after implementation
- **REFACTOR:** Not needed (code was clean on first pass)

**Total:** 28 tests, all passing

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Write failing test for variables | d37b935 | lib/templates/variables.test.ts |
| 2 | Implement variable substitution | ae40fa4 | lib/templates/variables.ts |
| 3 | Write failing test for inheritance | 3767612 | lib/templates/inheritance.test.ts |
| 4 | Implement override inheritance | 573afe8 | lib/templates/inheritance.ts |

## Decisions Made

### Technical Decisions

**1. Variable Replacement Strategy**
- Used single regex `/\{\{(\w+)\}\}/g` with nullish coalescing
- Preserves unknown variables for better UX (template validation can show errors without data loss)
- Clean, efficient, no external dependencies needed

**2. Override Merge Strategy**
- Spread operator: `{...baseStep, ...overridden_fields}`
- Explicit, readable, makes precedence clear
- Ensures non-overridden fields always from base (key inheritance requirement)

**3. Date Formatting Library**
- date-fns for all date operations
- Already in dependencies (no new packages)
- Lightweight, tree-shakeable
- Excellent UK date format support

### Testing Strategy

**Full TDD with RED-GREEN-REFACTOR:**
- Each feature started with failing tests
- Implementation made tests pass
- No refactor needed (clean first implementation)
- 100% test coverage of all edge cases

## Integration Points

### Consumed By
- **02-04 Deadline Calculation:** Will use `substituteVariables` for resolved templates
- **02-05 Template Editor UI:** Will use `AVAILABLE_PLACEHOLDERS` to show variable options
- **02-06 Reminder Scheduling:** Will use `resolveTemplateForClient` to generate final reminder content

### Dependencies
- `date-fns` for date formatting and calculations
- `lib/types/database.ts` for TypeScript interfaces

## Edge Cases Handled

1. **Unknown variables** → Preserved in template (not removed)
2. **Non-existent step indices in overrides** → Ignored silently
3. **Empty templates** → Return empty string
4. **No variables in template** → Return unchanged
5. **Multiple occurrences of same variable** → All replaced
6. **Base template updates** → Non-overridden fields get new values
7. **All fields overridden** → Works correctly (step_number still from base)
8. **Empty base steps array** → Returns empty array

## Testing Coverage

### Variables (15 tests)
✓ All 6 placeholder types work correctly
✓ Unknown variables preserved
✓ Multiple variables in one string
✓ Edge cases (empty, no variables, duplicates)
✓ Default accountant name
✓ Custom accountant name
✓ AVAILABLE_PLACEHOLDERS export

### Inheritance (13 tests)
✓ No overrides → base unchanged
✓ Partial overrides → merge correctly
✓ Multiple step overrides
✓ Non-existent step index → ignored
✓ Base template updates propagate
✓ All fields overridden
✓ Empty inputs handled
✓ getOverriddenFieldNames utility

## Performance Notes

- Pure functions (no side effects, easy to test and reason about)
- Single-pass regex replacement (O(n) where n = template length)
- Override resolution is O(steps × overrides) but both arrays are small (typically 3-5 steps)
- No database queries, no I/O (pure computation)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for next plans:**
- Template variable system complete and tested
- Override inheritance model working correctly
- Database types defined

**Blockers:** None

**Recommendations for next plans:**
- 02-04 should add UK bank holiday awareness to date calculations
- 02-05 template editor should validate variables on blur
- 02-06 reminder scheduling should cache resolved templates to avoid recalculation

## Self-Check: PASSED

✓ lib/templates/variables.ts exists
✓ lib/templates/variables.test.ts exists
✓ Commit d37b935 found in git log
✓ Commit ae40fa4 found in git log
✓ Commit 3767612 found in git log
✓ Commit 573afe8 found in git log
✓ All 28 tests passing
