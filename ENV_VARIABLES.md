# Environment Variables Reference

This document explains every variable in `.env.local`, where it is used in the codebase, and what it represents architecturally. It is intended to:

1. Give a clear picture of all external service connections
2. Serve as a reference for moving to a multi-tenant architecture in the future

---

## Architecture Overview

The application connects to three external services. Each has its own set of variables:

```
┌─────────────────────────────────────────────────────────────┐
│                    Prompt                      │
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

### `SUPABASE_STORAGE_BUCKET_DOCUMENTS`

```
SUPABASE_STORAGE_BUCKET_DOCUMENTS=prompt-documents
```

**What it is:** The name of the private Supabase Storage bucket used to store uploaded client financial documents (tax certificates, accounts, HMRC records, etc.). The bucket must be created manually in the Supabase Dashboard before first use — it cannot be created via SQL migration.

**Default:** `prompt-documents` (hardcoded fallback in `lib/documents/storage.ts`). If this variable is not set, the application will use `prompt-documents` automatically.

**Used in:** `lib/documents/storage.ts` — all three storage utilities (`uploadDocument`, `getSignedDownloadUrl`, `deleteDocument`) read this variable at module level.

**How to get it / set it up:**
1. Open the Supabase Dashboard for your project
2. Navigate to **Storage** → **New bucket**
3. Name the bucket `prompt-documents`
4. Set access to **Private** (do NOT set Public)
5. Confirm the bucket is created in the correct region (EU West for UK data residency)
6. Set this variable to `prompt-documents` (or your chosen bucket name)

**Required:** Optional — falls back to `'prompt-documents'` if not set. Recommended to set explicitly so the bucket name is visible in your environment configuration.

**Multi-tenant note:** All tenants using the same Supabase project share one bucket. Documents are isolated by the path prefix `orgs/{org_id}/...` and by org-scoped RLS policies on `storage.objects`.

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

### `POSTMARK_ACCOUNT_TOKEN`

```
POSTMARK_ACCOUNT_TOKEN=<your-postmark-account-api-token>
```

**What it is:** The account-level Postmark API token. Used by `lib/postmark/management.ts` to create Postmark Servers and Domains for new organisations via the Postmark Management API during the Email Setup wizard step.

**Used in:** `lib/postmark/management.ts` — `createOrgServer()`, `createOrgDomain()`, `checkDomainVerification()`.

**How to get it:** Postmark → Account → API Tokens → Account API Token.

**Security:** Never expose to the browser or commit to source control. This token has account-level access to create and manage all servers and domains in your Postmark account.

**Required:** Yes — if missing, the Email Setup wizard step will fail with an error. Not needed at build time; only accessed at runtime when an admin completes the wizard.

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

---

## Stripe Variables

Stripe handles subscription billing for paid plans (Starter, Practice).

### `STRIPE_SECRET_KEY`

```
STRIPE_SECRET_KEY=sk_live_...
# Test: sk_test_...
```

**What it is:** The Stripe secret API key used server-side to create checkout sessions, handle webhooks, and manage subscriptions.

**Used in:** `lib/stripe/client.ts` — lazy-initialised Stripe SDK instance.

---

### `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**What it is:** The Stripe publishable key for client-side use.

---

### `STRIPE_WEBHOOK_SECRET`

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

**What it is:** The webhook signing secret used to verify Stripe webhook payloads.

**Used in:** `app/api/stripe/webhook/route.ts`.

---

### `STRIPE_PRICE_STARTER`

```
STRIPE_PRICE_STARTER=price_...
```

**What it is:** The Stripe Price ID for the **Starter** plan (£39/mo, up to 100 clients).

**Previously named:** `STRIPE_PRICE_SOLE_TRADER` — renamed when the tier was renamed from Sole Trader → Starter. Update your `.env.local` and Vercel environment accordingly.

**Used in:** `lib/stripe/plans.ts` — `PLAN_TIERS.starter.priceId`.

---

### `STRIPE_PRICE_PRACTICE`

```
STRIPE_PRICE_PRACTICE=price_...
```

**What it is:** The Stripe Price ID for the **Practice** plan (£89/mo base, unlimited clients with metered overage above 300). The base price covers the flat monthly charge; overage is billed separately via `STRIPE_PRICE_PRACTICE_OVERAGE`.

