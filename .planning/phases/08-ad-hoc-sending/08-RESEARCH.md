# Phase 8: Ad-Hoc Sending - Research

**Researched:** 2026-02-08
**Domain:** Bulk email sending UI with progress feedback
**Confidence:** HIGH

## Summary

Phase 8 implements a bulk email sending feature triggered from the clients page. Users select clients via existing checkboxes, click a new "Send Email" button in the bulk actions toolbar, choose a template, preview the rendered email, and send with progress feedback. The entire flow happens in a modal dialog with no new navigation pages.

The standard approach uses shadcn/ui Dialog components for the modal flow, Next.js Server Actions for bulk sending with proper error handling, and sonner toast notifications for feedback. Progress tracking happens client-side with state updates, not streaming, since Server Actions don't stream well for progress updates. Email delivery uses the existing Postmark pipeline (renderTipTapEmail + sendRichEmail), and sends are logged to email_log with NULL reminder_queue_id to distinguish ad-hoc from scheduled sends.

**Primary recommendation:** Build a multi-step modal with state-driven view switching (template selection → preview → confirmation → sending → results). Process sends client-side in a loop with individual Server Action calls for granular progress updates and partial failure handling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Client selection:**
- Flow starts from the existing clients page — user selects clients via the existing bulk selection checkboxes
- A new "Send Email" button appears in the bulk actions toolbar (alongside existing bulk actions)
- Selection on the clients page is final — no ability to modify recipients inside the modal
- Clients without email addresses are silently skipped during send, with the count reflected in the results summary

**Template & preview:**
- Template selection via a simple dropdown listing all templates by name
- After selecting a template, show a preview rendered with the first selected client's data
- Preview shows the rendered email as the client would see it, plus a note indicating which placeholders were substituted
- No inline editing of subject or body — template is used as-is (user edits the template itself if changes are needed)

**Send flow & feedback:**
- Explicit confirmation step before sending: "Send to X clients?" with confirm button
- Visual progress bar showing X/Y sent as emails go out
- Results summary shows sent count and failed count, plus a list of failed clients with error reasons
- On individual send failure, continue sending remaining clients — collect all failures and report at the end

**Entry points & navigation:**
- Clients page is the only entry point — no standalone "Send Email" nav item
- Ad-hoc sends appear in the existing delivery log with an "ad-hoc" badge/tag to distinguish from scheduled reminders
- After successful send, modal closes and user returns to clients page with a success toast notification

### Claude's Discretion

- Modal layout and step progression (single panel vs wizard steps)
- Progress bar styling and animation
- Toast notification design and duration
- How to handle the case when all selected clients lack email addresses

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

The established libraries/tools for bulk operations with progress feedback in Next.js:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui Dialog | latest | Modal container | Already in project, consistent with bulk edit modal pattern |
| Next.js Server Actions | 15.x | Bulk send logic | Project standard for mutations, proper error handling |
| sonner | latest | Toast notifications | Already in project for success/error feedback |
| React useState | 19.x | Progress state management | Simple state tracking for X/Y progress |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Progress | latest | Progress bar component | Add to project for visual progress indicator |
| shadcn/ui Select | latest | Template dropdown | Already in project |
| Zod | 3.x | Input validation | Already in project for Server Action validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side loop | Single Server Action batch | Streaming from Server Actions is complex; client loop gives granular progress updates |
| Custom progress UI | shadcn/ui Progress | Progress component is standard, accessible, themable |
| Route handler streaming | Server Action | Route handlers better for streaming but Server Actions consistent with project patterns |

**Installation:**
```bash
npx shadcn@latest add progress
```

## Architecture Patterns

### Recommended Project Structure
```
app/(dashboard)/clients/components/
├── bulk-actions-toolbar.tsx      # Add "Send Email" button
├── send-email-modal.tsx           # New modal component
└── client-table.tsx               # Existing, manages selection state

app/actions/
└── send-adhoc-emails.ts           # New Server Action for sending

lib/email/
├── render-tiptap.ts               # Existing rendering pipeline
└── sender.ts                      # Existing sendRichEmail()
```

