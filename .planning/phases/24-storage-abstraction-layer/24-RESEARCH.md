# Phase 24: Storage Abstraction Layer - Research

**Researched:** 2026-02-28
**Domain:** Storage interface design, AES-256-GCM encryption, Postgres schema migrations
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STOR-01 | Extract `StorageProvider` interface from `lib/documents/storage.ts` with `upload()`, `getDownloadUrl()`, `delete()`, `getBytes()` methods; existing Supabase implementation unchanged and all existing functionality verified unaffected | Interface extraction pattern documented below; existing callers identified; TypeScript `satisfies` operator prevents silent drift |
| STOR-02 | `organisations` table gains `storage_backend` enum column (`supabase \| google_drive \| onedrive \| dropbox`, default `supabase`) and `storage_backend_status` column (`active \| error \| null`) | Postgres `CREATE TYPE … AS ENUM` migration pattern documented; `ALTER TABLE … ADD COLUMN … DEFAULT` is non-blocking on Postgres |
| STOR-03 | `organisations` table gains encrypted token columns per provider with `_enc` suffix: `google_refresh_token_enc`, `google_access_token_enc`, `ms_token_cache_enc`, `dropbox_refresh_token_enc`, `dropbox_access_token_enc` | `ALTER TABLE … ADD COLUMN … TEXT` migration; naming convention established |
| STOR-04 | `client_documents` table gains `storage_backend` column recording which backend was active at upload time; set at insert time, never derived from org's current `storage_backend` | Column addition documented; all insert sites identified; STOR-04 must be part of the same migration as STOR-02 enum creation |
| STOR-05 | `lib/crypto/tokens.ts` exports `encryptToken(plaintext)` and `decryptToken(ciphertext)` using AES-256-GCM with `ENCRYPTION_KEY` env var; env var documented in `ENV_VARIABLES.md`; no plaintext token ever written to any DB column outside this module | Node.js `crypto` module AES-256-GCM pattern documented below; no additional npm package required |
| STOR-06 | `resolveProvider(orgConfig)` factory in `lib/documents/storage.ts` returns correct `StorageProvider` implementation based on `org.storage_backend`; Supabase is the default when no third-party backend configured | Factory pattern documented; `orgConfig` type derivable from the `organisations` row type |
</phase_requirements>

---

## Summary

Phase 24 is a pure foundations phase — no user-visible behaviour changes. It creates the TypeScript interface, schema columns, and cryptographic module that all three provider integrations (Phases 25-27) depend on. The three deliverables are independent: the TypeScript refactor, the schema migrations, and the crypto module can each be built and verified in isolation.

The TypeScript refactor is a non-breaking extraction. The existing three functions in `lib/documents/storage.ts` (`uploadDocument`, `getSignedDownloadUrl`, `deleteDocument`) are already the right operations — the task is to define a `StorageProvider` interface that matches their signatures (with minor normalization for `getBytes` and `getDownloadUrl`), wrap the existing implementations in a `SupabaseStorageProvider` class, and add a `resolveProvider()` factory that defaults to returning the Supabase provider. All four call sites in the existing codebase continue to work unchanged because they call the named exports, not the provider directly — the refactor can expose both the named exports (for backwards compatibility) and the interface/factory (for future providers).

The AES-256-GCM crypto module requires no additional npm packages. Node.js `crypto` has been built-in since Node 10 and supports AES-256-GCM natively. The key management pattern (32-byte hex env var decoded at runtime) is simple, well-understood, and requires no external key management service at this scale.

