---
phase: 24-storage-abstraction-layer
plan: "03"
subsystem: infra
tags: [aes-256-gcm, crypto, encryption, oauth-tokens, env-vars]

requires:
  - phase: 24-01
    provides: "_enc columns on organisations table (TEXT DEFAULT NULL) — the columns this module will write to in Phase 25+"

provides:
  - "lib/crypto/tokens.ts — AES-256-GCM encryptToken() and decryptToken() functions"
  - "ENV_VARIABLES.md ENCRYPTION_KEY section — format, generation, security requirements, rotation notes"

affects:
  - phase-25-google-drive
  - phase-26-onedrive
  - phase-27-dropbox
  - phase-28-settings-ui-token-lifecycle

tech-stack:
  added: []
  patterns:
    - "Lazy env-var key loading: getKey() called inside each function, not at module level — mirrors D-11-05-01 Stripe client lazy init pattern; prevents build failures when env var absent at build time"
    - "_enc column suffix convention: any database column with _enc suffix MUST be written via encryptToken() and read via decryptToken() — enforced by code convention, not DB constraint"

key-files:
  created:
    - lib/crypto/tokens.ts
  modified:
    - ENV_VARIABLES.md

key-decisions:
  - "[D-24-03-01] getKey() called lazily inside each function, not at module level — mirrors Stripe lazy init (D-11-05-01); build-safe when ENCRYPTION_KEY absent (CI/CD environments)"
  - "[D-24-03-02] Ciphertext format iv_hex:authTag_hex:encrypted_hex (self-contained) — no external metadata required for decryption; entire token is one TEXT column value"
  - "[D-24-03-03] GCM auth tag errors NOT suppressed in decryptToken() — tampering or wrong key must surface immediately, not silently return garbage"
  - "[D-24-03-04] 12-byte (96-bit) IV via randomBytes(12) per call — GCM standard recommendation; fresh IV per encrypt call is non-negotiable for semantic security"

patterns-established:
  - "Lazy crypto key pattern: always read ENCRYPTION_KEY inside the function body — never const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') at module scope"
  - "AES-256-GCM ciphertext as single TEXT string: iv:tag:ciphertext — store as one column, deserialise at decrypt time"

requirements-completed: [STOR-05]

duration: 5min
completed: 2026-02-28
---

# Phase 24 Plan 03: AES-256-GCM Token Encryption Module Summary

**AES-256-GCM token encryption module (lib/crypto/tokens.ts) with lazy key loading, self-contained iv:tag:ciphertext format, and ENV_VARIABLES.md documentation for Phase 25+ OAuth token storage**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T03:09:00Z
- **Completed:** 2026-02-28T03:11:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `lib/crypto/tokens.ts` — the single encryption boundary for all `_enc` columns; exports `encryptToken()` and `decryptToken()` using Node.js built-in `crypto` (no new npm dependencies)
- Implemented lazy key loading via `getKey()` called inside each function — build does not fail when `ENCRYPTION_KEY` is absent at build/CI time
- Documented `ENCRYPTION_KEY` in `ENV_VARIABLES.md` with generation command, security requirements, Vercel-only storage rule, and rotation procedure

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/crypto/tokens.ts** - `0d1a9aa` (feat)
2. **Task 2: Document ENCRYPTION_KEY in ENV_VARIABLES.md** - `73691ea` (feat)

## Files Created/Modified

- `lib/crypto/tokens.ts` — AES-256-GCM encryptToken/decryptToken; the only module authorised to write `_enc` column values
- `ENV_VARIABLES.md` — New "Cryptography Variables" section with ENCRYPTION_KEY format, generation command, security requirements, and rotation note

## Decisions Made

- **[D-24-03-01]** `getKey()` is lazy (called inside each function, never at module scope) — mirrors the Stripe client lazy-init pattern (D-11-05-01); prevents Next.js build failures in CI/CD environments where `ENCRYPTION_KEY` is not present at build time
- **[D-24-03-02]** Ciphertext format is `iv_hex:authTag_hex:encrypted_hex` — self-contained single TEXT string; no external metadata tables or lookup needed at decrypt time
- **[D-24-03-03]** GCM auth tag errors are NOT caught/suppressed in `decryptToken()` — a wrong key or tampered ciphertext must throw immediately; silent failure would allow garbage data to propagate
- **[D-24-03-04]** 12-byte (96-bit) IV via `randomBytes(12)` per `encryptToken()` call — GCM standard; IV uniqueness per call is essential for semantic security under AES-GCM

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Environment variable required before Phase 25 OAuth flows work at runtime.**

Generate and add to Vercel environment variables:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Store result as `ENCRYPTION_KEY` in Vercel (Settings → Environment Variables → Production + Preview). Do NOT add to `.env.local` committed to source control.

No other external service configuration required for this plan.

## Next Phase Readiness

- `lib/crypto/tokens.ts` is ready for Phase 25 — any executor can `import { encryptToken, decryptToken } from '@/lib/crypto/tokens'` and immediately use it to store OAuth tokens
- `ENCRYPTION_KEY` must be provisioned in Vercel before any Phase 25 OAuth token write reaches production; the runtime error message is clear if it is missing
- Phase 25 callers must call `encryptToken()` before any INSERT into `_enc` columns and `decryptToken()` after any SELECT from `_enc` columns — no other setup required

---
*Phase: 24-storage-abstraction-layer*
*Completed: 2026-02-28*
