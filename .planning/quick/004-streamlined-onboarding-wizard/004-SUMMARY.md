---
phase: quick
plan: 004
subsystem: onboarding
tags: [onboarding, wizard, ui, ux, authentication]

requires:
  - quick/003: Auth moved to login page, making mode/connect steps redundant
  - phases/02-reminder-engine: Email settings infrastructure
  - phases/01-foundation: Client management and app_settings table

provides:
  - onboarding_complete: Flag in app_settings tracking wizard completion
  - getOnboardingComplete: Server action to check onboarding status
  - markOnboardingComplete: Server action to mark wizard complete
  - 3-step onboarding wizard: Clients -> Email -> Complete
  - Root routing logic: Demo -> dashboard, new user -> onboarding, returning -> dashboard

affects:
  - First-run experience: All new QuickBooks users see streamlined 3-step wizard
  - Demo users: Skip onboarding entirely (straight to dashboard)
  - Returning users: Never see onboarding again after first completion

tech-stack:
  added: []
  patterns:
    - Server-side routing based on user state (demo vs onboarding_complete)
    - Persistent onboarding completion flag in app_settings
    - Client-side wizard state machine (clients -> email -> complete)

key-files:
  created:
    - supabase/migrations/20260212100000_add_onboarding_complete_setting.sql
  modified:
    - app/actions/settings.ts
    - app/page.tsx
    - app/(auth)/onboarding/callback/route.ts
    - app/(auth)/onboarding/page.tsx
    - app/(auth)/onboarding/layout.tsx
    - app/(auth)/onboarding/components/onboarding-client-table.tsx

decisions:
  - decision-id: ONBD-001
    what: Single onboarding_complete flag for entire wizard
    why: Simple persistence without tracking per-step state
    alternatives: ["Per-step completion tracking", "Dismissible wizard"]
    rationale: Users complete or skip wizard as a whole, not incrementally

  - decision-id: ONBD-002
    what: Demo users skip onboarding entirely
    why: Demo should show immediate value, not configuration
    alternatives: ["Show abbreviated onboarding", "Optional onboarding tour"]
    rationale: Demo users just want to explore, not configure

  - decision-id: ONBD-003
    what: OAuth callback redirects to root (/) instead of /dashboard
    why: Root page now handles routing based on onboarding status
    alternatives: ["Callback sets query param for onboarding", "Callback checks flag directly"]
    rationale: Centralized routing logic at root, single source of truth

metrics:
  duration: 4min
  completed: 2026-02-12
---

# Quick Task 004: Streamlined Onboarding Wizard Summary

**One-liner:** Simplified onboarding to 3-step wizard (Clients -> Email -> Complete) after auth moved to login page.

## What Was Built

After quick/003 moved QuickBooks OAuth and demo login to the login page, the onboarding wizard still had redundant mode selection and connect steps. This task strips those away, leaving only the essential configuration steps:

1. **Step 1 - Clients**: Configure client types, year-ends, VAT details, CSV import
2. **Step 2 - Email**: Set sender name, email, reply-to address
3. **Step 3 - Complete**: Success screen with "Go to Dashboard" button

The wizard appears once for new QuickBooks users (after OAuth callback), then never again. Demo users skip it entirely.

## Implementation Details

### Task 1: Onboarding Completion Flag & Routing

**What was done:**
- Created migration `20260212100000_add_onboarding_complete_setting.sql` to seed `onboarding_complete=false` in app_settings
- Added `getOnboardingComplete()` and `markOnboardingComplete()` server actions to settings.ts
- Updated root `app/page.tsx` with smart routing:
  - Demo user (`demo@peninsula-internal.local`) → `/dashboard`
  - New user (`onboarding_complete=false`) → `/onboarding`
  - Returning user (`onboarding_complete=true`) → `/dashboard`
- Changed OAuth callback to redirect to `/` instead of `/dashboard`

**Files modified:**
- `supabase/migrations/20260212100000_add_onboarding_complete_setting.sql` (created)
- `app/actions/settings.ts` (+18 lines)
- `app/page.tsx` (routing logic)
- `app/(auth)/onboarding/callback/route.ts` (redirect target)

