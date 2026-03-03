# QA Edge Case Checklist

Edge cases not covered by the UI-focused QA task lists in `QA_TASK_LISTS.md`. These target backend logic, race conditions, security boundaries, and data integrity.

**Priority order:** Start with CRITICAL/HIGH items marked with a star.

---

## Security Boundaries

| # | Check | Severity | Status |
|---|---|---|---|
| S1 | **Unsubscribe endpoint is unauthenticated** — Visit `/api/unsubscribe?client_id=<any-uuid>`. Can you pause reminders for any client without auth? The client_id is embedded in every outgoing email. | HIGH | ⬜ |
| S2 | **`/api/run-migration` has no auth** — Send a POST to `/api/run-migration`. Does it execute without any authentication? This is a dev escape hatch left in production. | CRITICAL | ⬜ |
| S3 | **Portal token reuse within expiry window** — Generate a portal link, upload a doc, then try uploading again with the same token. The `used_at` update is fire-and-forget — multiple uploads are allowed. Is this intended? | MEDIUM | ⬜ |
| S4 | **OAuth CSRF cookie policy** — When connecting Google Drive/OneDrive/Dropbox, check if the `google_oauth_state` cookie is set with `SameSite=Strict`. If not, the OAuth callback is vulnerable to CSRF. | MEDIUM | ⬜ |
| S5 | **Admin page access without super_admin** — Log in as a regular org member (not admin). Navigate directly to `/admin`. Does the page load? The middleware doesn't enforce this — only a page-level guard does. | HIGH | ⬜ |
| S6 | **Rebuild queue by non-admin member** — As a non-admin org member, POST to `/api/reminders/rebuild-queue`. Any org member can trigger a full queue rebuild — is that intended? | LOW | ⬜ |

---

## Race Conditions & Concurrency

| # | Check | Severity | Status |
|---|---|---|---|
| R1 | **Double invite acceptance** — Open the same invite link in two browser tabs simultaneously. Click "Accept" in both at the same time. Does the user get added to the org twice? Are duplicate `user_organisations` rows created? | HIGH | ⬜ |
| R2 | **Double org creation in wizard** — Open the wizard completion step in two tabs. Submit both simultaneously. Do two orgs get created for the same user? | MEDIUM | ⬜ |
| R3 | **Cron lock contention** — If `/api/cron/send-emails` is triggered twice rapidly (Vercel can fire duplicates), both may pass the lock check before either completes the insert. Could emails be sent twice? | MEDIUM | ⬜ |
| R4 | **Stripe webhook failure silently drops events** — If the webhook handler throws after marking an event as processed, the event is permanently skipped (returns 200, UNIQUE constraint prevents retry). Test: what happens if the DB update fails mid-webhook? | HIGH | ⬜ |

---

## Subscription & Billing Enforcement

| # | Check | Severity | Status |
|---|---|---|---|
| B1 | **API route mutations bypass subscription check** — With a `cancelled`/`unpaid` subscription, use browser DevTools to POST directly to `/api/clients` (create a client) or `/api/schedules`. The middleware allows all `/api/` routes through regardless of subscription status. Only server actions call `requireWriteAccess()`. | HIGH | ⬜ |
| B2 | **Free plan client limit bypass via API** — On a free plan (25 client limit), try creating client #26 via direct POST to `/api/clients` instead of through the UI. The limit check only runs in server actions, not API route handlers. | HIGH | ⬜ |
| B3 | **Trial-to-unpaid transition** — Let a trial expire. Does the cron correctly transition `trialing` → `unpaid`? Does the middleware then block access and redirect to `/billing`? | MEDIUM | ⬜ |
| B4 | **Trial reminder double-send** — If the `trial_reminder_sent` flag write fails after the email sends, the next cron run sends another email. Hard to reproduce but check the flag write is atomic with the send. | LOW | ⬜ |

---

## File Upload Edge Cases

| # | Check | Severity | Status |
|---|---|---|---|
| U1 | **Large file upload (>4MB) skips all validation** — The `upload-session` → `upload-finalize` path bypasses: SHA-256 duplicate detection, MIME type re-verification, PDF corruption check, OCR classification, and advisory validation. Upload a 5MB PDF via portal — does it get `needs_review=false` and no validation? | HIGH | ⬜ |
| U2 | **Duplicate file detection** — Upload the exact same file twice to the same client portal. First upload should succeed, second should return 409. Then test with `confirmDuplicate=true` — does it override? | MEDIUM | ⬜ |
| U3 | **Invalid MIME type** — Try uploading a `.exe` or `.zip` through the portal upload endpoint. Is it rejected? The allowlist is PDF, JPEG, PNG, TIFF, Word, Excel, CSV. | MEDIUM | ⬜ |
| U4 | **Zero-byte file upload** — Try uploading an empty file through the portal. Does it handle gracefully or crash? | LOW | ⬜ |
| U5 | **Portal token with special characters in URL** — Visit `/portal/<script>alert(1)</script>` or `/portal/../../etc/passwd`. Does it handle gracefully? | MEDIUM | ⬜ |

