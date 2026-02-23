---
phase: 19-collection-mechanisms
plan: 03
subsystem: document-ui
tags: [documents, dashboard, realtime, notifications, signed-urls]
dependency_graph:
  requires: [19-01]
  provides: [document-card-ui, document-download-api, live-alert-feed, realtime-toast-notifications]
  affects: [client-detail-page, dashboard, layout]
tech_stack:
  added: []
  patterns:
    - Supabase Realtime postgres_changes INSERT subscription via client hook
    - Server layout importing client component (Next.js App Router pattern)
    - Inline confidence badge using div+span design system pattern (not Badge component)
    - Signed download URL with access log before URL returned to client
    - PostgREST FK join cast via `as unknown as T[]` to satisfy TypeScript
key_files:
  created:
    - app/api/clients/[id]/documents/route.ts
    - app/(dashboard)/clients/[id]/components/document-card.tsx
    - lib/documents/use-document-notifications.ts
    - app/(dashboard)/components/document-notification-mount.tsx
  modified:
    - app/(dashboard)/clients/[id]/page.tsx
    - app/(dashboard)/dashboard/components/alert-feed.tsx
    - app/(dashboard)/layout.tsx
decisions:
  - "[D-19-03-01] document_access_log INSERT uses org_id (fetched from client_documents row) + user_id — plan had accessed_at but actual schema column is created_at (auto-defaulted); plan adjusted accordingly"
  - "[D-19-03-02] PostgREST FK join typed as unknown as DocumentActivity[] — Supabase SDK infers joined columns as arrays; explicit double-cast required to satisfy TypeScript without losing type safety"
  - "[D-19-03-03] DocumentCard fetches all client documents per page mount and filters client-side by filing_type_id — simpler than one API call per card; acceptable for client detail page (max 4 cards)"
metrics:
  duration_seconds: 284
  completed_date: "2026-02-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 3
---

# Phase 19 Plan 03: Document UI, Activity Feed, and Realtime Notifications Summary

Document card component with download (signed URL + access log), live dashboard activity feed replacing hardcoded sample data, and Supabase Realtime toast notifications on new document inserts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Document API + DocumentCard on client detail page | 5846811 | app/api/clients/[id]/documents/route.ts, app/(dashboard)/clients/[id]/components/document-card.tsx, app/(dashboard)/clients/[id]/page.tsx |
| 2 | Live activity feed + Realtime notification hook | 18fc60c | app/(dashboard)/dashboard/components/alert-feed.tsx, lib/documents/use-document-notifications.ts, app/(dashboard)/components/document-notification-mount.tsx, app/(dashboard)/layout.tsx |

## What Was Built

### Task 1: Document API + DocumentCard

**GET /api/clients/{id}/documents** — Lists all `client_documents` for a client (org-scoped via RLS), returning filename, type label, confidence, received date, source, and created date. Document `storage_path` is never included in the response.

**POST /api/clients/{id}/documents** (body: `{ action: 'download', documentId }`) — Verifies client_id ownership (service client), generates a 300-second signed URL via `getSignedDownloadUrl`, inserts a row into `document_access_log` (with `org_id`, `user_id`, `action: 'download'`), and returns `{ signedUrl }`.

**DocumentCard component** (`app/(dashboard)/clients/[id]/components/document-card.tsx`) — 'use client' component accepting `{ clientId, filingTypeId, filingTypeName }`. Collapsed state shows filing type name, document count badge, and most recent date. Expanded state shows a table with: filename, document type label, confidence badge (traffic-light inline div+span), received date, source ("Portal"/"Email"/"Manual"), and a download button.

**Client detail page** — `FILING_TYPE_LABELS` constant added; Documents section added below FilingManagement with one DocumentCard per filing type (CT600, Self Assessment, VAT Return, Companies House).

### Task 2: Live Activity Feed + Realtime Notifications

**alert-feed.tsx** — Replaced hardcoded sample data with a live Supabase query on `client_documents` (last 10 by `created_at desc`). Each row shows an icon (Upload=portal, Mail=email, Bell=manual), client name, document type label or filename, and relative time. Each row is a `<Link>` to `/clients/{client_id}`. Empty state shows "No document activity yet." Card header retitled "Recent Documents".

**useDocumentNotifications** (`lib/documents/use-document-notifications.ts`) — Client-side hook subscribing to Supabase Realtime `postgres_changes` INSERT on `client_documents` filtered by `org_id`. On INSERT, fetches client name and document type label, then fires a Sonner `toast.success` with description "Via upload portal" or "Via email".

**DocumentNotificationMount** (`app/(dashboard)/components/document-notification-mount.tsx`) — Thin 'use client' component that resolves `orgId` from JWT `app_metadata` on mount, then calls `useDocumentNotifications(orgId)`. Renders nothing.

**layout.tsx** — Imports and renders `<DocumentNotificationMount />` at the top of the layout div, before the header. Next.js App Router handles server layout importing client component correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] document_access_log INSERT column mismatch**
- **Found during:** Task 1
- **Issue:** Plan specified `accessed_at` as the timestamp column in the INSERT, but Phase 18 migration (`20260224000001_document_collection_tables.sql`) defines the column as `created_at` with `DEFAULT now()` — no `accessed_at` column exists.
- **Fix:** Removed `accessed_at` from the INSERT; `created_at` is auto-defaulted by the database. Added `org_id` (required, NOT NULL) fetched from the document row.
- **Files modified:** app/api/clients/[id]/documents/route.ts
- **Commit:** 5846811

**2. [Rule 1 - Bug] PostgREST FK join TypeScript type mismatch**
- **Found during:** Task 2
- **Issue:** TypeScript error TS2352 — Supabase SDK infers FK joined columns as arrays (`{ label: any }[]`) not single objects (`{ label: string } | null`). The plan's `as DocumentActivity[]` cast was insufficient.
- **Fix:** Changed cast to `as unknown as DocumentActivity[]` (double-cast via unknown) — standard pattern for Supabase FK join type mismatches.
- **Files modified:** app/(dashboard)/dashboard/components/alert-feed.tsx
- **Commit:** 18fc60c

## Self-Check: PASSED

All files created: app/api/clients/[id]/documents/route.ts, app/(dashboard)/clients/[id]/components/document-card.tsx, lib/documents/use-document-notifications.ts, app/(dashboard)/components/document-notification-mount.tsx

All commits exist: 5846811, 18fc60c

Key links verified:
- document_access_log INSERT in route.ts
- postgres_changes subscription in use-document-notifications.ts
- client_documents query in alert-feed.tsx
- DocumentNotificationMount mounted in layout.tsx
- DocumentCard rendered in client [id]/page.tsx