**Used in:** `lib/stripe/plans.ts` — `PLAN_TIERS.practice.priceId`.

---

### `STRIPE_PRICE_PRACTICE_OVERAGE`

```
STRIPE_PRICE_PRACTICE_OVERAGE=price_...
```

**What it is:** Stripe metered Price ID for Practice overage billing (£0.60/client above 300). Only used when a Practice tier subscription is created — added as a second line item alongside the base Practice price to enable usage-based billing for high-volume practices.

**Used in:** `lib/stripe/plans.ts` / `app/api/stripe/create-checkout-session/route.ts` — wired in Plan 03 (metered billing). Not yet active.

**How to get it:** Stripe Dashboard → Products → Create a new usage-based Price attached to the Practice product. Set billing scheme to "Per unit" with a unit amount of 60 (pence), and aggregation as "Sum of usage during period".

**Source:** Stripe Dashboard > Products.

---

### `STRIPE_TAX_ENABLED`

```
STRIPE_TAX_ENABLED=false
# Set to "true" to enable Stripe Tax automatic VAT collection
```

**What it is:** Feature flag to enable Stripe Tax for automatic VAT calculation at checkout.

**Used in:** `app/api/stripe/create-checkout-session/route.ts`.

---

---

## Cryptography Variables

### `ENCRYPTION_KEY`

```
ENCRYPTION_KEY=<64-character-hex-string>
```

**What it is:** A 32-byte (256-bit) symmetric encryption key, hex-encoded as a 64-character string. Used by `lib/crypto/tokens.ts` to encrypt and decrypt OAuth refresh tokens and access tokens before they are stored in the database.

**Format:** Must be exactly 64 hexadecimal characters (0–9, a–f). Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Used in:** `lib/crypto/tokens.ts` — `encryptToken()` and `decryptToken()` functions only. No other module reads this variable.

**Security requirements:**
- MUST NOT be stored in Supabase (not in `app_settings` or any database table)
- MUST NOT be committed to source control
- Store only in Vercel environment variables (encrypted at rest by Vercel)
- If rotated: all existing `_enc` columns must be re-encrypted before the old key is discarded

**Required:** Yes (at runtime) — `lib/crypto/tokens.ts` throws at call time if absent or wrong length. Absence does not crash the build (lazy validation), but any token encrypt/decrypt operation will fail at runtime with a clear error message.

**First used:** Phase 25 (Google Drive OAuth token storage). Phase 24 creates the module but has no callers yet.

---

## Google Drive Integration Variables

These variables are required for the Google Drive storage backend introduced in Phase 25. They are only needed at runtime when an accountant connects Google Drive from the Settings page; the application builds and runs (with Supabase storage only) without them.

### `GOOGLE_CLIENT_ID`

```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

**What it is:** OAuth2 client ID for the Google Cloud application that represents Prompt in the Google ecosystem.

**Format:** Alphanumeric string ending in `.apps.googleusercontent.com` (e.g. `123456789-abc123.apps.googleusercontent.com`).

**Source:** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID

**Required for:**
- `app/api/auth/google-drive/connect/route.ts` — generates the OAuth2 authorization URL
- `app/api/auth/google-drive/callback/route.ts` — exchanges the authorization code for tokens
- `lib/storage/token-refresh.ts` — constructs the OAuth2Client for proactive token refresh

**Environment:** Production + Preview (Vercel)

**Security:** Never store in Supabase or source control. Treat with care — exposure allows creating auth URLs that impersonate Prompt.

---

### `GOOGLE_CLIENT_SECRET`

```
GOOGLE_CLIENT_SECRET=<24-character-alphanumeric-string>
```

**What it is:** OAuth2 client secret paired with `GOOGLE_CLIENT_ID`. Required for all server-side token operations (code exchange, token refresh).

**Format:** Alphanumeric string, approximately 24 characters.

**Source:** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (shown once at creation; if lost, create a new client secret from the same credential)

**Required for:** Same as `GOOGLE_CLIENT_ID` — all three OAuth2 route files and the token refresh utility.

**Environment:** Production only (Vercel)

**Security:** Never store in Supabase or source control. Treat as a password — full access to the OAuth2 app if exposed.

---

### `GOOGLE_REDIRECT_URI`

```
GOOGLE_REDIRECT_URI=https://{app-domain}/api/auth/google-drive/callback
# Example: https://app.getprompt.app/api/auth/google-drive/callback
# Local dev: http://localhost:3000/api/auth/google-drive/callback
```

**What it is:** The OAuth2 callback URL. Google redirects the accountant back to this URL after they approve access. **Must exactly match** an Authorized Redirect URI configured in the GCP OAuth 2.0 Client.

**Format:** `https://{app-domain}/api/auth/google-drive/callback`

