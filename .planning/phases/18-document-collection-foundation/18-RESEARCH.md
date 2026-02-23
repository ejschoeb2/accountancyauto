# Phase 18: Document Collection Foundation - Research

**Researched:** 2026-02-23
**Domain:** Supabase Storage (RLS + file upload), Postgres schema design, portal token security, UK GDPR compliance (data retention), Next.js server utilities
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Document type catalog**
- Seed data covers all 4 filing types fully (SA100, CT600, VAT, Companies House) — not just the 6 types named in success criteria
- Researcher determines the complete but minimal catalog for each filing type based on HMRC documentation
- Each document type row has: machine code (e.g. `P60`), display label (e.g. `P60 End-of-Year Certificate`), and a description field for portal checklist text (e.g. "Your employer provides this after the tax year ends")
- `filing_document_requirements` uses a binary `is_mandatory` flag (not a condition enum)
- Researcher populates the description text for all seeded document types

**Portal token behaviour**
- Default token expiry: 7 days from generation
- Tokens are multi-use until expiry (client may upload across multiple visits)
- Tokens are filing-type + tax-year scoped — each token issued for a specific client + filing type + tax year combination
- No `revoked_at` column in Phase 18 (deferred to Phase 19)
- Token storage: SHA-256 hash only, raw token never persisted

**Retention model**
- SA100 = individual: `retain_until = january_31_deadline + 5 years`, where `january_31_deadline` is January 31 immediately following the tax year end
- All other filing types (CT600, VAT, Companies House) = company: `retain_until = tax_period_end_date + 6 years`
- `calculateRetainUntil` signature: `(filingType: FilingType, taxPeriodEndDate: Date) => Date`
- `retain_until` persisted to `client_documents` at upload time

**Privacy policy integration**
- Amendments edited inline into existing `/privacy` page — no separate amendment section
- Terms Section 6 amendment goes into the separate `/terms` page
- Researcher drafts the exact amendment language for all 7 items
- Privacy policy + terms updates are a single plan task

### Claude's Discretion
- Exact schema column types and constraints (beyond what success criteria specifies)
- Index strategy for the 5 tables
- Order of migrations within the phase

### Deferred Ideas (OUT OF SCOPE)
- `revoked_at` column on `upload_portal_tokens` — Phase 19 adds this before portal UI is built
- Token expiry configurability (per-token expiry set by accountant)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | Seeded `document_types` catalog: HMRC document types with retention years, retention anchor, expected format metadata, and classification hints | HMRC document catalog research; see "HMRC Document Catalog" section below |
| DOCS-02 | `filing_document_requirements` table mapping document types to filing types with mandatory/conditional flags | Schema design section; binary `is_mandatory` flag per CONTEXT.md decision |
| DOCS-03 | `client_documents` table: metadata per org with all required columns including `tax_period_end_date` (NOT NULL) and `retention_hold` (NOT NULL) | Schema design section; Supabase RLS pattern matches existing project conventions |
| DOCS-04 | `document_access_log` table: INSERT-only RLS for authenticated users; every access/download logged | RLS pattern: INSERT + SELECT (own inserts); service_role for UPDATE/DELETE — consistent with project's per-operation RLS approach |
| DOCS-05 | Supabase Storage private bucket `prompt-documents`; org-scoped path; `storage.objects` RLS using `storage.foldername()` and JWT `app_metadata.org_id` | Storage RLS helper functions confirmed in Supabase docs; `auth_org_id()` helper already defined in project |
| DOCS-06 | `upload_portal_tokens` table: SHA-256 hashed tokens, 256-bit entropy, scoped to org+client+filing+tax_year, `expires_at`, `used_at` | Token security pattern; Node.js `crypto.randomBytes(32)` + `createHash('sha256')` |
| COMP-01 | Privacy policy at `/privacy` and Terms at `/terms` updated inline with all 7 identified gaps | Existing pages located; amendment language drafted below |
</phase_requirements>

---

## Summary

Phase 18 is entirely backend infrastructure — five new Postgres tables, a private Supabase Storage bucket with org-scoped RLS, HMRC seed data, portal token security, storage utility functions, and privacy/terms amendments. Nothing is displayed or collected yet.

The project already has a mature foundation: org-scoped RLS using `auth_org_id()` (defined in migration `20260219000004`), a `createAdminClient()` wrapper (service role, bypasses RLS), and established migration conventions. Phase 18 follows the same schema patterns exactly: UUID PKs, `org_id UUID NOT NULL REFERENCES organisations(id)`, per-operation RLS policies using `auth_org_id()`, and service_role policies for admin access.

