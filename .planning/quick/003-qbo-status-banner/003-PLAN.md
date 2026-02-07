---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - components/qbo-status-banner.tsx
  - app/actions/quickbooks.ts
  - app/(dashboard)/layout.tsx
  - supabase/migrations/20260207200000_add_last_synced_at_to_oauth_tokens.sql
  - lib/quickbooks/sync.ts
autonomous: true
gap_closure: true

must_haves:
  truths:
    - "QuickBooks status banner is always visible in the dashboard layout (both connected and disconnected states)"
    - "When connected, banner shows green status indicator with last sync time"
    - "When disconnected, banner shows warning with reconnect link"
  artifacts:
    - path: "components/qbo-status-banner.tsx"
      provides: "Status banner for both connected and disconnected states"
      contains: "connected"
    - path: "app/actions/quickbooks.ts"
      provides: "ConnectionStatus with lastSyncTime field"
      contains: "lastSyncTime"
    - path: "supabase/migrations/20260207200000_add_last_synced_at_to_oauth_tokens.sql"
      provides: "last_synced_at column on oauth_tokens"
      contains: "last_synced_at"
  key_links:
    - from: "app/(dashboard)/layout.tsx"
      to: "components/qbo-status-banner.tsx"
      via: "props including lastSyncTime"
      pattern: "lastSyncTime"
    - from: "lib/quickbooks/sync.ts"
      to: "supabase oauth_tokens.last_synced_at"
      via: "update after sync"
      pattern: "last_synced_at"
---

<objective>
Redesign the QBO status banner to show both connected and disconnected states, and add last sync time tracking.

Purpose: UAT Test 25 failed because the banner was designed as disconnected-warning-only
(returns null when connected). The UAT expects a persistent status banner showing connection
status, last sync time, and reconnect option.

Output: Always-visible status banner in dashboard layout with green/connected and warning/disconnected states.
</objective>

