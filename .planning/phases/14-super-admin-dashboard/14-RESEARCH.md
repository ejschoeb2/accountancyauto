# Phase 14: Super-Admin Dashboard - Research

**Researched:** 2026-02-21
**Domain:** Next.js route protection, Supabase admin client, read-only internal dashboard
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Org list presentation**
- Data table layout (not cards or grid) — consistent with existing client list patterns
- All columns treated with equal weight — name, slug, plan tier, subscription status, trial expiry, client count, user count
- Sort only — no filtering or search controls. Column headers are clickable to sort
- All orgs loaded at once — no pagination. Org count will be manageable (tens, not thousands)

**Org detail view**
- Full page at `/admin/[slug]` — not a modal or slide-over. Back button returns to list
- Single scroll page — settings at top, members below, Stripe info at bottom. No tabs
- Member list shows: name, email, role (no last sign-in or other metadata)
- Stripe subscription ID displayed as copyable text with copy button — not a clickable link

**Health & status signals**
- Color-coded badges for subscription status — use the existing traffic light system from DESIGN.md for consistency
- Trial expiry shown as relative days remaining ("12 days left", "Expired 3 days ago") — not absolute dates
- Badge alone signals problems — no row highlighting or summary stats needed

**Navigation & access**
- "Admin" link visible in sidebar/nav only when user has `is_super_admin = true` in app_metadata
- Reuse existing dashboard layout — same sidebar and top bar, admin content renders inside
- Non-super-admin users silently redirected to their org dashboard (no 403 page)
- From /admin, normal nav/logo navigation returns to org dashboard — no special "back to org" link needed

### Claude's Discretion
- Exact badge color mapping within the existing traffic light system
- Loading states and skeleton design
- Error handling for failed data fetches
- Exact spacing and typography within DESIGN.md patterns

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMN-01 | Super-admin flag stored in Supabase Auth `app_metadata.is_super_admin`; writable only via service role (not by any user action) | Flag already in app_metadata alongside org_id/org_role set by JWT hook; admin client (service role) is the only write path; no user-accessible API can touch app_metadata |
| ADMN-02 | `/admin` route requires `is_super_admin = true`; non-super-admin users are redirected to their dashboard | Middleware already reads `user.app_metadata` for org checks; same pattern for is_super_admin check in page-level guard; redirect to `/dashboard` (org-scoped) |
| ADMN-03 | Super-admin org list shows: org name, slug, plan_tier, subscription_status, trial_ends_at, client count, user count — sortable by plan and status | organisations table has all columns; client counts require aggregate query across clients table (org_id FK); user counts from user_organisations; admin client bypasses RLS for cross-org queries |
| ADMN-04 | Clicking an org shows its detail: full org settings, member list, Stripe subscription ID for manual lookup | `/admin/[slug]` detail page; admin client fetches member emails from Supabase Auth admin API; Stripe subscription ID is a column on organisations table |
</phase_requirements>

---

## Summary

Phase 14 builds a read-only internal operator dashboard at `/admin` and `/admin/[slug]`. The work is primarily front-end data display with two interesting backend concerns: (1) enforcing `is_super_admin` at the route level — which the existing middleware pattern handles cleanly, and (2) querying cross-org data (all organisations, their client counts, user counts, and member emails) — which requires the service-role admin client since RLS scopes authenticated queries to a single org.

The existing codebase already has all the infrastructure needed: `createAdminClient()` in `lib/supabase/admin.ts`, the `organisations` and `user_organisations` tables with the right columns, the `app_metadata` JWT pattern, and the DESIGN.md badge/table patterns. No new dependencies are needed. The Supabase Auth admin API (`admin.auth.admin.listUsers()` or `admin.auth.admin.getUserById()`) handles resolving member emails from user IDs, following the same pattern used in Phase 11 for payment-failed emails (decision D-11-02-03).

The main implementation risk is the RLS constraint: any Supabase client authenticated as a regular user can only SELECT organisations WHERE id = auth_org_id(). All admin dashboard queries must use `createAdminClient()` (service role), called only from server components or server actions — never exposed to the browser.

