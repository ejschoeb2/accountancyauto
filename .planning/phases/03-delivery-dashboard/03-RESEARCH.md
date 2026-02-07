# Phase 3: Delivery & Dashboard - Research

**Researched:** 2026-02-07
**Domain:** Transactional email delivery (Postmark), webhook processing, dashboard UI with status indicators
**Confidence:** HIGH

## Summary

This phase implements the final delivery mechanism for the reminder system built in Phase 2. The research covered three main domains: (1) Postmark API integration for sending transactional emails with HTML templates, (2) webhook handling for delivery status tracking with proper security verification, and (3) dashboard UI patterns for monitoring client status with traffic-light indicators and audit logs.

The standard approach uses the official Postmark Node.js SDK (`postmark` npm package) combined with React Email for HTML template generation. Webhooks require raw body access for HMAC-SHA256 signature verification, which Next.js Route Handlers support natively via `request.text()`. Dashboard implementation follows card-based architecture with shadcn/ui components (Badge, Card, Table) for status visualization.

Key recommendations include: never retry hard bounces (permanent failures with 5xx SMTP codes), implement webhook signature verification to prevent replay attacks, use inline CSS for email HTML to ensure compatibility across email clients, and organize the audit log with timestamp-first sorting with filters for efficient access patterns.

**Primary recommendation:** Use the official Postmark SDK with React Email templates, implement HMAC signature verification for webhooks, and build dashboard with shadcn/ui Card + Badge components for traffic-light status indicators.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Email presentation:**
- HTML emails with Peninsula Accounting branding (logo, colours, professional layout)
- Sender identity: practice name only — From: "Peninsula Accounting" <reminders@peninsulaaccounting.co.uk>
- Reply-To set to accountant's real email address so clients can respond directly
- Minimal footer: practice name + "This is an automated reminder from Peninsula Accounting"
- No unsubscribe link (these are legitimate business communications, not marketing)

**Dashboard layout:**
- New dedicated /dashboard page (separate from existing /clients page)
- Summary cards at top: key metrics (e.g., overdue count, reminders sent today, paused clients)
- Client status list below with essential columns only: client name, traffic-light indicator, next deadline, days until deadline
- Manual refresh (data loads on page visit, refresh button available — no auto-polling)
- This becomes the landing page after login

**Traffic-light logic:**
- 4-state system: green, amber, red, grey
- GREEN: Records received for that filing period — nothing to chase
- AMBER: At least one reminder has been sent but records not yet received — actively chasing
- RED: Filing deadline has passed and records haven't been received — genuinely overdue
- GREY: Client has reminders paused or no active deadlines — inactive/not applicable

**Audit log design:**
- Two locations: global log tab on dashboard + per-client log on client detail page (same data, different filters)
- Summary line per entry: client name, filing type, date sent, delivery status (delivered/bounced/failed)
- Basic filters: client name search and date range
- Failed/bounced emails trigger a warning banner on the dashboard — "X reminders failed to deliver"

### Claude's Discretion

- Postmark API integration approach and webhook handling
- Email HTML template structure and CSS
- Summary card metrics selection and layout
- Dashboard sorting defaults
- Audit log pagination approach
- Banner alert dismissal behavior

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| postmark | 4.0.5+ | Postmark Node.js SDK | Official SDK from Postmark/ActiveCampaign, supports entire REST API including webhooks |
| @react-email/components | latest | Email HTML component library | Industry standard for building HTML emails with React, renders to email-client-compatible HTML |
| @react-email/render | latest | Convert React components to HTML | Transforms React Email components into HTML strings for email delivery |
| shadcn/ui | latest | UI component library | Already in use, provides Badge, Card, Table components for dashboard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0+ | Date formatting | Already in project, use for "sent X days ago" and deadline calculations |
| zod | latest | Input validation | Already in use, validate webhook payloads and server action inputs |
| crypto (Node.js built-in) | N/A | HMAC verification | Webhook signature verification, no additional package needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Email | MJML | MJML requires separate compilation step, React Email integrates better with Next.js |
| postmark SDK | Raw fetch() calls | SDK handles authentication, error handling, type safety — no benefit to raw calls |
| Route Handlers | Supabase Edge Functions | Edge Functions add 2s CPU timeout limit, Route Handlers better for webhook processing |

