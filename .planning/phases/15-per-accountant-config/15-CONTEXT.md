# Phase 15: Per-Accountant Configuration

## Goal

Transform templates, schedules, and email settings from org-level shared resources to per-accountant owned resources. Each accountant (member) manages their own reminder setup independently, while admins retain full visibility across the org.

## Background

Quick Task 5 introduced accountant-scoped client isolation (`owner_id` on `clients` table, role-aware RLS). Members now see only their own clients. However, the resources that drive the reminder pipeline — templates, schedules, and settings — remain org-level. This means:

- Members cannot access `/templates` or `/schedules` (hidden from nav, admin-only pages)
- All accountants share the same send hour, sender name, and reply-to address
- The admin configures the entire reminder engine on behalf of everyone

This phase completes the per-accountant model by giving each member control over their own reminder setup.

## What Needs to Change

### 1. Database Migrations (Low effort, low risk)

Add `owner_id` (FK to `auth.users`) to:
- `email_templates`
- `schedules`
- `schedule_steps`
- `schedule_client_exclusions`

Add `user_id` (FK to `auth.users`) to:
- `app_settings` — so each user has own `reminder_send_hour`, `sender_name`, `sender_email`, `reply_to_email`

Backfill existing rows to the org's earliest admin (same pattern as clients migration `20260222000001`).

### 2. RLS Policy Rewrites (Low effort, low risk)

Same admin/member split pattern used for `clients`:
- **Member**: `owner_id = auth.uid()` (sees only own resources)
- **Admin**: `auth_org_role() = 'admin'` (sees all in org)
- **Service role**: unchanged (full access for cron jobs)

Tables needing rewritten policies: `email_templates`, `schedules`, `schedule_steps`, `schedule_client_exclusions`, `app_settings`.

### 3. Cron Pipeline Refactor (HIGH effort, medium risk)

**This is the hardest part.** The cron pipeline is the core of the application.

#### Current flow (`lib/reminders/scheduler.ts` + `app/api/cron/`):
```
for each org:
  → get org's send_hour from app_settings
  → get org's schedules + steps + templates
  → get org's clients
  → match clients to schedules → build queue → render templates
```

#### Required flow:
```
for each org:
  for each user in org:
    → get THIS USER's send_hour
    → get THIS USER's schedules + steps + templates
    → get THIS USER's clients (owner_id match)
    → match → build queue → render with user's templates
```

Key files:
- `lib/reminders/scheduler.ts` (~350 lines) — needs per-user inner loop
- `lib/reminders/queue-builder.ts` — needs user-scoped queries
- `app/api/cron/reminders/route.ts` — may need per-user iteration
- `app/api/cron/send-emails/route.ts` (~280 lines) — needs per-user sender settings

The `reminder_queue` table may need an `owner_id` column so `send-emails` knows which user's sender settings to use when sending.

### 4. Send-Emails Per-User Sender Settings (Medium effort)

Currently `send-emails` cron reads sender name/email/reply-to from org-level `app_settings`. Needs to resolve the queue item's owner → fetch that user's settings → use their sender name and reply-to.

Postmark server token and sender domain stay org-level (shared infrastructure). Per-user config is just sender name and reply-to address within that same Postmark server.

### 5. Nav + Page Access Changes (Low effort)

- Remove `/schedules` and `/templates` from `ADMIN_ONLY_HREFS` in `components/nav-links.tsx`
- Settings page currently redirects members to `/dashboard` — members need access to their own email settings (send hour, sender name, reply-to). Either a separate member settings page or conditional rendering on the existing settings page.
- Templates and schedules pages already work with RLS — once the policies are per-user, members will automatically see only their own.

### 6. New User Seeding (Medium effort)

When a member accepts an invite, they have zero templates, zero schedules, zero settings. Options:
- **Clone from admin**: copy the admin's templates + schedules as starter content
- **System defaults**: predefined starter templates (similar to current seed data)
- **Mini onboarding**: a guided setup for new members

The invite acceptance flow (`app/(auth)/invite/accept/actions.ts`) or a post-accept hook should trigger this seeding.

### 7. Settings Per-User (Medium effort)

`app_settings` currently uses `UNIQUE(org_id, key)`. Needs `UNIQUE(org_id, user_id, key)` where `user_id` is nullable:
- `user_id = NULL` → org-level default (admin sets)
- `user_id = <uuid>` → user-specific override

Settings actions (`app/actions/settings.ts`) need to resolve: user setting → org default fallback.

## Postmark Stays Org-Level

The Postmark server token and sender domain remain per-org. Each accountant can have their own `sender_name` and `reply_to_email` within that shared infrastructure (e.g., "John Smith via Prompt").

## Effort Summary

| Area | Effort | Risk |
|------|--------|------|
| DB migrations + RLS | Low | Low |
| App code (templates/schedules pages) | Low-Medium | Low |
| Nav/access changes | Low | Low |
| Cron pipeline refactor | **High** | **Medium** |
| New user seeding | Medium | Low |
| Send-emails per-user sender | Medium | Low-Medium |
| Settings per-user resolution | Medium | Low |

## Key Files

| File | Purpose |
|------|---------|
| `lib/reminders/scheduler.ts` | Core reminder processing — needs per-user loop |
| `lib/reminders/queue-builder.ts` | Queue building — needs user-scoped queries |
| `app/api/cron/reminders/route.ts` | Reminders cron entry point |
| `app/api/cron/send-emails/route.ts` | Send cron — needs per-user sender settings |
| `app/actions/settings.ts` | Settings CRUD — needs user-level resolution |
| `components/nav-links.tsx` | Nav visibility — unhide for members |
| `app/(auth)/invite/accept/actions.ts` | Invite acceptance — trigger user seeding |
| `app/(dashboard)/settings/page.tsx` | Settings page — member access |

## Dependencies

- Quick Task 5 must be deployed first (owner_id on clients, auth_org_role() helper)
- No external dependencies
