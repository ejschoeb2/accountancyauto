# Phase 19: Collection Mechanisms - Research

**Researched:** 2026-02-23
**Domain:** Postmark attachment extraction, Supabase Storage (portal uploads), Next.js App Router (public portal pages), document classification, in-app toast notifications, Supabase Edge Functions (retention cron), ZIP archive generation (DSAR), React drag-drop (react-dropzone)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Portal experience**
- Primary upload interaction: drag-drop dropzone with click-to-browse fallback
- Checklist layout: list of items, each a row with status indicator and per-item upload slot
- Post-upload feedback: inline confirmation per item — row updates to green check with filename shown; no page navigation
- Re-upload allowed: yes — re-uploading on an already-submitted item replaces the previous file

**Document display on client page**
- Default state: collapsed card showing document count and most recent submission date
- Expanded row columns: filename, document type label, confidence badge, received date, source (portal / email), download button
- Confidence badge: traffic light colours (green ≥80%, amber 50–79%, red <50%) with percentage shown — matches existing design system
- Download behaviour: opens signed URL in new tab (no forced download, no in-app preview modal)

**Notification behaviour**
- Trigger timing: per upload — fires immediately each time a document is received
- Applies to both channels: yes — both portal uploads and email attachment ingestion trigger notifications
- Display: toast only (auto-dismissing); no persistent notification bell for this phase
- Toast content: client name + document type label + outstanding items count (e.g. "Sarah Jones uploaded P60 — 2 items still outstanding")

**Email ingestion edge cases**
- No client match: store document as unmatched (not discarded); surface to accountant for triage
- Triage location: dedicated "Unmatched documents" section on the Documents page
- Multiple attachments: each attachment becomes a separate `client_documents` row — classified and stored independently
- Low classification confidence: store document regardless (never discard); show amber/red confidence badge; accountant corrects the type manually

### Claude's Discretion
- Exact toast positioning and dismiss timing
- Unmatched document section layout within Documents page
- Accountant correction flow for misclassified documents (inline edit vs modal)
- DSAR export format and delivery mechanism
- Retention flagging email template content and formatting

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PASS-01 | Postmark inbound webhook extracts attachments from client emails and uploads them to Supabase Storage using the org-scoped path convention, creating a `client_documents` row with source = `inbound_email`; attachment extraction runs after the `inbound_emails` row is stored so webhook always returns 200 regardless of Storage outcome | Existing `/api/postmark/inbound/route.ts` already stores the email and has the attachment array on the payload; extension requires post-store attachment loop using `uploadDocument()` + DB insert + non-blocking error handling |
| PASS-02 | Uploaded documents are classified against the `document_types` catalog based on filename and MIME type; `classification_confidence` is recorded; LOW and UNCLASSIFIED items are flagged for accountant review | Filename-based classification against the 23-row `document_types` catalog (code, label, expected_mime_types); no external AI needed; deterministic keyword matching sufficient for this phase |
| ACTV-01 | Accountant can generate a token-based portal link for a specific client + filing type from the client detail page; link expires after a configurable period (default 30 days — note: Phase 18 schema uses 7 days; REQUIREMENTS.md says 30 days — see Open Questions); regenerating a link revokes the previous token | Requires new `revoked_at` column on `upload_portal_tokens` (deferred from Phase 18 per CONTEXT.md); token generation = `crypto.randomBytes(32)`, SHA-256 hash stored; raw URL token encoded as hex |
| ACTV-02 | Client upload portal at `/portal/[token]` — Prompt-branded, no auth required, validates token server-side on every request; expired/revoked tokens show clear expiry message | Requires `/portal/[token]` route outside `(dashboard)` layout; must be added to `PUBLIC_ROUTES` in middleware; `<meta name="referrer" content="no-referrer">` in head |
| ACTV-03 | Portal checklist from `filing_document_requirements`; clients upload files against checklist items; progress indicator; files go browser→Storage via signed upload URL | CRITICAL: storage RLS has no anon policy; `createSignedUploadUrl` has service_role owner=null bug; **recommended approach: portal upload API route receives file bytes and proxies to `uploadDocument()` admin client**; requirement language "browser → Storage via signed upload URL" conflicts with storage RLS reality — see Architecture Patterns section |
| ACTV-04 | Accountant can customise default checklist per client-filing pair from client detail page: toggle items on/off, add ad-hoc items; customisations persist across years | Requires new DB table `client_document_checklist_customisations` (org_id, client_id, filing_type_id, document_type_id, is_enabled BOOLEAN, is_ad_hoc BOOLEAN) OR per-row overrides; checklist query must merge defaults from `filing_document_requirements` with customisations |
| DASH-01 | Filing type cards on client detail page show document count + most recent submission date; expanding reveals document list with columns; download generates 300-second signed URL + logs to `document_access_log` | `getSignedDownloadUrl()` already implemented in `lib/documents/storage.ts`; download API route needed; access log INSERT with service_role client |
| DASH-02 | Dashboard activity feed shows recent document submissions across all org clients (portal + email), with click-through to client page | `alert-feed.tsx` currently uses hardcoded sample data — Phase 19 wires it to live `client_documents` data via Supabase client query |
| DASH-03 | Accountant receives in-app notification when client uploads documents via portal: client name, items uploaded, items outstanding | Postmark inbound and portal upload API route both call a `sendDocumentNotification()` helper that fires `toast()` from Sonner; because the upload happens server-side, the notification must be polled or pushed to the accountant's browser — see Architecture Patterns for recommended approach |
| COMP-02 | Retention enforcement cron (weekly) sets `retention_flagged = true` on expired `client_documents`; honours `retention_hold`; never auto-deletes; notifies org admin by email for newly flagged documents | New Vercel cron route `/api/cron/retention` + `vercel.json` entry; follows same pattern as trial-expiry cron; idempotency via `WHERE retention_flagged = false AND NOT retention_hold AND retain_until < NOW()` |
| COMP-03 | DSAR export: ZIP of all `client_documents` files for a client + JSON manifest (metadata + access log), downloadable from client detail page | ZIP generation server-side (Node.js `archiver` package or native `jszip`); streams file bytes from `getSignedDownloadUrl()` → ZIP; manifest is `JSON.stringify()` of DB rows |
</phase_requirements>

