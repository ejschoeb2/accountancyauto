---
phase: quick
plan: 003
subsystem: dashboard-ui
tags: [quickbooks, status-banner, sync-tracking, uat-gap-closure]
dependency-graph:
  requires: [phase-3 oauth integration]
  provides: [always-visible QBO status banner with connected/disconnected states, last sync time tracking]
  affects: [future QBO sync features]
tech-stack:
  added: []
  patterns: [server component with date-fns formatting, dynamic import for admin client]
key-files:
  created:
    - supabase/migrations/20260207200000_add_last_synced_at_to_oauth_tokens.sql
  modified:
    - components/qbo-status-banner.tsx
    - app/actions/quickbooks.ts
    - lib/quickbooks/sync.ts
    - app/(dashboard)/layout.tsx
decisions:
  - id: D-Q003-1
    decision: Use dynamic import for createAdminClient in getConnectionStatus
    rationale: Avoid circular dependency issues and keep server action clean
  - id: D-Q003-2
    decision: Remove "use client" directive from QBO banner
    rationale: Component only uses pure functions (date-fns formatDistanceToNow), no client interactivity needed
  - id: D-Q003-3
    decision: Keep lucide-react icons in banner despite DESIGN_SYSTEM.md note
    rationale: lucide-react is still installed and used across 26 files; migration to material-symbols is aspirational
metrics:
  duration: ~3 min
  completed: 2026-02-07
---

# Quick 003: Redesign QBO Status Banner Summary

**Always-visible QBO status banner showing green/connected state with last sync time and warning/disconnected state with reconnect link, plus last_synced_at tracking in oauth_tokens.**

## What Was Done

### Task 1: Add last_synced_at column and update sync + connection status
- Created migration to add `last_synced_at TIMESTAMPTZ` column to `oauth_tokens` table
- Updated `ConnectionStatus` interface to include `lastSyncTime` field
- Rewrote `getConnectionStatus()` to query `oauth_tokens` directly (instead of via TokenManager) to fetch `realm_id` and `last_synced_at`
- Added `last_synced_at` timestamp update in `syncClients()` after successful client upsert (non-blocking on failure)

### Task 2: Redesign QBO status banner for both states and update layout props
- Removed the `return null` early exit when connected -- banner now always renders
- **Connected state:** Green `CheckCircle` icon, "QuickBooks connected" text, relative last sync time (e.g., "Last synced: 5 minutes ago") or "Last synced: never"
- **Disconnected state:** Amber `AlertTriangle` icon, "QuickBooks disconnected" text, reconnect badge linking to /onboarding
- Removed `"use client"` directive -- component is now a server component using pure `formatDistanceToNow` from date-fns
- Updated layout to pass `lastSyncTime` prop to `QboStatusBanner`

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add last_synced_at column and update sync + connection status | e96a994 | migration, quickbooks.ts, sync.ts |
| 2 | Redesign QBO status banner for both states | bd7702b | qbo-status-banner.tsx, layout.tsx |

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| D-Q003-1 | Dynamic import for createAdminClient | Avoids circular dependency, keeps server action clean |
| D-Q003-2 | Remove "use client" from banner | Only pure functions used, no client interactivity needed |
| D-Q003-3 | Keep lucide-react icons | Still installed and used in 26 files; material-symbols migration is aspirational |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript compiles without errors | PASS |
| Banner never returns null | PASS (no `return null` in file) |
| ConnectionStatus includes lastSyncTime | PASS |
| sync.ts updates last_synced_at | PASS |
| Migration file exists | PASS |
| Layout passes lastSyncTime prop | PASS |

## UAT Gap Closure

**UAT Test 25:** QuickBooks status banner is always visible, showing connection status and last sync time when connected, or disconnection warning with reconnect link when disconnected.

**Status:** Gap closed. Banner renders in both states with all required information.

## Self-Check: PASSED
