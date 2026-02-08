# Phase 6: Email Rendering Pipeline - Research

**Researched:** 2026-02-08
**Domain:** TipTap JSON to email-safe HTML rendering for Gmail, Outlook, and Apple Mail
**Confidence:** HIGH

## Summary

Phase 6 focuses on the rendering pipeline that converts TipTap JSON content (produced by the editor in Phase 5) into email-safe HTML that renders correctly in Gmail, Outlook, and Apple Mail. Preview UI functionality has been removed from scope per user decision.

The standard approach uses `@tiptap/html` for server-side JSON-to-HTML conversion combined with the existing React Email infrastructure for inline style generation. The pipeline replaces placeholder variables (`{{client_name}}`, etc.) at render time with actual client data, ensuring emails display with proper formatting across all major email clients.

**Primary recommendation:** Use `@tiptap/html`'s `generateHTML()` function server-side to convert TipTap JSON to raw HTML, perform string-based placeholder replacement using the existing `substituteVariables()` function, then inject the result into the existing React Email template wrapper. React Email's `render()` function automatically inlines all CSS styles for email client compatibility.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Placeholder replacement timing**: At render time — convert TipTap JSON to HTML with placeholders already filled with client data
- **Missing data fallback**: Show fallback text (e.g., "[Name]", "your records") if placeholder data is missing
- **Link behavior**: All links open in new tab (target="_blank")
- **Style inlining**: Inline everything — convert all styles to inline style attributes for maximum email client compatibility

### Claude's Discretion
- Specific fallback text wording for each placeholder type
- HTML structure and email template wrapper
- Testing strategy for Gmail/Outlook/Apple Mail compatibility
- Error handling for malformed TipTap JSON
- Character encoding and special character handling

### Deferred Ideas (OUT OF SCOPE)
- **Preview UI functionality** — Originally part of Phase 6, now removed from scope (editor is sufficient)
- **A/B testing** — Not in current milestone scope
- **Send-time optimization** — Not in current milestone scope
</user_constraints>

## Standard Stack

The rendering pipeline uses existing dependencies with no additional packages required.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/html | 3.15.3+ | Server-side JSON-to-HTML conversion | Official TipTap utility designed for server/email rendering without DOM dependencies |
| @react-email/render | 2.0.4 | HTML string generation with inline styles | Industry standard for React-based email templates, handles CSS inlining automatically |
| @react-email/components | 1.0.7 | Email-safe React components | Provides table-based layouts tested across Gmail, Outlook, Apple Mail |

**Note:** `@tiptap/html` was already installed in Phase 5 as part of the TipTap stack.

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Date formatting for placeholders | Already used in `lib/templates/variables.ts` for deadline formatting |
| Postmark SDK | 4.0.5 | Email delivery | Already integrated in `lib/email/sender.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tiptap/html | @tiptap/static-renderer | Static renderer is for SSR/RSC page rendering, not email HTML. HTML utility is purpose-built for server-side string output. |
| React Email inline styles | juice library | React Email already inlines CSS via `render()`. Adding juice would be redundant and increase bundle size. |
| String-based replacement | Handlebars/Mustache | Current `substituteVariables()` function works. No need to add templating library dependency. |

**Installation:**
No new packages required. All dependencies already installed.

## Architecture Patterns

### Recommended Rendering Pipeline
```
TipTap JSON (from database)
        ↓
@tiptap/html generateHTML() with extensions list
        ↓
Raw HTML string with {{placeholder}} tokens
        ↓
substituteVariables() replaces {{tokens}} with client data
        ↓
Resolved HTML string
        ↓
Inject into React Email <ReminderEmail> component body
        ↓
@react-email/render() converts to email-safe HTML with inline styles
        ↓