---

## Summary

Phase 19 implements the full document collection pipeline on top of the Phase 18 infrastructure. The work splits into three cleanly separable tracks: (1) passive ingestion — extending the existing Postmark inbound webhook to also process attachments; (2) active collection — the client upload portal at `/portal/[token]` which is a public Next.js route outside the auth/org middleware; and (3) surface and compliance — wiring documents into the client detail page, the dashboard activity feed, in-app notifications, retention cron, and DSAR export.

The most architecturally critical finding is the portal upload mechanism. The `prompt-documents` bucket has no anon RLS policy, meaning unauthenticated clients cannot upload directly to Supabase Storage. Additionally, `createSignedUploadUrl` from a service-role client has a known bug (storage-js #186) where the stored object has `owner = null`. The correct approach for portal uploads is a Next.js API route at `/api/portal/[token]/upload` that (1) validates the token, (2) receives the file bytes from the browser, and (3) calls `uploadDocument()` via admin client. File bytes do transit the Next.js server — this is acceptable given Vercel's body size limits (4.5 MB by default, 50 MB with Vercel Pro) and the expected document sizes (PDFs, scans).

The in-app notification requirement (DASH-03) requires a server-to-client push mechanism since the document arrives via webhook or portal API, not a direct user action on the accountant's browser. The recommended approach is Supabase Realtime subscriptions on the `client_documents` table — the accountant's browser subscribes to INSERT events on `client_documents` where `org_id = auth_org_id()`, and fires a Sonner toast on new rows.

**Primary recommendation:** The three tracks can be planned and executed in parallel up to the integration point. Start with the DB migration (add `revoked_at` + `checklist customisations` table), then PASS-01/PASS-02 (inbound webhook extension), ACTV-01 through ACTV-04 (portal), and DASH + COMP together in the final plan.

---

## Standard Stack

### Core (already in project — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.95.3 | Supabase client + Realtime | Already in project; Realtime subscriptions are built-in |
| `sonner` | ^2.0.7 | Toast notifications | Already in project; DESIGN.md shows `toast.success()` / `toast.error()` usage throughout |
| `postmark` | ^4.0.5 | Platform email (retention cron notifications) | Already in project; used in `lib/billing/notifications.ts` pattern |
| `crypto` (Node built-in) | n/a | Token generation + SHA-256 | Already used in Phase 18 portal token design |
| `date-fns` | ^4.1.0 | Date arithmetic | Already in project; used in `lib/documents/metadata.ts` |

### New Dependencies Required
| Library | Version | Purpose | Install |
|---------|---------|---------|---------|
| `jszip` | ^3.10.1 | ZIP archive generation for DSAR export | `npm install jszip @types/jszip` |

**Note on `archiver`:** `archiver` is a Node.js stream-based ZIP library but does not work in Next.js Edge Runtime. `jszip` works in both Node.js and browser environments and is more compatible with Next.js API routes. Prefer `jszip`.

**Note on `react-dropzone`:** The portal page needs drag-drop uploads. `react-dropzone` is the standard library for this. However, check if it's already installed in the project dependencies before adding it.

```bash
# Check if react-dropzone is already present
grep -r "react-dropzone" node_modules/.package-lock.json 2>/dev/null | head -1
# If not present:
npm install react-dropzone
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Realtime for DASH-03 | Long-polling / periodic refetch | Realtime is lower latency and already available in the Supabase project; polling adds latency and server load |
| `jszip` for DSAR | Native `archiver` | `archiver` requires Node.js streams; `jszip` runs in any environment |
| Proxy upload through Next.js server | Supabase signed upload URL (browser-direct) | Direct upload blocked by missing anon RLS policy and service-role owner=null bug — server proxy is correct |

**Installation:**
```bash
npm install jszip
npm install react-dropzone  # if not already present
```

---

## Architecture Patterns

### Recommended Project Structure (new files/directories)

```
app/
├── portal/
│   └── [token]/
│       ├── page.tsx             # Public client upload portal (ACTV-02, ACTV-03)
│       └── components/
│           ├── checklist-item.tsx   # Per-item row with dropzone + status
│           └── progress-bar.tsx     # X of Y items provided
├── (dashboard)/
│   ├── clients/
│   │   └── [id]/
│   │       └── components/
│   │           ├── document-card.tsx          # Collapsed/expanded document card (DASH-01)
│   │           └── generate-portal-link.tsx   # Portal link generator (ACTV-01)
│   ├── documents/
│   │   ├── page.tsx             # Unmatched documents triage (PASS-01 edge case)
│   │   └── components/
│   │       └── unmatched-documents-table.tsx
│   └── dashboard/
│       └── components/
│           └── alert-feed.tsx   # REPLACE hardcoded data with live query (DASH-02)
├── api/
│   ├── portal/
│   │   └── [token]/
│   │       ├── route.ts         # GET — validate token, return checklist
│   │       └── upload/
│   │           └── route.ts     # POST — receive file, upload to Storage, insert client_documents
│   ├── clients/
│   │   └── [id]/
│   │       ├── documents/
│   │       │   └── route.ts     # GET — list docs; POST — trigger DSAR export
│   │       └── portal-token/
│   │           └── route.ts     # POST — generate portal link; DELETE — revoke
│   └── cron/
│       └── retention/
│           └── route.ts         # Weekly retention enforcement cron (COMP-02)
lib/
├── documents/
│   ├── storage.ts               # EXISTING — uploadDocument, getSignedDownloadUrl, deleteDocument
│   ├── metadata.ts              # EXISTING — calculateRetainUntil
│   ├── classify.ts              # NEW — classifyDocument(filename, mimeType) → {documentTypeId, confidence}
│   └── notifications.ts         # NEW — sendRetentionFlaggedEmail (COMP-02 email to admin)
supabase/
└── migrations/
    └── [timestamp]_phase19_schema.sql  # revoked_at on upload_portal_tokens + checklist customisations table
```

### Pattern 1: Attachment Extraction in Postmark Inbound Webhook (PASS-01)

**What:** After the `inbound_emails` row is stored successfully, iterate over `payload.Attachments`, classify each, upload to Storage, and insert into `client_documents`. All failures are logged but do not prevent returning 200.

**Critical constraint:** The webhook must return 200 even if Storage upload fails. The `inbound_emails` store happens first; attachment processing is fully non-blocking.

**Existing Postmark payload structure** (from `app/api/postmark/inbound/route.ts`):
```typescript
// Attachment is already typed in the existing PostmarkInboundWebhook interface:
Attachments: Array<{
  Name: string;           // original filename
  Content: string;        // base64-encoded file content
  ContentType: string;    // MIME type
  ContentLength: number;  // bytes
}>

// Pattern for Phase 19 extension (add AFTER the inbound_email insert succeeds):
if (payload.Attachments && payload.Attachments.length > 0 && client?.id) {
  // Non-blocking — fire and forget with error logging
  processAttachments(payload, inboundEmail.id, client, orgId, supabase).catch(err =>
    console.error('[Postmark Inbound] Attachment processing failed:', err)
  );
}
// Always return 200 immediately after this block
```

**`processAttachments` function structure:**
```typescript
async function processAttachments(
  payload: PostmarkInboundWebhook,
  inboundEmailId: string,
  client: { id: string; org_id: string },
  orgId: string,
  supabase: SupabaseClient  // service client (already in scope)
): Promise<void> {
  for (const attachment of payload.Attachments) {
    try {
      const fileBuffer = Buffer.from(attachment.Content, 'base64');
      const classification = classifyDocument(attachment.Name, attachment.ContentType);

      // Determine tax year from current date (best-effort; accountant can correct)
      const taxYear = determineTaxYear(new Date());

      // Upload to Storage using existing utility
      const { storagePath } = await uploadDocument({
        orgId,
        clientId: client.id,
        filingTypeId: classification.filingTypeId ?? 'ct600_filing', // best-effort
        taxYear,
        file: fileBuffer,
        originalFilename: attachment.Name,
        mimeType: attachment.ContentType,
      });

      // Insert client_documents row
      await supabase.from('client_documents').insert({
        org_id: orgId,
        client_id: client.id,
        filing_type_id: classification.filingTypeId ?? 'ct600_filing',
        document_type_id: classification.documentTypeId,
        storage_path: storagePath,
        original_filename: attachment.Name,
        tax_period_end_date: taxPeriodEndDate,  // derive from client year_end_date
        retain_until: calculateRetainUntil(classification.filingTypeId, taxPeriodEndDate),
        classification_confidence: classification.confidence,
        source: 'inbound_email',
      });
    } catch (err) {
      console.error('[Postmark Inbound] Failed to process attachment:', attachment.Name, err);
    }
  }
}
```

### Pattern 2: Document Classification (PASS-02)

**What:** Deterministic classification matching filename keywords and MIME type against the 23 `document_types` rows in the catalog.

**Approach:** The `document_types` table has a `code` column (e.g. `P60`, `BANK_STATEMENT`) and `expected_mime_types`. Classification does NOT need to query the database at runtime — it can use a static lookup map built from the catalog codes and keyword synonyms.

```typescript
// lib/documents/classify.ts

interface ClassificationResult {
  documentTypeId: string | null;
  documentTypeCode: string | null;
  filingTypeId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unclassified';
}

// Keyword map: pattern → document type code
// Build from knowledge of the 23 seeded document types
const FILENAME_PATTERNS: Array<{ patterns: RegExp[]; code: string; filingType: string }> = [
  { patterns: [/p60/i, /end.of.year/i], code: 'P60', filingType: 'self_assessment' },
  { patterns: [/p45/i, /leaving/i], code: 'P45', filingType: 'self_assessment' },
  { patterns: [/p11d/i, /benefits/i], code: 'P11D', filingType: 'self_assessment' },
  { patterns: [/sa302/i, /tax.calc/i], code: 'SA302', filingType: 'self_assessment' },
  { patterns: [/bank.statement/i, /statement/i], code: 'BANK_STATEMENT', filingType: null }, // multi-filing
  // ... etc for all 23 types
];

export async function classifyDocument(
  filename: string,
  mimeType: string,
  supabase: SupabaseClient
): Promise<ClassificationResult> {
  // 1. Try filename keyword match (HIGH confidence if exact code match)
  // 2. Try MIME type match against expected_mime_types (MEDIUM)
  // 3. Fallback: UNCLASSIFIED
}
```

**Confidence levels:**
- `high`: filename contains exact document type code or strong keyword match + MIME type matches expected
- `medium`: filename partial match OR MIME type matches but filename unclear
- `low`: only MIME type match (PDF but could be anything)
- `unclassified`: no match at all (e.g. `.xlsx` with unknown filename)

### Pattern 3: Portal Route — Public Next.js Page (ACTV-02)

**What:** `/portal/[token]` must be a public page (no auth required). The middleware currently lists these as `PUBLIC_ROUTES`: `["/login", "/auth/callback", "/auth/signout", "/pricing", "/onboarding", "/invite/accept"]`.

**Required change:** Add `/portal` to `PUBLIC_ROUTES` in `lib/supabase/middleware.ts`.

**Route placement:** `/app/portal/[token]/page.tsx` — outside `(dashboard)` and `(auth)` route groups; it does NOT inherit the dashboard layout.

**Server-side token validation pattern:**
```typescript
// app/portal/[token]/page.tsx
import { createServiceClient } from '@/lib/supabase/service';
import crypto from 'crypto';

export default async function PortalPage({ params }: { params: { token: string } }) {
  const tokenHash = crypto.createHash('sha256').update(params.token).digest('hex');
  const supabase = createServiceClient();

  const { data: portalToken } = await supabase
    .from('upload_portal_tokens')
    .select('*, clients(company_name, display_name), filing_types(name)')
    .eq('token_hash', tokenHash)
    .single();

  // Expired: expires_at < now()
  // Revoked: revoked_at IS NOT NULL
  if (!portalToken || new Date(portalToken.expires_at) < new Date() || portalToken.revoked_at) {
    return <ExpiredTokenPage />;
  }

  // Update used_at (non-critical)
  await supabase.from('upload_portal_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', portalToken.id);

  return <PortalChecklist portalToken={portalToken} rawToken={params.token} />;
}
```

**No-referrer meta tag requirement:**
```tsx
// In the portal page layout or page head:
import Head from 'next/head'; // or use Next.js 13+ metadata API
export const metadata = {
  other: { referrer: 'no-referrer' },
};
```
In Next.js App Router, set via `export const metadata = { other: { referrer: 'no-referrer' } }` in the page file.

### Pattern 4: Portal File Upload — Server-Proxy Pattern (ACTV-03)

**Critical finding:** The `prompt-documents` bucket has no anon RLS policy (confirmed in `supabase/migrations/20260224000003_storage_objects_rls.sql` — only `authenticated` and `service_role` policies exist). Portal clients are unauthenticated. Therefore **direct browser-to-Storage upload is impossible**.

The requirement "files upload directly to Supabase Storage via signed upload URL (browser → Storage, never through Next.js server)" **cannot be implemented as written** given the current RLS setup.

**Recommended approach — server proxy upload:**
1. Browser sends `multipart/form-data` POST to `/api/portal/[token]/upload`
2. API route validates token (hash comparison, expiry, revocation check)
3. API route calls `uploadDocument()` using admin client (bypasses RLS)
4. API route inserts `client_documents` row
5. API route returns `{ success: true, documentId, documentTypeLabel, confidence }`
6. Portal client UI updates the checklist row inline

**File size constraint:** Vercel Hobby/Pro has a 4.5 MB default body size limit. Vercel Pro can increase to 50 MB via config. Since these are financial documents (PDFs, scans), 10–20 MB per file is realistic. Add `export const config = { api: { bodyParser: { sizeLimit: '25mb' } } }` to the upload route, and update `vercel.json` if needed.

**Alternative: Supabase Storage signed upload URL with anon policy:** Could add an anon INSERT policy on `storage.objects` scoped to a specific path pattern that includes the token hash. This would allow direct browser-to-Storage but exposes a wider attack surface and requires careful path-based token validation at the Storage layer. **Not recommended** — server proxy is simpler and more secure.

```typescript
// app/api/portal/[token]/upload/route.ts
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  // 1. Validate token
  const tokenHash = crypto.createHash('sha256').update(params.token).digest('hex');
  const supabase = createServiceClient();
  const { data: portalToken } = await supabase
    .from('upload_portal_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .single();

  if (!portalToken || new Date(portalToken.expires_at) < new Date() || portalToken.revoked_at) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  }

  // 2. Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const checklistItemId = formData.get('checklistItemId') as string;

  // 3. Upload to Storage via admin client
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await uploadDocument({
    orgId: portalToken.org_id,
    clientId: portalToken.client_id,
    filingTypeId: portalToken.filing_type_id,
    taxYear: portalToken.tax_year,
    file: fileBuffer,
    originalFilename: file.name,
    mimeType: file.type,
  });

  // 4. Classify + insert client_documents
  const classification = await classifyDocument(file.name, file.type, supabase);
  const taxPeriodEndDate = deriveTaxPeriodEnd(portalToken.tax_year, portalToken.filing_type_id);

  await supabase.from('client_documents').insert({ ... });

  // 5. Return success
  return NextResponse.json({ success: true, storagePath, confidence: classification.confidence });
}
```

### Pattern 5: In-App Notifications via Supabase Realtime (DASH-03)

**Problem:** When a client uploads via the portal, the accountant's browser is not involved in the upload request. The notification needs to be pushed from server to client.

**Recommended approach:** Supabase Realtime subscription on `client_documents` INSERT events.

**How it works:**
1. The portal upload API route inserts a `client_documents` row
2. Supabase Realtime broadcasts the INSERT to all subscribers for that `org_id`
3. A React hook in the dashboard layout subscribes and fires a Sonner toast on new rows

```typescript
// lib/documents/use-document-notifications.ts (new hook)
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export function useDocumentNotifications(orgId: string) {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('document-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_documents',
          filter: `org_id=eq.${orgId}`,
        },
        async (payload) => {
          // Fetch client name + outstanding count
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, display_name')
            .eq('id', payload.new.client_id)
            .single();

          const clientName = client?.display_name || client?.company_name || 'Client';
          const docTypeLabel = payload.new.document_type_id
            ? await resolveDocumentTypeLabel(payload.new.document_type_id, supabase)
            : 'document';

          toast.success(`${clientName} uploaded ${docTypeLabel}`);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId]);
}
```

**Where to mount:** In the `(dashboard)` layout component, call `useDocumentNotifications(orgId)`. The `orgId` is available from the JWT via `useUser()`.

**RLS note:** `client_documents` has `SELECT` policy `USING (org_id = auth_org_id())`. Realtime respects RLS for authenticated users, so only that org's events are received. Confirm Realtime is enabled on the `client_documents` table in the Supabase Dashboard.

### Pattern 6: Retention Cron (COMP-02)

**What:** Weekly Vercel cron job that flags expired documents and emails org admins.

**Pattern:** Follows existing `api/cron/trial-expiry/route.ts` pattern exactly.

```typescript
// app/api/cron/retention/route.ts
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // 1. Verify CRON_SECRET
  // 2. Find rows where retain_until < now() AND retention_hold = false AND retention_flagged = false
  // 3. Set retention_flagged = true (batch UPDATE)
  // 4. Group newly flagged docs by org_id
  // 5. For each org, send one retention notification email to org admins
  // 6. Log results
}
```

**Idempotency:** The `WHERE retention_flagged = false` clause is the idempotency guard — re-running the cron never re-flags already-flagged documents. The email notification uses the same batch-per-org pattern as billing notifications to avoid duplicate sends.

**vercel.json entry:**
```json
{ "path": "/api/cron/retention", "schedule": "0 8 * * 1" }
```
(Monday 8:00 UTC = weekly)

### Pattern 7: DSAR Export (COMP-03)

**What:** ZIP archive containing all `client_documents` storage files + JSON manifest.

**Implementation:**
```typescript
// app/api/clients/[id]/documents/dsar/route.ts
import JSZip from 'jszip';