The most novel technical area is Supabase Storage RLS on `storage.objects`. The official helper function `storage.foldername(name)` returns an array of path segments, allowing org-scoped access by checking that `foldername(name)[1]` equals the user's JWT `app_metadata.org_id`. This is well-documented and confirmed in the Supabase Storage Access Control docs. The bucket must be created manually via the Supabase Dashboard — it cannot be created via SQL migration.

**Primary recommendation:** Write Storage RLS policies and test them with a real authenticated JWT before Phase 19 begins. The policies are the hardest-to-debug artifact in this phase; all other tasks are straightforward schema migrations and TypeScript utilities following established project patterns.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.95.3` (already installed) | Storage upload, signed URL generation, metadata queries | Project's standard Supabase client |
| Node.js `crypto` | built-in | SHA-256 token hashing, `randomBytes(32)` for entropy | No additional package needed; built into Node runtime |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `file-type` | `^21.3.0` | Magic-byte MIME validation on upload | Already decided in STATE.md v4.0 decisions — install when writing `uploadDocument` utility |
| `date-fns` | `^4.1.0` (already installed) | `calculateRetainUntil` date arithmetic (`addYears`) | Already in project; use for retention date calculation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `storage.upload()` with admin client | `createSignedUploadUrl()` | `createSignedUploadUrl` has a known `owner=null` bug with service_role in storage-js #186 — use `storage.upload()` instead (already decided in STATE.md) |
| SHA-256 token hash | bcrypt/argon2 | SHA-256 is sufficient for 256-bit random tokens (unlike passwords, brute-force is infeasible at 2^256 entropy) |

**Installation:**
```bash
npm install file-type@^21.3.0
```
(`fflate` is for DSAR ZIP in Phase 19 — do NOT install in Phase 18)

---

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── documents/
│   ├── storage.ts        # uploadDocument, getSignedDownloadUrl, deleteDocument
│   └── metadata.ts       # calculateRetainUntil
supabase/migrations/
├── 20260223XXXXXX_document_collection_tables.sql
├── 20260223XXXXXX_document_rls_policies.sql
├── 20260223XXXXXX_document_types_seed.sql
└── 20260223XXXXXX_storage_objects_rls.sql
app/
└── (marketing)/
    ├── privacy/page.tsx   # amended inline
    └── terms/page.tsx     # Section 6 amended inline
```

### Pattern 1: Storage RLS — Org-Scoped Path Prefix Check
**What:** Supabase Storage RLS policies on `storage.objects` use the `storage.foldername(name)` helper, which returns an array of path segments. For the path `orgs/{org_id}/clients/{client_id}/...`, `foldername(name)[1]` is the org_id segment.

**The project already has `auth_org_id()` defined** (in migration `20260219000004_create_jwt_hook.sql`) — a SQL function that extracts `org_id` from `app_metadata` in the JWT. Use this directly in Storage policies.

**Example:**
```sql
-- Source: Supabase Storage Access Control docs + project's existing auth_org_id() helper
CREATE POLICY "documents_select_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

CREATE POLICY "documents_insert_org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

CREATE POLICY "documents_update_org"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

CREATE POLICY "documents_delete_org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);
```

Note: `auth_org_id()` returns a UUID; cast to `::text` to match the string segments returned by `foldername()`.

### Pattern 2: Token Security
**What:** Generate a 256-bit random token, show it once (in the generated portal URL), store only the SHA-256 hash.

```typescript
// Source: Node.js crypto built-in (no library needed)
import { randomBytes, createHash } from 'crypto';

function generatePortalToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('hex'); // 64-char hex = 256-bit
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

// Portal URL: /portal/{rawToken}  (shown once, never stored)
// DB stores:  token_hash = tokenHash  (SHA-256)
```

### Pattern 3: Retention Date Calculation
**What:** `calculateRetainUntil` derives the retention deadline from filing type and tax period end date.

```typescript
// Source: CONTEXT.md decisions + date-fns (already installed)
import { addYears } from 'date-fns';

type FilingType = 'self_assessment' | 'corporation_tax_payment' | 'ct600_filing' | 'vat_return' | 'companies_house';

function calculateRetainUntil(filingType: FilingType, taxPeriodEndDate: Date): Date {
  if (filingType === 'self_assessment') {
    // SA100 = individual: January 31 following tax year end + 5 years
    const taxYearEnd = taxPeriodEndDate; // e.g. 2025-04-05
    // January 31 immediately following: if taxYearEnd is in tax year ending Apr 5,
    // the filing deadline is Jan 31 of the calendar year after the tax year end
    const jan31Deadline = new Date(taxYearEnd.getFullYear() + 1, 0, 31); // Jan = month 0
    return addYears(jan31Deadline, 5);
  } else {
    // Company (CT600, VAT, Companies House, Corporation Tax Payment): +6 years
    return addYears(taxPeriodEndDate, 6);
  }
}
```