**Required for:**
- `app/api/auth/google-drive/connect/route.ts` — embedded in the authorization URL so Google knows where to redirect
- `app/api/auth/google-drive/callback/route.ts` — passed to the token exchange call (must match exactly)

**Environment:** Production + Preview (different values per environment)

**Note:** For local development, add `http://localhost:3000/api/auth/google-drive/callback` as an additional Authorized Redirect URI in the GCP OAuth client. The GCP client allows multiple redirect URIs — add both production and localhost so developers can test the flow locally.

**Setup:** Google Cloud Console → APIs & Services → Credentials → [Your OAuth 2.0 Client ID] → Authorized redirect URIs

---

---

## Dropbox Integration Variables

These variables are required for the Dropbox storage backend introduced in Phase 27. They are only needed at runtime when an accountant connects Dropbox from the Settings page; the application builds and runs (with Supabase storage only) without them.

### `DROPBOX_APP_KEY`

```
DROPBOX_APP_KEY=<alphanumeric-app-key>
```

**What it is:** App key for Dropbox OAuth2 integration. Identifies the Prompt application to Dropbox.

**Format:** Alphanumeric string (e.g. `abc123def456`).

**Source:** Dropbox App Console → Settings → App key

**Required for:**
- `app/api/auth/dropbox/connect/route.ts` — generates the Dropbox authorization URL
- `app/api/auth/dropbox/callback/route.ts` — token exchange requires clientId
- `lib/storage/dropbox.ts` — DropboxAuth constructor for token refresh

**Environment:** Production + Preview (Vercel)

**Security:** Never store in Supabase or source control. Exposure allows creating auth URLs that impersonate Prompt.

---

### `DROPBOX_APP_SECRET`

```
DROPBOX_APP_SECRET=<alphanumeric-app-secret>
```

**What it is:** App secret paired with `DROPBOX_APP_KEY`. Required for server-side token exchange and refresh operations.

**Format:** Alphanumeric string.

**Source:** Dropbox App Console → Settings → App secret (shown once at creation; rotate if lost)

**Required for:**
- `app/api/auth/dropbox/callback/route.ts` — token exchange requires clientSecret
- `lib/storage/dropbox.ts` — DropboxAuth constructor for automatic token refresh

**Environment:** Production only (Vercel)

**Security:** Never store in Supabase or source control. Treat as a password — full OAuth2 app access if exposed.

---

### `DROPBOX_REDIRECT_URI`

```
DROPBOX_REDIRECT_URI=https://{app-domain}/api/auth/dropbox/callback
# Example: https://app.getprompt.app/api/auth/dropbox/callback
# Local dev: http://localhost:3000/api/auth/dropbox/callback
```

**What it is:** OAuth2 callback URL. Dropbox redirects the accountant back to this URL after they approve access. **Must exactly match** a Redirect URI configured in the Dropbox App Console.

**Format:** `https://{app-domain}/api/auth/dropbox/callback`

**Required for:**
- `app/api/auth/dropbox/connect/route.ts` — embedded in the authorization URL so Dropbox knows where to redirect
- `app/api/auth/dropbox/callback/route.ts` — passed to the token exchange call (must match exactly)

**Environment:** Production + Preview (different values per environment)

**Note:** For local development, add `http://localhost:3000/api/auth/dropbox/callback` as an additional Redirect URI in the Dropbox App Console (Settings → OAuth 2 → Redirect URIs). The Dropbox App Console allows multiple redirect URIs.

**Setup:** Dropbox App Console → Settings → OAuth 2 → Redirect URIs

---

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