export async function GET(request: NextRequest, { params }) {
  const supabase = createClient(); // session-scoped (authenticated accountant)

  // 1. Fetch all client_documents for this client (org-scoped via RLS)
  const { data: docs } = await supabase
    .from('client_documents')
    .select('*')
    .eq('client_id', params.id);

  // 2. Fetch access log for each document
  const { data: accessLog } = await supabase
    .from('document_access_log')
    .select('*')
    .in('document_id', docs.map(d => d.id));

  // 3. Build ZIP
  const zip = new JSZip();
  for (const doc of docs) {
    const { signedUrl } = await getSignedDownloadUrl(doc.storage_path);
    const response = await fetch(signedUrl);
    const buffer = await response.arrayBuffer();
    zip.file(doc.original_filename, buffer);
  }

  // 4. Add manifest
  zip.file('manifest.json', JSON.stringify({ documents: docs, access_log: accessLog }, null, 2));

  // 5. Stream ZIP to response
  const content = await zip.generateAsync({ type: 'nodebuffer' });
  return new Response(content, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="dsar-${params.id}.zip"`,
    },
  });
}
```

**Note:** Accessing each file via signed URL inside the server route is the correct approach — use `getSignedDownloadUrl()` from `lib/documents/storage.ts` rather than fetching the raw storage path.

### Pattern 8: Token Revocation (ACTV-01 prerequisite)

**What:** Phase 18 deferred `revoked_at` column. Phase 19 needs it before building portal link generation UI.

**Migration required:**
```sql
-- Add revoked_at to upload_portal_tokens
ALTER TABLE upload_portal_tokens
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_upload_portal_tokens_revoked
  ON upload_portal_tokens(revoked_at)
  WHERE revoked_at IS NOT NULL;
```

**Revocation on regenerate:** When accountant generates a new portal link for same `(client_id, filing_type_id, tax_year)`, set `revoked_at = now()` on all existing non-revoked tokens for that combination before inserting the new token.

### Pattern 9: Checklist Customisation Table (ACTV-04)

**New table required:**
```sql
CREATE TABLE client_document_checklist_customisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id),
  document_type_id UUID REFERENCES document_types(id),  -- null for ad-hoc items
  is_enabled BOOLEAN NOT NULL DEFAULT true,             -- false = toggled off
  is_ad_hoc BOOLEAN NOT NULL DEFAULT false,             -- true = custom item added by accountant
  ad_hoc_label TEXT,                                    -- required when is_ad_hoc = true
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, filing_type_id, document_type_id)  -- one customisation per doc type per client+filing
);
```

**Checklist query logic:** Merge `filing_document_requirements` defaults with customisations:
1. Start with all `filing_document_requirements` for the `filing_type_id`
2. Apply customisations: filter out rows where `is_enabled = false` for this client
3. Append ad-hoc items where `is_ad_hoc = true` for this client

### Anti-Patterns to Avoid

- **Blocking webhook on Storage failures:** The Postmark inbound webhook must return 200 regardless. Use `processAttachments(...).catch(console.error)` to fire-and-forget.
- **Direct anon Storage upload:** The `prompt-documents` bucket has no anon RLS policy. Attempting it results in a 403.
- **Using `createSignedUploadUrl` from service_role:** Known bug — stored object gets `owner = null`, breaking future RLS queries by authenticated users. Use `uploadDocument()` (direct `upload()` call) instead.
- **Exposing raw storage paths:** The `storage_path` column must never appear in client-facing API responses. Always return signed URLs.
- **Re-flagging already-flagged documents in retention cron:** Filter by `retention_flagged = false` before updating to ensure idempotency.
- **Duplicate retention emails:** Track newly flagged doc IDs in the cron run; only email if `count > 0`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP archive generation | Custom ZIP byte builder | `jszip` | ZIP format has checksums, compression levels, directory structure — jszip handles all of it |
| Drag-drop file input | Custom drag events | `react-dropzone` | Handles drag state, file type validation, multiple files, `accept` MIME filters; battle-tested |
| Realtime push notifications | Long-polling, WebSocket server | Supabase Realtime `postgres_changes` | Already available in the Supabase project; zero infrastructure |
| Token generation | `Math.random()` | `crypto.randomBytes(32)` | Cryptographically secure; already used in project (Phase 18 design) |
| Base64 decode of Postmark attachments | Manual buffer operations | `Buffer.from(content, 'base64')` | Node built-in; already correct approach |

**Key insight:** JSZip and react-dropzone are the only new NPM dependencies. Everything else is built on existing project infrastructure (Supabase, Sonner, Postmark, crypto).

---

## Common Pitfalls

### Pitfall 1: Portal Route Not in PUBLIC_ROUTES
**What goes wrong:** The middleware redirects `/portal/*` to `/login` because it's not in the public routes list.
**Why it happens:** `lib/supabase/middleware.ts` has an explicit `PUBLIC_ROUTES` array. Any new route not in it gets the full auth flow.
**How to avoid:** Add `/portal` to `PUBLIC_ROUTES` at the top of `lib/supabase/middleware.ts` before building the portal page.
**Warning signs:** Portal page redirects to login instead of showing the checklist.

### Pitfall 2: Postmark Attachment Content is Base64
**What goes wrong:** Treating `attachment.Content` as a string and passing it directly to `uploadDocument()` instead of decoding from base64.
**Why it happens:** Postmark sends attachment content as base64-encoded strings in the JSON payload.
**How to avoid:** Always decode with `Buffer.from(attachment.Content, 'base64')` before passing to `uploadDocument()`.
**Warning signs:** Uploaded file is corrupt or the wrong size.

### Pitfall 3: Missing `revoked_at` Column Before Building Portal UI
**What goes wrong:** The portal link generator and portal validation query `revoked_at` but the column doesn't exist in Phase 18's schema.
**Why it happens:** Phase 18 CONTEXT.md explicitly deferred `revoked_at` to Phase 19. It must be added via migration before any Phase 19 code uses it.
**How to avoid:** Include a migration adding `revoked_at TIMESTAMPTZ` as the first task in Phase 19's first plan.

### Pitfall 4: Tax Period End Date for Email Attachments
**What goes wrong:** `client_documents.tax_period_end_date` is NOT NULL but is unknown when a client sends a spontaneous email with attachments (not tied to a specific filing period).
**Why it happens:** The column is required for retention calculation, but email ingestion doesn't have explicit period context.
**How to avoid:** Derive `tax_period_end_date` from the client's `year_end_date` — use the most recent completed tax year. Store as best-effort; accountant can correct it via the manual edit flow. Never refuse to store a document due to this uncertainty.
**Example:** If `year_end_date = 2024-12-31` and today is 2025-03-15, use `2024-12-31` as `tax_period_end_date`.

### Pitfall 5: Supabase Realtime Not Enabled on `client_documents`
**What goes wrong:** The `useDocumentNotifications` hook subscribes but never fires because Realtime is not enabled for the table.
**Why it happens:** Supabase Realtime requires the table to be included in the publication. New tables are not automatically added.
**How to avoid:** After the Phase 18 migration created `client_documents`, verify Realtime is enabled in Supabase Dashboard > Database > Replication > Tables OR add the table to the `supabase_realtime` publication via SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE client_documents;`
**Warning signs:** Subscription fires no events even after confirmed document inserts.

### Pitfall 6: Vercel Body Size Limit for Portal Uploads
**What goes wrong:** File upload to `/api/portal/[token]/upload` returns 413 or silently fails for files > 4.5 MB.
**Why it happens:** Next.js API routes have a default body parser limit of 4.5 MB in Vercel.
**How to avoid:** In the upload route, add `export const config = { api: { bodyParser: { sizeLimit: '25mb' } } }`. This is a Next.js Pages Router config; for App Router, disable the default body parser with `export const dynamic = 'force-dynamic'` and read `request.formData()` directly (which streams without Next.js body parsing limits).
**Note:** App Router does not use the `config.api.bodyParser` pattern. Use `request.formData()` which does not have the same limit.

### Pitfall 7: Filing Type for Unmatched Emails
**What goes wrong:** `client_documents.filing_type_id NOT NULL` but the filing type is unknown for an email with no client match.
**Why it happens:** The table schema requires `filing_type_id` to be non-null.
**How to avoid:** Use a sentinel value for unmatched/unknown cases. Options: (a) add a nullable constraint to `filing_type_id`, or (b) use a default filing type ID like `'ct600_filing'` with a comment. Option (b) is pragmatic and avoids a schema migration. The unmatched documents triage UI will show the accountant the original email for context.

### Pitfall 8: Portal Accessing Org-Specific Data Without Auth
**What goes wrong:** The portal page calls Supabase with a browser client (which requires auth) to fetch filing checklist data.
**Why it happens:** `client_documents` and `filing_document_requirements` have RLS policies requiring authentication.
**How to avoid:** The portal page is a server component (or uses a dedicated API route). Use `createServiceClient()` (service role) to fetch checklist data server-side, keyed by the validated token. The portal client never has direct Supabase access — all data fetching is via Next.js server components or API routes.

---

## Code Examples

### Classify Document (deterministic)
```typescript
// lib/documents/classify.ts
// Source: project-specific implementation

export interface ClassificationResult {
  documentTypeId: string | null;
  documentTypeCode: string | null;
  filingTypeId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unclassified';
}

// Static keyword map built from the 23 seeded document_types codes
const KEYWORD_MAP: Array<{ patterns: RegExp[]; code: string; filingType: string | null }> = [
  { patterns: [/\bp60\b/i, /end.of.year.cert/i], code: 'P60', filingType: 'self_assessment' },
  { patterns: [/\bp45\b/i], code: 'P45', filingType: 'self_assessment' },
  { patterns: [/\bp11d\b/i, /expenses.and.benefits/i], code: 'P11D', filingType: 'self_assessment' },
  { patterns: [/\bsa302\b/i, /tax.calculation/i], code: 'SA302', filingType: 'self_assessment' },
  { patterns: [/bank.statement/i, /statement/i], code: 'BANK_STATEMENT', filingType: null },
  { patterns: [/dividend.voucher/i], code: 'DIVIDEND_VOUCHER', filingType: null },
  { patterns: [/vat.return/i, /vat.workings/i], code: 'VAT_RETURN_WORKINGS', filingType: 'vat_return' },
  { patterns: [/purchase.invoice/i], code: 'PURCHASE_INVOICES', filingType: 'vat_return' },
  { patterns: [/sales.invoice/i], code: 'SALES_INVOICES', filingType: 'vat_return' },
  // ... complete for all 23 types
];

export async function classifyDocument(
  filename: string,
  mimeType: string,
  supabase: SupabaseClient
): Promise<ClassificationResult> {
  // Step 1: Try keyword match on filename
  for (const entry of KEYWORD_MAP) {
    if (entry.patterns.some(p => p.test(filename))) {
      // Resolve document_type_id from DB by code
      const { data: dt } = await supabase
        .from('document_types')
        .select('id')
        .eq('code', entry.code)
        .single();

      const mimeMatch = await checkMimeMatch(entry.code, mimeType, supabase);
      return {
        documentTypeId: dt?.id ?? null,
        documentTypeCode: entry.code,
        filingTypeId: entry.filingType,
        confidence: mimeMatch ? 'high' : 'medium',
      };
    }
  }

  // Step 2: MIME-only match — low confidence
  if (mimeType === 'application/pdf') {
    return { documentTypeId: null, documentTypeCode: null, filingTypeId: null, confidence: 'low' };
  }

  return { documentTypeId: null, documentTypeCode: null, filingTypeId: null, confidence: 'unclassified' };
}
```

### Supabase Realtime Subscription for Document Notifications
```typescript
// Source: Supabase docs — https://supabase.com/docs/guides/realtime/postgres-changes
const channel = supabase
  .channel('document-notifications')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'client_documents' },
    (payload) => {
      // payload.new contains the inserted row
      console.log('New document:', payload.new);
    }
  )
  .subscribe();