Postmark sendEmail() delivers HTML
```

### Pattern 1: Server-Side JSON-to-HTML Conversion
**What:** Use `generateHTML()` from `@tiptap/html` to convert stored TipTap JSON into HTML string without a browser DOM.

**When to use:** At email send time, in server-side API routes or cron jobs.

**Example:**
```typescript
// Source: https://tiptap.dev/docs/editor/api/utilities/html
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';

// JSON from database email_templates.body_json column
const bodyJson = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Dear ' },
        { type: 'mention', attrs: { id: 'client_name' } },
        { type: 'text', text: ', your ' },
        { type: 'mention', attrs: { id: 'filing_type' } },
        { type: 'text', text: ' is due on ' },
        { type: 'mention', attrs: { id: 'deadline' } }
      ]
    }
  ]
};

// Same extensions list used by editor (Phase 5)
const extensions = [
  StarterKit,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      target: '_blank',
      rel: 'noopener noreferrer'
    }
  }),
  Mention.configure({
    HTMLAttributes: { class: 'mention' },
    renderHTML({ node }) {
      return ['span', {}, `{{${node.attrs.id}}}`];
    }
  })
];

// Convert to HTML string
const rawHtml = generateHTML(bodyJson, extensions);
// Output: "<p>Dear {{client_name}}, your {{filing_type}} is due on {{deadline}}</p>"
```

**Critical:** The extensions list passed to `generateHTML()` MUST match the editor's extensions list (from Phase 5) to ensure consistent rendering.

### Pattern 2: Placeholder Replacement at Render Time
**What:** Replace `{{placeholder}}` tokens with actual client data using the existing `substituteVariables()` function.

**When to use:** After `generateHTML()` converts JSON to HTML, before passing to React Email.

**Example:**
```typescript
// Source: lib/templates/variables.ts (existing codebase)
import { substituteVariables } from '@/lib/templates/variables';

const rawHtml = "<p>Dear {{client_name}}, your {{filing_type}} is due {{deadline}}</p>";

const resolvedHtml = substituteVariables(rawHtml, {
  client_name: 'ABC Ltd',
  deadline: new Date(2026, 0, 31),
  filing_type: 'Corporation Tax Payment',
  accountant_name: 'Peninsula Accounting'
});
// Output: "<p>Dear ABC Ltd, your Corporation Tax Payment is due 31 January 2026</p>"
```

**Fallback handling:**
The existing `substituteVariables()` function preserves unknown placeholders. For missing data fallbacks per user decision:

```typescript
// Enhanced version for missing data
function substituteVariablesWithFallbacks(
  html: string,
  context: Partial<TemplateContext>
): string {
  const safeContext: TemplateContext = {
    client_name: context.client_name || '[Client Name]',
    deadline: context.deadline || new Date(),
    filing_type: context.filing_type || '[Filing Type]',
    accountant_name: context.accountant_name || 'Peninsula Accounting'
  };
  return substituteVariables(html, safeContext);
}
```

**Recommended fallback text:**
- `{{client_name}}` → `[Client Name]`
- `{{deadline}}` / `{{deadline_short}}` → `[Deadline Date]`
- `{{filing_type}}` → `[Filing Type]`
- `{{days_until_deadline}}` → `[X days]`
- `{{accountant_name}}` → `Peninsula Accounting` (always has default)

### Pattern 3: React Email Wrapper Integration
**What:** Inject the resolved HTML into the existing `ReminderEmail` React component, replacing the plain text `body` prop with HTML content.

**When to use:** After placeholder replacement, before calling `render()`.

**Example:**
```typescript
// Source: lib/email/templates/reminder.tsx (existing codebase) + modifications
import { Html, Head, Body, Container, Section, Text } from '@react-email/components';

interface ReminderEmailProps {
  clientName: string;
  subject: string;
  bodyHtml: string; // Changed from 'body: string' to 'bodyHtml: string'
  filingType: string;
}