### Pattern 1: Multi-Step Modal with State-Driven Views
**What:** Single Dialog component that switches between views based on state (step enum)
**When to use:** Multi-step flows within a modal that don't justify separate pages
**Example:**
```typescript
// Source: https://www.shadcn.io/patterns/button-group-navigation-3
type SendStep = 'select-template' | 'preview' | 'confirm' | 'sending' | 'results';

export function SendEmailModal({ open, onClose, selectedClients }: Props) {
  const [step, setStep] = useState<SendStep>('select-template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });
  const [results, setResults] = useState<SendResults | null>(null);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        {step === 'select-template' && <TemplateSelectView />}
        {step === 'preview' && <PreviewView />}
        {step === 'confirm' && <ConfirmView />}
        {step === 'sending' && <SendingView progress={sendProgress} />}
        {step === 'results' && <ResultsView results={results} />}
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 2: Client-Side Progress with Server Action Loop
**What:** Client component calls Server Action in a loop, updating progress state after each call
**When to use:** Bulk operations where granular progress matters more than speed
**Example:**
```typescript
// Source: https://makerkit.dev/blog/tutorials/nextjs-server-actions
async function handleSend() {
  setStep('sending');
  const results = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < clientsWithEmail.length; i++) {
    const client = clientsWithEmail[i];
    setSendProgress({ sent: i, total: clientsWithEmail.length });

    try {
      await sendToSingleClient({
        clientId: client.id,
        templateId: selectedTemplateId,
      });
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({ clientId: client.id, error: error.message });
    }
  }

  setSendProgress({ sent: clientsWithEmail.length, total: clientsWithEmail.length });
  setResults(results);
  setStep('results');
}
```

### Pattern 3: Email Log Entries for Ad-Hoc Sends
**What:** Insert email_log rows with NULL reminder_queue_id to distinguish ad-hoc from scheduled
**When to use:** Recording ad-hoc sends in the existing delivery log system
**Example:**
```typescript
// Insert email_log entry with no reminder_queue_id
await supabase.from('email_log').insert({
  reminder_queue_id: null,           // NULL = ad-hoc send
  client_id: clientId,
  filing_type_id: null,               // Ad-hoc sends aren't tied to filing types
  postmark_message_id: result.messageId,
  recipient_email: client.primary_email,
  subject: resolvedSubject,
  delivery_status: 'sent',
});
```

### Anti-Patterns to Avoid
- **Single Server Action for entire batch:** Loses granular progress updates and makes partial failure handling complex. Use client-side loop instead.
- **Streaming from Server Actions:** Server Actions don't stream progress updates well. Use state updates in a client component instead.
- **Modifying recipient list in modal:** User decisions from CONTEXT.md specify selection is final. Don't add recipient editing inside the modal.
- **Editing template content inline:** User decisions specify template is used as-is. Don't add inline subject/body editors.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress bar UI | Custom div with width % | shadcn/ui Progress | Accessible (aria-valuenow), themable, animation built-in |
| Toast notifications | Custom positioned divs | sonner (already in project) | Stacking, auto-dismiss, accessible, already configured |
| Bulk send error handling | Try/catch around Promise.all | Individual try/catch in loop | Partial failures handled gracefully, continue on error |
| Template rendering | Custom HTML generation | renderTipTapEmail() pipeline | Already handles TipTap JSON → HTML → variable substitution → React Email |
| Email delivery | Direct Postmark API calls | sendRichEmail() function | Already configured with From/ReplyTo, error handling, logging |

**Key insight:** The existing email rendering and sending pipeline (Phase 6) handles all the complexity. Ad-hoc sending is just "call renderTipTapEmail() + sendRichEmail() for each selected client" with UI for progress feedback.

## Common Pitfalls

### Pitfall 1: Assuming Server Actions Can Stream Progress
**What goes wrong:** Trying to stream progress updates from a Server Action fails or requires complex workarounds
**Why it happens:** Server Actions are designed for mutations, not streaming responses. Streaming works better with Route Handlers.
**How to avoid:** Use client-side loop with state updates instead of trying to stream from the server
**Warning signs:** Researching "Server Actions streaming progress" or "Server Actions SSE"

### Pitfall 2: Not Handling Clients Without Emails
**What goes wrong:** Modal shows "Send to 10 clients" but only 7 have email addresses, leading to confusion
**Why it happens:** Not filtering out clients without email before displaying counts
**How to avoid:** Filter `selectedClients.filter(c => c.primary_email)` before displaying counts and sending. Show warning if some clients are skipped.
**Warning signs:** User feedback like "It said 10 but only sent 7"

### Pitfall 3: Blocking UI During Long Sends
**What goes wrong:** Modal freezes or becomes unresponsive during bulk send
**Why it happens:** Not yielding to the event loop between sends, or using await Promise.all() which blocks
**How to avoid:** Use for-loop with individual awaits, allowing React to re-render between iterations. Consider small delay (50ms) between sends to respect Postmark rate limits.
**Warning signs:** Browser "Page Unresponsive" warnings, progress bar not updating

### Pitfall 4: Race Condition on Modal Close
**What goes wrong:** User closes modal during send, state is reset, errors are lost
**Why it happens:** Not preventing modal close during send, or not preserving results before closing
**How to avoid:** Disable close button and ESC during send step (`showCloseButton={step !== 'sending'}`), show results step before allowing close
**Warning signs:** "I closed it and lost the error messages"

### Pitfall 5: Poor Error Context in Results
**What goes wrong:** Results show "3 failed" but user doesn't know which clients or why
**Why it happens:** Not collecting client names and error messages during send loop
**How to avoid:** Collect detailed failure records: `{ clientName: string, clientId: string, email: string, error: string }[]`
**Warning signs:** User asks "Which ones failed?" after seeing results summary

### Pitfall 6: Postmark Rate Limiting
**What goes wrong:** Sends fail with throttling errors when sending to many clients
**Why it happens:** Postmark recommends 10 concurrent connections max; sending too fast triggers limits
**How to avoid:** Sequential sends (no parallelization) with optional small delay between sends (50-100ms) for very large batches
**Warning signs:** Postmark API errors mentioning rate limits or throttling

## Code Examples

Verified patterns from official sources and existing codebase:

### Template Dropdown (Fetching and Rendering)
```typescript
// Source: Existing app/api/email-templates/route.ts pattern
'use client';