// Cleanup
supabase.removeChannel(channel);
```

### Token Generation Pattern (ACTV-01)
```typescript
// Source: Node.js crypto docs + project pattern
import crypto from 'crypto';

function generatePortalToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex'); // 64-char hex = 256-bit entropy
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

// Store tokenHash in DB; return rawToken in URL
// Portal URL: https://{org-slug}.app.phasetwo.uk/portal/{rawToken}
```

### JSZip DSAR Export
```typescript
// Source: JSZip documentation — https://stuk.github.io/jszip/
import JSZip from 'jszip';

const zip = new JSZip();
zip.file('document.pdf', pdfBuffer);               // add file
zip.file('manifest.json', JSON.stringify(data));   // add JSON manifest

const content = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 },
});
// content is a Buffer, ready to send as Response body
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Signed upload URL (browser → Storage) | Server-proxy upload via Next.js API route | Phase 19 (discovered) | Simpler security model; file bytes transit server; acceptable given document sizes |
| Polling for notifications | Supabase Realtime postgres_changes | Already available in Supabase | Lower latency, no wasted requests |

**Note on direct browser uploads:** The storage-js `createSignedUploadUrl` bug (owner=null with service_role) is documented in the project's `storage.ts`. For a future phase where clients have their own auth sessions, direct browser uploads become possible. For Phase 19 with unauthenticated portal clients, server proxy is the only viable path.