**Important edge case:** For SA100, the tax year ends 5 April. If `taxPeriodEndDate` is `2025-04-05`, the January 31 deadline is `2026-01-31`, and `retain_until` = `2031-01-31`. The month index is 0-based in JavaScript's `Date` constructor.

### Pattern 4: Storage Upload Utility (Admin Client)
**What:** Server-side upload using admin client (bypasses RLS — correct for server-initiated uploads). Browser never gets the raw token; uploads go via Next.js server action.

For Phase 19 portal uploads: the client portal will use a signed upload URL via a server action that validates the portal token first. For Phase 18, only the utility function is needed.

```typescript
// Source: STATE.md v4.0 decisions — "use storage.upload() with admin client"
import { createAdminClient } from '@/lib/supabase/admin';

async function uploadDocument(
  orgId: string,
  clientId: string,
  filingTypeId: string,
  taxYear: string,
  file: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<{ storagePath: string }> {
  const adminClient = createAdminClient();
  const ext = originalFilename.split('.').pop() ?? 'bin';
  const uuid = crypto.randomUUID();
  const storagePath = `orgs/${orgId}/clients/${clientId}/${filingTypeId}/${taxYear}/${uuid}.${ext}`;

  const { error } = await adminClient.storage
    .from('prompt-documents')
    .upload(storagePath, file, { contentType: mimeType, upsert: false });

  if (error) throw error;
  return { storagePath };
}
```