**Primary recommendation:** Complete the three deliverables in order: (1) schema migrations for both tables in one migration file, (2) TypeScript interface extraction with backwards-compatible named exports, (3) crypto module with env-var guard. Verify the TypeScript build passes cleanly before declaring the phase done.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` (built-in) | Node 20 (project uses `@types/node ^20`) | AES-256-GCM encryption/decryption | Built-in, zero dependency surface, FIPS-compliant algorithms, no npm package needed |
| TypeScript interfaces | TS 5 (already in project) | `StorageProvider` interface definition | Zero-cost abstraction; structural typing means `SupabaseStorageProvider` satisfies the interface without explicit `implements` |
| Postgres `CREATE TYPE AS ENUM` | Postgres 15 (Supabase) | `storage_backend_enum` type | Standard Postgres approach; type-safe values at DB level; `DEFAULT 'supabase'` ensures zero disruption to existing rows |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | ^2.95.3 (already installed) | `SupabaseStorageProvider` implementation | Already used by the existing `uploadDocument`, `getSignedDownloadUrl`, `deleteDocument` functions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js `crypto` AES-256-GCM | `libsodium-wrappers` (NaCl secretbox) | libsodium is simpler API but adds 600 KB WASM dependency; Node `crypto` is already available, well-documented, and sufficient |
| Node.js `crypto` AES-256-GCM | `@noble/ciphers` | Excellent pure-JS library but another dependency; not justified when native crypto is available |
| Postgres TEXT columns for tokens | Supabase Vault | Vault is a managed secret store but is not yet GA for all regions and adds infrastructure complexity; application-level AES-256-GCM achieves the same security goal |
| Enum type for `storage_backend` | TEXT with CHECK constraint | CHECK constraint is simpler to add values to later without migration; ENUM is slightly more type-safe; project decision is ENUM (matches existing pattern for `plan_tier_enum`, `subscription_status_enum`) |

**Installation:** No new npm packages required for Phase 24.

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── documents/
│   └── storage.ts          # StorageProvider interface + SupabaseStorageProvider + resolveProvider() factory
├── crypto/
│   └── tokens.ts           # encryptToken() + decryptToken() — ONLY place plaintext touches crypto
└── types/
    └── database.ts         # existing — add OrgConfig type or derive from Supabase generated types
```

### Pattern 1: StorageProvider Interface with Backwards-Compatible Named Exports

**What:** Define a `StorageProvider` interface, implement it with `SupabaseStorageProvider`, and keep the original named export functions as thin wrappers. This means all four existing call sites continue to work without modification.

**When to use:** Whenever you need to add a seam without breaking existing callers.

**Example:**

```typescript
// lib/documents/storage.ts

export interface StorageProvider {
  upload(params: UploadParams): Promise<{ storagePath: string }>;
  getDownloadUrl(storagePath: string): Promise<{ url: string }>;
  delete(storagePath: string): Promise<void>;
  getBytes(storagePath: string): Promise<Buffer>;
}

export class SupabaseStorageProvider implements StorageProvider {
  private bucket: string;

  constructor() {
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'prompt-documents';
  }

  async upload(params: UploadParams): Promise<{ storagePath: string }> {
    // existing uploadDocument logic, unchanged
  }

  async getDownloadUrl(storagePath: string): Promise<{ url: string }> {
    // existing getSignedDownloadUrl logic, unchanged
  }

  async delete(storagePath: string): Promise<void> {
    // existing deleteDocument logic, unchanged
  }

  async getBytes(storagePath: string): Promise<Buffer> {
    // download file bytes for DSAR export
    const { url } = await this.getDownloadUrl(storagePath);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch bytes: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

// Backwards-compatible named exports — existing call sites unchanged
export async function uploadDocument(params: UploadParams) {
  return new SupabaseStorageProvider().upload(params);
}
export async function getSignedDownloadUrl(storagePath: string) {
  const { url } = await new SupabaseStorageProvider().getDownloadUrl(storagePath);
  return { signedUrl: url };
}
export async function deleteDocument(storagePath: string) {
  return new SupabaseStorageProvider().delete(storagePath);
}

// Factory for Phases 25-27
export function resolveProvider(orgConfig: OrgStorageConfig): StorageProvider {
  switch (orgConfig.storage_backend) {
    case 'supabase':
    default:
      return new SupabaseStorageProvider();
    // future: case 'google_drive': return new GoogleDriveProvider(orgConfig);
  }
}
```

### Pattern 2: AES-256-GCM Token Encryption Module

**What:** A self-contained module that is the ONLY place in the codebase where plaintext tokens touch cryptographic operations. All `_enc` column writes must go through this module.

**Key format:** `ENCRYPTION_KEY` must be a 64-character hex string (32 bytes). Derive at module level with validation so failures are obvious at startup, not at runtime.

**Ciphertext format:** `iv:authTag:ciphertext` (all hex-encoded) concatenated as a single TEXT string. This is self-contained — decryption needs no external metadata.

