---
status: diagnosed
trigger: "QuickBooks connection status banner not visible on dashboard or clients page"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:00:00Z
---

## Current Focus

hypothesis: Banner component intentionally hides itself when connected=true AND has no "connected" state display - it only shows a disconnected warning. The test expects to see status info (connection status, last sync time, reconnect option) but the component only renders when disconnected and shows minimal info.
test: Read component code and compare against test expectations
expecting: Component logic confirms it returns null when connected
next_action: Document root cause - two-part issue (design gap + conditional rendering)

## Symptoms

expected: Dashboard or clients page shows QuickBooks status banner with connection status, last sync time, reconnect option
actual: No QuickBooks status banner visible
errors: none
reproduction: Navigate to dashboard or clients page
started: By design - component was built this way

## Eliminated

- hypothesis: Component not imported or rendered in layout
  evidence: layout.tsx line 36 renders <QboStatusBanner connected={connectionStatus.connected} />
  timestamp: 2026-02-07

- hypothesis: Component file missing from codebase
  evidence: File exists at components/qbo-status-banner.tsx
  timestamp: 2026-02-07

- hypothesis: getConnectionStatus() crashes and prevents render
  evidence: Function has try/catch and returns {connected: false} on error, so layout would still render
  timestamp: 2026-02-07

## Evidence

- timestamp: 2026-02-07
  checked: components/qbo-status-banner.tsx
  found: Component returns null when connected=true (line 13-15). Only renders a warning banner when disconnected. No "connected" state display exists at all.
  implication: If QBO tokens exist in database, banner is invisible by design.

- timestamp: 2026-02-07
  checked: app/(dashboard)/layout.tsx
  found: Component IS rendered at line 36 with connected={connectionStatus.connected}. Import is correct.
  implication: Integration is correct. The issue is in the component's rendering logic and feature completeness.

- timestamp: 2026-02-07
  checked: app/actions/quickbooks.ts - getConnectionStatus()
  found: Returns {connected: true, realmId} when tokens exist in DB, {connected: false} otherwise. ConnectionStatus interface has connected and realmId but no lastSyncTime.
  implication: Even if banner showed connected state, there is no last sync time data available.

- timestamp: 2026-02-07
  checked: QboStatusBanner component content
  found: When disconnected, shows "QuickBooks disconnected" text + "Reconnect" badge linking to /onboarding. No last sync time. No connection status display for connected state.
  implication: Component is a minimal disconnected-warning, not a full status banner as the test expects.

- timestamp: 2026-02-07
  checked: .planning/phases/01-foundation-integration/01-03-PLAN.md lines 110-121
  found: Plan spec explicitly says "When connected === true: Render nothing (no banner)". The implementation matches the plan exactly.
  implication: This is a gap between the plan specification and the UAT test expectations, NOT an implementation bug. The plan designed a warning-only banner; the UAT expects a full status banner.

- timestamp: 2026-02-07
  checked: .planning/v1.0-UAT.md line 137
  found: UAT expects "status banner indicating connection status (connected/disconnected), last sync time, and option to reconnect if needed"
  implication: UAT expects the banner to always be visible showing current status. The plan and implementation only show it when disconnected.

- timestamp: 2026-02-07
  checked: Codebase-wide search for lastSync/syncTime
  found: No last sync time is tracked anywhere in the codebase. No database column, no server action, no UI for it.
  implication: Adding last sync time display requires new data infrastructure, not just a UI change.

## Resolution

root_cause: TWO issues combine to make the banner invisible - (1) The QboStatusBanner component returns null when connected=true, so if QuickBooks tokens exist in the database the banner is completely hidden. There is no "connected" state UI. (2) The component lacks features the test expects: no "last sync time" display, no connection status indicator for the connected state. The component was designed as a disconnected-warning-only banner, not a full status banner. Even if the user IS disconnected and the warning shows, it only displays "QuickBooks disconnected" and a Reconnect link - still missing last sync time.
fix:
verification:
files_changed: []
