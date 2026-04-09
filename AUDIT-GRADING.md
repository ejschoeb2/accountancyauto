# Prompt - Engineering Audit: Grading & Improvement Plan

**Audit Date:** 2026-04-06

---

## Current Grades

| Domain | Grade | Summary |
|---|---|---|
| Code Quality & Architecture | **C+** | Solid domain model and multi-tenant design, but 11 files exceed 700 LOC (5 over 1200), N+1 queries, inconsistent error handling, 30+ `any` types |
| Unit Test Coverage | **D** | 90 tests across 7 files covering deadline calculations, document classification, and email rendering — only ~7% of business logic |
| Integration Test Coverage | **F** | Zero integration tests. Payment processing, reminder pipeline, CSV import, client CRUD, and all webhooks are untested |
| End-to-End Test Coverage | **F** | Playwright in devDependencies but not configured. Zero E2E tests for any user journey |
| Authentication & Authorisation | **C-** | Supabase Auth + RLS provides good baseline. Undermined by 2 IDOR vulnerabilities, no CSRF protection, and legacy permissive RLS in migration history |
| Input Validation & Injection | **B-** | Zod schemas used consistently on most inputs. Supabase parameterised queries prevent SQL injection. No raw SQL. Minor gaps in CSRF and rate limiting |
| Secrets & Cryptography | **D** | AES-256-GCM encryption implementation is correct. Undermined by secrets in Git history and .env.example containing real-looking values |
| SOC 2 Readiness | **F** | No audit logging for data mutations, no SIEM/APM, no health checks, no security headers, no data classification, no CI test gates |
| Observability | **F** | 192 unstructured console.log calls. No APM, no correlation IDs, no alerting, no health checks, no error boundaries |
| **Overall** | **D+** | Feature-rich but operationally and security-wise not production-hardened |

---

## How to Improve Each Grade

The steps below focus specifically on what moves each grade upward. This differs from the issues list — the issues list documents everything found; this document describes the minimum work needed to reach each target grade.

---

### Code Quality & Architecture: C+ -> B+

**Current state:** Good architecture (multi-tenant RLS, distributed locking, domain model) but suffering from monolithic component growth and inconsistent patterns.

**To reach B- (minimum viable improvement):**
1. **Split the top 3 largest components** — Extract `client-table.tsx` (2003 LOC), `csv-import-step.tsx` (1546 LOC), and `wizard/page.tsx` (1260 LOC) into smaller, single-responsibility components. No file should exceed 500 LOC without clear justification.
2. **Fix the N+1 query in dashboard metrics** — Replace the O(n*m) nested filter in `lib/dashboard/metrics.ts:100-104` with a Map-based indexed lookup. This is a one-line fix that removes the worst performance hotspot.
3. **Establish an error handling convention** — Document and enforce: server actions throw (Next.js catches), API routes return `{ error, status }`, library functions use typed errors. Apply to new code immediately.

**To reach B (solid improvement):**
4. **Split action files by concern** — Separate `settings.ts` (842 LOC) and `audit-log.ts` (707 LOC) into query and mutation modules. Each file should do one type of thing.
5. **Eliminate `any` types in core paths** — Create `lib/types/tiptap.ts` for document structures and strengthen database row types. Target: zero `any` in `lib/` directory.
6. **Add pagination to collection endpoints** — `/api/clients` and audit log queries should accept `limit`/`offset` parameters.

**To reach B+:**
7. **Move template data out of code** — Extract the 1279 LOC `seed-defaults.ts` and 1666 LOC `seed-demo-data.ts` to JSON files or database-seeded configuration.
8. **Extract reusable component patterns** — Create `<FilterDropdown>`, `<EditableDataGrid>`, and `<ConfirmationDialog>` components to reduce duplication across the dashboard.
9. **Enforce file size limits** — Add an ESLint rule or CI check that flags files exceeding 500 LOC for review.

---

### Unit Test Coverage: D -> B

**Current state:** 90 tests across 7 files. Only deadline calculations, document classification, and email rendering are covered.

