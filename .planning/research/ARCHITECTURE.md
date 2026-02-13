# Architecture Research

**Domain:** Inbound Email Processing + AI Classification for Existing Email Reminder System
**Researched:** 2026-02-13
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Email Client │  │   Dashboard  │  │ Cron System  │              │
│  │ (External)   │  │  (Next.js)   │  │   (Vercel)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                      │
├─────────┼──────────────────┼──────────────────┼──────────────────────┤
│         │                  │                  │                      │
│  POSTMARK LAYER            │                  │                      │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐              │
│  │   Inbound    │  │   Outbound   │  │   Outbound   │              │
│  │   Webhook    │  │  (Reminder)  │  │ (Reply to    │              │
│  │              │  │              │  │   Client)    │              │
│  └──────┬───────┘  └──────────────┘  └──────────────┘              │
│         │                                                            │
├─────────┼────────────────────────────────────────────────────────────┤
│         │                    API LAYER                               │
├─────────┼────────────────────────────────────────────────────────────┤
│  ┌──────▼───────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ /api/webhooks/   │  │  /api/cron/  │  │ Server       │          │
│  │  inbound-email   │  │ send-emails  │  │ Actions      │          │
│  └──────┬───────────┘  └──────────────┘  └──────┬───────┘          │
│         │                                        │                  │
│         │  ┌──────────────────────┐              │                  │
│         └──► OpenAI Classification│◄─────────────┘                  │
│            │  (GPT-4o Structured) │                                 │
│            └──────────────────────┘                                 │
│                       │                                              │
├───────────────────────┼──────────────────────────────────────────────┤
│                       │          DATA LAYER                          │
├───────────────────────┼──────────────────────────────────────────────┤
│  ┌────────────────────▼────────────────────┐                        │
│  │         Supabase Postgres                │                        │
│  │ ┌───────────┐ ┌───────────┐ ┌───────────┐                       │
│  │ │ inbound_  │ │ reply_    │ │ clients/  │                       │
│  │ │ emails    │ │ classif.  │ │ email_log │                       │
│  │ └───────────┘ └───────────┘ └───────────┘                       │
│  └─────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Postmark Inbound** | Receive client replies, parse email, POST to webhook | Postmark cloud service + MX record |
| **Inbound Webhook Handler** | Validate webhook, parse payload, store raw email | Next.js API Route + signature validation |
| **OpenAI Classifier** | Classify email intent using structured output | Vercel AI SDK + Zod schema + GPT-4o |
| **Reply Classification Store** | Store classification results with confidence scores | Supabase table with enum + confidence |
| **Status Auto-Update Logic** | Update client_filing_assignments based on high-confidence classifications | Server Action with transaction |
| **Dashboard Reply Viewer** | Display inbound emails with classification, allow manual review | Next.js Server Component + RLS |
| **Outbound Reply Handler** | Send accountant replies back to clients | Reuse existing sendRichEmail() |
| **Reply-To Encoder** | Generate deterministic Reply-To addresses with embedded context | VERP-style encoding in email_sender |

## Integration with Existing Architecture

### Existing Components (Do Not Modify)

| Component | Path | Role |
|-----------|------|------|
| `sendRichEmail()` | `lib/email/sender.ts` | Outbound email sender via Postmark |
| `email_log` table | Migration `20260207020738` | Tracks all outbound emails |
| `clients` table | Migration `20260207000001` | Client master data |
| `client_filing_assignments` | Migration `20260207000002` | Which filings apply to each client |
| `app_settings` table | Migration `20260209120000` | Stores email_reply_to setting |
| Cron `/api/cron/send-emails` | `app/api/cron/send-emails/route.ts` | Sends queued reminder emails |

### New Components (To Be Built)