**Example:**

```typescript
// lib/crypto/tokens.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited string: iv:authTag:ciphertext (all hex-encoded).
 * This is the ONLY function that may write to _enc columns.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV — GCM standard
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypts a ciphertext string produced by encryptToken().
 * Throws on invalid key, corrupted ciphertext, or auth tag mismatch.
 */
export function decryptToken(ciphertext: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid ciphertext format');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
```

**Note on GCM auth tag:** GCM provides authenticated encryption — the auth tag ensures ciphertext integrity. If any bit is tampered with, `decipher.final()` throws. Do NOT suppress this error.

**Note on IV uniqueness:** A fresh 12-byte random IV per encryption call guarantees ciphertext uniqueness even for identical plaintexts. Do NOT reuse IVs.

### Pattern 3: Schema Migration — Enum Type Before Column

**What:** Postgres requires the enum type to exist before columns can reference it. The migration must create the type before adding columns that use it.

**Important:** The `storage_backend` enum type must be created in the same migration as (or before) the columns on `organisations` and `client_documents`. Splitting across two migrations risks type not being found.

**Example migration SQL:**

```sql
-- Create the storage backend enum type
CREATE TYPE storage_backend_enum AS ENUM ('supabase', 'google_drive', 'onedrive', 'dropbox');

-- organisations: storage backend selection and status
ALTER TABLE organisations
  ADD COLUMN storage_backend storage_backend_enum NOT NULL DEFAULT 'supabase',
  ADD COLUMN storage_backend_status TEXT CHECK (storage_backend_status IN ('active', 'error', 'reauth_required')) DEFAULT NULL;

-- organisations: encrypted token columns per provider
ALTER TABLE organisations
  ADD COLUMN google_refresh_token_enc TEXT DEFAULT NULL,
  ADD COLUMN google_access_token_enc TEXT DEFAULT NULL,
  ADD COLUMN ms_token_cache_enc TEXT DEFAULT NULL,
  ADD COLUMN dropbox_refresh_token_enc TEXT DEFAULT NULL,
  ADD COLUMN dropbox_access_token_enc TEXT DEFAULT NULL;

-- client_documents: record which backend was active at upload time
ALTER TABLE client_documents
  ADD COLUMN storage_backend storage_backend_enum NOT NULL DEFAULT 'supabase';

-- Backfill: all existing documents were uploaded to Supabase
-- DEFAULT 'supabase' handles this automatically for existing rows on column addition
-- Verify: SELECT COUNT(*) FROM client_documents WHERE storage_backend IS NULL; → should be 0
```

### Anti-Patterns to Avoid

- **Deriving storage_backend from org config at read time:** Always use `doc.storage_backend` on `client_documents`, never `org.storage_backend`. Orgs can switch backends; documents cannot be retroactively rerouted.
- **Writing plaintext tokens directly to DB columns:** Any `organisations` update that writes an `_enc` column value MUST call `encryptToken()` first. Code review gate: grep for `_enc` column writes and verify they all go through `encryptToken()`.
- **Reusing IVs in AES-256-GCM:** Always call `randomBytes(12)` per encryption. Never use a counter, timestamp, or static value as IV.
- **Swallowing auth tag errors:** GCM tag validation failure means the ciphertext was tampered with or the wrong key was used. Always let the error propagate.
- **Module-level `ENCRYPTION_KEY` validation that crashes the build:** Lazy key validation (inside `getKey()`) is correct. Module-level validation runs at import time and would crash the Next.js build when the env var is not set in CI/preview environments.
- **Exposing `SupabaseStorageProvider` constructor broadly:** The provider should be created via `resolveProvider()`, not instantiated directly by call sites. This enforces the factory as the single point of provider selection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES encryption | Custom XOR/ROT cipher, base64-only encoding | Node.js `crypto` AES-256-GCM | GCM provides both confidentiality and integrity (auth tag). Custom ciphers have well-known vulnerabilities. |
| Key derivation from password | Manual PBKDF | Node.js `crypto.scrypt` or `crypto.pbkdf2` | If a human-memorable password were ever used as key material (not recommended), PBKDF is required. For this phase, `ENCRYPTION_KEY` is a raw 32-byte key from env. |
| IV generation | `Math.random()` or timestamp | `crypto.randomBytes(12)` | CSPRNG only. `Math.random()` is not cryptographically secure. |
| Storage provider selection | Long if/else chains everywhere | `resolveProvider(orgConfig)` factory | Single point of change when new providers are added in Phases 25-27. |
| Ciphertext format | Separate IV column, separate authTag column | Single TEXT field with `iv:authTag:ciphertext` | Self-contained; no risk of mismatched IV/tag/ciphertext across rows; simpler schema. |

