# Phase 13: Onboarding Flow & Team Management - Research

**Researched:** 2026-02-21
**Domain:** Next.js App Router multi-step wizard, Supabase Auth magic link, token-based invite flow, role-based nav, cron notification
**Confidence:** HIGH — all findings grounded in the actual codebase; no speculative library choices needed

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Onboarding Wizard**
- Full-page stepper layout with progress bar at top — dedicated, distraction-free
- Step 1 (Account): Magic link authentication — user enters email, receives magic link, clicks to verify
- Step 2 (Firm Details): Minimal — firm name and URL slug only. User enters slug manually with availability validation feedback
- Step 3 (Plan Selection): Pricing cards showing all plan tiers with "Start Trial" buttons — 14-day free trial, no payment upfront
- Step 4 (Trial Started): Confirmation page showing trial details (14 days, plan name) with "Go to Dashboard" CTA button
- Back button allowed — users can navigate back to edit previous steps before completing
- Wizard lives at `/onboarding` on the bare domain (`app.phasetwo.uk/onboarding`) since the org subdomain doesn't exist yet
- Users who already have an org are redirected away from `/onboarding` to their dashboard (no re-entry)
- 14-day free trial period

**Team Management**
- Lives as a "Team" card/section on the existing settings page (admin-only)
- Single email input with "Invite" button for sending invites — one at a time
- Two roles only: Admin (full access) and Member (limited access)
- Member list shows: email, role badge (Admin/Member), status (Active/Pending)
- Pending invites appear in the same list as active members with "Pending" status badge and resend/cancel options
- Role changes require confirmation dialog (especially promoting to admin)
- Removing members requires confirmation dialog — removes access immediately
- Team size enforced per plan tier (e.g., Lite=1, Sole Trader=2, Practice=5, Firm=unlimited)
- Last admin cannot be removed — returns error and leaves assignment unchanged

**Invite Recipient Experience**
- Invite email: minimal plain text — less likely to hit spam filters
- Invite link goes to an accept page showing org name, who invited them, and "Accept & Join" button
- One org per user — if invitee already belongs to another org, show "You already belong to another organisation" message
- Invite links expire after 7 days — admin can resend if needed
- Admin chooses role (Admin or Member) at invite time
- Accept page: one-click accept, no form fields beyond authentication
- Tokenised link — single use, cannot be reused after acceptance

**Role-Based Navigation**
- Admin sees: Dashboard, Clients, Email Logs, Settings (including Team, Billing, Email Config)
- Member sees: Dashboard, Clients, Email Logs — that's it
- Restricted nav items (Settings, Billing, Team) are hidden entirely for Members — not visible at all
- Direct URL access to restricted routes (e.g., `/settings`) silently redirects Member to dashboard
- Members have full edit access to clients — they're accountants doing daily work

