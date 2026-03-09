# Wizard Import Persistence Fixes

## Problem

When a user imports clients via CSV during the setup wizard (`/setup/wizard`), the parsed data lives in React state (`savedImportRows` in `page.tsx`). If the user then proceeds to the storage setup step and is redirected to an OAuth provider (e.g. Google Drive), the full page redirect destroys React state and all imported client data is lost.

## Approaches

### 1. sessionStorage Persistence (Currently Implementing)

Serialize `savedImportRows` to `sessionStorage` whenever it changes. On wizard mount, check for and restore the data.

**Implementation:** Add a `useEffect` in `page.tsx` that writes `JSON.stringify(savedImportRows)` to `sessionStorage` on change. On mount, read it back and call `setSavedImportRows`.

**Pros:**
- Minimal code change — a single `useEffect` and a mount check
- No backend changes required
- Data is scoped to the tab, no cross-tab leakage
- Synchronous API, simple to reason about

**Cons:**
- ~5MB limit per origin — could be hit with very large imports (1000+ rows with many fields)
- Lost if user closes the tab or browser crashes
- Data is serialized as a string, so Date objects or other non-JSON types need handling

---

### 2. Save Clients to Supabase During the Import Step

Instead of holding clients in React state until the final wizard submission, insert them into the database when the user confirms the import. On return from OAuth, clients already exist in `clients` table.

**Implementation:** After CSV parsing and user confirmation in `csv-import-step.tsx`, call a server action to insert rows into the `clients` table tied to the organisation. Mark the wizard step as complete. On mount, check if clients already exist for the org.

**Pros:**
- Most robust — data survives any redirect, crash, or tab close
- Eliminates the deferred-write pattern entirely
- No temporary storage to clean up

**Cons:**
- Changes the wizard's commit model — partial data exists in the DB before wizard completion
- Need rollback logic if user abandons the wizard or goes back to re-import
- More complex error handling (what if insert partially fails?)
- Requires careful thought about what happens if the user re-imports (upsert vs replace)

---

### 3. IndexedDB Persistence

Same pattern as sessionStorage but uses IndexedDB, which supports much larger data volumes.

**Implementation:** Use a lightweight wrapper (e.g. `idb-keyval` or raw IndexedDB API) to store `savedImportRows` under a known key. Write on change, read on mount, delete on wizard completion.

**Pros:**
- No practical size limit (hundreds of MB available)
- Handles massive CSV imports without issue
- Data persists across tab closes (unlike sessionStorage)

**Cons:**
- Async API adds complexity (must await reads before rendering)
- Requires a library or boilerplate for the IndexedDB API
- Persists even after tab close — need explicit cleanup on wizard completion
- Overkill if imports are typically small (under a few hundred rows)

---

### 4. Server-Side Temporary Storage

Save the import data to a temporary location in Supabase — either a dedicated `pending_imports` table or a `pending_import_data jsonb` column on the `organisations` table.

**Implementation:** After CSV confirmation, POST the parsed rows to a server action that writes them as JSON to the org record. On wizard mount, check for pending data. Clear it on wizard completion.

**Pros:**
- Survives browser crashes, tab closes, device switches
- Works across multiple sessions (user could come back days later)
- Centralised — no client-side storage quirks

**Cons:**
- Requires a migration to add the column or table
- Adds a network round-trip on save and restore
- JSONB column on `organisations` could get large — need to enforce limits
- Must clean up pending data on wizard completion or abandonment

---

### 5. Open OAuth in a Popup Window

Open the OAuth provider's authorization URL in a popup window (`window.open`) instead of redirecting the main page. The wizard stays mounted and React state is preserved.

**Implementation:** In the storage step, call `window.open(oauthUrl, '_blank', 'popup,width=600,height=700')`. Use `postMessage` or poll `popup.closed` to detect completion. On success, advance the wizard step.

**Pros:**
- Zero persistence logic needed — React state is never destroyed
- Better UX — user sees the wizard behind the popup
- No serialization, no storage limits, no cleanup

**Cons:**
- Popup blockers may prevent the window from opening — need a fallback
- Cross-origin `postMessage` requires careful security handling
- Mobile browsers handle popups poorly (often open as new tabs)
- OAuth callback URL must handle the popup context (close itself and notify parent)
- More complex than a simple redirect flow

---

### 6. Move Storage Step Before Import Step

Reorder the wizard steps so OAuth-based storage setup happens before the CSV import step. By the time the user reaches import, no more full-page redirects will occur.

**Implementation:** Change the step order in `page.tsx` wizard step array. Adjust any step-dependent logic or validation that assumes the current order.

**Pros:**
- Eliminates the problem entirely — no persistence needed
- No new code, just reordering
- Simplest long-term solution if the step order makes logical sense

**Cons:**
- May not make sense from a UX perspective (storage setup before importing data feels backwards)
- Could confuse users who expect to set up data before configuring where it's stored
- If other steps also cause redirects in the future, the problem resurfaces
- Step dependencies may prevent simple reordering (e.g. import step might need storage config)

---

## Recommendation

**Ship sessionStorage (approach 1) now** — it covers the common case with minimal risk. If large imports become a real concern, upgrade to IndexedDB (approach 3). Long-term, saving clients to Supabase during import (approach 2) is the cleanest architecture but requires more careful design around rollback and re-import semantics.
