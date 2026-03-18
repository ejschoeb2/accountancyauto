# QA Edge Case Checklist

Edge cases not covered by the UI-focused QA task lists in `QA_TASK_LISTS.md`. These target backend logic, race conditions, security boundaries, and data integrity.

**Priority order:** Sections are ordered by maximum severity. Start with HIGH items.

---

## Multi-Tenant Isolation

| # | Check | Severity | Status |
|---|---|---|---|
| T1 | **Cross-org data access via API** — As user in Org A, try fetching clients from Org B by passing Org B's client IDs to API routes. RLS should block this, but verify for all major endpoints. | HIGH | ⬜ |
| T2 | **Member removed but session still active** — Remove a team member from the org. Before their session expires, can they still access org data? The JWT still contains the old `org_id`. | MEDIUM | ⬜ |
| T3 | **Org slug collision after deletion** — Create org "test-firm". Delete it. Create another org "test-firm". Does the slug uniqueness constraint work after deletion? | LOW | ⬜ |

---

## Auth Flow Edge Cases

| # | Check | Severity | Status |
|---|---|---|---|
| A1 | **Invite email mismatch** — Get invited as `alice@example.com`. Sign up with `bob@example.com` using the invite link. The signup succeeds (admin client creates user with `email_confirm: true`). Does `acceptInvite` catch the email mismatch? | HIGH | ⬜ |
| A2 | **JWT org_id stale after invite accept** — After accepting an invite, the JWT still has no `org_id` until `refreshSession()` is called. Navigate directly to the dashboard without refreshing — does the middleware DB fallback work, or do you get redirected to marketing? | MEDIUM | ⬜ |
| A3 | **Password reset redirect fragility** — Trigger a password reset. When the email link redirects through `/auth/callback`, does the `redirect=/auth/reset-password` param survive all middleware transformations? | MEDIUM | ⬜ |
| A4 | **Expired session during long wizard flow** — Start the wizard, leave the browser idle for 1+ hours (session expires), then try to complete the wizard. Does it fail gracefully or crash? | MEDIUM | ⬜ |
| A5 | **Magic link from wizard for user with existing org** — If a user already has an org and clicks a wizard magic link, they land on the dashboard instead of the wizard. Is this confusing? | LOW | ⬜ |

---

## File Upload Edge Cases

| # | Check | Severity | Status |
|---|---|---|---|
| U1 | **Large file upload (>4MB) skips all validation** — The `upload-session` → `upload-finalize` path bypasses: SHA-256 duplicate detection, MIME type re-verification, PDF corruption check, OCR classification, and advisory validation. Upload a 5MB PDF via portal — does it get `needs_review=false` and no validation? | HIGH | ⬜ |
| U2 | **Duplicate file detection** — Upload the exact same file twice to the same client portal. First upload should succeed, second should return 409. Then test with `confirmDuplicate=true` — does it override? | MEDIUM | ⬜ |
| U3 | **Invalid MIME type** — Try uploading a `.exe` or `.zip` through the portal upload endpoint. Is it rejected? The allowlist is PDF, JPEG, PNG, TIFF, Word, Excel, CSV. | MEDIUM | ⬜ |
| U4 | **Portal token with special characters in URL** — Visit `/portal/<script>alert(1)</script>` or `/portal/../../etc/passwd`. Does it handle gracefully? | MEDIUM | ⬜ |
| U5 | **Zero-byte file upload** — Try uploading an empty file through the portal. Does it handle gracefully or crash? | LOW | ⬜ |

---

## Data Integrity & Storage Providers

| # | Check | Severity | Status |
|---|---|---|---|
| D1 | **DSAR export with failed document fetch** — Generate a DSAR export for a client whose storage provider tokens have expired. Does the ZIP silently omit documents without noting it in the manifest? | HIGH | ⬜ |
| D2 | **Disconnect storage provider with existing documents** — Connect Google Drive, upload documents via portal, then disconnect Google Drive. Navigate to the client detail page — are those documents now inaccessible? Does DSAR export fail for them? | HIGH | ⬜ |
| D3 | **Client deletion cascade** — Delete a client. Are all related records (filings, documents, reminder queue entries, audit logs) properly cascaded? Or do orphaned FK references cause errors? Audit logs should be preserved with anonymized references for legal compliance. | HIGH | ⬜ |
| D4 | **Storage quota exceeded** — Google Drive is full. Upload via portal succeeds at your API but the Drive write fails. Is a document record created without a backing file? | MEDIUM | ⬜ |
| D5 | **Reconnect storage provider creates duplicate folder** — Disconnect and reconnect Google Drive. A second "Prompt/" folder is created in Drive root. Old documents are orphaned. | MEDIUM | ⬜ |
| D6 | **OAuth token refresh race** — Two concurrent file operations hit an expired Google token. Both try to refresh simultaneously. Does one get a revoked refresh token? | MEDIUM | ⬜ |
| D7 | **CSV import partial failure** — Import a CSV where the first 5 rows are valid and row 6 has invalid data. Are the first 5 clients created but with no filing assignments if the assignment insert fails? | MEDIUM | ⬜ |
| D8 | **CSV with UTF-8 BOM** — Excel-exported CSVs often have a BOM character. Does your parser handle it or does the first column name get corrupted? | LOW | ⬜ |
| D9 | **CSV with 1000+ rows** — Does the import timeout on Vercel's function duration limit? What's the batch size? | MEDIUM | ⬜ |
| D10 | **CSV duplicate detection** — Import the same CSV twice. Are duplicate clients created, or is there a company-number/name uniqueness check? | MEDIUM | ⬜ |
| D11 | **`app_settings` boolean as string** — If a setting is written as boolean `true` instead of string `"true"`, the equality check `data.value === "true"` silently fails and the flag appears unset. | LOW | ⬜ |