---

## Existing Codebase — Call Sites to Preserve

These four call sites currently import from `lib/documents/storage.ts`. After the refactor, they must continue to work without modification:

| File | Function Used | Purpose |
|------|--------------|---------|
| `app/api/portal/[token]/upload/route.ts:74` | `uploadDocument()` | Client portal file upload |
| `app/api/postmark/inbound/route.ts:270` | `uploadDocument()` (dynamic import) | Postmark inbound attachment storage |
| `app/api/clients/[id]/documents/route.ts:68` | `getSignedDownloadUrl()` | Accountant document download |
| `app/api/clients/[id]/documents/dsar/route.ts:47` | `getSignedDownloadUrl()` | DSAR export — currently fetches signed URL then fetches bytes via that URL |

**Note on DSAR:** The current DSAR route uses `getSignedDownloadUrl()` then `fetch(signedUrl)` to get bytes. After Phase 24, it could use `provider.getBytes()` directly — but this change is OUT OF SCOPE for Phase 24. The existing DSAR flow continues to work unchanged because `getSignedDownloadUrl()` remains as a named export. The `getBytes()` method on the interface will first be used by a future phase.

**Note on `getBytes()`:** The `StorageProvider` interface requires `getBytes()` (per STOR-01 and the phase goal), but no existing caller uses it yet. The `SupabaseStorageProvider.getBytes()` implementation can be a thin wrapper over `getDownloadUrl()` + `fetch()` — identical to what the DSAR route currently does inline. This satisfies the interface contract and prepares for Google Drive Phase 25.

---

## Common Pitfalls

### Pitfall 1: TypeScript `strict` mode and Buffer types

**What goes wrong:** `Buffer` is a Node.js type. In strict TypeScript with `"lib": ["dom", "dom.iterable", "esnext"]` in `tsconfig.json` (as this project uses), `Buffer` is available via `@types/node` (present as `^20` in devDependencies). The `StorageProvider.upload()` params type should accept `Buffer | Uint8Array` to match the existing `uploadDocument` signature.

**Why it happens:** The tsconfig targets ESNext but the project runs in Node.js via Vercel serverless. `Buffer` is available at runtime via `@types/node` but not in `dom` lib. The project already uses `Buffer` throughout (see portal upload route), so this is not a new concern.

**How to avoid:** Match the existing `UploadParams` type signature exactly. Do not introduce `ArrayBuffer` as the file type in the interface — the callers pass `Buffer`.

### Pitfall 2: Enum migration and existing rows on `client_documents`

**What goes wrong:** `ALTER TABLE client_documents ADD COLUMN storage_backend storage_backend_enum NOT NULL DEFAULT 'supabase'` works correctly for existing rows because `DEFAULT 'supabase'` backfills them. However, if the enum type is created in a separate migration from the column addition, there is a risk of migration ordering issues.

**Why it happens:** Supabase applies migrations in timestamp order. If enum creation and column addition are in separate files, the enum file must have an earlier timestamp.

**How to avoid:** Put the enum creation (`CREATE TYPE storage_backend_enum`) and all column additions in a SINGLE migration file. This is the safest approach.

### Pitfall 3: `ENCRYPTION_KEY` absent in production but present in dev

**What goes wrong:** If `getKey()` is called at module load time (not inside the function), the Next.js build crashes when `ENCRYPTION_KEY` is not set in the Vercel build environment.

**Why it happens:** Vercel runs `next build` in an environment without all runtime env vars. Module-level initialization runs during build.

**How to avoid:** Always call `getKey()` lazily inside `encryptToken()` and `decryptToken()`. This matches the pattern established for the Stripe client (see `lib/stripe/client.ts` in STATE.md decision D-11-05-01).