**Installation:**
```bash
npm install postmark @react-email/components @react-email/render
```

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── email/
│   ├── client.ts              # Postmark client singleton
│   ├── sender.ts              # Send email function (used by cron)
│   └── templates/
│       └── reminder.tsx       # React Email reminder template
├── webhooks/
│   ├── postmark-verify.ts     # HMAC signature verification
│   └── handlers.ts            # Webhook event handlers (delivery, bounce)
└── dashboard/
    ├── metrics.ts             # Calculate summary card metrics
    └── traffic-light.ts       # Traffic-light status calculation logic

app/
├── api/
│   ├── cron/
│   │   └── send-emails/
│   │       └── route.ts       # Cron endpoint: process pending reminders
│   └── webhooks/
│       └── postmark/
│           └── route.ts       # Webhook receiver: handle delivery events
└── (dashboard)/
    └── dashboard/
        ├── page.tsx           # Main dashboard (summary + status list)
        └── components/
            ├── summary-cards.tsx
            ├── client-status-table.tsx
            └── audit-log-table.tsx

supabase/
└── migrations/
    └── create_phase3_schema.sql  # email_log table
```

### Pattern 1: Email Sending from Cron Job

**What:** Separate cron job queries `reminder_queue` for `status='pending'`, sends via Postmark SDK, updates status to `sent` or `failed`, logs to `email_log` table.

**When to use:** Phase 2 cron already marks reminders as pending — this new cron processes the pending queue.

**Example:**
```typescript
// lib/email/sender.ts
// Source: Postmark official docs + Next.js patterns
import { ServerClient } from 'postmark';
import { render } from '@react-email/render';
import ReminderEmail from './templates/reminder';

const client = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!);

export async function sendReminderEmail(params: {
  to: string;
  subject: string;
  body: string;
  clientName: string;
  filingType: string;
  deadline: Date;
}) {
  const html = await render(
    ReminderEmail({
      clientName: params.clientName,
      filingType: params.filingType,
      deadline: params.deadline,
      body: params.body,
    })
  );

  const result = await client.sendEmail({
    From: 'Peninsula Accounting <reminders@peninsulaaccounting.co.uk>',
    To: params.to,
    ReplyTo: 'accountant@peninsulaaccounting.co.uk',
    Subject: params.subject,
    HtmlBody: html,
    TextBody: params.body, // plain text fallback
    MessageStream: 'outbound',
    TrackOpens: false, // User decision: no tracking
  });

  return {
    messageId: result.MessageID,
    submittedAt: result.SubmittedAt,
    to: result.To,
  };
}
```

### Pattern 2: Webhook Signature Verification

**What:** Verify HMAC-SHA256 signature from `x-postmark-signature` header against raw request body to prevent replay attacks and unauthorized webhooks.

**When to use:** EVERY webhook request MUST be verified before processing.

**Example:**
```typescript
// lib/webhooks/postmark-verify.ts
// Source: Postmark webhook security best practices
import crypto from 'crypto';

export function verifyPostmarkWebhook(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const computed = hmac.digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}

// app/api/webhooks/postmark/route.ts
// Source: Next.js Route Handler + Postmark patterns
export async function POST(request: Request) {
  const rawBody = await request.text(); // MUST use raw body for signature
  const signature = request.headers.get('x-postmark-signature');

  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 401 });
  }

  const isValid = verifyPostmarkWebhook(
    rawBody,
    signature,
    process.env.POSTMARK_WEBHOOK_SECRET!
  );

  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody); // Safe to parse after verification
  await handleWebhookEvent(event);

  return Response.json({ received: true });
}
```

### Pattern 3: React Email Template with Inline CSS

**What:** Use React Email components with inline styles (not external CSS) to ensure compatibility across email clients like Outlook.

**When to use:** All HTML emails sent via Postmark.

**Example:**
```typescript
// lib/email/templates/reminder.tsx
// Source: React Email documentation + email best practices
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
} from '@react-email/components';