### Claude's Discretion
- Progress bar visual design and step indicator style
- Exact pricing card layout and copy
- Invite email exact wording
- Accept page visual design
- Team size limits per plan tier (specific numbers)
- Trial-ending-soon email template and exact timing logic

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ONBD-01 | Sign-up page: new user creates a Supabase Auth account via magic link | Magic link OTP flow already implemented in `login/actions.ts`; sign-up uses same `signInWithOtp` — Supabase creates account on first OTP if email not yet registered |
| ONBD-02 | Org creation step: user enters firm name and org slug (auto-suggested, editable, unique, validated against reserved slug list); creates `organisations` and `user_organisations` (admin) rows | `organisations` table with slug CHECK constraint already exists; `user_organisations` table exists; service-role insert needed post-magic-link since user has no JWT claims yet |
| ONBD-03 | Firm details step: sender name and email (pre-fills Postmark per-org config); Postmark server token field (optional — can be configured later in Settings) | `app_settings` upsert pattern already in `settings.ts`; `organisations.postmark_server_token/sender_domain` columns exist; `updatePostmarkSettings` action already exists |
| ONBD-04 | Plan selection step: all 4 tiers shown with feature comparison; selecting "Start free trial" begins 14-day trial and skips Stripe Checkout | `createTrialForOrg()` already in `lib/billing/trial.ts`; `PLAN_TIERS` config in `lib/stripe/plans.ts` ready to display; no Stripe call needed for trial path |
| ONBD-05 | After onboarding, user is redirected to their org subdomain dashboard | Auth callback pattern established in `app/(auth)/auth/callback/route.ts`; subdomain redirect logic in `lib/middleware/subdomain.ts` |
| ONBD-06 | Already-onboarded orgs cannot re-enter `/onboarding`; `setup_complete` flag in `app_settings` prevents this | `getOnboardingComplete()` and `markOnboardingComplete()` already in `settings.ts`; middleware must treat `/onboarding` as public and handle redirect in the onboarding layout itself |
| TEAM-01 | Admin can invite team members by email; invite email sent via Postmark with tokenized accept link (expires 7 days) | `invitations` table with `token_hash`, `expires_at`, `accepted_at` already exists; need server action to generate token, hash it, insert row, send email via platform Postmark token |
| TEAM-02 | Accept invite flow: recipient clicks link → creates account or logs in → added to org via `user_organisations` | New route `/invite/accept` (or `/onboarding/accept`); uses `signInWithOtp` for auth then admin client to insert `user_organisations` row; must mark `invitations.accepted_at` |
| TEAM-03 | Settings page shows current team: member name, email, role, joined date; admin can remove members and change roles | `user_organisations` SELECT already works; need `supabase.auth.admin.getUserById()` to resolve email (same pattern as `sendPaymentFailedEmail`); need server actions for remove/change-role |
| TEAM-04 | Admin role has full access | `getOrgContext()` in `lib/auth/org-context.ts` already returns `orgRole`; need to thread this into layout nav and route protection |
| TEAM-05 | Member role has restricted access — settings, billing, team tabs hidden and routes redirect | `NavLinks` component needs role awareness; middleware or layout redirect needed for `/settings`, `/billing` |
| TEAM-06 | Org must always retain at least one admin; removing last admin is prevented | Server-side check before DELETE from `user_organisations`: count admins, reject if removing would leave zero |
| NOTF-01 | Trial-ending-soon email sent to org admin 3 days before `trial_ends_at`; daily cron check, not re-sent | New cron route `/api/cron/trial-reminder`; idempotency via `app_settings` key `trial_reminder_sent`; pattern matches existing `sendPaymentFailedEmail` in `lib/billing/notifications.ts` |
</phase_requirements>

---

## Summary

Phase 13 builds on a mature codebase where nearly all foundational infrastructure already exists. The `organisations`, `user_organisations`, and `invitations` tables are fully defined with correct RLS policies. `createTrialForOrg()`, `PLAN_TIERS`, magic-link auth, and the auth callback redirect are all implemented. The onboarding wizard UI scaffold (`WizardStepper`, layout pattern) also exists, though aimed at post-signup setup rather than a signup-first flow.

The primary work is: (1) reworking the onboarding flow for the new 4-step structure that starts unauthenticated and creates an org, (2) building the token-based invite system on top of the existing `invitations` table, (3) adding role-gated nav and route protection using the already-available `getOrgContext()`, and (4) adding a trial-reminder cron job. There are no new npm packages required. No new database tables are needed — only a new migration for the `trial_reminder_sent` idempotency flag in `app_settings` and any minor RLS changes.

The biggest architectural nuance is the onboarding "no-org-yet" problem: a user who just clicked a magic link has no `org_id` in their JWT yet (the Custom Access Token Hook fires on login, not on OTP send), so the wizard must use the admin/service-role client to INSERT into `organisations` and `user_organisations`, then trigger a session refresh so the JWT gets the new `org_id` claim before the subdomain redirect.