### Pitfall 4: `storage_backend_status` NULL vs empty string

**What goes wrong:** Treating `NULL` and `''` interchangeably for `storage_backend_status`. A `NULL` status means "no check has been run" (freshly connected or Supabase backend). An `'error'` status means a health check failed.

**Why it happens:** JavaScript/TypeScript falsy checks treat both `null` and `''` as falsy, masking the distinction.

**How to avoid:** Use `IS NULL` / `IS NOT NULL` in SQL checks. In TypeScript, use explicit null checks (`status === null` vs `status === 'error'`). The column has a CHECK constraint limiting it to `('active', 'error', 'reauth_required', NULL)`.

### Pitfall 5: `resolveProvider()` called without org having storage columns

**What goes wrong:** In Phase 24, the schema migration adds `storage_backend` to `organisations`. But existing queries that select from `organisations` may not include `storage_backend` in their SELECT list, so `orgConfig.storage_backend` is `undefined`. `resolveProvider()` receives `undefined` and must handle it gracefully.

**Why it happens:** TypeScript types are derived from Supabase-generated types — if the generated types aren't updated after the migration, the type system doesn't catch the missing field.

**How to avoid:** The `OrgStorageConfig` type should have `storage_backend: storage_backend_enum | null` with null treated as `'supabase'` in the factory switch. The `default` case in the switch always returns `SupabaseStorageProvider`, ensuring graceful degradation.

---

## Code Examples

### AES-256-GCM encrypt/decrypt round-trip

```typescript
// Source: Node.js official documentation — crypto module
// https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptToken(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes from 64-char hex
  const iv = randomBytes(12);                                   // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptToken(ciphertext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
```

### OrgStorageConfig type

```typescript
// Minimal type needed by resolveProvider() — derive from Supabase-generated types or define inline
export type StorageBackend = 'supabase' | 'google_drive' | 'onedrive' | 'dropbox';

export interface OrgStorageConfig {
  id: string;
  storage_backend: StorageBackend | null;
  // Token columns are NOT included in this type — resolveProvider() should not touch tokens
  // Token decryption happens inside the provider constructors in Phases 25-27
}
```

### ENV_VARIABLES.md entry for ENCRYPTION_KEY

```markdown
### `ENCRYPTION_KEY`

\`\`\`
ENCRYPTION_KEY=<64-character-hex-string>
\`\`\`

**What it is:** A 32-byte (256-bit) symmetric encryption key, hex-encoded as a 64-character string. Used by `lib/crypto/tokens.ts` to encrypt and decrypt OAuth refresh tokens and access tokens before they are stored in the database.

**Format:** Must be exactly 64 hexadecimal characters (0-9, a-f). Generate with:
\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

**Used in:** `lib/crypto/tokens.ts` — `encryptToken()` and `decryptToken()` functions only. No other module reads this variable.

**Security requirements:**
- MUST NOT be stored in Supabase (not in `app_settings` or any database table)
- MUST NOT be committed to source control
- Store only in Vercel environment variables (encrypted at rest by Vercel)
- Rotation: if rotated, all existing `_enc` columns must be re-encrypted before the old key is discarded

**Required:** Yes — `lib/crypto/tokens.ts` throws at call time if absent or wrong length. Absence does not crash the build (lazy validation), but any token operation will fail at runtime.
```

---

## Implementation Sequence

The three deliverables have no dependency between them. However, the recommended order is:

1. **Schema migration first** — ensures the database columns exist before any TypeScript code references them. Applying the migration is a prerequisite for generating updated TypeScript types from Supabase.
2. **TypeScript interface extraction** — add `StorageProvider` interface and `resolveProvider()` factory to `lib/documents/storage.ts`. Keep all named exports unchanged. Verify `npm run build` passes.
3. **Crypto module** — create `lib/crypto/tokens.ts`, add `ENCRYPTION_KEY` to `ENV_VARIABLES.md`. No callers yet in Phase 24 (callers are built in Phases 25-27). Verify `npm run build` passes.

