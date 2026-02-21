# Phase 12: Subdomain Routing & Access Gating - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Each org's dashboard is served at its own subdomain (`{slug}.app.phasetwo.uk`); middleware enforces org membership and subscription status; orgs without Postmark credentials are skipped in email delivery; per-org Postmark token and sender domain are configured by the admin in settings. Does NOT include: onboarding flow (Phase 13), team management (Phase 13), super-admin views (Phase 14), or multi-org switching (deferred).

</domain>

<decisions>
## Implementation Decisions

### Subdomain structure & fallback
- Pattern: `{slug}.app.phasetwo.uk` — org slug as subdomain under `app.phasetwo.uk`
- Bare `app.phasetwo.uk` (no slug) → redirect to marketing site (`phasetwo.uk`)
- Unknown/invalid subdomain slug → redirect to marketing site (same behavior as bare domain)
- Local dev: query parameter fallback (`?org=acme` on localhost), subdomains in production only

### Access denial & org identity
- Authenticated user on wrong org's subdomain → silently redirect to their own org's subdomain
- Unauthenticated user on valid org subdomain → generic login page (not org-branded), redirect to org dashboard after auth
- Multi-org users: not supported in this phase — users belong to one org only. Defer multi-org switching
- Org name displayed in header, to the right of the PhaseTwo logo

### Middleware enforcement
- Middleware reads subscription status from JWT claims (no DB call per request) — fast path
- Middleware also verifies JWT `org_id` matches the subdomain's org — defense in depth on top of RLS
- Mismatch → redirect to user's own org subdomain
- Read-only mode: Phase 11's existing dashboard banner and server action blocking are sufficient — no additional route-level interstitials needed from middleware

### Per-org Postmark setup
- Admin enters Postmark server token and sender domain manually in settings page
- New section on existing settings page for email configuration
- Token validated on save — test API call to Postmark, show success/error feedback
- Missing Postmark token at cron time → skip that org's emails with warning log (no fallback to platform token)

### Claude's Discretion
- Middleware implementation approach (Next.js middleware vs server component checks)
- Slug resolution strategy (DB lookup vs cached mapping)
- Settings page layout for Postmark section
- Exact redirect URLs and status codes
- Warning log format and destination

</decisions>

<specifics>
## Specific Ideas

- Product is **PhaseTwo** (`phasetwo.uk`), not Peninsula Accounting — Peninsula Accounting is a client/accountant
- Read-only mode enforcement already implemented in Phase 11 (11-05) — dashboard banner + server action guards. Phase 12 middleware just needs to pass through subscription status, not re-implement blocking
- JWT already contains `org_id` and `org_role` from Phase 10's Custom Access Token Hook — reuse these claims in middleware
- `organisations` table already has `slug`, `postmark_server_token`, and `postmark_sender_domain` columns from Phase 10

</specifics>

<deferred>
## Deferred Ideas

- Multi-org switching (user belongs to multiple orgs) — future phase
- Org-branded login page (show org logo/name on login) — future enhancement
- Auto-provisioned Postmark servers via API — future enhancement (currently manual token entry)

</deferred>

---

*Phase: 12-subdomain-routing-access-gating*
*Context gathered: 2026-02-21*
