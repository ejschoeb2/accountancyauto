---
phase: 13-onboarding-flow-team-management
plan: 04
subsystem: ui, billing
tags: [team-management, settings, cron, postmark, trial, notifications]

# Dependency graph
requires:
  - phase: 13-02
    provides: app/actions/team.ts with all 6 server actions
  - phase: 13-03
    provides: admin-only redirect guard on settings page

provides:
  - Team management card at /settings with full CRUD (invite, remove, change role, cancel/resend invites)
  - sendTrialEndingSoonEmail() function in lib/billing/notifications.ts
  - Trial reminder cron at /api/cron/trial-reminder (daily 9am UTC)
  - vercel.json updated with trial-expiry and trial-reminder cron entries

affects:
  - /settings page (TeamCard added between PostmarkSettingsCard and InboundCheckerCard)
  - lib/billing/notifications.ts (sendTrialEndingSoonEmail added)
  - vercel.json (two cron entries added)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline div+span badges from DESIGN.md for role (blue/neutral) and status (green/amber)"
    - "useTransition for non-blocking server action calls in client component"
    - "Per-row pendingAction state for cancel/resend to avoid disabling entire list"
    - "Trial reminder idempotency: app_settings key trial_reminder_sent=true per org"
    - "Cron window: gte(threeDays) + lt(fourDays) to avoid duplicate emails across days"

key-files:
  created:
    - app/(dashboard)/settings/components/team-card.tsx
    - app/api/cron/trial-reminder/route.ts
  modified:
    - app/(dashboard)/settings/page.tsx
    - lib/billing/notifications.ts
    - vercel.json

key-decisions:
  - "[D-13-04-01] TeamCard uses useTransition for invite/role-change/remove — keeps UI responsive during server action calls without blocking the entire card"
  - "[D-13-04-02] pendingAction state is per-row (id + action type) for cancel/resend — avoids disabling the entire member list during a single pending operation"
  - "[D-13-04-03] Trial reminder window is gte(now+3d) + lt(now+4d) — daily cron at 9am UTC will find orgs in exactly the 3-day window without re-sending on adjacent days"
  - "[D-13-04-04] trial-expiry cron added to vercel.json (was missing) — was defined in route.ts but not scheduled in vercel.json; added 0am UTC alongside trial-reminder at 9am UTC"

requirements-completed: [TEAM-03, TEAM-06, NOTF-01]

# Metrics
duration: 6min
completed: 2026-02-21
---

# Phase 13 Plan 04: Team Management UI & Trial Reminder Cron Summary

**Team CRUD card on settings page with invite form, member list, confirmation dialogs, and last-admin protection; plus daily trial-ending-soon cron sending amber warning emails to org admins 3 days before expiry with app_settings idempotency**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-21T10:49:49Z
- **Completed:** 2026-02-21T10:55:41Z
- **Tasks:** 2
- **Files modified/created:** 5 (2 created, 3 modified)

## Accomplishments

### Task 1: Team management card

- `app/(dashboard)/settings/components/team-card.tsx` — "use client" component with:
  - Invite form: email Input, role Select (Member/Admin), Invite Button with `useTransition`
  - Member list: email, RoleBadge (blue=Admin, neutral=Member), StatusBadge (green=Active, amber=Pending)
  - "Change role" dialog: role Select inside dialog + Confirm button + error display for last-admin case
  - "Remove" dialog: destructive Button + error display for last-admin case
  - Pending invite rows: Resend + Cancel buttons with per-row loading state
  - `useCallback` + `useEffect` for `refreshMembers()`, called after every mutation
- Settings page updated: `TeamCard` added between `PostmarkSettingsCard` and `InboundCheckerCard`

### Task 2: Trial reminder cron and email

- `sendTrialEndingSoonEmail()` added to `lib/billing/notifications.ts` — amber header color (warning, not error), "Upgrade Now" CTA → /billing, plain text + HTML, same admin email resolution pattern as `sendPaymentFailedEmail`
- `app/api/cron/trial-reminder/route.ts` — daily cron with CRON_SECRET auth, 3–4 day window query, idempotency check via `app_settings.trial_reminder_sent`, marks sent after successful email
- `vercel.json` — added `trial-expiry` (0am UTC) and `trial-reminder` (9am UTC) to crons array

## Task Commits

1. **Task 1: Build team management card on settings page** - `b4ae85b` (feat)
2. **Task 2: Build trial-ending-soon cron and notification email** - `834ba0d` (feat)

**Plan metadata:** (docs commit — see final_commit)

## Files Created/Modified

- `app/(dashboard)/settings/components/team-card.tsx` - New: team management card with full CRUD, dialogs, and invite form
- `app/(dashboard)/settings/page.tsx` - Modified: import + render `<TeamCard />` after PostmarkSettingsCard
- `lib/billing/notifications.ts` - Modified: added `sendTrialEndingSoonEmail` + HTML/text template builders
- `app/api/cron/trial-reminder/route.ts` - New: daily cron for trial-ending-soon emails with idempotency
- `vercel.json` - Modified: added trial-expiry and trial-reminder cron schedule entries

## Decisions Made

- [D-13-04-01] `useTransition` used for invite/role-change/remove server actions — keeps UI responsive during network calls while showing loading indicators without blocking the page.
- [D-13-04-02] `pendingAction` state is `{ id: string; action: 'resend' | 'cancel' }` for pending invite rows — allows individual row loading state without disabling the whole list.
- [D-13-04-03] Trial reminder window: `gte(now+3d)` and `lt(now+4d)` — ensures each daily 9am run targets orgs in exactly a 3-day window and the idempotency flag prevents double-sends even if a cron runs twice.
- [D-13-04-04] `trial-expiry` cron added to `vercel.json` — the route existed but was not in the Vercel schedule. Added alongside `trial-reminder` to ensure it runs daily at midnight UTC.

## Deviations from Plan

None — plan executed exactly as written.

One observation: `trial-expiry` was not in `vercel.json` before this plan. The plan specified to "check the current vercel.json first — if trial-expiry is already listed, only add trial-reminder." It was not listed, so both entries were added per the plan's instruction.

## Issues Encountered

None. TypeScript passed cleanly on first attempt. Build succeeded with no errors on both tasks.

## User Setup Required

None — no external service configuration required. The trial reminder cron will use the existing `POSTMARK_SERVER_TOKEN` and `CRON_SECRET` already configured in the environment.

## Next Phase Readiness

- Phase 13 complete: all 4 plans done (onboarding wizard, invite/accept, role-based nav, team UI + trial cron)
- TEAM-03, TEAM-06, NOTF-01 requirements complete
- v3.0 platform shipping: Phases 10-14 all complete

---
*Phase: 13-onboarding-flow-team-management*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: `app/(dashboard)/settings/components/team-card.tsx`
- FOUND: `app/(dashboard)/settings/page.tsx` (modified — TeamCard import + render)
- FOUND: `lib/billing/notifications.ts` (modified — sendTrialEndingSoonEmail added)
- FOUND: `app/api/cron/trial-reminder/route.ts`
- FOUND: `vercel.json` (modified — trial-expiry + trial-reminder crons added)
- FOUND: `.planning/phases/13-onboarding-flow-team-management/13-04-SUMMARY.md`
- FOUND commit: `b4ae85b` (feat(13-04): build team management card on settings page)
- FOUND commit: `834ba0d` (feat(13-04): build trial-ending-soon cron and notification email)