**Primary recommendation:** Build as two server-side React Server Components using `createAdminClient()` for all data fetches; gate both at page level by checking `session.user.app_metadata?.is_super_admin`; add a middleware bypass for `/admin` routes so the org-membership check does not block the super-admin.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | Already installed | RSC pages, routing, server actions | Project standard |
| Supabase JS (`@supabase/supabase-js`) | Already installed | Admin client for cross-org queries | Project standard |
| TanStack Table (`@tanstack/react-table`) | Already installed (used in client-table.tsx) | Client-side sortable table | Already used for the clients table; locked decision is sort-only no filter |
| Lucide React | Already installed | Icons | Project standard |
| shadcn/ui (Table, Card, Button) | Already installed | UI components | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | Already installed | Relative time formatting ("12 days left") | For trial_ends_at relative display |

**Installation:** No new packages required. All dependencies are already present.

---

## Architecture Patterns

### Recommended Project Structure

```
app/
└── (dashboard)/
    └── admin/
        ├── page.tsx               # Org list — RSC, super-admin guard
        ├── loading.tsx            # Skeleton matching existing pattern
        └── [slug]/
            ├── page.tsx           # Org detail — RSC, super-admin guard
            └── loading.tsx

components/
└── nav-links.tsx                  # MODIFIED: conditionally adds Admin link
```

No new `lib/` files are needed — all queries are straightforward enough to live in the page components or small co-located action files.

### Pattern 1: Super-Admin Route Guard (Page Level)

**What:** Each admin page checks `is_super_admin` from session app_metadata and redirects silently to `/dashboard` if false or missing.

**When to use:** Every page inside `app/(dashboard)/admin/`.

```typescript
// app/(dashboard)/admin/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user.app_metadata?.is_super_admin) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  // ... fetch all orgs with admin client
}
```

**Why page-level and not middleware-only:** The middleware currently applies org-membership validation (Step 8 of `updateSession`). A super-admin user has `app_metadata.org_id` pointing to their own org, not "all orgs". The middleware would pass them through normally after membership validation; the page guard is the clean enforcement point. Middleware can be adjusted to skip the org check for `/admin` routes.

### Pattern 2: Middleware Bypass for /admin

**What:** The middleware's org-membership check (Steps 6-8) must be skipped for `/admin` routes so the super-admin (who belongs to exactly one org) is not redirected away when accessing the global admin interface.

**How:** In `lib/supabase/middleware.ts`, add `/admin` to the check before Step 6 (or add it alongside `PUBLIC_ROUTES`). Since `/admin` still requires authentication, it is not a true public route — a better approach is a dedicated `isAdminRoute()` check that skips org resolution but still requires a valid session.

```typescript
function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

// After Step 2 (session refresh), after public route check:
if (isAdminRoute(pathname)) {
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl, 307);
  }
  // Allow through — page-level guard handles is_super_admin check
  return supabaseResponse;
}
```

This is a small, safe change to the existing middleware. It keeps the gate at the page level where it belongs.

### Pattern 3: Cross-Org Data Queries via Admin Client

**What:** Use `createAdminClient()` (service role) for all admin dashboard queries. RLS on `organisations` restricts authenticated users to their own org; service role bypasses RLS entirely.

**When to use:** Exclusively in server components/actions. Never pass the admin client to client components.

```typescript
// Fetch all orgs
const admin = createAdminClient();
const { data: orgs } = await admin
  .from("organisations")
  .select("id, name, slug, plan_tier, subscription_status, trial_ends_at, stripe_subscription_id")
  .order("created_at", { ascending: true });

// Fetch client counts per org (aggregate)
const { data: clientCounts } = await admin
  .from("clients")
  .select("org_id, id", { count: "exact" })
  // Use a GROUP BY approach or fetch counts per org individually

// Fetch user counts per org
const { data: userCounts } = await admin
  .from("user_organisations")
  .select("org_id, id", { count: "exact" });
```

**Note on aggregate counts:** PostgREST does not support GROUP BY natively. The practical approach for a small tenant count (tens of orgs) is to fetch all org IDs, then run a count query per org, or fetch the full rows and count in JavaScript. Given the small org count, fetching all `clients` rows with just `id, org_id` and counting in JS is acceptable.

**Better approach:** Use a single query with PostgREST's embedded count feature:

