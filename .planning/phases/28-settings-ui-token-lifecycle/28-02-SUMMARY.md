---
phase: 28-settings-ui-token-lifecycle
plan: "02"
subsystem: settings-ui
tags:
  - disconnect-modal
  - storage
  - token-lifecycle
  - ux-safety
dependency_graph:
  requires:
    - 28-01
  provides:
    - disconnect-confirm-modal
    - getDocumentCountByBackend
  affects:
    - app/(dashboard)/settings
tech_stack:
  added: []
  patterns:
    - "Confirmation modal with async document count fetch before destructive action"
    - "useTransition for disconnect action with loading state propagated to modal"
key_files:
  created:
    - app/(dashboard)/settings/components/disconnect-confirm-modal.tsx
  modified:
    - app/actions/settings.ts
    - app/(dashboard)/settings/components/storage-card.tsx
    - app/(dashboard)/settings/components/dropbox-connect-card.tsx
decisions:
  - "[D-28-02-01] disconnectOneDrive now returns Promise<{ error?: string }> with admin role guard — consistent with disconnectGoogleDrive and disconnectDropbox; consumers check result.error uniformly"
  - "[D-28-02-02] Document count fetched asynchronously after modal opens (not before) — avoids blocking button click; modal shows 'Loading...' briefly then count"
  - "[D-28-02-03] Confirm button disabled while documentCount === null — prevents triggering disconnect before count is known"
  - "[D-28-02-04] DisconnectConfirmModal rendered per-provider inside each card — no shared singleton; simpler state isolation"
metrics:
  duration_minutes: 5
  completed_date: "2026-02-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
requirements_satisfied:
  - TOKEN-03
---

# Phase 28 Plan 02: Disconnect Confirmation Modal Summary

**One-liner:** Confirmation modal with live document count for all three storage provider disconnect actions, replacing immediate-fire behaviour.

## What Was Built

A shared `DisconnectConfirmModal` component and `getDocumentCountByBackend` server action enable safe disconnect flows for Google Drive, Microsoft OneDrive, and Dropbox. Clicking Disconnect on any connected provider now opens a modal that fetches the live document count for that backend, warns the accountant that documents remain in the provider after disconnect, and requires explicit confirmation before clearing tokens.

## Files Created / Modified

| File | Change |
|------|--------|
| `app/(dashboard)/settings/components/disconnect-confirm-modal.tsx` | **Created** — shared Dialog component used by all three provider cards |
| `app/actions/settings.ts` | **Modified** — added `getDocumentCountByBackend`; updated `disconnectOneDrive` return type and added admin role guard |
| `app/(dashboard)/settings/components/storage-card.tsx` | **Modified** — Google Drive and OneDrive disconnect now open modal; modal state managed per-provider |
| `app/(dashboard)/settings/components/dropbox-connect-card.tsx` | **Modified** — Dropbox disconnect now opens modal; removed Loader2 from direct button (moved into modal) |

## DisconnectConfirmModal Props Interface

```typescript
interface DisconnectConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;          // e.g. "Google Drive", "Microsoft OneDrive", "Dropbox"
  documentCount: number | null;  // null = still loading
  isLoading: boolean;            // true while disconnect action is running
  onConfirm: () => void;
}
```

## getDocumentCountByBackend Signature

```typescript
export async function getDocumentCountByBackend(
  backend: 'google_drive' | 'onedrive' | 'dropbox'
): Promise<number>
```

- Requires `orgRole === 'admin'` — returns `0` for non-admins (safe fallback)
- Queries `client_documents.storage_backend` (per-document column, not org-level column)

## disconnectOneDrive Return Type Change

**Before:** `async function disconnectOneDrive(): Promise<void>` — threw on error

**After:** `async function disconnectOneDrive(): Promise<{ error?: string }>` — returns `{ error }` on failure; all three disconnect actions now have identical return type and admin role guard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added admin role guard to disconnectOneDrive**
- **Found during:** Task 1
- **Issue:** `disconnectOneDrive` lacked the admin role guard present in `disconnectGoogleDrive` and `disconnectDropbox` — any org member could call it
- **Fix:** Added `const { orgId, orgRole } = await getOrgContext(); if (orgRole !== 'admin') return { error: 'Admin only' };`
- **Files modified:** `app/actions/settings.ts`
- **Commit:** 6e3fee6

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | 6e3fee6 | feat(28-02): add getDocumentCountByBackend and update disconnectOneDrive return type |
| Task 2 | 1e56f05 | feat(28-02): add DisconnectConfirmModal and wire into all three provider cards |

## Self-Check: PASSED

- `app/(dashboard)/settings/components/disconnect-confirm-modal.tsx` — FOUND
- `app/actions/settings.ts` — FOUND
- `app/(dashboard)/settings/components/storage-card.tsx` — FOUND
- `app/(dashboard)/settings/components/dropbox-connect-card.tsx` — FOUND
- Commit 6e3fee6 — FOUND
- Commit 1e56f05 — FOUND
- `npx tsc --noEmit` — PASSED (no errors)