---

## Subscription & Billing

| # | Check | Severity | Status |
|---|---|---|---|
| B1 | **Stripe subscription downgrade with excess clients** — Downgrade from Practice (unlimited) to Lite (10 clients) when you have 50 clients. What happens? Are clients soft-deleted? Is the downgrade blocked? | HIGH | ⬜ |
| B2 | **Stripe webhook replay attack** — Replay an old `checkout.session.completed` event. The idempotency table should catch it, but verify the timestamp tolerance. | MEDIUM | ⬜ |

---

## Deadline & Reminder Logic

| # | Check | Severity | Status |
|---|---|---|---|
| DR1 | **Year-end date change after deadlines generated** — Change a client's year-end date. Are old deadlines cleaned up or do they linger alongside new ones? | HIGH | ⬜ |
| DR2 | **Client activated mid-cycle** — Activate a client 1 day before a VAT deadline. Does the reminder queue pick it up, or does it only catch clients present at queue-rebuild time? | MEDIUM | ⬜ |
| DR3 | **Paused client reactivation** — Pause reminders, let several deadlines pass, then unpause. Do all missed deadlines fire at once? | MEDIUM | ⬜ |
| DR4 | **Timezone-sensitive deadline display** — A deadline due "today" in UK time might show as "tomorrow" for users in UTC+5:30. Are all dates server-rendered in UTC/Europe-London? | MEDIUM | ⬜ |
| DR5 | **Leap year year-end** — Client with year-end 29 Feb. Corp Tax = year+9m+1d = 30 Nov. Companies House = year+9m = 29 Nov. Verify the date math doesn't break for Feb 29 inputs. | LOW | ⬜ |

---

## Email / Postmark

| # | Check | Severity | Status |
|---|---|---|---|
| E1 | **Postmark webhook spoofing** — POST a fake bounce event to your Postmark webhook endpoint. Is the webhook authenticated with signature verification, or can anyone trigger bounce handling? | HIGH | ⬜ |
| E2 | **Org without Postmark token** — Create an org on free plan. Do reminder crons silently skip this org? Is there any indication to the user that emails aren't being sent? | MEDIUM | ⬜ |
| E3 | **Platform Postmark token rotation** — If `POSTMARK_SERVER_TOKEN` env var changes, all free orgs that inherited it lose email sending. Are they notified? | MEDIUM | ⬜ |
| E4 | **Bounce handling for hard vs soft** — Send to an invalid email. Does the Postmark webhook correctly set `delivery_status` to `failed` (HardBounce) vs `bounced` (SoftBounce)? Are bounced emails retried? | MEDIUM | ⬜ |
| E5 | **Reminder email with missing template placeholders** — If a template references `{{client_name}}` but the client has no name set (null), does the email render with "null" or blank? | LOW | ⬜ |
| E6 | **Storage health check email uses platform token** — The storage health cron uses the platform Postmark token, not the org's. If the platform token isn't set, health check notifications fail silently. | LOW | ⬜ |

---

## UI / Frontend Consistency

| # | Check | Severity | Status |
|---|---|---|---|
| F1 | **Concurrent edits to same client** — Two admin tabs open on the same client. Both edit the company name and save. Last-write-wins? Any conflict detection? | MEDIUM | ⬜ |
| F2 | **Stale React Query cache after bulk operation** — Bulk-update 20 client statuses, then immediately navigate to a client detail page. Does it show the old status from cache? | LOW | ⬜ |

---

## Cleanup & Maintenance

| # | Check | Severity | Status |
|---|---|---|---|
| M1 | **Retention cron flags documents but notification fails** — Documents get `retention_flagged=true` but if the admin notification email fails, they're never told. Check this flow end-to-end. | MEDIUM | ⬜ |
| M2 | **`processed_webhook_events` table unbounded growth** — This table has no TTL or cleanup. Check its row count. Over months it will grow indefinitely. | LOW | ⬜ |
| M3 | **`locks` table cleanup after crash** — If the cron pod crashes mid-execution, the lock row (5-min TTL) remains. The next cron run 10 min later should clear it, but verify the expiry logic works. | LOW | ⬜ |
| M4 | **Retention policy on audit logs** — If a client is deleted, audit logs referencing that client should be preserved (legal requirement). Verify they aren't cascade-deleted and that references degrade gracefully. | MEDIUM | ⬜ |