```typescript
// Count clients per org using PostgREST count on filtered queries
// For each org, use .eq('org_id', orgId).select('id', { count: 'exact', head: true })
// Run in parallel with Promise.all for all orgs
const clientCountResults = await Promise.all(
  orgs.map((org) =>
    admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .then(({ count }) => ({ orgId: org.id, count: count ?? 0 }))
  )
);
```

This is the same pattern used in Phase 11 for user count (`D-11-04-02`).

### Pattern 4: Member Email Resolution

**What:** The `user_organisations` table stores `user_id` but not email or name. For the org detail page, member emails and names must come from Supabase Auth.

**How:** Use the Supabase Admin Auth API, following decision D-11-02-03 (which established this as the correct pattern for admin email resolution):

```typescript
const admin = createAdminClient();

// Get member user_ids for this org
const { data: members } = await admin
  .from("user_organisations")
  .select("user_id, role")
  .eq("org_id", org.id);

// Resolve user details from Auth
const memberDetails = await Promise.all(
  members.map(async (m) => {
    const { data: { user } } = await admin.auth.admin.getUserById(m.user_id);
    return {
      userId: m.user_id,
      email: user?.email ?? "unknown",
      name: user?.user_metadata?.full_name ?? user?.email ?? "unknown",
      role: m.role,
    };
  })
);
```

**Confidence:** HIGH — this exact pattern is used in `app/api/webhooks/stripe/route.ts` (D-11-02-03).

### Pattern 5: Conditional Admin Nav Link

**What:** The "Admin" nav link is visible only when `is_super_admin = true` in app_metadata. `NavLinks` is currently a client component using `usePathname()` — it doesn't have access to session data.

**Options:**
1. Pass `isSuperAdmin` as a prop from the server layout down to `NavLinks`
2. Fetch session in a separate server component that wraps or replaces the nav link for admin

**Recommended:** Option 1 — simplest change. The dashboard layout (`app/(dashboard)/layout.tsx`) already calls `supabase.auth.getUser()` and has the user object. Extract `is_super_admin` there and pass it as a prop to `NavLinks`.

```typescript
// In layout.tsx (server component)
const isSuperAdmin = user.app_metadata?.is_super_admin === true;

// NavLinks becomes:
<NavLinks isSuperAdmin={isSuperAdmin} />

// NavLinks client component adds:
const NAV_ITEMS_BASE = [...]; // existing items
const ADMIN_ITEM = { href: "/admin", icon: Shield, label: "Admin" };

export function NavLinks({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const items = isSuperAdmin ? [...NAV_ITEMS_BASE, ADMIN_ITEM] : NAV_ITEMS_BASE;
  // ... render
}
```

### Pattern 6: Subscription Status Badge Mapping

**What:** Map `subscription_status` enum values to the existing DESIGN.md `div+span` badge pattern.

**Confirmed mapping** (reusing the billing-status-card.tsx precedent from Phase 11, D-11-04-01):

| Status | Color | Bg class | Text class | Label |
|--------|-------|----------|------------|-------|
| `active` | Green | `bg-green-500/10` | `text-green-600` | Active |
| `trialing` | Blue | `bg-blue-500/10` | `text-blue-500` | Trial |
| `past_due` | Amber | `bg-amber-500/10` | `text-amber-600` | Payment overdue |
| `cancelled` | Red (destructive) | `bg-destructive/10` | `text-destructive` | Cancelled |
| `unpaid` | Red (destructive) | `bg-destructive/10` | `text-destructive` | Unpaid |
| `null` / unknown | Grey | `bg-status-neutral/10` | `text-status-neutral` | No subscription |

This matches the existing `billing-status-card.tsx` STATUS_CONFIG exactly — reuse or extract it.

### Pattern 7: Relative Trial Expiry Display

**What:** Show trial expiry as "12 days left" or "Expired 3 days ago".