**To reach C (baseline):**
1. **Test the billing/plan enforcement logic** — `lib/billing/usage-limits.ts` guards every paid feature. Write tests for: limit comparison, over-limit detection, each plan tier variation. (~15 tests)
2. **Test token generation/encryption** — `lib/crypto/tokens.ts` handles portal access tokens and OAuth encryption. Test the full lifecycle: generate, encrypt, decrypt, validate expiry, reject tampered tokens. (~10 tests)
3. **Test traffic light status calculation** — `lib/dashboard/traffic-light.ts` determines green/amber/red filing status. Test boundary values (days remaining at each threshold). (~10 tests)
4. **Test CSV utility functions** — `lib/utils/csv-template.ts` `rollYearEndToFuture()` date logic. Test leap years, timezone edge cases, invalid inputs. (~8 tests)

**To reach B- (meaningful coverage):**
5. **Test Zod validation schemas** — Each schema in `lib/validations/*.ts` should have tests for valid data acceptance, invalid data rejection, and error message quality. (~30 tests)
6. **Test email notification rendering** — `lib/billing/notifications.ts` payment failure emails. Verify correct content and recipient. (~5 tests)
7. **Test filing type descriptions** — `lib/deadlines/descriptions.ts` display text mapping. (~5 tests)

**To reach B:**
8. **Add code coverage reporting** — Configure Vitest coverage with `@vitest/coverage-v8`. Set initial threshold at 40% for `lib/` directory.
9. **Add coverage CI gate** — Fail builds if coverage drops below threshold. Ratchet upward as tests are added.
10. **Target 60% coverage on `lib/` directory** — This is the business logic core. Every function that makes a decision should have at least happy-path and error-path tests.

---

### Integration Test Coverage: F -> C

**Current state:** Zero integration tests. Every integration boundary is untested.