### Anti-Patterns to Avoid
- **`createSignedUploadUrl` with service role:** The storage-js library has a known bug where `owner` is set to `null` when using service role for signed upload URLs (storage-js issue #186). Use `storage.upload()` with admin client instead.
- **Storing raw portal tokens:** Only the SHA-256 hash goes in the database. The raw token appears only in the URL returned to the accountant.
- **Permanent/public document URLs:** UK GDPR violation. Always generate signed URLs with 300-second max expiry and log each generation in `document_access_log`.
- **Anchoring retention to `received_at`:** HMRC retention periods are anchored to the tax period end date, not when the document was received. The `tax_period_end_date` column is NOT NULL for this reason.
- **Creating the bucket via SQL:** The storage `buckets` table is managed-only — do not INSERT directly. Create via Supabase Dashboard or management API.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME type detection | Custom extension parsing | `file-type@^21.3.0` (magic bytes) | Extension spoofing is trivial; magic bytes detect actual file format |
| Token entropy | `Math.random()`, UUID v4 | `crypto.randomBytes(32)` | CSPRNG required; UUID v4 is only 122 bits and uses `Math.random()` in some envs |
| Date arithmetic for retention | Manual month/year arithmetic | `date-fns` `addYears` | Already installed; handles leap years and month boundaries correctly |
| Storage path prefix validation in RLS | Custom SQL function | `storage.foldername()` + `auth_org_id()` | Both already exist and are production-tested |

**Key insight:** The project already has `auth_org_id()` — a tested helper that extracts `org_id` from JWT `app_metadata`. Reuse it in Storage RLS policies without duplication.

---

## Common Pitfalls

### Pitfall 1: Storage RLS Not Written — Bucket Rejects All SDK Calls
**What goes wrong:** A private bucket without explicit `storage.objects` RLS policies rejects all non-service-role SDK calls with 403 errors. Unlike database tables, the bucket privacy setting ("private") only controls public URL access — authenticated SDK access still requires explicit RLS policies.
**Why it happens:** Supabase Storage uses RLS on `storage.objects` for SDK access control. The default is deny-all without policies.
**How to avoid:** Write all four RLS policies (SELECT, INSERT, UPDATE, DELETE) on `storage.objects` in the migration before Phase 19 testing begins.
**Warning signs:** Every `storage.from('prompt-documents').upload()` call returns 403 even with a valid authenticated JWT.

### Pitfall 2: `auth_org_id()` Returns UUID, `foldername()` Returns Text
**What goes wrong:** `(storage.foldername(name))[2] = auth_org_id()` fails with a type mismatch — `foldername()` returns `text`, `auth_org_id()` returns `uuid`.
**Why it happens:** PostgreSQL strict type comparison between `uuid` and `text`.
**How to avoid:** Cast: `(storage.foldername(name))[2] = (auth_org_id())::text`
**Warning signs:** Policy is syntactically valid but returns 0 rows for all authenticated users.

### Pitfall 3: SA100 Retention January 31 Off-By-One
**What goes wrong:** `calculateRetainUntil` calculates the wrong January 31 for SA100 filings.
**Why it happens:** Tax year ends April 5. The January 31 deadline is in the calendar year AFTER the tax year end year. For a tax year ending `2025-04-05`, the year component of the deadline is `2026` (not `2025`).
**How to avoid:** `new Date(taxPeriodEndDate.getFullYear() + 1, 0, 31)` — month index 0 = January. Then add 5 years.
**Warning signs:** Test case: `taxPeriodEndDate = 2025-04-05` → expected `2031-01-31`, actual wrong date.

### Pitfall 4: `document_types` Table — Global vs Org-Scoped
**What goes wrong:** Giving `document_types` an `org_id` column when it should be a global reference table.
**Why it happens:** The project pattern is to add `org_id` to all tenant tables. But `document_types` is seed/reference data like `filing_types` — no org_id, globally readable by authenticated users.
**How to avoid:** Model `document_types` and `filing_document_requirements` like `filing_types`: no `org_id`, RLS `USING(true)` for authenticated SELECT, service_role for writes.
**Warning signs:** Authenticated queries return 0 rows when org_id filter is applied to reference tables with no org_id column.

### Pitfall 5: Privacy Policy is a Hard Gate
**What goes wrong:** Documents are stored in production before the privacy policy is updated — UK GDPR Articles 13/14 transparency obligation violation.
**Why it happens:** Ordering plan tasks incorrectly (COMP-01 after DOCS-05).
**How to avoid:** COMP-01 (privacy + terms amendments) must be committed and deployed BEFORE any production Storage testing. It is a hard gate, not a nice-to-have.

### Pitfall 6: Bucket Name and Region
**What goes wrong:** Bucket created in wrong region, increasing latency or violating data residency preferences.
**Why it happens:** Supabase Dashboard defaults to the project region, but confirm before clicking create.
**How to avoid:** Verify project region in Dashboard. Bucket name = `prompt-documents` (already decided in STATE.md). Private bucket (not public). Max upload size: no hard limit set in Phase 18 (Phase 19 concern).

---

## Code Examples

### Storage RLS Migration (complete, verified pattern)
```sql
-- Source: Supabase Storage Access Control docs + project's auth_org_id() from 20260219000004
-- Run AFTER bucket 'prompt-documents' is created in Dashboard

-- SELECT: authenticated org members can read their org's files
CREATE POLICY "documents_select_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

-- INSERT: authenticated org members can upload to their org's prefix
CREATE POLICY "documents_insert_org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

-- UPDATE: authenticated org members can update (metadata) in their prefix
CREATE POLICY "documents_update_org"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

-- DELETE: authenticated org members can delete in their prefix
CREATE POLICY "documents_delete_org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'prompt-documents'
  AND (storage.foldername(name))[1] = 'orgs'
  AND (storage.foldername(name))[2] = (auth_org_id())::text
);

-- Service role: full access for admin operations (cron, server actions)
CREATE POLICY "documents_service_role_all"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'prompt-documents')
WITH CHECK (bucket_id = 'prompt-documents');
```

### Table: client_documents (complete schema)
```sql
CREATE TABLE client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id),
  document_type_id UUID REFERENCES document_types(id),    -- nullable for unclassified
  storage_path TEXT NOT NULL,                              -- orgs/{org_id}/clients/{...}
  original_filename TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tax_period_end_date DATE NOT NULL,                       -- retention anchor (NOT NULL)
  retain_until DATE NOT NULL,                              -- derived at upload time
  retention_hold BOOLEAN NOT NULL DEFAULT false,           -- HMRC enquiry hold
  retention_flagged BOOLEAN NOT NULL DEFAULT false,        -- set by cron when retain_until passed
  classification_confidence TEXT NOT NULL DEFAULT 'unclassified'
    CHECK (classification_confidence IN ('high', 'medium', 'low', 'unclassified')),
  source TEXT NOT NULL CHECK (source IN ('inbound_email', 'portal_upload', 'manual')),
  uploader_user_id UUID,                                   -- null for inbound_email
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_client_documents_org_id ON client_documents(org_id);
CREATE INDEX idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX idx_client_documents_filing_type ON client_documents(filing_type_id);
CREATE INDEX idx_client_documents_retain_until ON client_documents(retain_until)
  WHERE NOT retention_hold;  -- partial index for retention cron efficiency
```

### Table: upload_portal_tokens (complete schema)
```sql
CREATE TABLE upload_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id),
  tax_year TEXT NOT NULL,              -- e.g. '2024-25' (display), or YYYY format
  token_hash TEXT NOT NULL UNIQUE,     -- SHA-256 hex of raw token (raw token never stored)
  expires_at TIMESTAMPTZ NOT NULL,     -- DEFAULT now() + interval '7 days' set in app
  used_at TIMESTAMPTZ,                 -- last use timestamp (multi-use until expiry)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID             -- accountant who generated the link
);

ALTER TABLE upload_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_upload_portal_tokens_org_id ON upload_portal_tokens(org_id);
CREATE INDEX idx_upload_portal_tokens_token_hash ON upload_portal_tokens(token_hash);
-- Composite index for accountant "view active tokens for client" query
CREATE INDEX idx_upload_portal_tokens_client_filing
  ON upload_portal_tokens(client_id, filing_type_id, tax_year);
```

### Table: document_access_log (INSERT-only RLS)
```sql
CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  document_id UUID NOT NULL REFERENCES client_documents(id) ON DELETE CASCADE,
  user_id UUID,                        -- null for portal (unauthenticated) access if needed
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'delete')),
  session_context TEXT,                -- optional: IP, user agent summary
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

-- INSERT-only for authenticated (audit trail integrity — no UPDATE/DELETE via RLS)
CREATE POLICY "document_access_log_insert_org"
ON document_access_log FOR INSERT TO authenticated
WITH CHECK (org_id = auth_org_id());

-- SELECT: org members can read their own org's audit log
CREATE POLICY "document_access_log_select_org"
ON document_access_log FOR SELECT TO authenticated
USING (org_id = auth_org_id());

-- Service role: full access for admin operations
CREATE POLICY "document_access_log_service_role_all"
ON document_access_log FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_document_access_log_org_id ON document_access_log(org_id);
CREATE INDEX idx_document_access_log_document_id ON document_access_log(document_id);
CREATE INDEX idx_document_access_log_created_at ON document_access_log(created_at DESC);
```

---

## HMRC Document Catalog (Seed Data)

This section defines the complete `document_types` and `filing_document_requirements` seed data. The table is a global reference (no `org_id`).

### document_types rows

| code | label | description (portal text) | applicable_to |
|------|-------|--------------------------|----------------|
| `P60` | P60 End-of-Year Certificate | Your employer provides this after the tax year ends in April. It shows your total pay and tax deducted. | SA100 |
| `P45` | P45 Details of Employee Leaving Work | Provided by your employer when you leave a job. Shows pay and tax to the date of leaving. | SA100 |
| `P11D` | P11D Expenses and Benefits | Issued by your employer if you received benefits such as a company car, private medical insurance, or loans. | SA100 |
| `SA302` | SA302 Tax Calculation | A summary of your income and tax liability produced by HMRC. Download from your HMRC online account or request by post. | SA100 |
| `BANK_STATEMENT` | Bank Statements | Bank statements for all accounts held in the tax year. Provide full year statements for all current and savings accounts. | SA100, CT600, VAT |
| `DIVIDEND_VOUCHER` | Dividend Vouchers | Vouchers issued for dividends received during the tax year. Your company secretary or registrar provides these. | SA100, CT600 |
| `RENTAL_INCOME` | Rental Income Records | Records of all rental income received and allowable expenses paid during the tax year. | SA100 |
| `SELF_EMPLOYMENT` | Self-Employment Income & Expenses | Sales records, expense receipts, and mileage logs if you are self-employed or a sole trader. | SA100 |
| `PENSION_LETTER` | Pension Award Letters | Letters confirming pension income from any private or state pension received during the year. | SA100 |
| `GIFT_AID` | Gift Aid Records | Records of charitable donations made under Gift Aid. Your charity should provide a receipt. | SA100 |
| `CT600_ACCOUNTS` | Statutory Accounts | Signed statutory accounts (profit and loss account and balance sheet) for the accounting period. | CT600 |
| `CT600_TAX_COMPUTATION` | Tax Computation Workings | Detailed tax computation showing the calculation of Corporation Tax liability. | CT600 |
| `PAYROLL_SUMMARY` | Payroll Summary (P32/P11D) | PAYE payroll records for the period, including employer and employee NICs paid. | CT600 |
| `LOAN_STATEMENTS` | Loan and Director Loan Statements | Statements for any company loans, including director's loan account balances. | CT600 |
| `FIXED_ASSET_REGISTER` | Fixed Asset Register | Schedule of fixed assets held, additions, disposals, and depreciation for the period. | CT600 |
| `SHARE_REGISTER` | Share Register and Shareholder Details | Current share register showing all shareholders, share classes, and beneficial ownership. | CT600, CH |
| `VAT_RETURN_WORKINGS` | VAT Return Workings | Working papers supporting the VAT figures: output tax schedules, input tax schedules, and reconciliation. | VAT |
| `PURCHASE_INVOICES` | Purchase Invoices | All VAT-registered purchase invoices and receipts for the period. | VAT |
| `SALES_INVOICES` | Sales Invoices | All sales invoices raised during the VAT period with VAT breakdown. | VAT |
| `FUEL_SCALE_CHARGE` | Fuel Scale Charge Record | Evidence of the fuel scale charge applied if the company provides fuel for private use. | VAT |
| `CH_ACCOUNTS` | Companies House Annual Accounts | Filleted or abridged accounts filed at Companies House. Typically prepared from the full statutory accounts. | CH |
| `CONFIRMATION_STATEMENT` | Confirmation Statement Information | Current officer details, registered office address, share structure, and PSC register for the Confirmation Statement. | CH |
| `PSC_REGISTER` | Persons with Significant Control Register | Register of all persons or entities with significant control over the company. | CH |

### filing_document_requirements mapping

**SA100 (Self Assessment):**
| document_type_code | is_mandatory |
|--------------------|-------------|
| `P60` | false (mandatory if employed) |
| `P45` | false (mandatory if left employment) |
| `P11D` | false (mandatory if benefits received) |
| `SA302` | false (if HMRC issues one) |
| `BANK_STATEMENT` | true |
| `DIVIDEND_VOUCHER` | false |
| `RENTAL_INCOME` | false (mandatory if rental income) |
| `SELF_EMPLOYMENT` | false (mandatory if self-employed) |
| `PENSION_LETTER` | false (mandatory if pension income) |
| `GIFT_AID` | false |

**CT600 (Corporation Tax):**
| document_type_code | is_mandatory |
|--------------------|-------------|
| `CT600_ACCOUNTS` | true |
| `CT600_TAX_COMPUTATION` | true |
| `BANK_STATEMENT` | true |
| `PAYROLL_SUMMARY` | false |
| `DIVIDEND_VOUCHER` | false |
| `LOAN_STATEMENTS` | false |
| `FIXED_ASSET_REGISTER` | false |
| `SHARE_REGISTER` | false |

**VAT Return:**
| document_type_code | is_mandatory |
|--------------------|-------------|
| `VAT_RETURN_WORKINGS` | true |
| `PURCHASE_INVOICES` | true |
| `SALES_INVOICES` | true |
| `BANK_STATEMENT` | true |
| `FUEL_SCALE_CHARGE` | false |

**Companies House:**
| document_type_code | is_mandatory |
|--------------------|-------------|
| `CH_ACCOUNTS` | true |
| `CONFIRMATION_STATEMENT` | true |
| `PSC_REGISTER` | true |
| `SHARE_REGISTER` | false |

**Note on `is_mandatory`:** Given CONTEXT.md decision that `is_mandatory` is a binary flag, several items above are `false` because their mandatory nature depends on the client's circumstances. The portal checklist UI (Phase 19) will show all items; the accountant can customise per client (ACTV-04). Flagging `is_mandatory = false` for conditional documents is the correct interpretation of the binary flag.

### Full document_types schema
```sql
CREATE TABLE document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,            -- machine code: 'P60', 'BANK_STATEMENT', etc.
  label TEXT NOT NULL,                  -- display: 'P60 End-of-Year Certificate'
  description TEXT NOT NULL,           -- portal checklist text
  default_retention_years INT NOT NULL, -- statutory retention (6 for most; 5 for SA100 docs)
  expected_mime_types TEXT[],           -- e.g. ARRAY['application/pdf', 'image/jpeg']
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

-- Global reference data: readable by all authenticated users (like filing_types)
CREATE POLICY "document_types_select_authenticated"
ON document_types FOR SELECT TO authenticated
USING (true);

-- Only service_role can write (seed data, immutable for users)
CREATE POLICY "document_types_service_role_all"
ON document_types FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

### filing_document_requirements schema
```sql
CREATE TABLE filing_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id),
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(filing_type_id, document_type_id)
);