interface ReminderEmailProps {
  clientName: string;
  filingType: string;
  deadline: Date;
  body: string;
}

export default function ReminderEmail({
  clientName,
  filingType,
  deadline,
  body,
}: ReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f4f4' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', padding: '20px' }}>
          {/* Logo */}
          <Section style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src="https://peninsulaaccounting.co.uk/logo.png" alt="Peninsula Accounting" width="150" />
          </Section>

          {/* Content */}
          <Section>
            <Heading style={{ color: '#333333', fontSize: '20px' }}>
              {filingType} Reminder
            </Heading>
            <Text style={{ color: '#666666', fontSize: '14px', lineHeight: '1.5' }}>
              {body}
            </Text>
          </Section>

          {/* Footer */}
          <Section style={{ marginTop: '30px', borderTop: '1px solid #eeeeee', paddingTop: '20px' }}>
            <Text style={{ color: '#999999', fontSize: '12px', textAlign: 'center' }}>
              This is an automated reminder from Peninsula Accounting
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### Pattern 4: Dashboard Traffic-Light Status Calculation

**What:** Calculate 4-state traffic-light status (green/amber/red/grey) based on reminder queue status and records received flag.

**When to use:** Dashboard page and client detail page status indicators.

**Example:**
```typescript
// lib/dashboard/traffic-light.ts
// Source: User requirements + dashboard patterns
export type TrafficLightStatus = 'green' | 'amber' | 'red' | 'grey';

export function calculateClientStatus(client: {
  id: string;
  reminders_paused: boolean;
  records_received_for: string[]; // Array of filing_type_ids
  reminder_queue: Array<{
    filing_type_id: string;
    deadline_date: string;
    status: string;
  }>;
}): TrafficLightStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // GREY: Paused or no active deadlines
  if (client.reminders_paused || client.reminder_queue.length === 0) {
    return 'grey';
  }

  // Check each filing type
  let hasOverdue = false;
  let hasActivelyChasedAndNotReceived = false;

  for (const reminder of client.reminder_queue) {
    const deadline = new Date(reminder.deadline_date);
    const isReceived = client.records_received_for.includes(reminder.filing_type_id);

    if (isReceived) {
      // GREEN for this filing type - continue checking others
      continue;
    }

    // RED: Deadline passed and not received
    if (deadline < today) {
      hasOverdue = true;
    }

    // AMBER: At least one reminder sent but not received
    if (reminder.status === 'sent') {
      hasActivelyChasedAndNotReceived = true;
    }
  }

  if (hasOverdue) return 'red';
  if (hasActivelyChasedAndNotReceived) return 'amber';

  return 'green';
}
```

### Pattern 5: Audit Log with Timestamp-First Sorting

**What:** Query email_log table sorted by timestamp DESC (newest first), apply client and date range filters, use offset-based pagination.

**When to use:** Dashboard audit log tab and client detail page audit log.

**Example:**
```typescript
// app/(dashboard)/dashboard/page.tsx - audit log query
// Source: Audit log best practices + Supabase patterns
const { data: auditLog, error } = await supabase
  .from('email_log')
  .select(`
    id,
    sent_at,
    client_id,
    clients!inner(company_name),
    filing_types!inner(name),
    delivery_status,
    postmark_message_id
  `)
  .order('sent_at', { ascending: false })
  .range(offset, offset + limit - 1);

// For per-client log, add filter:
// .eq('client_id', clientId)

// For date range filter:
// .gte('sent_at', startDate)
// .lte('sent_at', endDate)
```

### Anti-Patterns to Avoid

