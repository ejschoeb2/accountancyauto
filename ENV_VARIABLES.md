# Environment Variables Reference

This document explains every variable in `.env.local`, where it is used in the codebase, and what it represents architecturally. It is intended to:

1. Give a clear picture of all external service connections
2. Serve as a reference for moving to a multi-tenant architecture in the future

---

## Architecture Overview

The application connects to three external services. Each has its own set of variables:

```
┌─────────────────────────────────────────────────────────────┐
│                    Peninsula Accounting                      │
│                     (Next.js on Vercel)                      │
└──────────────┬────────────────┬────────────────┬────────────┘
               │                │                │
       ┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
       │   Supabase   │  │  Postmark   │  │  Vercel    │
       │  (Database + │  │  (Email     │  │  (Hosting) │
       │    Auth)     │  │  Delivery)  │  │            │
       └──────────────┘  └─────────────┘  └────────────┘
```

**Per-client (tenant) variables** are the ones that would need to change when the system is deployed for a different accounting firm. These are marked with `[TENANT]` below.

---

## Supabase Variables

Supabase provides the database, authentication, and row-level security for the application.

### `NEXT_PUBLIC_SUPABASE_URL` `[TENANT]`

```
NEXT_PUBLIC_SUPABASE_URL=https://zmsirxtgmdbbdxgxlato.supabase.co
```

**What it is:** The URL of the Supabase project. Each Supabase project gets a unique URL in the format `https://<project-ref>.supabase.co`.

**Used in:** All Supabase clients — `lib/supabase/client.ts`, `server.ts`, `middleware.ts`, `service.ts`, `admin.ts` — and in scripts.

**How to get it:** Supabase Dashboard → Project Settings → API → Project URL.

**Multi-tenant note:** Each tenant would need their own Supabase project (separate database, separate auth). This variable would change per tenant.

---

### `NEXT_PUBLIC_SUPABASE_ANON_KEY` `[TENANT]`

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**What it is:** A JWT that identifies this app to Supabase for client-side and server-side read operations. It is safe to expose publicly. Row-Level Security (RLS) policies control what data it can access.