ALTER TABLE filing_document_requirements ENABLE ROW LEVEL SECURITY;

-- Global reference data: readable by all authenticated users
CREATE POLICY "filing_document_requirements_select_authenticated"
ON filing_document_requirements FOR SELECT TO authenticated
USING (true);

CREATE POLICY "filing_document_requirements_service_role_all"
ON filing_document_requirements FOR ALL TO service_role
USING (true) WITH CHECK (true);
```

---

## Privacy Policy and Terms Amendments (Draft Language)

The following is the drafted amendment language for all 7 identified gaps. The planner should implement these as a single task editing both `/privacy` and `/terms` pages.

### Amendment 1: Financial Documents as a Data Category (Section 3 of /privacy)
**Location:** Under "Client Data (Stored by Accountants as Data Controllers)" subsection. Add new bullet point:

> - Financial documents and records uploaded through the client portal — including but not limited to tax certificates (P60, P45), employer forms (P11D), HMRC tax calculations (SA302), bank statements, dividend vouchers, statutory accounts, VAT records, and Companies House filing documents

### Amendment 2: 6-Year Statutory Retention Carve-Out (Section 9 of /privacy)
**Location:** Add a new bullet point to the existing retention list:

> - Financial documents and tax records uploaded to the platform are subject to statutory retention requirements. Under HMRC record-keeping obligations (TMA 1970 s12B for individuals; HMRC CH14600 for companies) and UK GDPR Article 17(3)(b), financial documents must be retained for a minimum of 5 years from the 31 January filing deadline (individual filings) or 6 years from the tax period end date (company filings). These documents will not be deleted within the applicable statutory retention period, even on account cancellation.

### Amendment 3: Broadened Processing Scope (Section 4 of /privacy)
**Location:** Update the last paragraph that currently reads "We process client data only as instructed — specifically for sending reminders...". Replace with:

> We process client data only as instructed — specifically for sending reminders, rendering email templates, delivering email communications, storing and managing financial documents and tax records uploaded via the accountant portal or received as email attachments, and providing accountants with access to those documents on behalf of their clients. We will not access, use, or disclose client data for any other purpose.

### Amendment 4: Firm Clients Added as Portal Data Subjects (Section 4 of /privacy)
**Location:** Add a new paragraph at the end of Section 4:

> Where accountants share a portal link with their clients to facilitate document uploads, those clients interact directly with the Prompt platform as data subjects. In this context, accountants (as data controllers) are responsible for informing their clients that their personal data and financial documents will be processed by Prompt as a data processor. The upload portal does not require client account registration; clients access the portal via a time-limited token link provided by their accountant.

### Amendment 5: Supabase File Storage in Sub-processor List (Section 7 of /privacy)
**Location:** Update the Supabase row in the sub-processor table. Change the "Purpose" column from:
> Database hosting, authentication, row-level security

To:
> Database hosting, authentication, row-level security, and encrypted file storage for uploaded financial documents and tax records

### Amendment 6: Terms Section 6 Qualified to Permit Financial Documents (/terms, Section 6)
**Location:** In Section 6 "Data Processing", update the fourth bullet point that currently reads:
> - Not enter special category data (health, financial beyond what is necessary, etc.) into the platform

Replace with:
> - Not enter special category data (such as health data, biometric data, or criminal record data) into the platform; financial documents that are necessary for the purpose of tax return preparation and filing (including P60s, SA302s, bank statements, dividend vouchers, and similar HMRC or Companies House records) are permitted as they fall within the ordinary scope of accountancy services

### Amendment 7: "Last updated" Date on Both Pages
Both `/privacy/page.tsx` and `/terms/page.tsx` have `Last updated: February 2026` — these are correct for the current date and require no change for the date itself. However, if implementing amendments, confirm the date reflects when amendments are deployed.

---

## Open Questions

1. **`tax_year` format in `upload_portal_tokens`**
   - What we know: Success criteria says `{filing_type}/{tax_year}/{uuid}.pdf` in the storage path. CONTEXT.md specifies tokens are "filing-type + tax-year scoped."
   - What's unclear: Should `tax_year` be stored as `2024-25` (SA100 display format) or `2025` (calendar year for CT600 end date)?
   - Recommendation: Use a simple `TEXT` column and store as `YYYY` for company filings (calendar year of period end), `YYYY-YY` for SA100 (e.g. `2024-25`). The planner should decide a consistent format. For simplicity, `TEXT` column named `tax_year` with app-level formatting.

2. **AML/KYC documents — same bucket or separate?**
   - What we know: STATE.md notes "AML/KYC documents: same `client_documents` bucket or exclude from standard retention cron via `retention_rule` column? Decide before Phase 18 plan."
   - What's unclear: Whether AML documents need a different retention period or cron exclusion mechanism.
   - Recommendation: Defer to Phase 19 plan unless the planner decides in Phase 18 plan. AML retention (typically 5 years from end of business relationship under MLRA 2007) differs from HMRC retention. Adding a `retention_anchor` TEXT column (`tax_period_end` vs `relationship_end`) to `client_documents` would future-proof this without requiring a separate table. This is within Claude's Discretion.

3. **`SUPABASE_STORAGE_BUCKET_DOCUMENTS` env var**
   - STATE.md explicitly notes: "add to ENV_VARIABLES.md before Phase 18 implementation"
   - This is a non-optional action item. Plan must include updating ENV_VARIABLES.md.

4. **`corporation_tax_payment` as a filing type for retention**
   - What we know: `FilingTypeId` includes `corporation_tax_payment` alongside `ct600_filing`. CONTEXT.md classifies all non-SA100 as "company" (6-year retention from `tax_period_end_date`).
   - What's unclear: Does `corporation_tax_payment` have its own document types, or does it share with `ct600_filing`?
   - Recommendation: `corporation_tax_payment` and `ct600_filing` can share most documents. No separate document types needed for Phase 18. The `filing_document_requirements` mapping only needs entries for `ct600_filing` (which is the document filing deadline) — `corporation_tax_payment` is the payment deadline and does not require client-submitted documents.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createSignedUploadUrl` with service role | `storage.upload()` with admin client | storage-js issue #186 (known bug) | Portal uploads must use admin client upload, not signed upload URL |