**Primary recommendation:** Implement in four discrete plans — (1) onboarding wizard, (2) invite + accept flow, (3) role-gated nav + route protection, (4) trial-reminder cron — matching the natural dependency order.

---

## Standard Stack

### Core (all already in the project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | existing | Auth, DB client, session cookies | Already the SSR client throughout |
| `@supabase/supabase-js` (admin) | existing | Service-role DB writes, `auth.admin.getUserById()` | Required for RLS-bypassing writes during onboarding and invite accept |
| `postmark` | existing | Sending invite emails and trial-reminder email | Already used for all outbound email in this project |
| `next/navigation` (App Router) | existing | `redirect()`, `useRouter`, `useSearchParams` | Standard App Router pattern throughout |
| `crypto` (Node built-in) | built-in | Generating and hashing invite tokens | `crypto.randomBytes` + `crypto.createHash('sha256')` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React `cache()` | built-in | Deduplicating `getOrgContext()` within a render | Already used in `getCurrentOrg()` — apply same pattern |
| `lucide-react` | existing | Icons in wizard steps, team management cards | All icons in this project use lucide |
| shadcn/ui components | existing | `Card`, `Button`, `Input`, `Dialog`, `Badge` | All UI primitives already present |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `crypto.randomBytes` + SHA-256 hash | `uuid` for token | UUID is not suitable for secret tokens — crypto random bytes are cryptographically strong |
| Platform Postmark token for invites | Org Postmark token | Invites are system notifications (like payment-failed). Use platform token so they work even before the org configures their own Postmark settings |
| `app_settings` key for trial reminder idempotency | Separate `sent_notifications` table | `app_settings` is already the per-org KV store; no new table needed for a single flag |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Structure

```
app/(auth)/onboarding/          # REPLACE existing; new 4-step wizard
  layout.tsx                    # Keep layout; add "already onboarded" redirect
  page.tsx                      # New: 4-step wizard (Account → Firm → Plan → Done)
  actions.ts                    # New: createOrgAndJoinAsAdmin(), checkSlugAvailable()

app/(auth)/invite/
  accept/
    page.tsx                    # New: accept invite page (shows org name, "Accept & Join")
    actions.ts                  # New: validateInviteToken(), acceptInvite()

app/(dashboard)/settings/
  components/
    team-card.tsx               # New: team management card (member list + invite form)
    team-member-row.tsx         # New: row showing email, role badge, status, actions
    invite-form.tsx             # New: single email + role select + "Invite" button

app/actions/
  team.ts                       # New: sendInvite(), removeTeamMember(), changeRole()

app/api/cron/
  trial-reminder/
    route.ts                    # New: daily cron — finds orgs 3 days from trial_ends_at

lib/billing/
  notifications.ts              # EXTEND: add sendTrialEndingSoonEmail()

components/
  nav-links.tsx                 # MODIFY: accept orgRole prop, filter restricted items
```

### Pattern 1: Onboarding Wizard — No-Org-Yet Problem

**What:** When a user completes magic link auth during onboarding, they have no `org_id` in their JWT. The wizard must create the org using the **admin (service-role) client**, then force a session refresh so the next navigation picks up the new JWT claims.

**How it works:**

```typescript
// app/(auth)/onboarding/actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function createOrgAndJoinAsAdmin(
  firmName: string,
  slug: string,
  planTier: "lite" | "sole_trader" | "practice" | "firm"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  // 1. Insert org row
  const { data: org, error: orgError } = await admin
    .from("organisations")
    .insert({ name: firmName, slug, plan_tier: planTier })
    .select()
    .single();

  if (orgError) throw new Error(orgError.message);

  // 2. Insert user_organisations (admin role)
  await admin.from("user_organisations").insert({
    user_id: user.id,
    org_id: org.id,
    role: "admin",
  });

  // 3. Create trial
  await createTrialForOrg(org.id, admin);

  // 4. Mark onboarding complete in app_settings
  await admin.from("app_settings").upsert(
    { org_id: org.id, key: "onboarding_complete", value: "true" },
    { onConflict: "org_id,key" }
  );

  return { orgId: org.id, slug: org.slug };
}
```