| Component | Path | Purpose |
|-----------|------|---------|
| Inbound webhook handler | `app/api/webhooks/inbound-email/route.ts` | Receive Postmark inbound POSTs |
| `inbound_emails` table | New migration | Store raw inbound email data |
| `reply_classifications` table | New migration | Store AI classification results |
| OpenAI classifier service | `lib/ai/classify-email.ts` | Classify email intent using GPT-4o |
| Reply-To encoder | `lib/email/reply-to-encoder.ts` | Generate/decode VERP-style addresses |
| Status update action | `app/actions/update-filing-status.ts` | Auto-update records_received_for |
| Dashboard reply log | `app/(dashboard)/email-logs/page.tsx` | View inbound emails + classifications |
| Manual override UI | `app/(dashboard)/email-logs/[id]/page.tsx` | Override classification, reply to client |

### Modified Components (Extend Existing)

| Component | Current | Change Needed |
|-----------|---------|---------------|
| `sendRichEmail()` | Uses static `replyTo` from `app_settings` | Add optional `replyToOverride` param for encoded addresses |
| `clients.records_received_for` | Manually updated JSONB array | Auto-updated by classification logic |
| `email_log` table | Tracks outbound only | Add `direction` enum ('outbound', 'inbound'), `inbound_email_id` FK |

## Recommended Database Schema

### New Table: `inbound_emails`

```sql
CREATE TABLE inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Postmark webhook data
  postmark_message_id TEXT UNIQUE NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,  -- The encoded reply-to address
  subject TEXT NOT NULL,
  text_body TEXT,
  html_body TEXT,
  date TIMESTAMPTZ NOT NULL,

  -- Decoded context (from Reply-To address)
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE SET NULL,
  original_email_log_id UUID REFERENCES email_log(id) ON DELETE SET NULL,

  -- Processing metadata
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'classified', 'failed')),

  -- Full webhook payload (for debugging)
  raw_payload JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inbound_emails_client ON inbound_emails(client_id);
CREATE INDEX idx_inbound_emails_status ON inbound_emails(processing_status);
CREATE INDEX idx_inbound_emails_received ON inbound_emails(received_at DESC);
CREATE INDEX idx_inbound_emails_postmark ON inbound_emails(postmark_message_id);
```

### New Table: `reply_classifications`

```sql
CREATE TYPE reply_intent_enum AS ENUM (
  'paperwork_sent',       -- "I've sent the documents"
  'question',             -- "I have a question about..."
  'extension_request',    -- "Can I have more time?"
  'out_of_office',        -- Auto-reply OOO
  'unsubscribe',          -- "Stop sending me emails"
  'acknowledgement',      -- "Thanks, got it"
  'confusion',            -- "I don't understand"
  'other'                 -- Catch-all
);

CREATE TABLE reply_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_email_id UUID REFERENCES inbound_emails(id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- AI classification results
  intent reply_intent_enum NOT NULL,
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,  -- AI's explanation
  extracted_filing_types TEXT[],  -- Which filings mentioned (if any)

  -- Manual override
  manual_override_intent reply_intent_enum,
  manual_override_by UUID REFERENCES auth.users(id),
  manual_override_at TIMESTAMPTZ,
  manual_override_reason TEXT,

  -- Action taken
  auto_action_taken BOOLEAN DEFAULT false,
  action_description TEXT,  -- "Marked Corp Tax as records received"

  classified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reply_class_intent ON reply_classifications(intent);
CREATE INDEX idx_reply_class_confidence ON reply_classifications(confidence);
CREATE INDEX idx_reply_class_override ON reply_classifications(manual_override_at)
  WHERE manual_override_at IS NOT NULL;
```

### Extend Existing: `email_log`

```sql
-- Add direction tracking
ALTER TABLE email_log ADD COLUMN direction TEXT DEFAULT 'outbound'
  CHECK (direction IN ('outbound', 'inbound'));

-- Link inbound emails
ALTER TABLE email_log ADD COLUMN inbound_email_id UUID
  REFERENCES inbound_emails(id) ON DELETE SET NULL;

-- Index for replies
CREATE INDEX idx_email_log_direction ON email_log(direction);
```

## Architectural Patterns

### Pattern 1: Reply-To Encoding (VERP-style)

**What:** Encode client_id + filing_type_id + email_log_id into the Reply-To address subdomain/local-part, allowing deterministic parsing when reply arrives.

**When to use:** Inbound email processing where you need to associate replies with specific outbound emails and context.