---

## Open Questions

1. **Token expiry discrepancy: 7 days vs 30 days**
   - What we know: Phase 18 CONTEXT.md locked "default token expiry: 7 days from generation"; REQUIREMENTS.md ACTV-01 says "expires after a configurable period (default 30 days)"
   - What's unclear: Which value is the product decision?
   - Recommendation: Clarify with user before planning ACTV-01. Use 7 days as default if unresolved (matches Phase 18 schema comment) but make the value configurable via `upload_portal_tokens.expires_at` (the schema already accepts any timestamp, so this is just a config constant).

2. **`filing_type_id` for unmatched email attachments (no client match)**
   - What we know: `client_documents.filing_type_id NOT NULL`; when an email arrives with no matching client, filing type is truly unknown
   - What's unclear: Should `filing_type_id` be nullable, or should we use a sentinel value?
   - Recommendation: Make `filing_type_id` nullable in a Phase 19 migration for unmatched documents, OR use a well-documented convention (e.g. `'ct600_filing'` as default) with a comment. The former is cleaner. Planner should choose based on scope preference.

3. **Supabase Realtime publication for `client_documents`**
   - What we know: Realtime requires the table to be in the `supabase_realtime` publication
   - What's unclear: Was this already enabled when Phase 18 created the table?
   - Recommendation: Add `ALTER PUBLICATION supabase_realtime ADD TABLE client_documents;` to the Phase 19 DB migration as a safety measure (idempotent with `IF NOT EXISTS` logic).