**After calling this action:** The client must trigger `supabase.auth.refreshSession()` in the browser so the Custom Access Token Hook fires with the new `org_id` in `app_metadata`, then redirect to the org's subdomain. The wizard's Step 4 "Go to Dashboard" button must do this refresh before redirecting.

**Confidence:** HIGH — this is the same pattern used elsewhere in the codebase (admin client bypasses RLS for provisioning operations).

### Pattern 2: Invite Token Flow

**What:** Generate a cryptographically random token, store its SHA-256 hash in `invitations.token_hash`, send the raw token in the email URL. On accept, hash the token from the URL and compare to the stored hash.

```typescript
// app/actions/team.ts
import crypto from "crypto";

function generateInviteToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex"); // 64-char hex
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export async function sendInvite(email: string, role: "admin" | "member") {
  const admin = createAdminClient();
  const { orgId } = await getOrgContext();

  // Check user seat limit before inserting
  const { count } = await admin
    .from("user_organisations")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  // ... compare against org.user_count_limit

  const { raw, hash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await admin.from("invitations").insert({
    org_id: orgId,
    email,
    role,
    token_hash: hash,
    expires_at: expiresAt.toISOString(),
  });

  // Send via platform Postmark token (same as NOTF-02 pattern)
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${raw}`;
  // ... sendEmail(...)
}
```

**Accept flow (`/invite/accept?token=...`):**

```typescript
// app/(auth)/invite/accept/actions.ts
export async function acceptInvite(token: string) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();

  // Look up invitation by hash
  const { data: invite } = await admin
    .from("invitations")
    .select("*")
    .eq("token_hash", hash)
    .is("accepted_at", null)          // single-use check
    .gt("expires_at", new Date().toISOString())  // expiry check
    .single();

  if (!invite) throw new Error("Invalid or expired invite link");

  // Check accepting user is not already in another org
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be authenticated");

  const { data: existing } = await admin
    .from("user_organisations")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) throw new Error("You already belong to another organisation");

  // Insert user_organisations
  await admin.from("user_organisations").insert({
    user_id: user.id,
    org_id: invite.org_id,
    role: invite.role,
  });

  // Mark invite accepted
  await admin.from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return { orgId: invite.org_id };
}
```

### Pattern 3: Role-Gated Navigation

**What:** `NavLinks` is currently a "dumb" client component that always renders all links. It needs the user's `orgRole` passed from the server layout.

**How:** The dashboard `layout.tsx` already fetches the user and calls `getOrgId()`. Add `getOrgContext()` to get the role, and pass it as a prop to `NavLinks`.

```typescript
// app/(dashboard)/layout.tsx — additions
const { orgRole } = await getOrgContext();
// ...
<NavLinks orgRole={orgRole} />
<SettingsLink orgRole={orgRole} />
```

```typescript
// components/nav-links.tsx — add role filtering
const ADMIN_ONLY_ROUTES = ["/billing"]; // Settings handled separately

export function NavLinks({ orgRole }: { orgRole: string }) {
  const visibleItems = NAV_ITEMS.filter(
    item => !ADMIN_ONLY_ROUTES.includes(item.href) || orgRole === "admin"
  );
  // ...
}
```

**Route protection:** For server components (`/settings`, `/billing` pages), check role at the top of the page/layout and `redirect("/dashboard")` if member tries to access admin-only routes.

### Pattern 4: Trial-Reminder Cron

**What:** Daily cron at `/api/cron/trial-reminder` finds orgs with `trial_ends_at` between now+3d and now+4d, sends email to admin(s), marks `app_settings` `trial_reminder_sent=true` to prevent re-send.

```typescript
// Idempotency check via app_settings
const { data: alreadySent } = await adminClient
  .from("app_settings")
  .select("id")
  .eq("org_id", org.id)
  .eq("key", "trial_reminder_sent")
  .eq("value", "true")
  .single();

