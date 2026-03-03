# 🔍 QA Audit Log
**Date:** 2026-03-03  
**Auditor:** Antigravity Browser Agent  
**App:** Peninsula Accounting — `http://localhost:3000`  
**Scope:** Auth, Clients, Email Logs, Settings, Client Portal, API Routes

---

## 🔴 ISSUES FOUND

### [ERROR-1] React Hydration Mismatch
- **Page:** `http://localhost:3000/`
- **Action:** SSR/Hydration Check on initial page load
- **Issue:** React hydration mismatch detected in the console — `data-jetski-tab-id` attribute mismatch between server-rendered HTML and client-side props. This can cause subtle UI glitches or flickers on initial load.
- **Severity:** Medium — Affects SSR stability and can cause unpredictable UI behaviour.

---

### [ERROR-2] Setup Wizard Not Enforced on Dashboard Access
- **Page:** `http://localhost:3000/dashboard`
- **Action:** Navigated directly to `/dashboard` while wizard was partially complete (Step 3: Import Clients)
- **Issue:** The application did NOT redirect to the setup wizard. The dashboard was fully accessible, effectively allowing users to bypass required onboarding steps.
- **Severity:** Medium — Users may miss critical setup (e.g. connecting email, importing clients).

---

### [ERROR-3] `/clients/import` is a Dead Route
- **Page:** `http://localhost:3000/clients/import`
- **Action:** Navigated directly to this URL
- **Issue:** Redirected back to `/clients` list. The import UI is implemented as a modal within the clients page, not as a standalone route. Any direct links or bookmarks to `/clients/import` will silently fail.
- **Severity:** Low — Functional via modal, but the route is broken.

---

### [ERROR-4] Document Section: Slow Loading / No Skeleton State
- **Page:** `http://localhost:3000/clients/[id]` (e.g. `/clients/acme-ltd`)
- **Action:** Loaded a client detail page and observed the documents section
- **Issue:** The documents section shows a plain "Loading documents..." text state with significant latency (several seconds) before rendering the list or empty state. No skeleton/shimmer loader is shown, making it feel broken.
- **Severity:** Low/UX — Not a crash, but a poor perceived performance experience.

---

### [ERROR-5] Settings Tab Names Don't Match Documentation
- **Page:** `http://localhost:3000/settings`
- **Action:** Observed settings tab labels
- **Issue:** Actual tabs are (General, Email, Billing) — the task spec listed (Domain Setup, Email Settings, Client Portal, Members). This is likely a documentation drift issue, but worth noting in case any tab content was intended to exist and was dropped.
- **Severity:** Info — Verify intended tabs are all present.

---

## ✅ PAGES VERIFIED

| Status | Page |
|--------|------|
| [OK] | `http://localhost:3000/` — Landing page renders correctly |
| [OK] | `http://localhost:3000/login` — Auth flow works with provided credentials |
| [OK] | `http://localhost:3000/setup/wizard` — All steps render; back/forward navigation works |
| [OK] | `http://localhost:3000/clients` — Client list loads; Overdue filter and Clear filters work |
| [OK] | `http://localhost:3000/clients/acme-ltd` — Client detail loads with all sections |
| [OK] | `http://localhost:3000/email-logs` — Activity page loads; All Activity / Uploads / Sent Emails switchers work |
| [OK] | `http://localhost:3000/settings` — Tabs switch correctly; Portal, Team, Email, Billing content renders |
| [OK] | `http://localhost:3000/portal/TEST-INVALID-TOKEN` — Invalid token handled gracefully with "Link expired" message |
| [OK] | `http://localhost:3000/portal/[valid-token]` — Valid portal link renders checklist correctly |
| [OK] | `http://localhost:3000/api/auth/dropbox/connect` — Route correctly initiates Dropbox OAuth flow |
| [OK] | `http://localhost:3000/api/auth/dropbox/callback` — Route handles missing params gracefully, redirects to dashboard |

---

## ⚠️ CONSOLE WARNINGS

| Type | Detail | Impact |
|------|--------|--------|
| **Hydration Mismatch** | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties` | Medium — SSR instability |
| **Framer Motion** | `Animating backgroundColor from "rgba(0,0,0,0)" to "transparent"` — "transparent" is not an animatable value | Low — Visual glitch potential |
| **Supabase Security** | `Using the user object from supabase.auth.getSession() could be insecure. Use supabase.auth.getUser() instead.` | **High** — Security best practice violation; session data could be spoofed |

---

## 🛠 Recommended Fixes (Priority Order)

1. **[HIGH] Supabase Security** — Replace all `supabase.auth.getSession()` calls that use the returned `user` object with `supabase.auth.getUser()` to prevent token spoofing.
2. **[MEDIUM] Wizard Guard** — Add middleware or a redirect check in the dashboard route to enforce wizard completion before allowing access.
3. **[MEDIUM] Hydration Mismatch** — Investigate the `data-jetski-tab-id` attribute. It is likely being set by a browser extension or a client-side-only library. Wrap in a `useEffect` with a mounted check, or suppress with `suppressHydrationWarning` if intentional.
4. **[LOW] Skeleton Loader** — Add a skeleton/shimmer loader to the documents section on the client detail page to improve perceived performance.
5. **[LOW] `/clients/import` Route** — Either create a proper page route for `/clients/import` or remove all references to it as a direct URL.
6. **[INFO] Framer Motion** — Replace `"transparent"` with `"rgba(0,0,0,0)"` in any `animate` / `initial` props to prevent animation warnings.