**Trade-offs:**
- **Pro:** No database lookups needed to match replies to context
- **Pro:** Works even if client changes their email address
- **Con:** Exposes IDs in email headers (use UUIDs, not sequential integers)
- **Con:** Requires subdomain or plus-addressing support

**Example:**
```typescript
// lib/email/reply-to-encoder.ts

export interface ReplyContext {
  clientId: string;
  filingTypeId: string;
  emailLogId: string;
}

export function encodeReplyTo(context: ReplyContext): string {
  // Format: replies+<client>.<filing>.<emaillog>@peninsulaaccounting.co.uk
  // UUIDs are URL-safe (no = substitution needed like VERP)
  const encoded = `${context.clientId}.${context.filingTypeId}.${context.emailLogId}`;
  return `replies+${encoded}@peninsulaaccounting.co.uk`;
}

export function decodeReplyTo(address: string): ReplyContext | null {
  // Extract local part before @
  const [localPart] = address.split('@');

  // Match replies+<uuid>.<filing>.<uuid> pattern
  const match = localPart.match(/^replies\+([a-f0-9-]+)\.([a-z_]+)\.([a-f0-9-]+)$/i);

  if (!match) return null;

  return {
    clientId: match[1],
    filingTypeId: match[2],
    emailLogId: match[3],
  };
}
```

### Pattern 2: Structured AI Classification with Confidence Thresholds

**What:** Use OpenAI structured output with Zod schema to classify email intent, then apply confidence thresholds to determine if auto-action is safe.

