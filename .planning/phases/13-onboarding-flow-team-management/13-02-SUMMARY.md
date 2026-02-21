---
phase: 13-onboarding-flow-team-management
plan: 02
subsystem: auth
tags: [team-management, invitations, crypto, postmark, supabase, next.js]

# Dependency graph
requires:
  - phase: 13-01
    provides: /invite/accept in PUBLIC_ROUTES, onboarding wizard pattern
  - phase: 10-org-data-model-rls-foundation
    provides: invitations table, user_organisations table, admin client pattern
  - phase: 12-subdomain-routing-access-gating
    provides: subdomain redirect pattern after session refresh
provides:
  - sendInvite, removeTeamMember, changeRole, getTeamMembers, cancelInvite, resendInvite server actions in app/actions/team.ts
  - sendInviteEmail function in lib/billing/notifications.ts
  - validateInviteToken, acceptInvite server actions in app/(auth)/invite/accept/actions.ts
  - Accept invite page at /invite/accept with multi-state UI
affects:
  - 13-03 (team management UI can now import from app/actions/team.ts)
  - 13-04 (no dependency)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - crypto.randomBytes(32) for raw token, SHA-256 hash stored in DB — raw token sent in email only
    - Admin client used for all invitations queries on accept page (invitee has no org_id in JWT)
    - Email member lookup via getUserById loop (PostgREST FK join to auth.users not reliable)
    - Suspense wrapper for useSearchParams in client component

key-files:
  created:
    - app/actions/team.ts
    - app/(auth)/invite/accept/actions.ts
    - app/(auth)/invite/accept/page.tsx
  modified:
    - lib/billing/notifications.ts

key-decisions:
  - "[D-13-02-01] Admin client used for validateInviteToken and acceptInvite — invitee has no org_id in JWT so RLS on invitations would block SELECT queries"
  - "[D-13-02-02] Email-as-member check uses getUserById loop over memberships (not listUsers filter) — avoids reliance on Supabase admin listUsers email filter availability"
  - "[D-13-02-03] Unauthenticated invitees shown invite details + Sign In link (not magic link form) — avoids modifying auth callback; user re-clicks invite link after signing in"
  - "[D-13-02-04] sendInviteEmail uses platform POSTMARK_SERVER_TOKEN (not org token) — invitee's org may not have Postmark configured yet; these are system notifications"

requirements-completed: [TEAM-01, TEAM-02]

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 13 Plan 02: Invite & Accept Flow Summary

**Team invite flow: admin sends tokenised invite email, recipient clicks link to accept and join org — with cryptographic token security, single-use enforcement, seat limit checks, and last-admin protection**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-21T10:37:30Z
- **Completed:** 2026-02-21T10:45:29Z
- **Tasks:** 2
- **Files modified/created:** 4 (3 created, 1 modified)

## Accomplishments

- `app/actions/team.ts` — 6 server actions: `getTeamMembers`, `sendInvite`, `removeTeamMember`, `changeRole`, `cancelInvite`, `resendInvite`
- `sendInvite` enforces seat limits (active + pending count vs. `user_count_limit`), deduplicates invites, generates `crypto.randomBytes(32)` token stored as SHA-256 hash
- `removeTeamMember` and `changeRole` enforce last-admin protection (TEAM-06)
- `sendInviteEmail` added to `lib/billing/notifications.ts` — plain text + HTML email using platform Postmark token
- `app/(auth)/invite/accept/actions.ts` — `validateInviteToken` (hashes raw token, admin client lookup) and `acceptInvite` (inserts user_organisations, marks accepted_at, returns orgSlug)
- `app/(auth)/invite/accept/page.tsx` — multi-state client component: loading, invalid, unauthenticated, ready, accepting, error, success — wrapped in Suspense for Next.js useSearchParams compliance

## Task Commits

1. **Task 1: Create team server actions and invite email function** - `61618e1` (feat)
2. **Task 2: Build invite accept page and actions** - `6a4dd7d` (feat)

**Plan metadata:** (docs commit — see final_commit)

## Files Created/Modified

- `app/actions/team.ts` - New: 6 team management server actions with crypto token generation, seat limit enforcement, last-admin protection
- `lib/billing/notifications.ts` - Modified: added `sendInviteEmail` function alongside existing `sendPaymentFailedEmail`
- `app/(auth)/invite/accept/actions.ts` - New: `validateInviteToken` and `acceptInvite` server actions using admin client
- `app/(auth)/invite/accept/page.tsx` - New: accept invite page client component with 7 UI states

## Decisions Made

- [D-13-02-01] `validateInviteToken` and `acceptInvite` use admin client (service-role) — the invitee has no `org_id` in their JWT until after joining, so RLS on `invitations` would silently return zero rows for a regular authenticated query.
- [D-13-02-02] Checking if email is already a member: loop over `user_organisations` rows and call `getUserById` per member to compare emails. This avoids relying on `getUserByEmail` (not available in current SDK version) or `listUsers` email filter (not reliable cross-version). Acceptable for small team sizes (< 100 users).
- [D-13-02-03] Unauthenticated accept page shows invite details + "Sign In" link. After sign-in, user re-clicks the invite link from their email. This avoids modifying the auth callback route (out of scope) and is pragmatic for the 99% case where invitees already have accounts.
- [D-13-02-04] Invite emails use `POSTMARK_SERVER_TOKEN` (platform token), not the org's Postmark token. The invitee's org may not have a configured Postmark server yet; and invite emails are system notifications, not client-facing communications.

## Deviations from Plan

None - plan executed exactly as written.

The only implementation note: `getUserByEmail` is not exposed on the Supabase JS admin API (confirmed by SDK inspection). The plan mentioned it as an approach for checking existing members. Used `getUserById` loop over memberships instead — functionally equivalent with the same security guarantees.

## Issues Encountered

- None. TypeScript passed cleanly on first attempt. Build succeeded with no errors.

## User Setup Required

None — no external service configuration required. The invite email will use the existing `POSTMARK_SERVER_TOKEN` already configured in the environment.

## Next Phase Readiness

- `app/actions/team.ts` exports all 6 server actions ready for Phase 13-03 (team management settings UI)
- Invite/accept flow is end-to-end functional and in `PUBLIC_ROUTES` (added in 13-01)
- TEAM-01 (send invite) and TEAM-02 (accept invite) requirements complete

---
*Phase: 13-onboarding-flow-team-management*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: `app/actions/team.ts`
- FOUND: `lib/billing/notifications.ts`
- FOUND: `app/(auth)/invite/accept/actions.ts`
- FOUND: `app/(auth)/invite/accept/page.tsx`
- FOUND: `.planning/phases/13-onboarding-flow-team-management/13-02-SUMMARY.md`
- FOUND commit: `61618e1` (feat: team server actions and sendInviteEmail)
- FOUND commit: `6a4dd7d` (feat: invite accept page and actions)