---

## Data Integrity

| # | Check | Severity | Status |
|---|---|---|---|
| D1 | **CSV import partial failure** — Import a CSV where the first 5 rows are valid and row 6 has invalid data. Are the first 5 clients created but with no filing assignments if the assignment insert fails? | MEDIUM | ⬜ |
| D2 | **DSAR export with failed document fetch** — Generate a DSAR export for a client whose storage provider tokens have expired. Does the ZIP silently omit documents without noting it in the manifest? | HIGH | ⬜ |
| D3 | **Disconnect storage provider with existing documents** — Connect Google Drive, upload documents via portal, then disconnect Google Drive. Navigate to the client detail page — are those documents now inaccessible? Does DSAR export fail for them? | HIGH | ⬜ |
| D4 | **Reconnect storage provider creates duplicate folder** — Disconnect and reconnect Google Drive. A second "Prompt/" folder is created in Drive root. Old documents are orphaned. | MEDIUM | ⬜ |
| D5 | **`app_settings` boolean as string** — If a setting is written as boolean `true` instead of string `"true"`, the equality check `data.value === "true"` silently fails and the flag appears unset. | LOW | ⬜ |

---

## Auth Flow Edge Cases

| # | Check | Severity | Status |
|---|---|---|---|
| A1 | **Invite email mismatch** — Get invited as `alice@example.com`. Sign up with `bob@example.com` using the invite link. The signup succeeds (admin client creates user with `email_confirm: true`). Does `acceptInvite` catch the email mismatch? | HIGH | ⬜ |
| A2 | **JWT org_id stale after invite accept** — After accepting an invite, the JWT still has no `org_id` until `refreshSession()` is called. Navigate directly to the dashboard without refreshing — does the middleware DB fallback work, or do you get redirected to marketing? | MEDIUM | ⬜ |
| A3 | **Password reset redirect fragility** — Trigger a password reset. When the email link redirects through `/auth/callback`, does the `redirect=/auth/reset-password` param survive all middleware transformations? | MEDIUM | ⬜ |
| A4 | **Magic link from wizard for user with existing org** — If a user already has an org and clicks a wizard magic link, they land on the dashboard instead of the wizard. Is this confusing? | LOW | ⬜ |
| A5 | **Expired session during long wizard flow** — Start the wizard, leave the browser idle for 1+ hours (session expires), then try to complete the wizard. Does it fail gracefully or crash? | MEDIUM | ⬜ |

---

## Email / Postmark Edge Cases

| # | Check | Severity | Status |
|---|---|---|---|
| E1 | **Org without Postmark token** — Create an org on free plan. Do reminder crons silently skip this org? Is there any indication to the user that emails aren't being sent? | MEDIUM | ⬜ |
| E2 | **Platform Postmark token rotation** — If `POSTMARK_SERVER_TOKEN` env var changes, all free orgs that inherited it lose email sending. Are they notified? | MEDIUM | ⬜ |
| E3 | **Bounce handling for hard vs soft** — Send to an invalid email. Does the Postmark webhook correctly set `delivery_status` to `failed` (HardBounce) vs `bounced` (SoftBounce)? Are bounced emails retried? | MEDIUM | ⬜ |
| E4 | **Reminder email with missing template placeholders** — If a template references `{{client_name}}` but the client has no name set (null), does the email render with "null" or blank? | LOW | ⬜ |
| E5 | **Storage health check email uses platform token** — The storage health cron uses the platform Postmark token, not the org's. If the platform token isn't set, health check notifications fail silently. | LOW | ⬜ |

---

## Cleanup & Maintenance

| # | Check | Severity | Status |
|---|---|---|---|
| M1 | **`processed_webhook_events` table unbounded growth** — This table has no TTL or cleanup. Check its row count. Over months it will grow indefinitely. | LOW | ⬜ |
| M2 | **`locks` table cleanup after crash** — If the cron pod crashes mid-execution, the lock row (5-min TTL) remains. The next cron run 10 min later should clear it, but verify the expiry logic works. | LOW | ⬜ |
| M3 | **Retention cron flags documents but notification fails** — Documents get `retention_flagged=true` but if the admin notification email fails, they're never told. Check this flow end-to-end. | MEDIUM | ⬜ |

---

## Multi-Tenant Isolation

| # | Check | Severity | Status |
|---|---|---|---|
| T1 | **Cross-org data access via API** — As user in Org A, try fetching clients from Org B by passing Org B's client IDs to API routes. RLS should block this, but verify for all major endpoints. | HIGH | ⬜ |
| T2 | **Org slug collision** — Create org "test-firm". Delete it. Create another org "test-firm". Does the slug uniqueness constraint work after deletion? | LOW | ⬜ |
| T3 | **Member removed but session still active** — Remove a team member from the org. Before their session expires, can they still access org data? The JWT still contains the old `org_id`. | MEDIUM | ⬜ |