<execution_context>
@C:\Users\ejsch\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\ejsch\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/debug/qbo-banner-not-visible.md
@components/qbo-status-banner.tsx
@app/actions/quickbooks.ts
@app/(dashboard)/layout.tsx
@lib/quickbooks/sync.ts
@lib/quickbooks/token-manager.ts
@DESIGN_SYSTEM.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add last_synced_at column and update sync + connection status</name>
  <files>
    supabase/migrations/20260207200000_add_last_synced_at_to_oauth_tokens.sql
    app/actions/quickbooks.ts
    lib/quickbooks/sync.ts
  </files>
  <action>
    THREE files to create/modify:

    1. CREATE migration file `supabase/migrations/20260207200000_add_last_synced_at_to_oauth_tokens.sql`:
       ```sql
       -- Add last_synced_at to track when clients were last synced from QuickBooks
       ALTER TABLE oauth_tokens
         ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
       ```

    2. MODIFY `app/actions/quickbooks.ts`:
       - Update the `ConnectionStatus` interface to add `lastSyncTime`:
         ```typescript
         export interface ConnectionStatus {
           connected: boolean;
           realmId?: string;
           lastSyncTime?: string;
         }
         ```
       - Update `getConnectionStatus()` to return lastSyncTime. In the query, the
         `getStoredTokens()` call returns raw data. Instead of using TokenManager,
         query oauth_tokens directly to get `last_synced_at`:
         ```typescript
         export async function getConnectionStatus(): Promise<ConnectionStatus> {
           const { createAdminClient } = await import("@/lib/supabase/admin");
           const supabase = createAdminClient();

           try {
             const { data, error } = await supabase
               .from("oauth_tokens")
               .select("realm_id, last_synced_at")
               .eq("provider", "quickbooks")
               .single();

             if (error || !data) {
               return { connected: false };
             }

             return {
               connected: true,
               realmId: data.realm_id,
               lastSyncTime: data.last_synced_at ?? undefined,
             };
           } catch {
             return { connected: false };
           }
         }
         ```
         NOTE: Use dynamic import for createAdminClient to avoid circular dependency
         issues if any. If the existing static import `import { TokenManager } ...`
         already works, keep using static imports but query supabase directly from
         this function instead of going through TokenManager (since TokenManager
         doesn't return last_synced_at).

    3. MODIFY `lib/quickbooks/sync.ts`:
       - After the successful upsert of clients (the `if (error)` check around line 83-93),
         add an update to record the sync timestamp on oauth_tokens:
         ```typescript
         // Update last_synced_at timestamp
         await supabase
           .from("oauth_tokens")
           .update({ last_synced_at: new Date().toISOString() })
           .eq("provider", "quickbooks");
         ```
         Place this BEFORE the `return { success: true, count: ... }` line.
         If the update fails, log it but don't fail the sync (sync itself succeeded).
  </action>
  <verify>
    Run `npm run build` to verify no TypeScript errors.
    Check that the migration file exists and has valid SQL.
  </verify>
  <done>
    - ConnectionStatus interface includes lastSyncTime
    - getConnectionStatus() returns last_synced_at from database
    - syncClients() updates last_synced_at after successful sync
    - Migration file exists to add the column
  </done>
</task>

<task type="auto">
  <name>Task 2: Redesign QBO status banner for both states and update layout props</name>
  <files>
    components/qbo-status-banner.tsx
    app/(dashboard)/layout.tsx
  </files>
  <action>
    TWO files to modify:

    1. REWRITE `components/qbo-status-banner.tsx` to show both states:

       Props interface:
       ```typescript
       interface QboStatusBannerProps {
         connected: boolean;
         lastSyncTime?: string;
       }
       ```

       Component logic:
       - REMOVE the early return null when connected
       - Render TWO different banner states:

       **When connected:**
       - Subtle, non-intrusive banner (not a warning)
       - Use `bg-status-success/5 border-b border-status-success/20` for the container
       - Show a CheckCircle icon (from lucide-react) in `text-status-success`
       - Text: "QuickBooks connected" in `text-sm font-medium text-status-success`
       - If lastSyncTime is provided, show "Last synced: {relative time}" in `text-sm text-muted-foreground`
         Format the time using `formatDistanceToNow` from date-fns with `{ addSuffix: true }`.
         Example: "Last synced: 5 minutes ago"
       - If no lastSyncTime, show "Last synced: never" in muted text

       **When disconnected (keep existing styling but improve):**
       - Keep current `bg-status-warning/10 border-b border-status-warning/20` styling
       - Keep AlertTriangle icon in `text-status-warning`
       - Keep "QuickBooks disconnected" text
       - Keep Reconnect badge/link to /onboarding

       Imports needed: `CheckCircle, AlertTriangle` from lucide-react, `formatDistanceToNow` from date-fns,
       `Badge` from @/components/ui/badge, `Link` from next/link.

       The component is a server component ("use client" is NOT on the current file and should NOT be added).
       Since `formatDistanceToNow` is a pure function, it works fine in server components.

    2. MODIFY `app/(dashboard)/layout.tsx`:
       - Update the QboStatusBanner render to pass `lastSyncTime`:
         Change:
         ```
         <QboStatusBanner connected={connectionStatus.connected} />
         ```
         To:
         ```
         <QboStatusBanner connected={connectionStatus.connected} lastSyncTime={connectionStatus.lastSyncTime} />
         ```
  </action>
  <verify>
    Run `npm run build` to verify no TypeScript errors.
    Grep the built output for "QuickBooks connected" to confirm the connected state text exists.
  </verify>
  <done>
    - Banner renders in BOTH connected and disconnected states (never returns null)
    - Connected state shows green check, "QuickBooks connected", and last sync time
    - Disconnected state shows warning icon, "QuickBooks disconnected", and Reconnect link
    - Layout passes lastSyncTime prop to banner
    - Build passes with no errors
  </done>
</task>

</tasks>

<verification>
1. `npm run build` completes without errors
2. `components/qbo-status-banner.tsx` never returns null - both states render visible UI
3. `app/actions/quickbooks.ts` ConnectionStatus includes lastSyncTime
4. `lib/quickbooks/sync.ts` updates last_synced_at after sync
5. Migration file exists at `supabase/migrations/20260207200000_add_last_synced_at_to_oauth_tokens.sql`
6. `app/(dashboard)/layout.tsx` passes lastSyncTime prop to QboStatusBanner
</verification>

<success_criteria>
UAT Test 25 passes: QuickBooks status banner is always visible, showing connection status
and last sync time when connected, or disconnection warning with reconnect link when disconnected.
</success_criteria>

<output>
After completion, create `.planning/quick/003-qbo-status-banner/003-SUMMARY.md`
</output>