```typescript
function formatTrialExpiry(trialEndsAt: string | null): string | null {
  if (!trialEndsAt) return null;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? "" : "s"} left`;
  const ago = Math.abs(diffDays);
  return `Expired ${ago} day${ago === 1 ? "" : "s"} ago`;
}
```

**Note:** Only display trial expiry column/text when `subscription_status === 'trialing'`. For other statuses, show `—`.

### Pattern 8: Sortable Table (Client-Side Only)

**What:** The locked decision is sort-only (no filter, no search). Since all orgs are loaded at once, client-side sorting with TanStack Table's `getSortedRowModel()` is correct — same library already used for the clients table.

**Sortable columns:** plan_tier, subscription_status (the two specified in ADMN-03).
**Non-sortable columns:** name, slug, trial_ends_at, client_count, user_count — clickable headers are only for sort-eligible columns.

**Implementation:** The org list table should be a "use client" component (like `ClientTable`) so sorting state is interactive. The page fetches data server-side and passes it as props.

### Anti-Patterns to Avoid

- **Using authenticated Supabase client for cross-org queries:** RLS will filter to `org_id = auth_org_id()`, returning only the super-admin's own org. Always use `createAdminClient()`.
- **Exposing admin client to browser:** Server-only. The `SUPABASE_SERVICE_ROLE_KEY` is a server secret.
- **Fetching member emails with user_metadata:** Use `admin.auth.admin.getUserById()` for authoritative email — user_metadata can be stale or absent.
- **Adding `/admin` to PUBLIC_ROUTES in middleware:** `/admin` requires authentication; adding to public routes would allow unauthenticated access. Use the dedicated admin route bypass that still enforces `!user → redirect to login`.
- **Setting `is_super_admin` via any app API route:** The flag must only be set via Supabase Dashboard or direct service-role SQL. No application endpoint should write to `app_metadata.is_super_admin`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table | Custom sort logic | TanStack Table `getSortedRowModel()` | Already used in client-table.tsx; handles multi-column sort state correctly |
| Relative date display | Custom date math | The simple inline function above (date-fns `formatDistanceToNow` is also available) | Trivial for this specific "days left/ago" pattern |
| Admin route protection | Complex RBAC middleware | Page-level `redirect("/dashboard")` guard | Simple, auditable, matches existing `orgRole !== "admin" → redirect` pattern in billing/page.tsx |
| Member email lookup | Storing emails in user_organisations | `admin.auth.admin.getUserById()` | Auth is the source of truth; avoids denormalization |

---

## Common Pitfalls

### Pitfall 1: RLS Blocks Cross-Org Queries
**What goes wrong:** Using `createClient()` (authenticated anon client) instead of `createAdminClient()` returns only the super-admin's own org from the `organisations` table.
**Why it happens:** RLS policy `organisations_select_own` restricts SELECT to `id = auth_org_id()` for authenticated role.
**How to avoid:** All admin page data fetches use `createAdminClient()`. Enforce at code review.
**Warning signs:** Org list shows exactly 1 org (the super-admin's own org).

### Pitfall 2: Middleware Org Check Blocks /admin Access
**What goes wrong:** The middleware resolves org from subdomain/`?org=` param and validates the user belongs to that org. A super-admin visiting `/admin` (with their own org's subdomain) passes membership validation fine — but if they somehow hit `/admin` on a different subdomain, they'd be redirected.
**Why it happens:** The middleware enforces "user must be a member of the org matching the URL's subdomain". Super-admins may want to view the admin dashboard from any context.
**How to avoid:** Add an `isAdminRoute()` check in middleware that skips Steps 6-9 (org resolution, membership, subscription enforcement) and proceeds directly after the session check. The page guard handles is_super_admin.
**Warning signs:** Super-admin is redirected away from `/admin` in unexpected scenarios.

### Pitfall 3: Org Member Count from Auth API is Slow
**What goes wrong:** Calling `admin.auth.admin.getUserById()` sequentially for many members of many orgs on the list page is O(members * orgs) API calls, making the page slow.
**Why it happens:** The org list page only needs counts, not individual member details.
**How to avoid:** For the org **list** page, get user counts from `user_organisations` table count queries only — no Auth API calls needed. The Auth API is only called on the **detail** page for name/email resolution of a single org's members.
**Warning signs:** /admin page load takes multiple seconds.

### Pitfall 4: NavLinks Receives isSuperAdmin on Every Request
**What goes wrong:** The dashboard layout already calls `supabase.auth.getUser()` — adding the prop is zero cost. But if NavLinks is memoized or statically optimized somewhere, the prop may not update.
**Why it happens:** NavLinks is a client component; layout is a server component. The prop flows correctly at render time.
**How to avoid:** This is standard RSC→Client component prop passing; no special handling needed. The flag is read from the session which is fresh on every request.

### Pitfall 5: is_super_admin Can Be Set by User
**What goes wrong:** If any API route or server action accepts `is_super_admin` as a field and writes it via the authenticated client, a user could escalate their own privilege.
**Why it happens:** The `app_metadata` field in Supabase can be written via the service role only — but a developer could accidentally expose a server action that calls `admin.auth.admin.updateUserById(userId, { app_metadata: { is_super_admin: true } })`.
**How to avoid:** ADMN-01 requires no application UI or client-callable API path sets this flag. Audit any new server actions for app_metadata writes. Setting the flag is done only via Supabase Dashboard.

---

## Code Examples

### Subscription Status Badge (Reusable)

Established pattern from `billing-status-card.tsx` (confirmed existing code):

```tsx
// Source: app/(dashboard)/billing/components/billing-status-card.tsx
const STATUS_CONFIG: Record<string, { label: string; bgClass: string; textClass: string }> = {
  active:    { label: "Active",           bgClass: "bg-green-500/10",       textClass: "text-green-600" },
  trialing:  { label: "Trial",            bgClass: "bg-blue-500/10",        textClass: "text-blue-500" },
  past_due:  { label: "Payment overdue",  bgClass: "bg-amber-500/10",       textClass: "text-amber-600" },
  cancelled: { label: "Cancelled",        bgClass: "bg-destructive/10",     textClass: "text-destructive" },
  unpaid:    { label: "Unpaid",           bgClass: "bg-destructive/10",     textClass: "text-destructive" },
};