export function TemplateSelectView({ onSelect }: Props) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplates() {
      const res = await fetch('/api/email-templates');
      const data = await res.json();
      setTemplates(data.filter((t: EmailTemplate) => t.is_active));
      setLoading(false);
    }
    fetchTemplates();
  }, []);

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder="Select a template..." />
      </SelectTrigger>
      <SelectContent>
        {templates.map(t => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Preview Email with First Client Data
```typescript
// Source: Existing lib/email/render-tiptap.ts
async function generatePreview(templateId: string, firstClient: Client) {
  const template = await fetchTemplate(templateId);

  const context: TemplateContext = {
    client_name: firstClient.company_name,
    deadline: firstClient.year_end_date ? new Date(firstClient.year_end_date) : new Date(),
    filing_type: '[Filing Type]',
    accountant_name: 'Peninsula Accounting',
  };

  const { html, subject } = await renderTipTapEmail({
    bodyJson: template.body_json,
    subject: template.subject,
    context,
  });

  return { html, subject };
}
```

### Progress Bar During Send
```typescript
// Source: https://ui.shadcn.com/docs/components/radix/progress
import { Progress } from '@/components/ui/progress';

export function SendingView({ progress }: { progress: { sent: number, total: number } }) {
  const percentage = progress.total > 0 ? (progress.sent / progress.total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Sending email {progress.sent} of {progress.total}...
        </p>
      </div>
      <Progress value={percentage} className="w-full" />
      <p className="text-xs text-muted-foreground text-center">
        Please don't close this window
      </p>
    </div>
  );
}
```

### Server Action for Single Send
```typescript
// Source: Existing app/api/cron/send-emails/route.ts pattern
'use server';

import { renderTipTapEmail } from '@/lib/email/render-tiptap';
import { sendRichEmail } from '@/lib/email/sender';
import { createClient } from '@/lib/supabase/server';

export async function sendAdHocEmail(params: {
  clientId: string;
  templateId: string;
}) {
  const supabase = await createClient();

  // Fetch client
  const { data: client } = await supabase
    .from('clients')
    .select('id, company_name, primary_email, year_end_date')
    .eq('id', params.clientId)
    .single();

  if (!client || !client.primary_email) {
    throw new Error('Client not found or has no email address');
  }

  // Fetch template
  const { data: template } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', params.templateId)
    .single();

  if (!template) {
    throw new Error('Template not found');
  }

  // Render email
  const { html, text, subject } = await renderTipTapEmail({
    bodyJson: template.body_json,
    subject: template.subject,
    context: {
      client_name: client.company_name,
      deadline: client.year_end_date ? new Date(client.year_end_date) : new Date(),
      filing_type: '[Ad-Hoc]',
      accountant_name: 'Peninsula Accounting',
    },
  });

  // Send via Postmark
  const result = await sendRichEmail({
    to: client.primary_email,
    subject,
    html,
    text,
  });

  // Log to email_log (NULL reminder_queue_id = ad-hoc)
  await supabase.from('email_log').insert({
    reminder_queue_id: null,        // NULL distinguishes ad-hoc from scheduled
    client_id: client.id,
    filing_type_id: null,
    postmark_message_id: result.messageId,
    recipient_email: client.primary_email,
    subject,
    delivery_status: 'sent',
  });

  return { success: true, messageId: result.messageId };
}
```

### Toast Notification on Completion
```typescript
// Source: Existing app/(dashboard)/templates/new/page.tsx pattern
import { toast } from 'sonner';

function handleComplete(results: SendResults) {
  if (results.failed === 0) {
    toast.success(`Successfully sent ${results.sent} email${results.sent !== 1 ? 's' : ''}`);
  } else {
    toast.error(`Sent ${results.sent}, failed ${results.failed}. Check results for details.`);
  }
  onClose();
}
```

### Delivery Log Badge for Ad-Hoc
```typescript
// Modify delivery-log-table.tsx to show ad-hoc badge
function getEmailTypeBadge(entry: AuditEntry) {
  if (!entry.reminder_queue_id) {
    return <Badge variant="outline">Ad-Hoc</Badge>;
  }
  return null; // Scheduled sends don't need a badge (they're the default)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Promise.all() for bulk sends | Client-side loop with state updates | 2024+ | Granular progress, better error handling |
| Route handlers for mutations | Server Actions | Next.js 13+ (2023) | Simpler code, no manual API routes |
| Custom toast libraries | sonner | 2024+ | Better UX, already in shadcn ecosystem |
| Streaming from Server Actions | Client-side state management | 2026 | Server Actions not designed for streaming |

**Deprecated/outdated:**
- **Server Actions streaming:** Route handlers are the recommended approach for streaming responses. For progress updates in bulk operations, use client-side state instead.
- **useFormStatus for non-form actions:** Intended for form submissions. For programmatic mutations, use local loading state.

## Open Questions

Things that couldn't be fully resolved:

1. **Should ad-hoc sends be retryable from the delivery log?**
   - What we know: Requirements don't mention retry functionality
   - What's unclear: User workflow if an ad-hoc send fails — do they re-select clients manually?
   - Recommendation: Handle during planning. If needed, add retry button in delivery log detail view (future phase).

2. **Should there be a send preview mode (test send to accountant)?**
   - What we know: CONTEXT.md doesn't mention test sends
   - What's unclear: Common pattern for email tools to send test before bulk
   - Recommendation: Not in scope for Phase 8. Could be added to template editor (Phase 5 enhancement).

3. **Rate limiting strategy for large batches (100+ clients)?**
   - What we know: Postmark recommends 10 concurrent connections max; existing cron sends sequentially
   - What's unclear: Should we add delays between sends? Warn user if selecting many clients?
   - Recommendation: Sequential sends with no artificial delay for now. Monitor Postmark errors. Add 50ms delay if throttling occurs in practice.

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `lib/email/render-tiptap.ts` - Email rendering pipeline
  - `lib/email/sender.ts` - sendRichEmail() function
  - `app/api/cron/send-emails/route.ts` - Bulk send pattern
  - `app/(dashboard)/clients/components/bulk-edit-modal.tsx` - Multi-step modal pattern
  - `components/ui/sonner.tsx` - Toast configuration
- Official shadcn/ui documentation:
  - [Dialog](https://ui.shadcn.com/docs/components/radix/dialog) - Modal component API
  - [Progress](https://ui.shadcn.com/docs/components/radix/progress) - Progress bar component
  - [Wizard Steps](https://www.shadcn.io/patterns/button-group-navigation-3) - Multi-step navigation pattern

### Secondary (MEDIUM confidence)
- [Next.js Server Actions: Complete Guide (2026)](https://makerkit.dev/blog/tutorials/nextjs-server-actions) - Server Action error handling patterns
- [Next.js Error Handling Patterns](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nextjs/) - Try/catch best practices
- [Shadcn UI Best Practices for 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44) - Dialog and modal patterns
- [Partial Success for Bulk Operations](https://developers.criteo.com/marketing-solutions/docs/partial-success-for-bulk-operations) - Handling mixed success/failure in bulk ops
- [Postmark SMTP Rate Limits](https://postmarkapp.com/support/article/do-we-have-rate-limits-for-smtp) - 10 concurrent connections recommendation

### Tertiary (LOW confidence)
- [Next.js Streaming with Server Actions](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Streaming limitations (official docs confirm Route Handlers better for streaming)
- React file upload tutorials - General progress tracking patterns (adapted for email sending context)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project or standard shadcn components
- Architecture: HIGH - Patterns verified in existing codebase (bulk edit modal, email sending)
- Pitfalls: HIGH - Based on known Server Action limitations and existing Postmark usage
- Email rendering pipeline: HIGH - Fully implemented in Phase 6, just needs integration

**Research date:** 2026-02-08
**Valid until:** 30 days (stable domain, no fast-moving dependencies)
