# Project Research Summary

**Project:** Peninsula Accounting — v3.0 Multi-Tenancy & SaaS Platform
**Domain:** B2B SaaS platform migration — single-tenant to multi-tenant with billing
**Researched:** 2026-02-19
**Confidence:** HIGH (all four research files verified against official sources)

---

## Executive Summary

Peninsula Accounting's v3.0 milestone converts a mature single-tenant Next.js + Supabase application into a fully-isolated multi-tenant SaaS with Stripe billing, subdomain routing, team invites, and a super-admin panel. The architectural approach is well-established: a single shared Supabase project with `org_id` RLS isolation enforced via a Custom Access Token Hook that injects `org_id` into the JWT, combined with Next.js middleware that extracts the org slug from the subdomain and rewrites requests transparently. This stack requires only one new npm package (`stripe@^20.3.1`) — everything else builds on existing dependencies.

The migration is a high-risk, high-value operation on a live application. All existing tables lack `org_id` and all existing RLS policies use `USING (true)`. The recommended migration strategy is a three-phase Expand-Backfill-Contract approach that keeps the application live throughout, with activation of RLS as the final step only after the JWT hook is verified. The two cron jobs are the single highest-severity risk: they use the service role key which bypasses RLS entirely, and without explicit `org_id` filters added before or alongside RLS activation, they will send every tenant's reminder emails to every other tenant's clients on the first run.

The feature set is clear and well-bounded. Fourteen must-ship features define the SaaS platform MVP. Several differentiators — contextual upgrade prompts at 80% usage, soft-limit enforcement, transparent overage pricing, UK-specific VAT handling — are low-effort but high-value for the UK accounting market. The Stripe Customer Portal eliminates the need to build custom billing UI. Super-admin impersonation is explicitly deferred post-v3.0 due to RLS complexity. Overall confidence across all four research areas is HIGH.

---

## Key Findings

### Recommended Stack

The v3.0 stack introduces exactly one new package. The Stripe Node SDK (`stripe@^20.3.1`) covers checkout sessions, webhooks, billing portal, and subscription management server-side. `@stripe/stripe-js` is NOT required given the confirmed decision to use Stripe-Hosted Checkout (redirect flow) rather than Embedded Checkout. The Stripe API version to pin is `2026-01-28.clover`. All subdomain routing, RLS policy changes, and JWT claim injection work entirely with existing dependencies.

See `STACK.md` for full integration patterns and environment variable requirements.

**Core new technology:**
- `stripe@^20.3.1`: Server-side billing — Stripe-Hosted Checkout avoids PCI scope and requires no client-side setup
- Custom Access Token Hook (Supabase, SQL-only, no npm package): JWT `org_id` injection — zero extra DB queries per RLS evaluation vs subquery approach
- `Next.js middleware + NextResponse.rewrite()` (existing): Subdomain routing — no URL change in browser, `x-org-slug` header injected for downstream components
- `lib/org/current-org.ts` (new file, no package): React-cached org resolution — one DB hit per request regardless of how many server components call `getCurrentOrg()`

**Critical version and config details:**
- Stripe API version: `2026-01-28.clover` — pin in constructor to prevent breaking changes
- GBP must be set explicitly (`currency: 'gbp'`) on every Checkout Session; Stripe does not default to GBP
- Vercel wildcard SSL requires the nameserver delegation method, not A records
- Stripe Price IDs stored in environment variables (`STRIPE_PRICE_LITE`, etc.), not hardcoded

### Expected Features