- **Don't retry hard bounces:** 5xx SMTP codes are permanent failures — immediately mark as failed and alert accountant, never retry
- **Don't parse JSON before verifying signature:** Signature verification MUST happen on raw body bytes, not re-stringified JSON
- **Don't use media queries as primary responsive strategy:** Many email clients strip them — use fluid tables (width: 100%, max-width: 600px) as primary approach
- **Don't auto-refresh dashboard:** Polling adds unnecessary load and complexity — manual refresh with button is sufficient
- **Don't sort audit log by client name:** Users care about recent activity first — always sort by timestamp DESC

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML rendering | Custom template string builder | React Email | Handles inline CSS conversion, email client quirks, component reuse |
| Postmark API calls | Raw fetch() with auth headers | `postmark` SDK | Type safety, error handling, retry logic, message tracking |
| HMAC signature verification | Custom crypto implementation | Node.js `crypto.createHmac()` + timing-safe comparison | Prevents timing attacks, handles encoding edge cases |
| Email bounce classification | Custom SMTP code parsing | Postmark webhook event types | Postmark already classifies bounces as hard/soft/spam |
| Dashboard table pagination | Manual offset/limit calculation | shadcn/ui Table + DataTable pattern | Handles edge cases, sorting, filtering, responsive design |

**Key insight:** Email deliverability is complex — authentication (SPF/DKIM/DMARC), bounce handling, spam filtering, client compatibility. Postmark solves all of this; custom solutions will miss edge cases and harm sender reputation.

## Common Pitfalls

### Pitfall 1: JSON Re-Stringification Breaking Signatures

**What goes wrong:** Developer parses incoming webhook JSON, then re-stringifies it for signature verification — signature doesn't match because JSON key order or whitespace changed.

**Why it happens:** HMAC signs exact byte sequence received over the wire. `JSON.stringify()` may produce different output than original.

**How to avoid:** ALWAYS verify signature against raw body BEFORE parsing JSON. Use `request.text()` in Route Handler, verify signature, THEN `JSON.parse()`.

**Warning signs:** Webhook signature verification fails intermittently or always, even with correct secret.

### Pitfall 2: Hard Bounce Retry Loops

**What goes wrong:** System retries emails with hard bounces (5xx SMTP codes like "mailbox does not exist"), wasting API calls and damaging sender reputation.

**Why it happens:** Developer treats all failed emails the same, implementing generic retry logic without checking bounce type.

**How to avoid:** Postmark webhooks include `Type` field with values like `HardBounce`, `SoftBounce`, `Transient`. Hard bounces should be marked as permanently failed and NEVER retried. Remove hard bounce addresses from mailing list.

**Warning signs:** Postmark dashboard shows high bounce rate, emails to same addresses repeatedly failing.

### Pitfall 3: External CSS in Email Templates

**What goes wrong:** Email uses `<link>` to external stylesheet or `<style>` tag with classes — email looks broken in Outlook, Gmail mobile.

**Why it happens:** Many email clients strip `<style>` tags and block external resources for security reasons.

**How to avoid:** Use ONLY inline styles (style attribute on every element). React Email handles this automatically when rendering — verify by checking rendered HTML output.

**Warning signs:** Email looks perfect in browser preview but broken in actual email clients, especially Outlook.

### Pitfall 4: Missing Cron Secret Verification

**What goes wrong:** Cron endpoint is publicly accessible, malicious actors can trigger email sending by calling `/api/cron/send-emails` directly.

**Why it happens:** Developer assumes Vercel cron jobs are automatically secured — they're not.

**How to avoid:** Add CRON_SECRET environment variable, check `Authorization` header equals `Bearer ${CRON_SECRET}` before processing. Vercel automatically adds this header to scheduled cron requests.

**Warning signs:** Unexpected emails being sent, cron job triggered outside scheduled times.

### Pitfall 5: Soft Bounce Over-Suppression

**What goes wrong:** System permanently marks emails as failed after first soft bounce (4xx SMTP codes like "mailbox full"), but these are temporary failures.

**Why it happens:** Developer doesn't distinguish between hard and soft bounces.

**How to avoid:** Implement retry logic for soft bounces — retry 3-5 times over 2-4 weeks before marking as permanently failed. Postmark webhooks provide `Type` field to distinguish hard vs soft.

**Warning signs:** Emails marked as failed that later succeed when retried manually, clients reporting they never received reminders.