if (alreadySent) continue; // skip — already notified

// Send email, then mark:
await adminClient.from("app_settings").upsert(
  { org_id: org.id, key: "trial_reminder_sent", value: "true" },
  { onConflict: "org_id,key" }
);
```

Schedule: `"0 9 * * *"` (9am UTC daily) in `vercel.json`.

### Pattern 5: Middleware — `/onboarding` is Public (Bare Domain)

**What:** `/onboarding` lives on the bare domain (`app.phasetwo.uk`) with no org slug. The existing middleware already handles the no-slug case correctly: unauthenticated users in production get redirected to the marketing site. The wizard needs to be reachable by unauthenticated users without a slug.

**Solution:** Add `/onboarding` and `/invite/accept` to `PUBLIC_ROUTES` in `lib/supabase/middleware.ts`. The layout for `/onboarding` must handle "already has org" re-entry protection (check `user_organisations` via admin client, redirect to their subdomain if found).

```typescript
// lib/supabase/middleware.ts
const PUBLIC_ROUTES = ["/login", "/auth/callback", "/auth/signout", "/pricing", "/onboarding", "/invite/accept"];
```

**Critical:** In production, `/onboarding` is accessed at `app.phasetwo.uk/onboarding` — a no-slug URL. The middleware's no-slug branch must not redirect these routes to the marketing site. Since they are in `PUBLIC_ROUTES`, they pass through before the slug check — this works correctly with the current middleware structure.

### Anti-Patterns to Avoid

- **Using the user Supabase client for org/user_org INSERT during onboarding:** The user has no `org_id` in JWT yet, so RLS will reject any INSERT that requires `org_id = auth_org_id()`. Always use the admin client for provisioning actions.
- **Redirecting to subdomain before session refresh:** The org subdomain route requires a valid JWT with `org_id`. After creating the org, the client MUST call `supabase.auth.refreshSession()` first, otherwise the middleware will see no `org_id` and loop.
- **Storing the raw invite token in the database:** Only store the SHA-256 hash. The raw token exists only in the email link and in transit.
- **Using the org Postmark token for invite emails:** Invite emails are system notifications. The org may not have configured their Postmark token yet (they're mid-onboarding). Always use the platform `POSTMARK_SERVER_TOKEN`.
- **Relying on middleware alone for role enforcement:** Middleware runs on every request but does not know the user's role (it would require an extra DB query per request). Role enforcement belongs in layout server components and server actions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cryptographic token generation | Custom random string | `crypto.randomBytes(32)` (Node built-in) | Cryptographically secure; handles entropy correctly |
| Token storage security | Plain token in DB | SHA-256 hash in DB, raw in email URL only | Prevents DB breach from giving attacker valid tokens |
| Seat limit check | Complex role logic | Query `user_organisations` count + compare to `org.user_count_limit` | Already pattern-matched by `checkClientLimit()` in `lib/billing/usage-limits.ts` |
| Email admin resolution | Trying to join auth.users | `supabase.auth.admin.getUserById(userId)` | PostgREST FK joins to auth.users don't reliably work — established in MEMORY.md |
| Confirmation dialogs | Custom modal | shadcn `Dialog` component | Already used throughout the app; consistent UX |

**Key insight:** The invite token pattern (random bytes → SHA-256 → store hash) is the same pattern used by every major auth system for password reset tokens. Don't deviate from this.

---

## Common Pitfalls

### Pitfall 1: Session JWT Stale After Org Creation
**What goes wrong:** User creates org on Step 2. On Step 4 "Go to Dashboard", they are redirected to their org subdomain. Middleware checks `user.app_metadata.org_id` — it is still `undefined` because the JWT was issued before org creation. Middleware either loops or sends them to marketing site.
**Why it happens:** Supabase JWTs are issued at login time. The Custom Access Token Hook only fires on new login/session events, not on DB changes.
**How to avoid:** After the `createOrgAndJoinAsAdmin()` server action succeeds, call `await supabase.auth.refreshSession()` in the client component before redirecting. This triggers a new token with the org claims injected by the hook.
**Warning signs:** User ends up at marketing site or login page after completing onboarding.

### Pitfall 2: Invitations RLS Blocks Accept Flow
**What goes wrong:** The accept page reads the invitation by token hash. The user accepting the invite is NOT yet a member of the org (they have no `org_id` in their JWT). The `invitations_select_org` RLS policy uses `org_id = auth_org_id()` — the user's `auth_org_id()` returns the zero UUID, so the query returns no rows.
**Why it happens:** RLS on `invitations` is scoped to `org_id = auth_org_id()`, which is correct for admins managing their invites but blocks unauthenticated or cross-org users.
**How to avoid:** The invite accept route must use the **admin client** (service-role, bypasses RLS) to look up the invite by token hash. This is acceptable because the raw token IS the credential — the security is in the token itself.
**Warning signs:** "Invalid or expired invite link" error even with a valid fresh link.

### Pitfall 3: One-Org-Per-User Constraint — Timing Window
**What goes wrong:** User accepts an invite and is already in an org (they went through onboarding separately). The check passes, but then a race condition inserts two `user_organisations` rows.
**Why it happens:** The check-then-insert is two separate operations.
**How to avoid:** The `UNIQUE(user_id, org_id)` constraint on `user_organisations` already prevents exact duplicates. For the "one org per user" constraint (any org), the accept action must check for any existing row before inserting, and the `user_organisations` table does not enforce this at DB level — the application must enforce it. Keep the check-then-insert in a single server action (not parallel requests possible via the UI since it's a one-click flow).

### Pitfall 4: Last Admin Prevention — Timing Window
**What goes wrong:** Two concurrent requests to remove admins leave an org with no admins.
**Why it happens:** Application-level check-then-delete with no DB-level constraint.
**How to avoid:** The check-then-delete is unavoidable without a DB trigger. Use `SELECT FOR UPDATE` (advisory lock) or simply: query the admin count AFTER the delete in a transaction. In practice, this is an extremely rare race (small team, admin removing themselves), and the check is sufficient for this use case. Document that the check is best-effort, not transactional.

### Pitfall 5: `/onboarding` Middleware Routing in Development
**What goes wrong:** In development, the `/onboarding` route at `localhost:3000/onboarding` (no `?org=` param) is treated as "no slug". If not in `PUBLIC_ROUTES`, the middleware either sends unauthenticated users to `/login` or authenticated users through the org-resolution logic which fails (no org yet).
**Why it happens:** The middleware's no-slug branch assumes any authenticated user should have an org. New users during onboarding don't have one yet.
**How to avoid:** `/onboarding` and `/invite/accept` must be in `PUBLIC_ROUTES`. The onboarding page handles its own auth state internally (Step 1 shows magic link form; later steps check `user` server-side).

### Pitfall 6: NavLinks is "use client" — Cannot Call Server Functions Directly
**What goes wrong:** `NavLinks` is a client component. `getOrgContext()` is a server function. Calling it inside `NavLinks` would fail.
**Why it happens:** Server/client boundary.
**How to avoid:** Fetch `orgRole` in the `DashboardLayout` server component (already fetching user and orgId) and pass it as a prop to `NavLinks`. This is the correct pattern — data flows server → client via props.

---

## Code Examples

### Verified Patterns from This Codebase

### Slug Availability Check (server action)
```typescript
// app/(auth)/onboarding/actions.ts
export async function checkSlugAvailable(slug: string): Promise<{ available: boolean; reason?: string }> {
  // Check format first (DB has constraint but give friendly error)
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.length < 3) {
    return { available: false, reason: "Slug must be at least 3 characters, lowercase letters, numbers, and hyphens only" };
  }

  // Reserved slugs (matches middleware reserved list)
  const RESERVED = ["www", "app", "api", "admin", "billing", "onboarding", "invite", "pricing", "login", "dashboard"];
  if (RESERVED.includes(slug)) {
    return { available: false, reason: "This slug is reserved. Please choose a different one." };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("organisations")
    .select("id")
    .eq("slug", slug)
    .single();

  return { available: !data };
}
```

### Getting Team Members (resolves emails via auth admin API)
```typescript
// Pattern from lib/billing/notifications.ts — established approach
export async function getTeamMembers(orgId: string) {
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("user_organisations")
    .select("id, user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const members = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const { data: { user } } = await admin.auth.admin.getUserById(m.user_id);
      return {
        id: m.id,
        userId: m.user_id,
        email: user?.email ?? "(unknown)",
        role: m.role,
        joinedAt: m.created_at,
        status: "active" as const,
      };
    })
  );

  return members;
}
```

### Trial Reminder Cron — Finding Orgs Due in 3 Days
```typescript
// app/api/cron/trial-reminder/route.ts
const now = new Date();
const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

