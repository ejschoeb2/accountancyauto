---
phase: 03-delivery-dashboard
plan: 03
subsystem: email
tags: [postmark, webhooks, hmac, delivery-tracking, bounce-handling]

# Dependency graph
requires:
  - phase: 03-01
    provides: email_log table with delivery_status and bounce tracking fields
provides:
  - Postmark webhook endpoint for delivery and bounce events with HMAC signature verification
  - Real-time delivery status updates to email_log table
  - Hard bounce vs soft bounce classification
affects: [03-04-dashboard, 03-05-cron-job]

# Tech tracking
tech-stack:
  added: []
  patterns: [webhook-signature-verification, admin-client-for-webhooks, timing-safe-hmac-comparison]

key-files:
  created:
    - lib/webhooks/postmark-verify.ts
    - app/api/webhooks/postmark/route.ts
  modified:
    - middleware.ts

key-decisions:
  - "HMAC-SHA256 signature verification with timing-safe comparison prevents replay attacks"
  - "Webhooks excluded from auth middleware - no user session, verified by signature instead"
  - "Hard bounces marked as 'failed' (permanent), soft bounces as 'bounced' (temporary)"
  - "Always return 200 to Postmark to prevent unnecessary retries"
  - "Raw body read before JSON parsing for signature verification"

patterns-established:
  - "Webhook security: verify signature on raw body before processing"
  - "Admin Supabase client pattern for background operations without user session"
  - "Timing-safe comparison for HMAC verification to prevent timing attacks"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 3 Plan 3: Postmark Webhook Handler Summary

**HMAC-verified webhook endpoint updates email_log delivery status in real-time, distinguishing hard bounces (failed) from soft bounces (bounced)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T01:32:52Z
- **Completed:** 2026-02-07T01:34:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- HMAC-SHA256 signature verification utility with timing-safe comparison
- Postmark webhook endpoint at /api/webhooks/postmark handling Delivery and Bounce events
- Real-time email_log updates when emails are delivered or bounce
- Hard bounce vs soft bounce classification (failed vs bounced status)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create webhook signature verification utility** - `7215918` (feat)
2. **Task 2: Create Postmark webhook route handler** - `370af0f` (feat)

**Plan metadata:** (pending - will be committed after SUMMARY creation)

## Files Created/Modified
- `lib/webhooks/postmark-verify.ts` - HMAC-SHA256 signature verification with crypto.timingSafeEqual, handles Buffer length mismatch
- `app/api/webhooks/postmark/route.ts` - POST handler for Postmark delivery/bounce events, verifies signature on raw body, updates email_log
- `middleware.ts` - Excludes /api/webhooks from auth checks (webhooks have no user session)

## Decisions Made

**Signature verification security:** Uses crypto.timingSafeEqual for HMAC comparison to prevent timing attacks. Signature is verified on raw request body before JSON parsing to ensure byte-exact verification.

**Hard vs soft bounce classification:** Hard bounces (Type: 'HardBounce') are permanent failures (5xx SMTP codes) marked as 'failed'. Soft bounces (Type: 'SoftBounce' or 'Transient') are temporary failures marked as 'bounced' for potential retry.

**Webhook response strategy:** Always returns 200 status to Postmark, even for processing errors. This prevents Postmark from retrying when retries won't help (e.g., data errors).

**Auth exclusion:** Webhooks excluded from middleware auth matcher since they have no user session. Security is provided by HMAC signature verification instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded webhooks from middleware auth**
- **Found during:** Task 2 (Webhook route creation)
- **Issue:** Middleware config would apply auth checks to /api/webhooks, causing webhook requests to fail
- **Fix:** Updated middleware.ts matcher to exclude api/webhooks path from auth checks
- **Files modified:** middleware.ts
- **Verification:** TypeScript compilation passes, webhook routes won't be blocked by auth
- **Committed in:** 370af0f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for webhook functionality - webhooks cannot have user sessions. No scope creep.

## Issues Encountered

None

## User Setup Required

**External services require manual configuration.** See [03-USER-SETUP.md](./03-USER-SETUP.md) for:
- POSTMARK_WEBHOOK_SECRET environment variable setup
- Postmark dashboard webhook configuration
- Webhook URL: https://your-domain.com/api/webhooks/postmark
- Verification commands to test webhook delivery

## Next Phase Readiness

**Ready for next phase:**
- Webhook endpoint ready to receive Postmark delivery and bounce events
- email_log table will be updated in real-time when emails are delivered or bounce
- Hard bounce vs soft bounce classification ready for dashboard display
- Signature verification prevents unauthorized webhook calls

**Blockers:**
- Webhook URL must be configured in Postmark dashboard (covered in USER-SETUP.md)
- POSTMARK_WEBHOOK_SECRET must be set in environment (matches secret in Postmark dashboard)
- Postmark must be configured to send Delivery and Bounce webhooks (covered in USER-SETUP.md)

**Next plan:** 03-04-dashboard (dashboard UI to display delivery status and traffic-light indicators)

## Self-Check: PASSED

All key files verified:
- lib/webhooks/postmark-verify.ts: FOUND
- app/api/webhooks/postmark/route.ts: FOUND

All commits verified:
- 7215918 (Task 1): FOUND
- 370af0f (Task 2): FOUND

---
*Phase: 03-delivery-dashboard*
*Completed: 2026-02-07*