Each step can be committed independently. The phase is complete when all three exist and `npm run build` produces zero TypeScript errors.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AES-256-CBC (no auth tag) | AES-256-GCM (AEAD — auth tag included) | Node.js 10+ | GCM provides authentication; CBC does not. Use GCM always for token encryption. |
| Storing tokens in plaintext | Encrypted storage with app-level AES-256-GCM | Industry standard for OAuth token storage at rest | Breach of DB does not expose permanent cloud storage access |
| Provider-specific code inline | `StorageProvider` interface + factory | Phase 24 (this phase) | Enables Phases 25-27 to add providers without modifying existing call sites |

**Deprecated/outdated:**
- AES-256-CBC for symmetric encryption of secrets: does not provide authentication. An attacker can flip bits in the ciphertext without detection. GCM replaces it for all new uses.

---

## Open Questions

1. **`getBytes()` return type: `Buffer` vs `Uint8Array` vs `ReadableStream`**
   - What we know: The DSAR route currently downloads via a Supabase signed URL (`fetch(signedUrl)`), assembles bytes as `ArrayBuffer`, and feeds them to JSZip. Phase 25 (Google Drive) will need to proxy bytes from the Drive API.
   - What's unclear: Whether Phase 25 needs streaming (`ReadableStream`) or buffered bytes (`Buffer`) for large PDFs. The current Vercel function timeout is 60 seconds (set on the DSAR route with `export const maxDuration = 60`). For large document sets, streaming would be needed — but that is a Phase 29 concern.
   - Recommendation: Define `getBytes()` as returning `Promise<Buffer>` for Phase 24. This matches the current pattern and keeps the interface simple. Phase 29 can revisit if streaming is needed.

2. **`storage_backend_status` values — include `reauth_required` in enum or keep as TEXT with CHECK?**
   - What we know: STOR-02 describes `storage_backend_status` as `active | error | null`. STOR-05 (via `withTokenRefresh` in Phase 25) will also set `reauth_required`.
   - What's unclear: Whether `reauth_required` is a subset of `error` or a distinct state. The STATE.md v5.0 Known Risks section #1 explicitly uses `reauth_required` as a status value.
   - Recommendation: Add `reauth_required` to the CHECK constraint for `storage_backend_status` now, even though Phase 24 doesn't use it. The migration is cleaner than adding a new constraint in Phase 25. Use TEXT + CHECK (not enum) for status so values can be added without `ALTER TYPE`.

3. **`OrgStorageConfig` — derive from Supabase-generated types or define manually?**
   - What we know: The project does not currently auto-generate Supabase types as part of the build. The `database.ts` types in `lib/types/` appear to be manually maintained.
   - Recommendation: Define `OrgStorageConfig` as a minimal interface in `lib/documents/storage.ts` directly — enough to type `resolveProvider()`. Full Supabase type regeneration is not required for Phase 24.

---

## Sources

### Primary (HIGH confidence)

- Node.js 20 official documentation — `crypto.createCipheriv`, `crypto.createDecipheriv`, `crypto.randomBytes`, AES-256-GCM usage — https://nodejs.org/api/crypto.html
- Postgres 15 documentation — `CREATE TYPE AS ENUM`, `ALTER TABLE ADD COLUMN` — https://www.postgresql.org/docs/15/sql-createtype.html
- Project codebase analysis — existing `lib/documents/storage.ts` (read directly), all four call sites identified and verified, existing `tsconfig.json`, `package.json` dependency list

### Secondary (MEDIUM confidence)

- MEMORY.md project decisions: D-11-05-01 (lazy Stripe client initialization) — establishes the lazy env var validation pattern for `ENCRYPTION_KEY`
- STATE.md v5.0 Decisions section — `ENCRYPTION_KEY` env var requirement, `_enc` column suffix convention, `storage_backend` column-per-document decision, all pre-decided before Phase 24 coding

### Tertiary (LOW confidence)

- None — all critical claims are verified against project source or official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Node.js crypto built-in, confirmed in Node 20; TypeScript interface patterns are project-standard; no new npm packages
- Architecture: HIGH — existing call sites verified by grep; interface extraction is mechanical; schema columns derived from REQUIREMENTS.md which is authoritative
- Pitfalls: HIGH — lazy key loading pattern verified from existing Stripe lazy client (D-11-05-01); enum-before-column ordering is documented Postgres behaviour; GCM auth tag semantics are from Node.js official docs

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable domain — crypto primitives and Postgres enum semantics do not change)