const { data: orgsNearingTrialEnd } = await adminClient
  .from("organisations")
  .select("id, name")
  .eq("subscription_status", "trialing")
  .gte("trial_ends_at", threeDaysFromNow.toISOString())
  .lt("trial_ends_at", fourDaysFromNow.toISOString());
```

### Removing a Team Member (with last-admin check)
```typescript
export async function removeTeamMember(targetUserId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") return { error: "Only admins can remove team members" };

  // Get current role of target before removing
  const { data: target } = await admin
    .from("user_organisations")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", targetUserId)
    .single();

  // If removing an admin, check there will still be at least one remaining
  if (target?.role === "admin") {
    const { count } = await admin
      .from("user_organisations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return { error: "Cannot remove the last admin. Promote another member to admin first." };
    }
  }

  await admin
    .from("user_organisations")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  return {};
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact on Phase 13 |
|--------------|-----------------|-------------------|
| Old `/onboarding` was a post-signup setup wizard for existing users | New `/onboarding` is a signup-first flow that creates the user AND the org | Must rebuild the wizard page.tsx; layout.tsx can be mostly kept |
| `navLinks` had no role awareness | Needs role-filtered navigation | `NavLinks` needs `orgRole` prop from layout |
| No team management UI | Team card on Settings page (admin-only) | New component only; settings page layout is already proven |
| Trial expiry cron exists | Trial-reminder cron does NOT yet exist | New cron route + new `vercel.json` entry + `sendTrialEndingSoonEmail()` |

**Already implemented (do not rebuild):**
- `createTrialForOrg()` in `lib/billing/trial.ts` — call it from the onboarding action
- `WizardStepper` component in `components/wizard-stepper.tsx` — reuse as-is
- `invitations` table with correct schema and RLS — table is ready, no schema changes
- `getOrgContext()` in `lib/auth/org-context.ts` — the role resolution utility is complete
- `PLAN_TIERS` in `lib/stripe/plans.ts` — pricing display for Step 3 is ready
- `sendPaymentFailedEmail()` pattern in `lib/billing/notifications.ts` — use same pattern for invite email and trial-reminder email
- Magic link `sendMagicLink()` action in `app/(auth)/login/actions.ts` — reuse for onboarding Step 1 (same OTP flow creates account if new)

---

## Open Questions

1. **Where does `/invite/accept` live — on the bare domain or the org subdomain?**
   - What we know: The invite link is sent with no org context (the recipient doesn't know the org's subdomain). The link should work from email regardless of which subdomain is in the URL.
   - What's unclear: Whether to use `app.phasetwo.uk/invite/accept?token=...` (bare domain) or `{slug}.app.phasetwo.uk/invite/accept?token=...` (org subdomain embedded in URL).
   - Recommendation: Use the bare domain (`app.phasetwo.uk/invite/accept`). It avoids leaking the org slug in the email URL, and the accept action resolves the org from the token itself. Add `/invite/accept` to `PUBLIC_ROUTES` and treat it like `/onboarding`. After acceptance, redirect to the org's subdomain using the resolved org slug.

2. **What happens if the invite recipient is not yet authenticated when they click the link?**
   - What we know: The accept page must handle both cases — logged-in user (one-click accept) and unauthenticated user (need to create account first). The CONTEXT.md says "creates Supabase Auth account if new, or logs in if existing."
   - Recommendation: Show the accept page with org name + "Accept & Join" button. If user is not authenticated, clicking "Accept & Join" triggers magic link OTP (same as login flow) with a `?token=...` preserved in the `emailRedirectTo` so the callback can redirect back to the accept page. This keeps the token flow intact.

3. **Reserved slug list — what should it include?**
   - What we know: The middleware reserves `['www', 'app', 'api', 'admin', 'billing']`. The onboarding wizard must enforce the same list plus application route names.
   - Recommendation: Extend the reserved list in the slug validation action to include all Next.js route segments that could conflict: `['www', 'app', 'api', 'admin', 'billing', 'onboarding', 'invite', 'pricing', 'login', 'dashboard', 'clients', 'settings', 'templates', 'schedules', 'email-logs', 'rollover']`. Keep this as a constant shared between middleware and the slug validation action.

4. **Team size limits per plan — exact numbers?**
   - What we know: CONTEXT.md leaves this to Claude's discretion. The `user_count_limit` column already exists on `organisations`.
   - Recommendation: Lite=1, Sole Trader=2, Practice=5, Firm=unlimited (null). These are already reflected in `lib/billing/trial.ts` (trial gets Practice-tier: 5 users). The `PLAN_TIERS` config in `lib/stripe/plans.ts` also has `userLimit` values that align.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all patterns verified against actual files
  - `app/(auth)/onboarding/` — existing wizard structure
  - `app/(auth)/login/actions.ts` — magic link OTP pattern
  - `app/(auth)/auth/callback/route.ts` — post-auth subdomain redirect
  - `lib/supabase/middleware.ts` — PUBLIC_ROUTES, no-slug handling, org validation
  - `lib/auth/org-context.ts` — `getOrgContext()`, JWT fast path + admin fallback
  - `lib/billing/trial.ts` — `createTrialForOrg()` implementation
  - `lib/billing/notifications.ts` — `sendPaymentFailedEmail()` pattern for email admin resolution
  - `lib/stripe/plans.ts` — `PLAN_TIERS` configuration
  - `app/api/cron/trial-expiry/route.ts` — cron auth, admin client, batch update pattern
  - `supabase/migrations/20260219000001_create_organisations_and_user_orgs.sql` — table schemas
  - `app/(dashboard)/layout.tsx` — server component layout pattern
  - `components/nav-links.tsx` — current nav structure (client component)
  - `components/wizard-stepper.tsx` — reusable stepper component
  - Supabase MCP `pg_policies` query — confirmed RLS on `invitations` uses `org_id = auth_org_id()` (blocking cross-org reads as expected)
- `MEMORY.md` — `supabase.auth.admin.getUserById()` preferred over FK joins; RLS vs GRANT for supabase_auth_admin

### Secondary (MEDIUM confidence)
- Supabase Auth OTP behaviour: `signInWithOtp` creates the user account if the email does not already exist in auth.users — this is documented Supabase Auth behaviour and is consistent with how the existing login flow works
- SHA-256 token hashing for invite tokens — industry standard pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already present and in use
- Architecture: HIGH — patterns verified directly in codebase files
- Pitfalls: HIGH — most identified from direct code inspection (RLS policies confirmed via DB query, middleware logic read in full)
- Open questions: MEDIUM — recommendations are reasoned but need planner confirmation (especially invite accept URL design)

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable — no fast-moving external dependencies)