**Commit:** `8bda275`

### Task 2: Streamlined Wizard UI

**What was done:**
- Rewrote `app/(auth)/onboarding/page.tsx`:
  - Removed mode selection ("Demo" vs "Connect Your Data")
  - Removed QuickBooks connect step (OAuth already happened at login)
  - Removed all OAuth callback parameter handling (`useSearchParams`, `Suspense`)
  - Simplified to 3 steps: `clients | email | complete`
  - Wrapped content in Cards matching dashboard design system
  - Used consistent typography: `text-2xl font-bold tracking-tight` for headings
- Updated `app/(auth)/onboarding/layout.tsx`:
  - Added Peninsula branding (logo pair with divider, matching login page)
  - Added server-side auth check (redirect to `/login` if not authenticated)
  - Increased max width to `max-w-5xl` for client table room
- Updated `onboarding-client-table.tsx`:
  - Changed text from "synced from QuickBooks" to just "{N} clients" (source is now ambiguous)

**Files modified:**
- `app/(auth)/onboarding/page.tsx` (-277 lines, +110 lines - massive simplification)
- `app/(auth)/onboarding/layout.tsx` (+auth check, +branding)
- `app/(auth)/onboarding/components/onboarding-client-table.tsx` (text change)

**Commit:** `b44ad4d`

## User Flows

### New QuickBooks User
1. Visit `/` (unauthenticated) → redirect to `/login`
2. Click "Sign in with QuickBooks" → OAuth flow
3. QuickBooks callback → auto-create Supabase user, sync clients
4. Redirect to `/` → `onboarding_complete=false` → redirect to `/onboarding`
5. Complete 3-step wizard (or skip through)
6. Click "Go to Dashboard" → `markOnboardingComplete()` → redirect to `/dashboard`
7. Future visits to `/` → `onboarding_complete=true` → redirect to `/dashboard`

### Demo User
1. Visit `/` (unauthenticated) → redirect to `/login`
2. Click "Try Demo" → `signInAsDemo()` → redirect to `/dashboard`
3. Never sees onboarding (demo user check in `app/page.tsx`)

### Returning QuickBooks User
1. Visit `/` (authenticated, session cookie exists) → `onboarding_complete=true` → redirect to `/dashboard`
2. No onboarding shown

## Design System Alignment

**Branding:**
- Logo pair: `logofini.png` + `peninsulaccountinglogo.jpg` with vertical divider
- Matches login page branding exactly

**Typography:**
- Step headings: `text-2xl font-bold tracking-tight`
- Subtext: `text-muted-foreground`
- Matches dashboard settings page hierarchy

**Components:**
- Used `Card` / `CardContent` from `@/components/ui/card`
- Used `Button` with variants: primary (default), ghost (skip), outline
- Used `active:scale-[0.97]` micro-interaction on primary buttons

**Spacing:**
- `space-y-8` between major sections (stepper, content, nav)
- `space-y-6` within cards
- `space-y-4` for form fields

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Concerns:**
- Migration `20260212100000_add_onboarding_complete_setting.sql` needs to be applied to remote database
- Pre-existing TypeScript error in `lib/email/sender.ts` (unrelated to this task)

**Recommendations:**
- Run `npx supabase db push` to apply the `onboarding_complete` migration
- Test full onboarding flow with fresh QuickBooks account
- Test demo login flow (should skip onboarding)
- Test returning user flow (should skip onboarding)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add onboarding_complete flag and redirect logic | 8bda275 | settings.ts, page.tsx, callback/route.ts, migration |
| 2 | Rewrite onboarding as streamlined 3-step wizard | b44ad4d | onboarding/page.tsx, layout.tsx, client-table.tsx |

## Self-Check: PASSED

**Created files verified:**
- ✓ supabase/migrations/20260212100000_add_onboarding_complete_setting.sql

**Commits verified:**
- ✓ 8bda275
- ✓ b44ad4d

All deliverables present and accounted for.
