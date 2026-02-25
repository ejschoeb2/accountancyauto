# Deferred Items - Phase 21

## Pre-existing TypeScript Errors (out of scope for Plan 02)

These TypeScript errors existed before Plan 02 execution and are in files unrelated to the OCR/classification work:

1. `app/(dashboard)/settings/components/settings-tabs.tsx` (lines 90, 91) — `string | null` not assignable to `string` for PostmarkSettingsCard props
2. `app/api/filing-types/route.ts` (line 31) — Conversion type mismatch on array
3. `app/portal/[token]/components/checklist-item.tsx` (lines 62, 63) — `condition_description` property missing from `ChecklistItem` type
4. `components/marketing/hero-section.tsx` — framer-motion `Variants` type incompatibility with ease array

These are pre-existing issues, not introduced by Plan 02. They should be resolved in appropriate future plans.

## Pre-existing Test Failure

- `lib/templates/variables.test.ts` — "uses default 'Peninsula Accounting' for {{accountant_name}}" fails because the default was updated to 'PhaseTwo' (branding change) but test was not updated. Known tech debt item #4 in STATE.md.