4. **ACTV-03: Direct upload requirement conflicts with RLS reality**
   - What we know: REQUIREMENTS.md ACTV-03 says "files upload directly to Supabase Storage via signed upload URL (browser → Storage, never through Next.js server)"; the storage bucket has no anon RLS policy
   - What's unclear: Whether the requirement should be relaxed or the RLS should be extended
   - Recommendation: Server proxy is correct for Phase 19. Add a note to ACTV-03 in the plan that the implementation proxies through Next.js for portal (unauthenticated) uploads. Direct browser uploads are feasible only if anon RLS is added to storage — which opens security considerations. Document the decision.

5. **DASH-03: Notification delivery to the right accountant**
   - What we know: Portal tokens are created by a specific accountant; the token has `created_by_user_id`
   - What's unclear: Should the notification go only to the accountant who created the portal link, or to all org members?
   - Recommendation: Notify all org members subscribed to Realtime (simplest). The toast says "Sarah Jones uploaded P60" which is useful for any org member. Per-user targeting adds complexity. Claude's discretion per CONTEXT.md.

---

## Validation Architecture

`workflow.nyquist_validation` is not set (absent from `.planning/config.json`). Skipping Validation Architecture section.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection — `app/api/postmark/inbound/route.ts` — existing attachment payload structure and webhook pattern
- Codebase inspection — `lib/documents/storage.ts` — `uploadDocument()`, `getSignedDownloadUrl()`, service_role bug note
- Codebase inspection — `supabase/migrations/20260224000003_storage_objects_rls.sql` — confirmed no anon policy
- Codebase inspection — `lib/supabase/middleware.ts` — PUBLIC_ROUTES list confirmed
- Codebase inspection — `lib/billing/notifications.ts` — platform email notification pattern (for retention cron COMP-02)
- Codebase inspection — `vercel.json` — existing cron schedule format
- Codebase inspection — `supabase/migrations/20260224000001_document_collection_tables.sql` — full schema for 5 tables

### Secondary (MEDIUM confidence)
- Supabase Realtime postgres_changes subscription pattern — consistent with Supabase docs and @supabase/supabase-js v2 API
- JSZip v3 `generateAsync({ type: 'nodebuffer' })` pattern — standard usage; version in npm registry confirmed stable

### Tertiary (LOW confidence)
- Vercel body size limit for App Router multipart form: testing recommended — the 4.5 MB limit applies to Pages Router body parsing; App Router `request.formData()` may have different limits depending on Vercel plan

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project except jszip (stable, widely used)
- Architecture: HIGH — patterns derived from direct codebase inspection of existing webhook, storage utilities, cron routes, and middleware
- Portal upload approach: HIGH — confirmed from storage RLS migration and storage.ts bug documentation
- Pitfalls: HIGH — sourced from actual code and existing project comments
- Realtime subscriptions: MEDIUM — Supabase Realtime API is stable but table publication status needs runtime verification

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable infrastructure; no fast-moving dependencies)