### Pitfall 6: Table-Based Email Layout Pitfalls

**What goes wrong:** Email uses divs with flexbox/grid for layout — breaks in Outlook which uses Word rendering engine.

**Why it happens:** Developer applies modern web layout techniques to email without understanding email client limitations.

**How to avoid:** Use HTML `<table>` elements for layout structure. React Email's Container, Section components render as tables automatically. Set width in percentages (not fixed pixels) for responsive design.

**Warning signs:** Email looks broken specifically in Outlook, layout collapses or elements overlap.

## Code Examples

Verified patterns from official sources:

### Sending Email with Postmark SDK

```typescript
// Source: https://postmarkapp.com/developer/user-guide/send-email-with-api
import { ServerClient } from 'postmark';

const client = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!);

const response = await client.sendEmail({
  From: 'Peninsula Accounting <reminders@peninsulaaccounting.co.uk>',
  To: 'client@example.com',
  ReplyTo: 'accountant@peninsulaaccounting.co.uk',
  Subject: 'VAT Return Reminder',
  HtmlBody: '<html><body><h1>Reminder</h1><p>Your VAT return is due soon.</p></body></html>',
  TextBody: 'Reminder: Your VAT return is due soon.',
  MessageStream: 'outbound',
  TrackOpens: false,
  TrackLinks: 'None',
});

// response includes:
// - MessageID: unique identifier for tracking
// - SubmittedAt: ISO timestamp when Postmark accepted the email
// - To: confirmed recipient address
```

### Handling Postmark Webhook Events

```typescript
// Source: https://postmarkapp.com/developer/webhooks/webhooks-overview
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-postmark-signature');

  // Verify signature
  const isValid = verifyPostmarkWebhook(
    rawBody,
    signature!,
    process.env.POSTMARK_WEBHOOK_SECRET!
  );

  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // Event types: Delivery, Bounce, SpamComplaint, SubscriptionChange, Open, Click
  switch (event.RecordType) {
    case 'Delivery':
      await handleDelivery({
        messageId: event.MessageID,
        recipient: event.Recipient,
        deliveredAt: event.DeliveredAt,
      });
      break;

    case 'Bounce':
      await handleBounce({
        messageId: event.MessageID,
        type: event.Type, // HardBounce, SoftBounce, Transient, etc.
        bounceCode: event.TypeCode,
        description: event.Description,
        recipient: event.Email,
      });
      break;

    default:
      console.warn(`Unhandled webhook type: ${event.RecordType}`);
  }

  return Response.json({ received: true });
}
```

### React Email Reminder Template

```typescript
// Source: https://www.npmjs.com/package/@react-email/components
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
} from '@react-email/components';

export default function ReminderEmail({
  clientName,
  body
}: {
  clientName: string;
  body: string;
}) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section>
            <img
              src="https://peninsulaaccounting.co.uk/logo.png"
              alt="Peninsula Accounting"
              width="150"
              style={{ display: 'block', margin: '0 auto 20px' }}
            />
          </Section>

          <Section>
            <Heading style={headingStyle}>Reminder</Heading>
            <Text style={textStyle}>{body}</Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              This is an automated reminder from Peninsula Accounting
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Inline styles - email clients don't support external CSS
const bodyStyle = {
  fontFamily: 'Arial, sans-serif',
  backgroundColor: '#f4f4f4',
  padding: '20px',
};

const containerStyle = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  padding: '30px',
};

const headingStyle = {
  color: '#333333',
  fontSize: '24px',
  marginBottom: '20px',
};

const textStyle = {
  color: '#666666',
  fontSize: '16px',
  lineHeight: '1.6',
};

const footerStyle = {
  marginTop: '40px',
  borderTop: '1px solid #eeeeee',
  paddingTop: '20px',
};

const footerTextStyle = {
  color: '#999999',
  fontSize: '12px',
  textAlign: 'center' as const,
};
```

### Traffic-Light Badge Component