**To reach D (not failing):**
1. **Test Stripe webhook handlers** — This is the highest-risk untested integration. Write tests for `handleCheckoutSessionCompleted`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted`, and `handleInvoicePaymentFailed` using mock Stripe event payloads. Verify correct database state changes. (~12 tests)
2. **Test the reminder scheduler** — `lib/reminders/scheduler.ts` is the core product. Mock Supabase and test: lock acquisition, send_hour enforcement, correct client filtering, template variable rendering. (~10 tests)

**To reach C- (baseline):**
3. **Test CSV import action** — `app/actions/csv.ts` with mocked Supabase. Test: valid import, validation failures, duplicate handling, plan limit enforcement. (~10 tests)
4. **Test filing rollover** — `lib/rollover/detector.ts` + `executor.ts` with mocked DB. Test: candidate detection, paused client filtering, array mutation, queue cleanup. (~8 tests)
5. **Test client CRUD actions** — `app/actions/clients.ts` with mocked Supabase. Test: create, update, delete, org isolation, plan limits. (~8 tests)

**To reach C:**
6. **Test cron job endpoints** — All 5 cron routes with mocked dependencies. Test: auth validation (valid/invalid secret), batch processing, lock handling, error accumulation. (~15 tests)
7. **Test Postmark webhook** — `app/api/webhooks/postmark/route.ts`. Test: signature verification, event processing, idempotency. (~6 tests)
8. **Set up test infrastructure** — Create shared test utilities: `createMockSupabase()`, `createMockStripeEvent()`, `createMockPostmarkWebhook()`. Establish patterns for future tests.

---

### End-to-End Test Coverage: F -> C

**Current state:** Playwright is in devDependencies but not configured. Zero E2E tests.

**To reach D (not failing):**
1. **Configure Playwright** — Set up `playwright.config.ts` with: base URL, auth state storage, test directory, screenshot on failure.
2. **Write the login flow test** — Test: navigate to login, enter credentials, verify dashboard loads, verify org context is correct. This is the foundation for all other E2E tests.
3. **Write the client creation flow** — Test: navigate to clients, click create, fill form, verify client appears in table.

**To reach C-:**
4. **Test CSV import flow** — Upload a CSV file, verify preview renders, confirm import, verify clients created.
5. **Test the setup wizard** — Complete the onboarding wizard end-to-end for a new account.
6. **Test email template editing** — Create template, edit content, save, verify persistence.

**To reach C:**
7. **Test multi-tenant isolation** — Log in as Org A, verify Org B's data is not visible. This is the most critical E2E security test.
8. **Test the reminder configuration flow** — Set up a schedule, assign to clients, verify reminder queue builds.
9. **Add E2E to CI** — Run Playwright tests on every PR. Use `webServer` option to start the dev server automatically.

---

### Authentication & Authorisation: C- -> B

**Current state:** Supabase Auth + RLS provides a good foundation. Specific vulnerabilities undermine it.

**To reach C (fix critical gaps):**
1. **Fix the unsubscribe IDOR** — Replace `client_id` with cryptographic tokens. This is the most exploitable vulnerability.
2. **Fix the document download IDOR** — Add `org_id` ownership check.
3. **Verify RLS policies on live database** — Run the audit query and confirm no `USING (true)` policies remain.

**To reach B-:**
4. **Implement CSRF protection** — Add CSRF tokens to all mutation endpoints using `@edge-csrf/nextjs`.
5. **Fix portal token error responses** — Return identical errors for all invalid states to prevent enumeration.
6. **Use timing-safe comparison for cron auth** — Replace `!==` with `crypto.timingSafeEqual()`.

**To reach B:**
7. **Add rate limiting to auth endpoints** — 5 requests/minute per IP on login, signup, password reset.
8. **Add integration tests for auth flows** — Test that unauthenticated requests are rejected, org-scoped data is isolated, and role-based access is enforced.
9. **Document the auth model** — Update ARCHITECTURE.md with: which endpoints require auth, which use service role vs. session client, and the RLS policy model.

---

### Input Validation & Injection: B- -> A-

**Current state:** Good baseline — Zod schemas on most inputs, Supabase parameterised queries, no raw SQL construction.

**To reach B:**
1. **Add CSRF tokens** (same as auth improvement — these are interconnected).
2. **Add rate limiting on mutation endpoints** — Prevents abuse of valid input paths.
3. **Sanitise error responses** — Don't return database error messages to clients. Return generic messages and log details server-side.

**To reach B+:**
4. **Test all Zod schemas** — Write unit tests for each validation schema covering valid, invalid, and boundary inputs.
5. **Add input size limits** — Enforce max request body size on file upload and bulk operation endpoints.
6. **Add Content-Security-Policy header** — Prevents XSS even if a rendering bug exists.

**To reach A-:**
7. **Add automated SAST scanning** — Integrate a static analysis tool (e.g., `eslint-plugin-security`, Semgrep) into CI to catch injection patterns.
8. **Audit all uses of `dangerouslySetInnerHTML`** — Verify no user-controlled content is rendered unsafely.
9. **Add dependency vulnerability scanning to CI** — `npm audit` on every build with failure threshold.

---

### Secrets & Cryptography: D -> B

**Current state:** Correct AES-256-GCM implementation, but secrets management practices are poor.

**To reach C (fix critical issues):**
1. **Clean .env.local.example** — Replace all values with obviously fake placeholders.
2. **Add startup validation for dev environments** — Check that Stripe key starts with `sk_test_` and Postmark token is a sandbox token when `NODE_ENV=development`.

**To reach B-:**
3. **Implement encryption key versioning** — Store key version with each ciphertext. Support decrypting with any historical version. Always encrypt with the current version. This enables rotation without downtime.
4. **Add `detect-secrets` pre-commit hook** — Prevents accidental secret commits in the future.

**To reach B:**
5. **Document the secrets management process** — Which secrets exist, where they're stored (Vercel), how to rotate each one, who has access.
6. **Implement secret rotation schedule** — Rotate CRON_SECRET and ENCRYPTION_KEY quarterly. Document the procedure.

---

### SOC 2 Readiness: F -> C

**Current state:** Almost no SOC 2 controls in place.

**To reach D (address critical gaps):**
1. **Create an immutable audit_log table** — Log all data mutations (clients, templates, schedules, settings, permissions) with: org_id, user_id, action, table_name, row_id, old_values, new_values, created_at. INSERT-only policy (no UPDATE/DELETE).
2. **Add security headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy in `next.config.ts`.
3. **Add a health check endpoint** — `/api/health` that verifies DB and Postmark connectivity.

**To reach C-:**
4. **Integrate Sentry** — Centralized error tracking with PII scrubbing, environment tagging, and alert rules.
5. **Add structured logging** — Replace console.log with a JSON logger that includes context (orgId, userId, action).
6. **Implement cron failure alerting** — Notify ops when cron batch failure rate exceeds threshold.

**To reach C:**
7. **Set up CI/CD pipeline** — GitHub Actions that runs tests, `npm audit`, and coverage checks on every PR. This is the "change management" control.
8. **Define data classification** — PUBLIC (filing dates, company names), INTERNAL (email addresses), SENSITIVE (tax documents), PII (user credentials). Document handling requirements per level.
9. **Implement PII redaction in logs** — Never log email addresses, client names, or document content. Use IDs only.
10. **Document an incident response procedure** — What to do when: cron fails, data breach suspected, Postmark outage. Who is notified, what actions are taken, where is the runbook.

---

### Observability: F -> B-

**Current state:** 192 unstructured console calls. Nothing else.

**To reach D (basic visibility):**
1. **Add a health check endpoint** — `/api/health` checking DB and Postmark. Used by uptime monitoring.
2. **Add Sentry** — Captures errors automatically with stack traces, user context, and environment info.
3. **Add cron failure alerting** — Email or Slack notification when batch processing fails.

**To reach C (usable in production):**
4. **Implement structured logging** — Replace all console calls with Pino/Winston. JSON format, log levels, request context. This is ~2-3 days of work but transforms debuggability.
5. **Add correlation IDs** — Generate in middleware, propagate via AsyncLocalStorage, include in all logs. Makes multi-step debugging possible.
6. **Add React error boundaries** — `error.tsx` files in dashboard and marketing route groups. Graceful degradation instead of blank pages.

**To reach B-:**
7. **Add cron execution metadata** — Include `execution_id`, `started_at`, `ended_at`, `duration_ms`, `failed_org_count` in all cron responses.
8. **Add email delivery metrics** — Track first-attempt success rate, retry distribution, time-to-delivery. Surface in an admin dashboard or weekly report.
9. **Add circuit breaker for Postmark** — Exponential backoff and circuit breaker pattern to handle Postmark outages gracefully.
10. **Add storage health escalation** — If storage backend stays unhealthy for 7+ days, escalate alert. Show in-app banner.

---

## Recommended Improvement Sequence

The grades are interconnected. This is the optimal order for maximum grade improvement with minimum effort:

| Phase | Duration | Actions | Grades Improved |
|---|---|---|---|
| **1. Security hardening** | 1 week | Fix IDORs (AUDIT-001, 002), add CSRF (AUDIT-003), verify RLS (AUDIT-004), fix cron timing attack, clean .env.example | Auth: C- -> C+, Secrets: D -> C |
| **2. Observability foundation** | 1 week | Add Sentry, health check, cron alerting, structured logging | Observability: F -> C, SOC 2: F -> D |
| **3. Critical test coverage** | 2 weeks | Stripe webhook tests, reminder scheduler tests, CSV import tests, client CRUD tests, plan limit tests | Unit: D -> C, Integration: F -> D |
| **4. Security + infra hardening** | 1 week | Rate limiting, security headers, audit logging, CI pipeline with test gates | Auth: C+ -> B, Input: B- -> B, SOC 2: D -> C- |
| **5. Component refactoring** | 2 weeks | Split top 5 bloated files, establish error convention, fix N+1 queries, eliminate `any` types | Code Quality: C+ -> B |
| **6. Test expansion** | 2 weeks | E2E setup + critical journeys, API route tests, cron tests, validation schema tests, coverage thresholds | Unit: C -> B-, Integration: D -> C, E2E: F -> C |
| **7. Polish** | 1 week | Correlation IDs, circuit breaker, error boundaries, email metrics, data classification, incident response docs | Observability: C -> B-, SOC 2: C- -> C |

**Estimated total: 10 weeks to move overall grade from D+ to B-**

After completing all 7 phases:

| Domain | Current | Target |
|---|---|---|
| Code Quality & Architecture | C+ | **B** |
| Unit Test Coverage | D | **B-** |
| Integration Test Coverage | F | **C** |
| End-to-End Test Coverage | F | **C** |
| Authentication & Authorisation | C- | **B** |
| Input Validation & Injection | B- | **B** |
| Secrets & Cryptography | D | **B-** |
| SOC 2 Readiness | F | **C** |
| Observability | F | **B-** |
| **Overall** | **D+** | **B-** |