// Usage (DESIGN.md div+span badge pattern):
<div className={`px-3 py-2 rounded-md inline-flex items-center ${config.bgClass}`}>
  <span className={`text-sm font-medium ${config.textClass}`}>{config.label}</span>
</div>
```

### Admin Page Guard

```typescript
// Source: existing pattern from app/(dashboard)/billing/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user.app_metadata?.is_super_admin) {
    redirect("/dashboard");
  }
  // ...
}
```

### All-Org Data Fetch (Admin Client)

```typescript
// Source: lib/supabase/admin.ts + Phase 11 pattern
import { createAdminClient } from "@/lib/supabase/admin";

async function getAllOrgsWithCounts() {
  const admin = createAdminClient();

  // All orgs (bypasses RLS)
  const { data: orgs } = await admin
    .from("organisations")
    .select("id, name, slug, plan_tier, subscription_status, trial_ends_at, stripe_subscription_id")
    .order("created_at", { ascending: true });

  if (!orgs) return [];

  // Parallel count queries
  const [clientCountResults, userCountResults] = await Promise.all([
    Promise.all(
      orgs.map((org) =>
        admin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .then(({ count }) => ({ orgId: org.id, count: count ?? 0 }))
      )
    ),
    Promise.all(
      orgs.map((org) =>
        admin
          .from("user_organisations")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .then(({ count }) => ({ orgId: org.id, count: count ?? 0 }))
      )
    ),
  ]);

  const clientCountMap = Object.fromEntries(clientCountResults.map((r) => [r.orgId, r.count]));
  const userCountMap = Object.fromEntries(userCountResults.map((r) => [r.orgId, r.count]));

  return orgs.map((org) => ({
    ...org,
    clientCount: clientCountMap[org.id] ?? 0,
    userCount: userCountMap[org.id] ?? 0,
  }));
}
```

### Org Detail: Member Resolution

```typescript
// Source: Pattern from D-11-02-03 (app/api/webhooks/stripe/route.ts)
async function getOrgMembers(orgId: string) {
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("user_organisations")
    .select("user_id, role")
    .eq("org_id", orgId);

  if (!memberships?.length) return [];

  const members = await Promise.all(
    memberships.map(async (m) => {
      const { data: { user } } = await admin.auth.admin.getUserById(m.user_id);
      return {
        userId: m.user_id,
        email: user?.email ?? "—",
        name: user?.user_metadata?.full_name ?? user?.email ?? "—",
        role: m.role,
      };
    })
  );

  return members;
}
```

### Copyable Stripe Subscription ID

```tsx
"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyableText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <code className="text-sm font-mono text-muted-foreground">{value}</code>
      <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7">
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
```

---

## Database Reality Check

Confirmed from live Supabase schema (2026-02-21):

**`organisations` table columns available for admin list:**
- `id`, `name`, `slug`, `plan_tier` (enum), `subscription_status` (enum), `trial_ends_at` (timestamptz), `stripe_subscription_id`, `created_at`

**`user_organisations` table:**
- `id`, `user_id`, `org_id`, `role` (enum), `created_at`

**`clients` table:**
- Has `id` and `org_id` — sufficient for count queries

**RLS reality:**
- `organisations_select_own`: authenticated role can only SELECT org WHERE id = auth_org_id()
- `Service role full access to organisations`: service_role bypasses all — this is what `createAdminClient()` uses
- **Conclusion:** Admin page MUST use `createAdminClient()`. Confirmed.

**The `is_super_admin` flag:**
- Lives in Supabase Auth `app_metadata` (not a database table column)
- Readable from JWT session: `session.user.app_metadata.is_super_admin`
- Writable only via Supabase Admin Auth API (`admin.auth.admin.updateUserById`)
- The JWT hook (enabled in Supabase Dashboard) currently injects `org_id` and `org_role` from `user_organisations`. It does NOT need to inject `is_super_admin` — it's already available directly on `user.app_metadata` from the JWT without the hook touching it.

---

## Open Questions

1. **Does the middleware's org-membership check interfere with super-admin access to /admin?**
   - What we know: The middleware validates that the user belongs to the org matching the URL's subdomain. A super-admin user has a normal `org_id` in their JWT, so they will pass membership validation for their own org's subdomain normally.
   - What's unclear: If a super-admin accesses `/admin` from a different subdomain (e.g., they're browsing `otheracme.app.phasetwo.uk/admin`), they'd get redirected to their own org subdomain first by the wrong-org guard, and then the `otheracme` slug would no longer be in the URL.
   - Recommendation: Add the `isAdminRoute()` middleware bypass as described in Architecture Patterns. This is a small, safe change that eliminates all edge cases cleanly.

2. **Plan for data retention policy for cancelled orgs (noted in STATE.md open questions)?**
   - What we know: STATE.md flagged "Data retention policy for cancelled orgs (30 days mentioned; confirm before Phase 14)" as something to resolve.
   - What's unclear: Since Phase 14 is read-only with no deletion actions, this does not directly block Phase 14 implementation. The admin list will simply show cancelled orgs with their badge.
   - Recommendation: Flag this as deferred — data retention is an operational concern (manual deletion or future automated cleanup), not a Phase 14 UI concern. The admin dashboard simply surfaces cancelled status.

---

## Sources

### Primary (HIGH confidence)

- **Live Supabase schema** — confirmed organisations columns, user_organisations structure, RLS policies (queried 2026-02-21)
- `lib/supabase/admin.ts` — createAdminClient() implementation, service role pattern
- `lib/supabase/middleware.ts` — full middleware flow, app_metadata JWT access pattern
- `lib/auth/org-context.ts` — getOrgId/getOrgContext, JWT claim extraction pattern
- `app/(dashboard)/billing/components/billing-status-card.tsx` — STATUS_CONFIG, badge pattern
- `app/(dashboard)/billing/page.tsx` — role-based route guard pattern
- `components/nav-links.tsx` — current nav structure, client component
- `app/(dashboard)/layout.tsx` — server layout, user fetch, prop-passing opportunity
- `app/(dashboard)/clients/components/client-table.tsx` — TanStack Table sortable table pattern
- `DESIGN.md` — traffic light system, badge pattern (div+span), card header spacing

### Secondary (MEDIUM confidence)

- STATE.md decisions D-11-02-03 — admin.auth.admin.getUserById() for email resolution
- STATE.md decisions D-11-04-01, D-11-04-02 — badge pattern, count query pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed and in use
- Architecture: HIGH — patterns directly derived from existing codebase; no new patterns introduced
- Pitfalls: HIGH — RLS constraint verified against live schema; middleware behavior read from source code
- Data model: HIGH — confirmed against live Supabase database

**Research date:** 2026-02-21
**Valid until:** Stable — no fast-moving dependencies; valid until schema changes