```typescript
// Source: https://ui.shadcn.com/docs/components/badge + user requirements
import { Badge } from '@/components/ui/badge';

type Status = 'green' | 'amber' | 'red' | 'grey';

export function TrafficLightBadge({ status }: { status: Status }) {
  const config = {
    green: { label: 'On Track', variant: 'default', className: 'bg-green-500' },
    amber: { label: 'Chasing', variant: 'secondary', className: 'bg-amber-500' },
    red: { label: 'Overdue', variant: 'destructive', className: '' },
    grey: { label: 'Inactive', variant: 'outline', className: 'text-gray-500' },
  };

  const { label, variant, className } = config[status];

  return (
    <Badge
      variant={variant as any}
      className={className}
      aria-label={`Status: ${label}`}
    >
      {label}
    </Badge>
  );
}
```

### Dashboard Summary Cards

```typescript
// Source: https://ui.shadcn.com/docs/components/base/card + dashboard patterns
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function SummaryCards({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">
            Overdue Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {metrics.overdueCount}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">
            Actively Chasing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-amber-600">
            {metrics.chasingCount}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">
            Sent Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">
            {metrics.sentTodayCount}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">
            Paused Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-600">
            {metrics.pausedCount}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Cron Job Security Check

```typescript
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
// app/api/cron/send-emails/route.ts
export const dynamic = 'force-dynamic'; // Prevent caching