**When to use:** AI classification where incorrect actions have consequences (e.g., marking filings as complete when they're not).

**Trade-offs:**
- **Pro:** Type-safe classification results
- **Pro:** Confidence threshold prevents false positives
- **Pro:** Manual override path for ambiguous cases
- **Con:** Requires OpenAI API (cost + latency)
- **Con:** High threshold means more manual reviews

**Example:**
```typescript
// lib/ai/classify-email.ts
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const classificationSchema = z.object({
  intent: z.enum([
    'paperwork_sent',
    'question',
    'extension_request',
    'out_of_office',
    'unsubscribe',
    'acknowledgement',
    'confusion',
    'other',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  extractedFilingTypes: z.array(z.string()).optional(),
});

export async function classifyEmail(params: {
  subject: string;
  body: string;
  clientName: string;
  filingType: string;
}): Promise<z.infer<typeof classificationSchema>> {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: classificationSchema,
    prompt: `You are classifying a client's reply to a tax filing reminder.

Context:
- Client: ${params.clientName}
- Filing Type: ${params.filingType}

Email:
Subject: ${params.subject}
Body: ${params.body}

Classify the intent and provide a confidence score (0-1).`,
  });

  return object;
}

// High confidence threshold for auto-actions
export const HIGH_CONFIDENCE_THRESHOLD = 0.85;

export function shouldAutoUpdate(intent: string, confidence: number): boolean {
  // Only auto-update for clear "paperwork sent" signals
  return intent === 'paperwork_sent' && confidence >= HIGH_CONFIDENCE_THRESHOLD;
}
```

### Pattern 3: Webhook Security with Signature Verification

**What:** Verify incoming webhooks using cryptographic signatures to prevent spoofing.

**When to use:** Any public webhook endpoint (Postmark inbound, Stripe payments, etc.).

**Trade-offs:**
- **Pro:** Prevents attackers from forging webhook events
- **Pro:** Industry standard (Postmark, Stripe, GitHub all use this)
- **Con:** Requires careful handling of raw request body
- **Con:** Signature verification adds latency

**Example:**
```typescript
// app/api/webhooks/inbound-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await request.text();

  // Get signature from header
  const signature = request.headers.get('x-postmark-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  // Verify signature using HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', process.env.POSTMARK_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('base64');

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse JSON after verification
  const payload = JSON.parse(rawBody);

  // Process webhook...

  return NextResponse.json({ success: true });
}
```

## Data Flow

### Inbound Email Processing Flow

```
Client Reply
    ↓
Postmark Inbound (MX: inbound.postmarkapp.com)
    ↓
POST /api/webhooks/inbound-email (signature verified)
    ↓
1. Decode Reply-To address → extract client_id, filing_type_id, email_log_id
    ↓
2. Insert into inbound_emails table (status: pending)
    ↓
3. Call OpenAI classifier → intent + confidence + reasoning
    ↓
4. Insert into reply_classifications table
    ↓
5. IF confidence >= 0.85 AND intent = 'paperwork_sent':
     → Update clients.records_received_for (add filing_type_id)
     → Set auto_action_taken = true
   ELSE:
     → Flag for manual review
    ↓
6. Update inbound_emails.processing_status = 'classified'
    ↓
Return 200 OK to Postmark
```

### Outbound Reply Flow (Accountant → Client)

```
Dashboard: Accountant views inbound_email
    ↓
Clicks "Reply" button
    ↓
Compose form (pre-filled with client email)
    ↓
POST /api/send-reply
    ↓
1. Load client + inbound_email context
    ↓
2. Call sendRichEmail({
     to: inbound_email.from_email,
     subject: "Re: " + inbound_email.subject,
     html: rendered_html,
     text: plain_text,
     clientId: client.id,
     replyToOverride: encodeReplyTo(...)  // New param
   })
    ↓
3. Insert into email_log (direction: outbound, inbound_email_id: ...)
    ↓
4. Update inbound_email with replied_at timestamp
    ↓
Return success → show confirmation in dashboard
```

### Reminder Email with Encoded Reply-To

```
Cron: /api/cron/send-emails
    ↓
For each pending reminder:
    ↓
1. Generate Reply-To address:
     encodeReplyTo({
       clientId: reminder.client_id,
       filingTypeId: reminder.filing_type_id,
       emailLogId: <inserted email_log.id>
     })
    ↓
2. Call sendRichEmail({
     ...,
     replyToOverride: encoded_reply_to
   })
    ↓
3. Postmark sends email with:
     From: reminders@peninsulaaccounting.co.uk
     Reply-To: replies+<uuid>.<filing>.<uuid>@peninsulaaccounting.co.uk
    ↓
Client replies → goes to Postmark inbound → webhook flow above
```

## Postmark Configuration Requirements

### MX Record Setup

**DNS Record:**
```
Type: MX
Name: @ (or specific subdomain if using replies.peninsulaaccounting.co.uk)
Value: inbound.postmarkapp.com
Priority: 10
TTL: 3600
```

**Impact:** All emails sent to `*@peninsulaaccounting.co.uk` will be routed to Postmark inbound processing.

**Alternative (recommended):** Use subdomain `replies.peninsulaaccounting.co.uk` to avoid catching all domain email:
```
Type: MX
Name: replies
Value: inbound.postmarkapp.com
Priority: 10
```

### Webhook Configuration

**In Postmark Dashboard:**
1. Go to Server → Inbound Message Stream → Settings
2. Set Inbound Webhook URL: `https://peninsulaaccounting.co.uk/api/webhooks/inbound-email`
3. Enable webhook authentication (signature verification)
4. Generate webhook secret → store as `POSTMARK_WEBHOOK_SECRET` env var

**Webhook Payload Fields (Postmark):**
- `FromName`, `From`, `FromFull` (email, name)
- `ToFull` (array of recipients)
- `Subject`, `TextBody`, `HtmlBody`
- `Date` (ISO 8601 timestamp)
- `MessageID` (Postmark's unique ID)
- `MailboxHash` (for matching threads)
- `Attachments` (array - NOT processed in v3.0)

### Plus-Addressing Support

**Postmark automatically supports plus-addressing:**
- `replies+abc123@domain.com` is treated as distinct from `replies@domain.com`
- All addresses forward to same inbound webhook
- No additional configuration needed

**Verification:** Send test email to `replies+test@peninsulaaccounting.co.uk` and verify webhook receives it.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 clients (current) | Single Next.js API route handles all webhooks inline. OpenAI classification synchronous. Works fine on Vercel Pro (10s timeout). |
| 100-500 clients | Move OpenAI classification to background job using Vercel Queue or Inngest. Webhook returns 200 immediately, classification happens async. Add retry logic for OpenAI failures. |
| 500-2000 clients | Consider rate limiting on OpenAI API (current: 500 RPM on tier 1). Batch classify multiple emails in single request if reply volume spikes. Add Redis cache for classification results to handle duplicate emails. |
| 2000+ clients | Dedicated email processing service (separate from Next.js). Use job queue (BullMQ + Redis) for classification pipeline. Consider fine-tuned model instead of GPT-4o for cost optimization. |

### Scaling Priorities

1. **First bottleneck:** OpenAI API latency (200-500ms per classification). **Fix:** Move to background queue, return 200 to Postmark immediately.
2. **Second bottleneck:** Database writes (Supabase free tier has connection limits). **Fix:** Upgrade to Supabase Pro ($25/mo) or batch insert classifications.
3. **Third bottleneck:** Postmark inbound rate limits (1000 emails/month on free tier). **Fix:** Upgrade Postmark plan based on reply volume.

## Anti-Patterns

### Anti-Pattern 1: Parsing Reply-To from Email Body

**What people do:** Try to extract context by parsing "In reply to..." text in email body or using email threading headers (In-Reply-To, References).

**Why it's wrong:**
- Email threading headers are unreliable (clients strip them, forwarding breaks them)
- Body parsing is fragile (different email clients format differently)
- Requires database lookup to match headers to original email
- Fails if client manually composes new email to accountant

**Do this instead:** Encode all context in Reply-To address using VERP-style pattern. Deterministic, survives forwarding, no DB lookup needed.

### Anti-Pattern 2: Auto-Updating Status Without Confidence Threshold

**What people do:** Classify email intent with AI, then immediately update client filing status regardless of confidence score.

**Why it's wrong:**
- AI misclassifications can mark filings as complete when they're not
- "Thanks for the reminder" (acknowledgement) might be classified as "paperwork sent"
- No mechanism to catch mistakes until accountant notices missing documents

**Do this instead:** Use confidence threshold (>= 0.85) for auto-actions. Below threshold, flag for manual review. Store classification reasoning for audit trail.

### Anti-Pattern 3: Blocking Webhook Response on OpenAI API

**What people do:** Call OpenAI API synchronously in webhook handler, wait for classification, then return 200 to Postmark.

**Why it's wrong:**
- OpenAI API can take 500ms+ (especially GPT-4o with structured output)
- If OpenAI times out or errors, webhook returns 500 → Postmark retries indefinitely
- Blocks webhook processing queue (Postmark expects <2s responses)
- No retry logic if OpenAI is down

**Do this instead:**
- For MVP (<100 clients): Acceptable to call OpenAI synchronously with try/catch. Return 200 even if classification fails (mark as 'failed' status, retry later).
- For scale: Move classification to background job. Webhook stores raw email, returns 200 immediately, background worker classifies async.

### Anti-Pattern 4: Storing Full HTML Email Body in Production

**What people do:** Store `html_body` from Postmark webhook directly in database for every email.

**Why it's wrong:**
- HTML emails can be 50KB-500KB (especially with inline CSS)
- For 1000 replies/month, that's 50-500MB of mostly unused data
- Supabase free tier has 500MB database limit
- Rarely need to re-render HTML (text body sufficient for classification + display)

**Do this instead:**
- Store `text_body` only for classification/display
- Store `html_body` only for first 30 days (for debugging), then delete via cron
- Or store HTML in Supabase Storage (separate from database), link via URL
- For v3.0 MVP: Store both, optimize later if storage becomes issue

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Postmark (Inbound)** | Webhook POST with signature verification | Requires MX record DNS setup. Webhook URL must return 200 within 10s or Postmark retries. |
| **Postmark (Outbound)** | Existing `sendRichEmail()` via Postmark API | Already configured. Add `replyToOverride` param to support encoded addresses. |
| **OpenAI GPT-4o** | Vercel AI SDK with structured output (Zod schema) | Requires `OPENAI_API_KEY` env var. Use `generateObject()` for classification. Tier 1: 500 RPM limit. |
| **Supabase Postgres** | Existing admin client for service role access | Use `createAdminClient()` for webhook handler (bypasses RLS). New tables need RLS policies for dashboard. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Webhook → Classifier** | Direct function call (synchronous for MVP) | Consider async queue for scale. Pass `subject`, `body`, `clientName`, `filingType`. |
| **Classifier → Database** | Supabase admin client (transactional) | Wrap classification + auto-update in transaction. Rollback if either fails. |
| **Dashboard → Reply Sender** | Server Action → `sendRichEmail()` | Reuse existing email sender. Pass `inbound_email_id` for threading context. |
| **Cron → Email Sender** | Existing pattern, add Reply-To encoding | Modify to generate encoded Reply-To before calling `sendRichEmail()`. Insert `email_log` first to get ID for encoding. |

## Build Order Recommendation

**Phase 1: Infrastructure (Weeks 1-2)**
1. Add MX record for `replies.peninsulaaccounting.co.uk`
2. Configure Postmark inbound webhook URL + secret
3. Create migrations for `inbound_emails`, `reply_classifications` tables
4. Extend `email_log` with `direction` + `inbound_email_id`
5. Add `OPENAI_API_KEY` and `POSTMARK_WEBHOOK_SECRET` to env vars

**Phase 2: Inbound Processing (Weeks 2-3)**
1. Build Reply-To encoder/decoder (`lib/email/reply-to-encoder.ts`)
2. Build webhook handler (`app/api/webhooks/inbound-email/route.ts`)
   - Signature verification
   - Decode Reply-To
   - Store in `inbound_emails`
3. Build OpenAI classifier (`lib/ai/classify-email.ts`)
   - Structured output with Zod
   - Intent + confidence + reasoning
4. Build auto-update logic (`app/actions/update-filing-status.ts`)
   - Check confidence threshold
   - Update `clients.records_received_for`
   - Store in `reply_classifications`
5. Test with manual email sends to `replies+<encoded>@...`

**Phase 3: Outbound Integration (Week 4)**
1. Modify `sendRichEmail()` to accept `replyToOverride` param
2. Modify cron `/api/cron/send-emails` to encode Reply-To before sending
3. Test full round-trip: cron sends → client replies → webhook processes

**Phase 4: Dashboard (Weeks 4-5)**
1. Build email log page (`app/(dashboard)/email-logs/page.tsx`)
   - List all inbound emails with classification
   - Filter by intent, confidence, manual review needed
2. Build detail page (`app/(dashboard)/email-logs/[id]/page.tsx`)
   - Show full email content
   - Show classification with reasoning
   - Manual override controls
   - Reply form
3. Build reply sender action (`app/actions/send-reply.ts`)
   - Compose reply email
   - Call `sendRichEmail()` with encoded Reply-To
   - Update `inbound_emails.replied_at`

**Phase 5: Monitoring & Refinement (Week 6)**
1. Add error monitoring (Sentry or similar)
2. Add classification accuracy tracking dashboard
3. Tune confidence threshold based on real data
4. Add retry logic for failed OpenAI calls

## Sources

- [Postmark Inbound Webhook Documentation](https://postmarkapp.com/developer/webhooks/inbound-webhook)
- [Postmark Inbound Domain Forwarding](https://postmarkapp.com/developer/user-guide/inbound/inbound-domain-forwarding)
- [VERP (Variable Envelope Return Path) Guide](https://blog.mystrika.com/the-complete-guide-to-verp-variable-envelope-return-path/)
- [OpenAI Structured Outputs Documentation](https://platform.openai.com/docs/guides/structured-outputs)
- [Vercel AI SDK Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Next.js Webhook Security Best Practices](https://makerkit.dev/blog/tutorials/nextjs-security)
- [Text Classification with Vercel AI SDK](https://vercel.com/academy/ai-sdk/text-classification)
- [Email Classification with GPT-4o](https://medium.com/@louremipsum/how-i-completed-a-full-stack-assignment-using-brand-new-technologies-in-3-days-55735281c741)

---
*Architecture research for: Inbound Email Processing + AI Classification*
*Researched: 2026-02-13*
*Confidence: HIGH (based on official Postmark docs, OpenAI structured output specs, and Vercel AI SDK patterns)*