**Must ship for v3.0 SaaS launch (14 features):**
- Multi-step onboarding wizard (4 steps max: Account, Firm Details, Plan, You're In)
- Organisation creation with full tenant data isolation
- 14-day trial with no card required — `trial_ends_at` written at org creation
- Trial expiry gate — hard block at day 15, redirect to plan selection
- Stripe subscription creation via Hosted Checkout (no custom payment UI)
- Plan limit enforcement — soft limit with 1-3 over grace period, then hard block
- Billing management page — current plan, usage meters (clients, users), renewal date
- Stripe Customer Portal link — handles plan changes, invoices, cancellation, payment methods
- UK VAT on subscription invoices via Stripe Tax (20% standard rate)
- GB VAT number collection at checkout — Stripe auto-validates with HMRC
- Team invite by email — token-based, 72-hour expiry, single-use, email-matched
- Role-based access — Admin (billing + team management) and Member (client work only)
- Super-admin tenant list — org name, plan, status, client/user counts, signup date
- Super-admin subscription status synced from Stripe webhooks

**Defer to v3.x (build when metrics trigger):**
- Trial conversion email sequence (Day 0, 3, 10, 13, 14) — valuable but not blocking launch
- Onboarding checklist / progress bar — build when 14-day activation rate falls below 60%
- Upgrade prompt at 80% usage threshold — build when upgrade requests arrive via support
- Pending invite resend/cancel UI — build when "I didn't get my invite" support tickets appear

**Explicit anti-features (do not build in v3.0):**
- Metered/usage-based billing — application-layer limit enforcement is sufficient
- Custom billing management UI — Stripe Customer Portal covers everything needed
- SSO/SAML — not needed for 1-15 person target firms
- Super-admin impersonation — complex RLS implications, defer to v3.x
- Reseller/agency accounts — different product architecture, out of scope

See `FEATURES.md` for full prioritisation matrix, UK-specific requirements, and competitor gap analysis.

### Architecture Approach

The architecture is a single Vercel deployment against a single Supabase project. Tenant isolation is enforced at the database layer via RLS policies that read `org_id` from the JWT (via Custom Access Token Hook). The subdomain (`orgslug.app.domain.com`) is used for routing and UX only — the authoritative tenant identity is always the JWT claim, never the URL. Middleware extracts the org slug, injects it as `x-org-slug` header, and rewrites the path; a `getCurrentOrg()` helper (React `cache()`-wrapped) resolves the org record once per request. Three new tables are required: `organisations`, `user_organisations`, and `invitations`.

See `ARCHITECTURE.md` for the full migration SQL (Expand-Backfill-Contract phases), RLS policy templates for all 16 affected tables, cron rewrite patterns, and the 10-step verified build order.

**Major components and their v3.0 changes:**

| Component | Change |
|-----------|--------|
| `middleware.ts` | CHANGED: adds subdomain detection + `x-org-slug` injection; keeps existing session refresh |
| `lib/org/current-org.ts` | NEW: React-cached slug-to-org-record resolver; used by all server components and actions |
| Custom Access Token Hook | NEW: Postgres function injecting `org_id` + `org_role` into every JWT at login |
| `organisations` table | NEW: holds plan tier, Stripe IDs, trial dates, per-org Postmark token |
| `user_organisations` table | NEW: user membership + role (admin/member) |
| `invitations` table | NEW: token-based invites with expiry |
| All 16 tenant tables | MIGRATED: `org_id` column added, NOT NULL enforced after backfill, RLS activated |
| Both cron routes | REWRITE: iterate over orgs, pass `org_id` to every query, use per-org Postmark token |
| `lib/email/sender.ts` | CHANGED: accepts `serverToken` parameter instead of reading global env var |
| `app/api/webhooks/stripe/` | NEW: handles subscription lifecycle, syncs status to `organisations` table |

### Critical Pitfalls

Research identified 10 critical pitfalls (potential data breaches or outages) and 5 moderate ones. The top 5 requiring action before any multi-tenant traffic:

1. **Cron jobs bypass RLS — will send cross-tenant emails on first run.** Both cron routes use the service role key which ignores all RLS policies. Every query on a tenant table must include `.eq('org_id', orgId)` explicitly. The fix requires refactoring `processReminders()` to accept `orgId` as a required parameter and having the cron route iterate over active organisations. This is not optional or deferrable — cross-tenant email delivery will occur on the first cron run after migration if this is not addressed. See `PITFALLS.md` Pitfall 1.

2. **RLS activated before JWT hook is verified will lock out all users immediately.** The hook must be deployed, tested (verify `org_id` present in `SELECT auth.jwt()` as an authenticated user), and confirmed working before dropping the old `USING (true)` policies. If the hook fails silently and RLS is activated, `(auth.jwt() ->> 'org_id')` returns NULL, every RLS check fails, and every user gets a 403. See `PITFALLS.md` Pitfall 2 / `ARCHITECTURE.md` Phase C.

3. **`user_metadata` vs `app_metadata` for org claims — a security invariant.** `user_metadata` is user-modifiable via the browser client SDK. An authenticated user can call `supabase.auth.updateUser({ data: { org_id: 'target-org' } })` to self-assign access to another tenant's data. All RLS policies and org claims must use `app_metadata`, which is only writable via the service role key. This must be correct from the first migration — it cannot be changed without rewriting all policies and re-issuing all user tokens. See `PITFALLS.md` Pitfall 7.

4. **Stripe webhook race — `subscription.created` fires before `checkout.session.completed`.** Stripe does not guarantee event ordering. Use `checkout.session.completed` as the sole provisioning trigger (upsert on `stripe_customer_id`). Implement idempotency via a `processed_webhook_events` table to prevent duplicate processing on Stripe retries. See `PITFALLS.md` Pitfall 4.

5. **Trial expiry not enforced if Stripe webhook delivery fails.** Defence in depth is required: store `trial_ends_at` at org creation time, check it in middleware regardless of webhook state, and add a daily fallback cron that marks `status = 'trial_expired'` for orgs where `trial_ends_at < now()` and no subscription exists. Webhook-only enforcement fails silently during Vercel deploys. See `PITFALLS.md` Pitfall 5.

---

## Implications for Roadmap

Research points to five phases. Dependencies flow from data model to billing to routing to onboarding/team management to operations. The ordering of the first three phases is non-negotiable — each is a prerequisite for the next.

### Phase 1: Org Data Model & RLS Foundation

**Rationale:** Every subsequent phase depends on correct tenant isolation. This phase creates the schema, backfills existing data, and activates RLS. It must be complete and verified before any new tenant is created. It is also the highest-risk phase — mistakes here (wrong JWT claim source, missing `org_id` on a table, `NOT NULL` before backfill) are silent and catastrophic.

**Delivers:** `organisations`, `user_organisations`, `invitations` tables; `org_id` column on all 16 tenant tables with NOT NULL constraint after backfill; Custom Access Token Hook deployed and verified; RLS policies active on all tables; `getCurrentOrg()` helper; all server actions updated to include `org_id` on inserts; `app_settings` restructured to composite `(org_id, key)` unique constraint; `locks` table keyed per org; first org's Postmark token seeded from env var.

**Addresses:** Tenant isolation, org creation (required by all other phases)

**Avoids:** Pitfalls 1 (cron cross-tenant), 2 (missing org_id on tables), 3 (NOT NULL on unfilled rows), 7 (user_metadata), 12 (app_settings shared across orgs), 13 (lock scoping), 15 (CSV import org_id null)

**Research flag:** Skip — architecture is fully documented with verified SQL in `ARCHITECTURE.md`. Three-phase migration pattern is ready to execute. JWT hook SQL and RLS templates are production-ready.

### Phase 2: Stripe Billing Integration

**Rationale:** Billing comes before subdomain routing and onboarding because it defines the org's subscription state (trialing, active, past_due, cancelled) that gates all access. The trial expiry check in middleware (Phase 3) reads `organisations.trial_ends_at` and `organisations.status`, which are populated here. Plan tier limits enforcement requires the plan tier stored on the org.

**Delivers:** Stripe checkout session creation via Server Action; `checkout.session.completed` webhook handler (provisions org subscription via upsert); `customer.subscription.updated` and `customer.subscription.deleted` handlers (sync status); `invoice.payment_failed` handler (dunning notification); `processed_webhook_events` idempotency table; billing management page showing plan, usage meters, renewal date; Stripe Customer Portal link; UK VAT via Stripe Tax; GB VAT number collection; daily trial-expiry fallback cron.

**Addresses:** Stripe subscription, plan limits, billing page, VAT compliance, trial logic

**Avoids:** Pitfalls 4 (webhook race — use checkout.session.completed as sole provisioning event), 5 (trial expiry webhook failure — `trial_ends_at` column + daily fallback cron), plus idempotency for all webhook events

**Research flag:** Skip — full Stripe integration patterns (webhook handler, checkout, billing portal, GBP/VAT, event list) are in `STACK.md` with verified code. All webhook handling strategies are documented in `STACK.md` and `PITFALLS.md`.

### Phase 3: Subdomain Routing & Access Gating

**Rationale:** Can be developed in parallel with Phase 2 (no shared code paths) but must be deployed before onboarding creates tenants with their own subdomains. Depends on `organisations.slug` (Phase 1). This phase also adds trial expiry and subscription status gating in middleware, which reads from Phase 1 schema and Phase 2 Stripe sync.

**Delivers:** Updated `middleware.ts` with subdomain detection and `x-org-slug` injection; `lib/org/current-org.ts` helper; org membership validation on login (prevent cross-tenant session use); trial expiry gate in middleware (redirect expired orgs to billing); Vercel wildcard domain configuration (`*.app.domain.com`); local dev bypass for `*.localhost`; Vercel preview environment bypass.

**Addresses:** Subdomain routing, login membership check, trial expiry gating, subscription-status gating

**Avoids:** Pitfalls 6 (cookie scope / wrong-tenant session), 14 (Vercel preview deployment breakage)

**Research flag:** Skip — Next.js middleware pattern with `NextResponse.rewrite()` and `x-org-slug` header injection is fully documented in `ARCHITECTURE.md` Section 2. Vercel nameserver requirement for wildcard SSL is documented in `STACK.md`.

### Phase 4: Onboarding Flow & Team Management

**Rationale:** Requires Phases 1, 2, and 3 all live. The onboarding wizard creates the `organisation` record, starts the Stripe trial, and routes to the tenant subdomain. Team invites require the `invitations` table (Phase 1), Postmark sending (Phase 1 token migration), and role enforcement (Phase 1 `user_organisations`).

**Delivers:** 4-step onboarding wizard (Account, Firm Details, Plan, Trial Started); org slug generation and reservation; invited user onboarding flow (separate from full wizard — no plan selection); team invite by email with 72-hour expiry and single-use enforcement; Admin/Member role enforcement in UI; pending invite list; org settings page (firm name, timezone, Postmark configuration entry).

**Addresses:** Onboarding, team invites, RBAC, org settings

**Avoids:** Pitfall 8 (invite token replay — 72h expiry, single-use, email-matched acceptance), Pitfall 10 (Postmark null token — validate before processing any org's emails)

**Research flag:** Skip for invite flow and wizard structure (well-documented patterns in `FEATURES.md` with step-by-step UX detail). The Postmark provisioning model for new tenants (Option A: org admin enters their own token; Option B: Peninsula creates programmatically; Option C: shared account with per-org senders) must be resolved before this phase is planned — see Open Questions.

### Phase 5: Super-Admin Panel

**Rationale:** Internal tooling; no external customer dependency. Can be built after the platform accepts tenants. Reads from `organisations` table via service role (bypasses RLS), so depends only on Phase 1 schema for basic functionality; full subscription status display depends on Phase 2 webhook sync being live.

**Delivers:** Tenant list with plan tier, subscription status, client/user counts, signup date; filter by plan and subscription status (especially `past_due`); search by org name; link to Stripe dashboard per customer (via `stripe_customer_id`); super-admin access gate enforced via `app_metadata.is_super_admin`.

**Addresses:** Internal tenant visibility, subscription monitoring

**Avoids:** Pitfall 9 (super-admin accessible to org users — must use `app_metadata.is_super_admin`, not `user_metadata`)

**Research flag:** Skip — simple read-only dashboard using service role queries. All patterns are documented. Super-admin role check via `app_metadata` is described in `PITFALLS.md` Pitfall 9.

### Phase Ordering Rationale

- Phase 1 must be first: every other phase reads `org_id` from the schema and JWT. Activating RLS before the hook is verified is the single largest risk of the entire milestone.
- Phase 2 before Phase 4: the onboarding wizard creates a Stripe subscription at the plan selection step. Phase 2 must be live before the onboarding wizard is functional end-to-end.
- Phase 3 can run in parallel with Phase 2: no shared code paths. Both must be deployed before Phase 4.
- Phase 4 requires Phases 1, 2, and 3 all deployed and verified.
- Phase 5 can begin any time after Phase 1 is merged; full subscription status functionality requires Phase 2.

### Research Flags

**Phases needing deeper research during planning:** None identified. All five phases have well-documented, officially-sourced patterns. The research files contain ready-to-implement SQL, TypeScript, and configuration.

**Standard patterns (skip research-phase for all phases):** All patterns are fully specified in `ARCHITECTURE.md`, `STACK.md`, and `PITFALLS.md` with verified code from official Supabase, Stripe, Next.js, and Vercel documentation.

---

## Critical Risks Requiring Immediate Attention

These three risks must be resolved in Phase 1 before any other work. They cannot be retrofitted safely.

**Risk 1: JWT claim source — must use `app_metadata`, not `user_metadata`.**
This is an architectural invariant that must be documented and enforced before Phase 1 migration SQL is written. Changing this after RLS is activated requires updating every RLS policy, every server action, and re-issuing tokens for all users. The `ARCHITECTURE.md` hook SQL correctly uses `app_metadata`; verify this matches the actual migration SQL before execution.

**Risk 2: Cron job org_id filters must be deployed before or simultaneously with RLS activation.**
The build order (`ARCHITECTURE.md` Step 7) says cron rewrites should be done "before or alongside" RLS activation. In practice, cron rewrites should be deployed and verified before Phase C (RLS activation) is run. Any deployment window where RLS is active but crons lack `org_id` filters is catastrophic: cross-tenant reminder emails with no error raised.

**Risk 3: Postmark token migration for the founding org.**
The founding org must have its `postmark_server_token` and `postmark_sender_domain` populated from the env vars before the cron is switched to per-org token mode. The one-time seed script is in `ARCHITECTURE.md` Section 5. If this step is missed, the founding org's reminder emails silently fail with Postmark 401 errors — `email_log` will show failures but no alert fires.

---

## Open Questions to Resolve During Planning

These are decision points the research identified but did not resolve. Each requires product or business input before the relevant phase can be planned.

| Question | Relevant Phase | Recommendation |
|----------|---------------|----------------|
| What are the exact `plan_tier` enum values in the database? The architecture SQL uses `('starter', 'pro', 'enterprise')` as placeholders, but confirmed tiers are Lite, Sole Trader, Practice, Firm. | Phase 1 | Use `('lite', 'sole_trader', 'practice', 'firm')` — confirm before writing migration SQL |
| Is Peninsula VAT-registered? This determines whether plan prices (£20/39/89/£159) are defined VAT-exclusive in Stripe with Stripe Tax adding 20%, or VAT-inclusive. | Phase 2 | Define VAT-exclusive in Stripe if VAT-registered; configure Stripe Tax for automatic calculation. Business decision required. |
| What is the slug format and reserved slug list? Slugs like `admin`, `www`, `api`, `app`, `billing` must be blocked from org registration. | Phase 1 + Phase 4 | Lowercase alphanumeric + hyphens, max 32 chars; define reservation list in application code before onboarding wizard is built |
| Where do per-org Postmark server tokens come from for new tenants? Options: (a) org admin enters their own Postmark token in settings, (b) Peninsula creates a Postmark server per org programmatically via Postmark Management API, (c) all orgs share one Peninsula Postmark account with per-org sender signatures. | Phase 4 | This determines the onboarding wizard's email setup step scope. Resolve before Phase 4 planning. |
| Will the trial conversion email sequence (Day 0, 3, 10, 13, 14) be in v3.0 or v3.x? | Phase 4 | Deferred to v3.x per `FEATURES.md`. Scaffold Postmark template IDs and trigger points in Phase 4 to avoid a full second pass. |
| What is the data retention policy for cancelled orgs (duration before deletion)? | Phase 5 | `FEATURES.md` mentions 30 days. If confirmed, a deletion cron must be designed — add to Phase 5 scope. Legal/product decision required. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against npm registry (Feb 2026); Stripe patterns verified against Stripe official docs; Supabase hook pattern verified against Supabase official docs; Next.js middleware verified against official docs. One new package only (`stripe@^20.3.1`). |
| Features | HIGH | Table stakes and UK requirements (VAT, SCA/3DS2, GBP, GB VAT number) verified against Stripe and HMRC docs. Conversion benchmarks (18-25% no-card trial conversion) are MEDIUM confidence — multiple corroborating 2025 sources. Competitor analysis is MEDIUM — based on publicly available pricing/feature pages for Karbon, TaxDome, Pixie, Cone. |
| Architecture | HIGH | All core patterns from official documentation: Supabase Custom Access Token Hook, Supabase RLS performance guide, Next.js multi-tenant guide, Vercel Platforms reference implementation. Migration SQL is based on standard Postgres expand/backfill/contract patterns with production-tested batching. |
| Pitfalls | HIGH | All 10 critical pitfalls are grounded in the actual codebase (specific file paths cited) and verified against official documentation. Not theoretical — traced to real code paths that will break in multi-tenant mode. |

**Overall confidence: HIGH**

### Gaps to Address

- **Plan tier enum values in migration SQL:** Placeholder values in research SQL must be replaced with confirmed values before Phase 1 migration file is written. Resolve immediately.
- **Postmark provisioning model for new tenants:** Not resolved in research. Affects onboarding wizard scope in Phase 4. Resolve before Phase 4 planning begins.
- **VAT treatment on plan prices:** Business decision needed before Stripe products are created in the Dashboard. Does not block Phase 1 or Phase 3, but must be resolved before Phase 2 Stripe configuration.
- **Slug reservation list:** Define before onboarding wizard allows slug selection in Phase 4. Low effort — produce the list at the start of Phase 4 planning.

---

## Sources

### Primary (HIGH confidence — official documentation)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Custom Claims and RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant)
- [Vercel Platforms reference implementation](https://github.com/vercel/platforms)
- [Vercel multi-tenant domain management](https://vercel.com/docs/multi-tenant/domain-management)
- [Stripe build subscriptions guide](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- [Stripe webhooks for subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature)
- [Stripe Customer Portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Stripe Collect tax in the United Kingdom](https://docs.stripe.com/tax/supported-countries/europe/united-kingdom)
- [Stripe Customer Tax IDs](https://docs.stripe.com/billing/customer/tax-ids)
- [stripe npm package v20.3.1](https://www.npmjs.com/package/stripe) — verified Feb 2026
- [Supabase Service Role and RLS](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)

### Secondary (MEDIUM confidence — multiple corroborating sources)
- UK competitor analysis: Karbon, TaxDome, Pixie, Cone, Accountancy Manager pricing/feature pages
- Free trial conversion benchmarks: 1capture.io, First Page Sage (2025 benchmarks)
- Upgrade prompt conversion data: Mixpanel/Appcues research (2025)
- Soft-limit SaaS upsell research: 10Duke.com
- UK VAT on SaaS: Sprintlaw UK, vatcalc.com, vatupdate.com
- UK HMRC mandatory e-invoicing 2029: vatcalc.com, vatupdate.com
- Stripe webhook race condition: excessivecoding.com (cited in PITFALLS.md)

---

*Research completed: 2026-02-19*
*Ready for roadmap: yes*