export default function ReminderEmail({ clientName, subject, bodyHtml, filingType }: ReminderEmailProps) {
  return (
    <Html>
      <Head>
        <meta charSet="UTF-8" />
      </Head>
      <Body style={{ backgroundColor: '#f4f4f4', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' }}>
          <Section style={{ backgroundColor: '#333333', padding: '20px', textAlign: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
              Peninsula Accounting
            </Text>
          </Section>

          <Section style={{ padding: '30px' }}>
            {/* Inject resolved HTML content */}
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          <Section style={{ backgroundColor: '#f4f4f4', padding: '20px' }}>
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

**CSS Inlining:**
React Email's `render()` function automatically inlines all CSS. No manual inlining required.

```typescript
// Source: https://react.email/docs/utilities/render
import { render } from '@react-email/render';

const emailHtml = await render(<ReminderEmail {...props} />);
// render() automatically converts all style={{}} props to inline style="" attributes
```

### Pattern 4: Link Security (Target Blank)
**What:** Configure all links to open in new tab with security attributes per user decision.

**When to use:** In TipTap Link extension configuration (Phase 5 editor setup).

**Example:**
```typescript
// Source: https://tiptap.dev/docs/editor/extensions/marks/link
import Link from '@tiptap/extension-link';

const extensions = [
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      target: '_blank',
      rel: 'noopener noreferrer' // Security: prevent window.opener access
    }
  })
];
```

**Security rationale:**
Per [best practices](https://hashrocket.com/blog/posts/using-target-_blank-properly), `rel="noopener noreferrer"` prevents the opened page from accessing `window.opener`, which could otherwise be exploited for phishing or data theft.

### Anti-Patterns to Avoid

- **Don't use `@tiptap/core`'s `generateHTML`:** It requires a browser DOM. Use `@tiptap/html` instead for server-side rendering.

- **Don't manually inline CSS with juice:** React Email's `render()` already does this automatically. Adding juice creates redundant processing and dependency bloat.

- **Don't use `<div>` for email layout:** Email clients (especially Outlook) render divs inconsistently. React Email uses table-based layouts, which are universally supported.

- **Don't rely on external stylesheets:** Gmail strips `<link>` tags. All styles must be inline (React Email handles this).

- **Don't skip UTF-8 charset declaration:** Include `<meta charSet="UTF-8" />` in email `<Head>` to ensure special characters render correctly. Per [email encoding best practices](https://www.emailonacid.com/blog/article/email-development/the-importance-of-content-type-character-encoding-in-html-emails/), UTF-8 supports all languages, emojis, and symbols.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS inlining for emails | Custom inline style converter | React Email's `render()` | React Email already converts all `style={{}}` props to inline `style=""` attributes automatically. Manual inlining misses edge cases (pseudo-classes, media queries). |
| Email client compatibility | Custom HTML sanitizer | React Email components | React Email components (`<Section>`, `<Container>`, etc.) use table-based layouts tested across Gmail, Outlook, Apple Mail. Custom divs break in Outlook. |
| Server-side HTML from TipTap JSON | Manual ProseMirror traversal | `@tiptap/html` generateHTML | The HTML utility handles node traversal, extension rendering, and edge cases (nested nodes, marks, etc.). Manual traversal is 200+ lines of fragile code. |
| Link security attributes | Manual attribute injection | Link extension config | TipTap Link extension accepts `HTMLAttributes` config. Manually adding attributes to HTML output misses links created later. |
| Placeholder variable replacement | Template string interpolation | Existing `substituteVariables()` | The function handles regex edge cases (preserving unknown vars, escaping, etc.). String interpolation breaks on missing data. |

**Key insight:** Email HTML rendering has decades of client-specific quirks (Outlook's Word rendering engine, Gmail's `<style>` byte limits, Apple Mail's aggressive CSS parsing). React Email codifies these workarounds. Building custom solutions reintroduces bugs the community already solved.

## Common Pitfalls

### Pitfall 1: Extensions List Mismatch Between Editor and Renderer
**What goes wrong:** `generateHTML()` throws errors or produces incorrect HTML if the extensions list doesn't match the editor's extensions from Phase 5.

**Why it happens:** TipTap's JSON format includes node/mark types (e.g., `{ type: 'mention' }`). If `generateHTML()` receives JSON with a `mention` node but the extensions list doesn't include the Mention extension, it fails to render that node.

**How to avoid:**
- Extract extensions configuration into a shared module (e.g., `lib/tiptap/extensions.ts`) used by both the editor (Phase 5) and the renderer (Phase 6).
- Pass the exact same extension instances to both `useEditor({ extensions })` and `generateHTML(json, extensions)`.

**Warning signs:**
- Console errors: `"Unknown node type: mention"`
- Missing content in rendered emails (nodes silently dropped)
- Unit tests fail when comparing `editor.getHTML()` output with `generateHTML()` output

### Pitfall 2: Forgetting `rel="noopener noreferrer"` on `target="_blank"` Links
**What goes wrong:** Email links become security vulnerabilities. Opened pages can access the originating email client window via `window.opener` and redirect users to phishing sites.

**Why it happens:** Per [security research](https://dev.to/thehassantahir/targetblank-is-a-security-risk-1ee4), `target="_blank"` without `rel="noopener noreferrer"` leaves `window.opener` accessible to the new window, enabling tab-nabbing attacks.

**How to avoid:**
- Configure Link extension with `HTMLAttributes: { rel: 'noopener noreferrer' }` in Phase 5.
- Verify via unit test that rendered HTML contains both attributes.

**Warning signs:**
- Security audits flag `target="_blank"` without `rel`
- Links render as `<a target="_blank">` without `rel` attribute in test emails

### Pitfall 3: Email HTML Exceeds 102KB (Gmail Clipping)
**What goes wrong:** Gmail truncates emails larger than 102KB, hiding content below the clipping line (including unsubscribe links, which can trigger spam complaints).

**Why it happens:** Gmail applies a [102KB limit](https://thehtmlemailtoolkit.com/how-to-avoid-common-pitfalls-in-html-email-development/) to prevent inbox bloat. Emails with large HTML content get clipped with a "[Message clipped] View entire message" link.

**How to avoid:**
- Keep email HTML under 100KB (leave 2KB buffer).
- Avoid inline base64 images (use hosted images with `<img src="https://...">` instead).
- Use React Email's `render({ pretty: false })` option to strip whitespace in production.
- Monitor email size in tests: `expect(emailHtml.length).toBeLessThan(100_000)`.

**Warning signs:**
- Gmail shows "[Message clipped]" link when viewing test emails
- Email size grows over time as templates get richer content

### Pitfall 4: Incorrect UTF-8 Charset Causing Broken Special Characters
**What goes wrong:** Special characters (£, €, em dashes, curly quotes) render as � or question marks in emails.

**Why it happens:** Per [email encoding documentation](https://www.emailonacid.com/blog/article/email-development/the-importance-of-content-type-character-encoding-in-html-emails/), email clients ignore `<meta charset>` tags in the HTML body and rely on the `Content-Type` header from the email server. If Postmark doesn't set `Content-Type: text/html; charset=UTF-8`, clients default to ASCII or ISO-8859-1.

**How to avoid:**
- Include `<meta charSet="UTF-8" />` in React Email `<Head>` (defensive coding).
- Verify Postmark sets `Content-Type: text/html; charset=UTF-8` header (check Postmark SDK defaults).
- Use HTML entities for special characters if UTF-8 support is uncertain: `&pound;` instead of `£`.

**Warning signs:**
- Test emails show � characters where £ or € symbols should appear
- Non-English client names render incorrectly

### Pitfall 5: Malformed TipTap JSON Causing Render Failures
**What goes wrong:** `generateHTML()` throws errors or returns empty HTML when database contains invalid JSON (e.g., `{"text": null}` nodes, mismatched schema).

**Why it happens:** Per [TipTap validation documentation](https://tiptap.dev/docs/guides/invalid-schema), TipTap's schema validation can emit `contentError` events when JSON violates the ProseMirror schema (e.g., a text node with `null` text value).

**How to avoid:**
- Enable TipTap's `enableContentCheck: true` in Phase 5 editor to catch invalid content at save time.
- Add server-side JSON validation before rendering:
  ```typescript
  function validateTipTapJson(json: unknown): boolean {
    if (!json || typeof json !== 'object') return false;
    if (!('type' in json) || json.type !== 'doc') return false;
    if (!('content' in json) || !Array.isArray(json.content)) return false;
    return true;
  }
  ```
- Wrap `generateHTML()` in try-catch and log errors for debugging:
  ```typescript
  try {
    const html = generateHTML(bodyJson, extensions);
  } catch (error) {
    console.error('TipTap JSON render failed:', error, bodyJson);
    throw new Error('Invalid email template content');
  }
  ```

**Warning signs:**
- Emails fail to send with vague "render failed" errors
- `generateHTML()` returns empty string or throws exception
- Console logs show JSON with `"text": null` or missing required fields

### Pitfall 6: Outlook Rendering Inline Styles Incorrectly
**What goes wrong:** Outlook (2007-2021) uses Microsoft Word's HTML rendering engine, which ignores many CSS properties (max-width, padding on `<div>`, background images).

**Why it happens:** Per [Outlook HTML email documentation](https://www.emailonacid.com/blog/article/email-development/how-to-code-emails-for-outlook/), Outlook's rendering engine is fundamentally different from browsers. It doesn't support modern CSS.

**How to avoid:**
- Use React Email components (`<Section>`, `<Container>`) which handle Outlook quirks via MSO conditional comments and table-based layouts.
- Test emails in Outlook 2016/2019 (worst offenders) using Litmus or Email on Acid.
- Avoid complex CSS (flexbox, grid, transform). Stick to basic inline styles (color, font-size, font-weight, text-align).

**Warning signs:**
- Emails look perfect in Gmail/Apple Mail but broken in Outlook
- Padding/margins don't render in Outlook
- Background colors missing in Outlook

## Code Examples

Verified patterns from official sources and existing codebase:

### Complete Rendering Pipeline
```typescript
// Source: Integration of TipTap docs + existing codebase patterns
import { generateHTML } from '@tiptap/html';
import { render } from '@react-email/render';
import { substituteVariables } from '@/lib/templates/variables';
import ReminderEmail from '@/lib/email/templates/reminder';
import { extensions } from '@/lib/tiptap/extensions'; // Shared with Phase 5 editor

interface RenderEmailParams {
  bodyJson: object; // TipTap JSON from email_templates.body_json
  clientName: string;
  deadline: Date;
  filingType: string;
  subject: string;
}

async function renderEmailHtml(params: RenderEmailParams): Promise<string> {
  // Step 1: Convert TipTap JSON to raw HTML with {{placeholder}} tokens
  const rawHtml = generateHTML(params.bodyJson, extensions);

  // Step 2: Replace placeholders with actual client data
  const resolvedHtml = substituteVariables(rawHtml, {
    client_name: params.clientName,
    deadline: params.deadline,
    filing_type: params.filingType,
    accountant_name: 'Peninsula Accounting'
  });

  // Step 3: Inject into React Email template wrapper
  const emailComponent = (
    <ReminderEmail
      clientName={params.clientName}
      subject={params.subject}
      bodyHtml={resolvedHtml}
      filingType={params.filingType}
    />
  );

  // Step 4: Render to email-safe HTML with inline styles
  const emailHtml = await render(emailComponent, {
    pretty: false // Minimize size to avoid Gmail 102KB clipping
  });

  return emailHtml;
}
```

### TipTap Mention Extension Configuration for Placeholder Rendering
```typescript
// Source: https://tiptap.dev/docs/editor/extensions/nodes/mention
import Mention from '@tiptap/extension-mention';

const MentionPlaceholder = Mention.configure({
  HTMLAttributes: {
    class: 'mention-placeholder'
  },
  renderHTML({ node }) {
    // Render mention nodes as {{variable_name}} in HTML output
    // This allows substituteVariables() to replace them with actual data
    return ['span', { class: 'mention-placeholder' }, `{{${node.attrs.id}}}`];
  },
  renderText({ node }) {
    // Plain text rendering (for email text fallback)
    return `{{${node.attrs.id}}}`;
  }
});

export { MentionPlaceholder };
```

### Enhanced substituteVariables with Fallbacks
```typescript
// Source: Adaptation of lib/templates/variables.ts with user-specified fallbacks
import { format } from 'date-fns';
import { TemplateContext } from '@/lib/templates/variables';

function substituteVariablesWithFallbacks(
  html: string,
  context: Partial<TemplateContext>
): string {
  const variables: Record<string, string> = {
    client_name: context.client_name || '[Client Name]',
    deadline: context.deadline ? format(context.deadline, 'dd MMMM yyyy') : '[Deadline Date]',
    deadline_short: context.deadline ? format(context.deadline, 'dd/MM/yyyy') : '[DD/MM/YYYY]',
    filing_type: context.filing_type || '[Filing Type]',
    days_until_deadline: context.deadline
      ? Math.max(0, Math.floor((context.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))).toString()
      : '[X days]',
    accountant_name: context.accountant_name || 'Peninsula Accounting'
  };

  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
}
```

### Error Handling for Malformed TipTap JSON
```typescript
// Source: https://tiptap.dev/docs/guides/invalid-schema + defensive coding
import { generateHTML } from '@tiptap/html';

function safeGenerateHTML(json: unknown, extensions: any[]): string {
  // Basic validation
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid TipTap JSON: not an object');
  }

  if (!('type' in json) || json.type !== 'doc') {
    throw new Error('Invalid TipTap JSON: root must be type "doc"');
  }

  if (!('content' in json) || !Array.isArray(json.content)) {
    throw new Error('Invalid TipTap JSON: doc must have content array');
  }

  try {
    return generateHTML(json, extensions);
  } catch (error) {
    console.error('generateHTML failed:', error);
    console.error('JSON:', JSON.stringify(json, null, 2));
    throw new Error(`Email template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

### React Email Template with UTF-8 Charset
```typescript
// Source: https://react.email/docs/components/html + encoding best practices
import { Html, Head, Body, Container, Section, Text } from '@react-email/components';

export default function ReminderEmail({ bodyHtml, subject, clientName, filingType }) {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </Head>
      <Body style={{
        backgroundColor: '#f4f4f4',
        fontFamily: 'Arial, sans-serif, Helvetica',
        margin: 0,
        padding: 0,
        WebkitTextSizeAdjust: '100%',
        MsTextSizeAdjust: '100%'
      }}>
        <Container style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: '#ffffff'
        }}>
          {/* Header */}
          <Section style={{
            backgroundColor: '#333333',
            padding: '20px',
            textAlign: 'center'
          }}>
            <Text style={{
              color: '#ffffff',
              fontSize: '24px',
              fontWeight: 'bold',
              margin: 0
            }}>
              Peninsula Accounting
            </Text>
          </Section>

          {/* Body content from TipTap */}
          <Section style={{ padding: '30px' }}>
            <div
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
              style={{
                color: '#333333',
                fontSize: '14px',
                lineHeight: '1.6'
              }}
            />
          </Section>

          {/* Footer */}
          <Section style={{
            backgroundColor: '#f4f4f4',
            padding: '20px',
            borderTop: '1px solid #dddddd'
          }}>
            <Text style={{
              color: '#999999',
              fontSize: '12px',
              textAlign: 'center',
              margin: 0
            }}>
              This is an automated reminder from Peninsula Accounting
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CSS inlining with juice | React Email auto-inlining | React Email v1.0 (2022+) | No need for juice dependency. `render()` handles inlining automatically. |
| Div-based email layouts | Table-based layouts via React Email components | Industry shift 2015+ | Tables universally supported by email clients. Divs break in Outlook. |
| Plain text email bodies | Rich text HTML with TipTap + React Email | This project (Phase 5-6) | Users can format emails with bold, links, lists instead of plain text. |
| Client-side template rendering | Server-side rendering with @tiptap/html | TipTap v3 (2024+) | No DOM dependency. Can render emails in cron jobs and API routes. |
| External stylesheets in emails | Inline styles only | Gmail enforcement 2016+ | Gmail strips `<link>` tags and limits `<style>` tag bytes. Inline styles are the only reliable option. |

**Deprecated/outdated:**
- **juice library for CSS inlining:** React Email's `render()` function makes this redundant.
- **@tiptap/static-renderer for email HTML:** Designed for SSR page rendering, not email. Use `@tiptap/html` instead.
- **HTML 4.01 table syntax:** Still used for email compatibility, but React Email components abstract this away. Don't hand-code `<table cellspacing="0" cellpadding="0">`.

## Open Questions

Things that couldn't be fully resolved:

1. **Postmark Content-Type Header Defaults**
   - What we know: Postmark SDK sends emails via `sendEmail()` method. UTF-8 encoding is critical for special characters.
   - What's unclear: Does Postmark SDK automatically set `Content-Type: text/html; charset=UTF-8` header, or must it be explicitly configured?
   - Recommendation: Test emails with £ symbols in staging. If they render as �, add explicit charset configuration to Postmark client. Consult Postmark SDK documentation for `Headers` parameter.

2. **Email Client Testing Coverage**
   - What we know: Gmail, Outlook, and Apple Mail are the required targets per success criteria.
   - What's unclear: Which specific Outlook versions (2007/2010/2016/2019/365)? Which Gmail clients (web/iOS/Android)? Which Apple Mail versions (macOS/iOS)?
   - Recommendation: Test in Outlook 2016 (worst rendering engine), Gmail web, Apple Mail macOS as minimum viable coverage. Use Litmus or Email on Acid for comprehensive testing if budget allows.

3. **TipTap JSON Schema Evolution**
   - What we know: Emails stored as TipTap JSON in database may need to render months/years later. Schema changes in TipTap updates could break old JSON.
   - What's unclear: How to handle schema migration if TipTap extensions change in future versions?
   - Recommendation: Pin `@tiptap/*` package versions together (use exact versions, not `^` ranges). Test old emails after any TipTap upgrade before deploying.

## Testing Strategy (Claude's Discretion)

### Email Client Compatibility Testing
1. **Manual testing in real clients:**
   - Gmail web (Chrome/Firefox)
   - Outlook 2016 (Microsoft 365 desktop app)
   - Apple Mail macOS (latest version)
   - Gmail mobile (iOS/Android) - bonus coverage

2. **Automated rendering tests:**
   - Use Litmus or Email on Acid for cross-client screenshots (if budget allows)
   - Alternative: Email rendering sandboxes like Testi@ or Mailtrap

3. **Key test cases:**
   - Bold/italic/underline text renders correctly
   - Links open in new tab with correct `rel` attributes
   - Placeholders replaced with actual data (no `{{tokens}}` visible)
   - Special characters (£, €, em dashes) render correctly
   - Email stays under 100KB to avoid Gmail clipping
   - Layout doesn't break in Outlook (tables render correctly)

### TipTap JSON Validation Testing
1. **Valid JSON rendering:**
   - Create templates with various formatting (bold, links, lists, mentions)
   - Verify `generateHTML()` produces correct HTML
   - Compare `editor.getHTML()` output (Phase 5) with `generateHTML()` output (Phase 6) for consistency

2. **Invalid JSON handling:**
   - Test with malformed JSON (missing `type`, null `text`, invalid schema)
   - Verify errors are caught and logged, not silently ignored
   - Ensure fallback behavior prevents email send failures

3. **Edge cases:**
   - Empty content (`{ type: 'doc', content: [] }`)
   - Only placeholders (no static text)
   - Very long content (test 100KB limit)
   - All placeholders missing from context (fallback text appears)

## Sources

### Primary (HIGH confidence)
- [TipTap HTML Utility Documentation](https://tiptap.dev/docs/editor/api/utilities/html) - `generateHTML()` API
- [TipTap JSON/HTML Export Guide](https://tiptap.dev/docs/guides/output-json-html) - Server-side rendering patterns
- [TipTap Mention Extension](https://tiptap.dev/docs/editor/extensions/nodes/mention) - Custom renderHTML configuration
- [TipTap Invalid Schema Handling](https://tiptap.dev/docs/guides/invalid-schema) - contentError events and validation
- [React Email Render Utility](https://react.email/docs/utilities/render) - Inline CSS conversion
- [React Email Components](https://react.email/docs/components/html) - Email-safe components
- [@tiptap/html npm package](https://www.npmjs.com/@tiptap/html) - Version 3.15.3 documentation

### Secondary (MEDIUM confidence)
- [HTML Email Best Practices - WooCommerce](https://developer.woocommerce.com/docs/features/email/email-html-best-practices/) - Layout, CSS, client compatibility
- [Email Rendering Tips - Mailgun](https://www.mailgun.com/blog/email/simplifying-the-complex-concept-of-email-rendering/) - Cross-client rendering guidance
- [Designing High-Performance Email Layouts 2026 - Medium](https://medium.com/@romualdo.bugai/designing-high-performance-email-layouts-in-2026-a-practical-guide-from-the-trenches-a3e7e4535692) - Current best practices
- [Outlook HTML Email Issues - Email on Acid](https://www.emailonacid.com/blog/article/email-development/how-to-code-emails-for-outlook/) - Outlook-specific rendering quirks
- [Email Encoding Best Practices - Email on Acid](https://www.emailonacid.com/blog/article/email-development/the-importance-of-content-type-character-encoding-in-html-emails/) - UTF-8 charset configuration
- [Target Blank Security - Hashrocket](https://hashrocket.com/blog/posts/using-target-_blank-properly) - noopener noreferrer requirement
- [HTML and CSS in Emails 2026 - Designmodo](https://designmodo.com/html-css-emails/) - Current CSS support matrix
- [Nested Table Layouts - Tabular Email](https://tabular.email/blog/nested-table-layouts-html-email) - Table structure patterns
- [Common Email Coding Mistakes - HTML Email Toolkit](https://thehtmlemailtoolkit.com/how-to-avoid-common-pitfalls-in-html-email-development/) - Pitfall catalog

### Tertiary (LOW confidence - WebSearch only)
- [TipTap JSON Validation Gist](https://gist.github.com/the94air/1ba7afafa3f7bb95b2ab77cd7aaddd68) - Community validation example (not official)
- [React Email Builder Comparison - Unlayer](https://unlayer.com/blog/react-email-builder-libraries-review) - Marketing comparison (not technical)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages already installed, official documentation verified
- Architecture: HIGH - Patterns based on official TipTap and React Email docs plus existing codebase
- Pitfalls: HIGH - Sourced from official documentation and reputable email development resources
- Testing strategy: MEDIUM - Based on industry best practices, but client-specific requirements need validation

**Research date:** 2026-02-08
**Valid until:** 60 days (stable domain - email client rendering changes slowly, TipTap 3.x is stable)