| `anon` role access for portal | Token-gated server action validates token before any storage operation | Phase 18 design | Portal page is unauthenticated; all storage ops happen server-side after token validation |

---

## Sources

### Primary (HIGH confidence)
- Supabase Storage Access Control docs (https://supabase.com/docs/guides/storage/security/access-control) — `storage.foldername()` RLS pattern, INSERT policy for `WITH CHECK`
- Supabase Storage Helper Functions docs (https://supabase.com/docs/guides/storage/schema/helper-functions) — `storage.foldername()`, `storage.extension()`, `storage.filename()` API
- Supabase Storage Ownership docs (https://supabase.com/docs/guides/storage/security/ownership) — `owner_id` vs `owner` deprecation; service_role creates with `owner = null`
- Project migration `20260219000004_create_jwt_hook.sql` — `auth_org_id()` function already defined; reused in Storage RLS
- Project migration `20260219000005_rewrite_rls_policies.sql` — established per-operation RLS pattern for org-scoped tables
- `lib/types/database.ts` — `FilingTypeId` type confirmed: `'corporation_tax_payment' | 'ct600_filing' | 'companies_house' | 'vat_return' | 'self_assessment'`
- Node.js `crypto` built-in docs — `randomBytes(32)`, `createHash('sha256')` for token security
- HMRC CH14600 (Companies records retention) + TMA 1970 s12B (individual tax records) — 6-year company, 5-year individual from filing deadline — confirmed in STATE.md v4.0 decisions

### Secondary (MEDIUM confidence)
- STATE.md v4.0 decisions section — storage bucket name, portal upload pattern, signed URL expiry, token entropy decisions — all pre-committed decisions from prior research phase
- REQUIREMENTS.md (DOCS-01 through DOCS-06, COMP-01) — authoritative requirement definitions

### Tertiary (LOW confidence)
- HMRC document type catalog completeness — research is based on standard UK accounting practice knowledge. The planner should treat the document catalog as a reasonable starting point that can be extended; it is not exhaustively verified against HMRC publications.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project or are Node.js built-ins
- Architecture patterns: HIGH — directly derived from existing project migrations and Supabase official docs
- Storage RLS: HIGH — verified against official Supabase Storage Access Control docs
- HMRC document catalog: MEDIUM — based on accounting practice knowledge, not exhaustive HMRC publication cross-reference
- Privacy/terms amendments: MEDIUM — legally reasonable language for UK GDPR compliance; not reviewed by legal counsel
- Pitfalls: HIGH — most are from official docs or STATE.md documented prior learnings

**Research date:** 2026-02-23
**Valid until:** 2026-04-23 (stable — Supabase Storage APIs, Node.js crypto, and date-fns are stable; HMRC requirements change annually but not mid-year)