**Used in:** `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server components), `lib/supabase/middleware.ts` (auth session refresh).

**How to get it:** Supabase Dashboard → Project Settings → API → `anon` `public` key.

**Multi-tenant note:** Unique per Supabase project, so changes per tenant.

---

### `SUPABASE_SERVICE_ROLE_KEY` `[TENANT]`

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**What it is:** A JWT with full admin access to the Supabase database, bypassing all RLS policies. **Must never be exposed to the browser or committed to source control.**

**Used in:**
- `lib/supabase/service.ts` — used in the Postmark inbound webhook handler to write emails without an authenticated user session
- `lib/supabase/admin.ts` — used for admin-level operations
- `scripts/` — used in seed and migration scripts run locally

**How to get it:** Supabase Dashboard → Project Settings → API → `service_role` key.

**Multi-tenant note:** Unique per Supabase project. Handle with extreme care — this key has full unrestricted database access.

---

## App Variables

### `NEXT_PUBLIC_APP_URL` `[TENANT]`

```
NEXT_PUBLIC_APP_URL=https://accountancyauto.vercel.app
# Local: http://localhost:3000
```

**What it is:** The publicly accessible URL of the deployed Next.js application.

**Used in:**
- `app/(auth)/login/actions.ts` — constructs the OAuth callback redirect URL for Supabase Auth
- `lib/email/sender.ts` — appended to unsubscribe links in outbound emails
- `lib/email/templates/reminder.tsx` — used in email template footers

**Multi-tenant note:** Each tenant would have their own Vercel deployment URL (or custom domain). This variable ensures links in emails point to the correct tenant's app.

---

### `NEXT_PUBLIC_IS_DEMO`

```
NEXT_PUBLIC_IS_DEMO=false
# Set to "true" to enable demo mode
```

**What it is:** A feature flag that enables demo mode. When `true`, the login page shows a demo login button and no real emails are sent.

**Used in:** `app/page.tsx`, `app/(auth)/login/page.tsx`.

**Multi-tenant note:** This is a deployment-level flag, not tenant-specific. Would typically be `false` in all production deployments.

---

## Postmark Variables

Postmark handles both outbound (reminder emails to clients) and inbound (client replies).

### `POSTMARK_SERVER_TOKEN` `[TENANT]`

```
POSTMARK_SERVER_TOKEN=3c43839b-...
```

**What it is:** The API token for a specific Postmark **server**. A Postmark server is a logical grouping that has its own sending domain, sender signatures, and message streams. This token authenticates all API calls to send emails.

**Used in:** `lib/email/client.ts` — creates the Postmark SDK client used by the email sender.

**How to get it:** Postmark → Servers → [Your Server] → API Tokens → Server API Token.

**Multi-tenant note:** This is the most critical Postmark variable. Each tenant needs their own Postmark server (and thus their own token) so that:
- Emails come from their own domain
- Their sending reputation is isolated
- Their email history and analytics are separate

---

### `POSTMARK_SENDER_DOMAIN` `[TENANT]`

```
POSTMARK_SENDER_DOMAIN=phasetwo.uk
```

**What it is:** The domain used for outbound sender email addresses (e.g. `reminders@phasetwo.uk`). This must match a domain that has an active **Sender Signature** verified in the Postmark server above.

**Used in:** `app/(dashboard)/settings/page.tsx` — passed to the Email Settings card to lock the `@domain` portion of the sender address, preventing users from setting an unverified domain.

**How to get it:** Set this to whatever domain you have verified as a Sender Signature in the Postmark server. Postmark → Servers → [Your Server] → Sender Signatures.

**Multi-tenant note:** Each tenant would have their own domain and Sender Signature. This variable ensures the settings UI only allows sender addresses on the correct domain for that tenant.

---

### `POSTMARK_WEBHOOK_SECRET` `[TENANT]`

```
POSTMARK_WEBHOOK_SECRET=b7b131...
```

**What it is:** A secret token appended as a query parameter to the Postmark inbound webhook URL. When Postmark POSTs an inbound email to the app, this token is verified to ensure the request is genuine and not spoofed.

**Used in:** `app/api/postmark/inbound/route.ts` — checked on both POST and GET requests to the webhook endpoint.

**Webhook URL format:**
```
https://<app-url>/api/postmark/inbound?token=<POSTMARK_WEBHOOK_SECRET>
```

**How to get it:** Generate any long random string. You can use:
```bash
openssl rand -hex 64
```

**Multi-tenant note:** Each tenant deployment should have its own unique secret. This prevents one tenant's Postmark server from sending data to another tenant's webhook.

---

### `ACCOUNTANT_EMAIL` `[TENANT]`

```
ACCOUNTANT_EMAIL=ethan@phasetwo.uk
```

**What it is:** The accountant's personal email address. Currently validated in the env schema but used sparingly — intended for system-level notifications or alerts (e.g. if a cron job fails).

**Used in:** `lib/validations/env.ts` (schema validation only). Reserved for future use in error/alert notifications.

**Multi-tenant note:** This would be the primary accountant's email for each tenant.

---

## Cron Variables

### `CRON_SECRET` `[TENANT]`

```
CRON_SECRET=46233b25...
```

**What it is:** A bearer token that secures the cron job API endpoints. The cron scheduler (configured separately in `vercel.json` or an external service) must include this token in the `Authorization` header when calling the cron routes.

**Used in:**
- `app/api/cron/send-emails/route.ts` — verifies `Authorization: Bearer <CRON_SECRET>` before sending queued emails
- `app/api/cron/reminders/route.ts` — same verification before processing reminders

**Cron call format:**
```
GET /api/cron/send-emails
Authorization: Bearer <CRON_SECRET>
```

**How to get it:** Generate any long random string:
```bash
openssl rand -hex 32
```

**Multi-tenant note:** Each tenant deployment needs a unique cron secret. In a multi-tenant architecture, the cron scheduler would need to be configured per tenant, each with their own secret.

---

## Multi-Tenant Migration Summary

When deploying for a new accounting firm, the following variables would change. Everything else (app code, database schema) stays the same.

| Variable | Changes Per Tenant | Reason |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Separate database per tenant |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Tied to Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Tied to Supabase project |
| `NEXT_PUBLIC_APP_URL` | ✅ Yes | Each tenant has their own deployment URL |
| `POSTMARK_SERVER_TOKEN` | ✅ Yes | Each tenant sends from their own domain |
| `POSTMARK_SENDER_DOMAIN` | ✅ Yes | Each tenant's verified sending domain |
| `POSTMARK_WEBHOOK_SECRET` | ✅ Yes | Isolate inbound data per tenant |
| `ACCOUNTANT_EMAIL` | ✅ Yes | Each tenant has a different accountant |
| `CRON_SECRET` | ✅ Yes | Secure cron endpoints per deployment |
| `NEXT_PUBLIC_IS_DEMO` | ❌ No | Always `false` in production |

### Future Architecture Path

The current model is **one deployment per tenant** (simple, isolated, no shared infrastructure risk). This approach:
- Is easy to manage for a small number of clients
- Keeps data fully isolated (each tenant has a separate Supabase project)
- Scales poorly beyond ~10-20 tenants due to management overhead

When scaling, the path would be:
1. **Centralised database with tenant isolation** — single Supabase project, all tables gain a `tenant_id` column, RLS policies filter by tenant
2. **Centralised Postmark** — one Postmark account, multiple servers (one per client domain), token stored in the `app_settings` table per tenant
3. **Single deployment** — `NEXT_PUBLIC_APP_URL` becomes `https://app.yoursaas.com`, tenants access via subdomain or path routing

The variables marked `[TENANT]` above are exactly what would move from `.env` files into the database when taking that centralised path.