export async function POST(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Process pending reminders
  const result = await sendPendingReminders();

  return Response.json(result);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MJML for email templates | React Email | 2023 | Better Next.js integration, component reuse, TypeScript support |
| Nodemailer + SMTP | Postmark API | Ongoing | Higher deliverability, bounce handling, webhook infrastructure |
| Custom email parsing | Postmark event types | N/A | Postmark classifies bounces/spam, no need to parse SMTP codes |
| Polling for email status | Webhooks | Industry standard | Real-time updates, no polling overhead |
| Auto-refresh dashboards | Manual refresh | 2024+ | Reduced server load, user controls data freshness |

**Deprecated/outdated:**
- External CSS in emails: Most modern email clients still strip it (as of 2026)
- Unverified webhook endpoints: Security risk, now considered unacceptable
- Next.js Pages Router API routes: App Router Route Handlers are current standard (Next.js 13+)

## Open Questions

Things that couldn't be fully resolved:

1. **Postmark domain verification status**
   - What we know: Postmark requires sender signature verification before sending emails
   - What's unclear: Whether domain DNS records (SPF/DKIM/DMARC) are already configured for peninsulaaccounting.co.uk
   - Recommendation: Verify domain setup in Postmark dashboard during Phase 3 kick-off, add to task list if setup needed

2. **Accountant's real Reply-To email address**
   - What we know: User wants Reply-To set to accountant's real email for client responses
   - What's unclear: What is the actual accountant email address to use in Reply-To header
   - Recommendation: Request during implementation, store in environment variable ACCOUNTANT_EMAIL

3. **Email log retention period**
   - What we know: Audit log shows all sent emails with delivery status
   - What's unclear: How long to retain email logs (forever, 1 year, 7 years for compliance?)
   - Recommendation: Default to 7 years (UK accounting record retention), add optional cleanup cron if storage becomes issue

4. **Failed delivery retry logic scope**
   - What we know: Soft bounces should be retried, hard bounces should not
   - What's unclear: Should retry logic be built in Phase 3 or deferred to Phase 4 (polish)?
   - Recommendation: Implement basic soft bounce retry (3 attempts over 2 weeks) in Phase 3, defer advanced retry to Phase 4

5. **Dashboard default landing page route**
   - What we know: User wants /dashboard as landing page after login
   - What's unclear: Should middleware redirect / to /dashboard, or update post-login redirect in auth config?
   - Recommendation: Use middleware redirect for authenticated users: / -> /dashboard

## Sources

### Primary (HIGH confidence)

- [Postmark Developer Documentation - API Overview](https://postmarkapp.com/developer/api/overview) - Authentication, base URLs, API structure
- [Postmark Developer Documentation - Sending Email with API](https://postmarkapp.com/developer/user-guide/send-email-with-api) - Email sending methods and required fields
- [Postmark Developer Documentation - Webhooks Overview](https://postmarkapp.com/developer/webhooks/webhooks-overview) - Webhook types, security, payload data
- [Postmark Developer Documentation - Messages API](https://postmarkapp.com/developer/api/messages-api) - Message tracking and status retrieval
- [npmjs.com - postmark package](https://www.npmjs.com/package/postmark) - Official SDK version 4.0.5, Node.js v14+ support
- [npmjs.com - @react-email/components](https://www.npmjs.com/package/@react-email/components) - React Email component library
- [shadcn/ui Documentation - Badge Component](https://ui.shadcn.com/docs/components/badge) - Badge variants and usage
- [shadcn/ui Documentation - Card Component](https://ui.shadcn.com/docs/components/base/card) - Card layout patterns
- [Next.js Documentation - Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) - POST body parsing with request.json() and request.text()
- [Vercel Documentation - Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) - Cron secret security

### Secondary (MEDIUM confidence)

- [How to Handle Stripe and Paystack Webhooks in Next.js - DEV Community](https://dev.to/thekarlesi/how-to-handle-stripe-and-paystack-webhooks-in-nextjs-the-app-router-way-5bgi) - Webhook signature verification patterns
- [Most Webhook Signatures Are Broken - Medium](https://yusufhansacak.medium.com/most-webhook-signatures-are-broken-4ad00acfb755) - Critical webhook security guidance on HMAC signing bytes not objects
- [HTML and CSS in Emails: What Works in 2026? - Designmodo](https://designmodo.com/html-css-emails/) - Inline CSS necessity, email client compatibility
- [Responsive Email Design Tutorial - Mailtrap](https://mailtrap.io/blog/responsive-email-design/) - Table-based layouts, 600px width standard, media query limitations
- [Designing High-Performance Email Layouts in 2026 - Medium](https://medium.com/@romualdo.bugai/designing-high-performance-email-layouts-in-2026-a-practical-guide-from-the-trenches-a3e7e4535692) - Mobile-first approach, graceful degradation
- [Carbon Design System - Status Indicators](https://carbondesignsystem.com/patterns/status-indicator-pattern/) - Traffic-light color standards (red/amber/green)
- [Guide to Building Audit Logs - Medium](https://medium.com/@tony.infisical/guide-to-building-audit-logs-for-application-software-b0083bb58604) - Timestamp-first sorting, pagination patterns
- [Next.js Server Actions: Complete Guide - MakerKit](https://makerkit.dev/blog/tutorials/nextjs-server-actions) - Error handling and validation with Zod
- [Transactional Email Bounce Handling Best Practices - Postmark](https://postmarkapp.com/guides/transactional-email-bounce-handling-best-practices) - Hard vs soft bounce distinction
- [Soft Bounce Suppression Logic - Suped](https://www.suped.com/knowledge/email-deliverability/technical/what-is-the-recommended-soft-bounce-suppression-logic-for-email) - 3-5 bounce threshold over 2-4 weeks
- [Email Bounce Rate Guide - CleverTap](https://clevertap.com/blog/email-bounce-rate/) - Acceptable bounce rate < 2%, red flag > 5%

### Tertiary (LOW confidence)

- [Next.js SaaS Dashboard Best Practices - KSolves](https://www.ksolves.com/blog/next-js/best-practices-for-saas-dashboards) - Card-based architecture, lazy loading
- [Best Dashboard Design Examples 2026 - Muzli](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/) - Visual design trends, glowing accents
- [Supabase Edge Functions Troubleshooting](https://supabase.com/docs/guides/functions/troubleshooting) - 2s CPU timeout, 150s idle timeout (relevant for why Route Handlers preferred)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Postmark docs, npm registry, React Email docs all verified
- Architecture: HIGH - Patterns based on official examples and established Next.js conventions
- Pitfalls: MEDIUM-HIGH - Bounce handling and webhook security from Postmark + community best practices, email CSS from multiple authoritative sources

**Research date:** 2026-02-07
**Valid until:** 2026-04-07 (60 days — email standards stable, Next.js patterns mature)
