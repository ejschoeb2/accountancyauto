# Postmark Inbound Webhook Research

## Overview

Postmark's inbound webhook accepts and parses emails sent to your server's unique inbound email address or forwarding domain, then POSTs the email as JSON to the URL you specify.

## Complete Payload Structure

### Root Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `FromName` | string | Sender's display name |
| `From` | string | Sender's email address (e.g., "sender@example.com") |
| `FromFull` | object | Detailed sender information with Email, Name, MailboxHash |
| `To` | string | Primary recipient(s) |
| `ToFull` | array | Detailed recipient objects |
| `Cc` | string | Carbon copy recipient(s) |
| `CcFull` | array | Detailed CC recipient objects |
| `Bcc` | string | Blind carbon copy recipient(s) |
| `BccFull` | array | Detailed BCC recipient objects |
| `OriginalRecipient` | string | Original destination email address |
| `Subject` | string | Email subject line |
| `MessageID` | string | Unique message identifier |
| `MessageStream` | string | Stream designation (always "inbound" for inbound emails) |
| `ReplyTo` | string | Reply-to address if set |
| `MailboxHash` | string | Plus addressing hash value (e.g., from "user+hash@domain.com") |
| `Date` | string | Message timestamp (format depends on sending mailserver) |
| `TextBody` | string | **Plain text message content** |
| `HtmlBody` | string | **HTML message content** |
| `StrippedTextReply` | string | Extracted reply text only (strips quoted text) |
| `Tag` | string | Custom tag identifier |
| `Headers` | array | Custom and spam headers |
| `Attachments` | array | File attachment objects |

### Nested Object Structures

**FromFull/ToFull/CcFull/BccFull objects:**
```typescript
{
  Email: string;        // Email address
  Name: string;         // Display name
  MailboxHash: string;  // Plus addressing hash
}
```

**Headers array items:**
```typescript
{
  Name: string;   // Header name (e.g., "X-Spam-Status")
  Value: string;  // Header value
}
```

**Attachments array items:**
```typescript
{
  Name: string;          // Filename
  Content: string;       // Base-64 encoded file content
  ContentType: string;   // MIME type (e.g., "application/pdf")
  ContentLength: number; // Size in bytes
}
```

## Key Fields for Client Email Replies

For our use case (tracking client email replies), we need:

1. **`From`** - Client's email address (to match against `clients.email`)
2. **`Subject`** - Email subject (to extract reference numbers or keywords)
3. **`TextBody`** - Plain text content of the email
4. **`HtmlBody`** - HTML content (fallback if TextBody is empty)
5. **`Date`** - When the email was sent
6. **`To`** / **`OriginalRecipient`** - Which inbound address received it
7. **`StrippedTextReply`** - Useful to get just the reply without quoted text

## Authentication & Security

### HTTP Basic Auth (Recommended)
- Postmark supports HTTP Basic authentication for webhook URLs
- Configure by adding credentials to the URL: `https://username:password@example.com/webhook`
- Prevents unauthorized requests to public webhook endpoints

### Important Security Limitation
**Postmark webhooks do NOT include cryptographic signatures (HMAC)** to verify that requests genuinely originated from Postmark. This differs from services like Stripe or GitHub that sign webhook payloads.

Security relies on:
- HTTP Basic Auth
- IP allowlisting (optional)
- HTTPS for transport security

### Best Practices
- Use HTTPS endpoints only
- Implement HTTP Basic Auth on webhook endpoint
- Validate payload structure
- Implement idempotent processing (same webhook could be retried)
- Log all webhook requests for debugging

## Webhook Delivery & Retries

- Postmark expects a **200 response** to confirm receipt
- If 200 is not received, Postmark retries up to **10 times** with growing intervals
- If a **403 response** is received, retries stop immediately
- Datetimes in webhook data use **ISO 8601 format**

## Example Minimal Payload

```json
{
  "From": "client@example.com",
  "FromName": "John Smith",
  "FromFull": {
    "Email": "client@example.com",
    "Name": "John Smith",
    "MailboxHash": ""
  },
  "To": "replies@peninsulaaccounting.com",
  "Subject": "Re: Corporation Tax Return Due",
  "MessageID": "abc123",
  "MessageStream": "inbound",
  "Date": "2026-02-16T10:30:00Z",
  "TextBody": "Yes, I've sent the documents via post.",
  "HtmlBody": "<p>Yes, I've sent the documents via post.</p>",
  "StrippedTextReply": "Yes, I've sent the documents via post.",
  "Headers": [],
  "Attachments": []
}
```

## Implementation Notes for /api/postmark/inbound

1. **Verify request method** - Only accept POST requests
2. **Validate payload structure** - Ensure required fields exist
3. **Extract sender email** - Use `From` field
4. **Look up client** - Query Supabase `clients` table by email
5. **Extract message content** - Prefer `TextBody`, fallback to `HtmlBody` or `StrippedTextReply`
6. **Store webhook data** - Save to `inbound_emails` table
7. **Auto-update client status** - If client has "Reminder Sent" records, update to "Records Received"
8. **Return 200** - Always return 200 OK to acknowledge receipt

## TypeScript Interface for Webhook Payload

```typescript
interface PostmarkInboundWebhook {
  FromName: string;
  From: string;
  FromFull: {
    Email: string;
    Name: string;
    MailboxHash: string;
  };
  To: string;
  ToFull: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Cc?: string;
  CcFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Bcc?: string;
  BccFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  OriginalRecipient: string;
  Subject: string;
  MessageID: string;
  MessageStream: string;
  ReplyTo?: string;
  MailboxHash?: string;
  Date: string;
  TextBody: string;
  HtmlBody: string;
  StrippedTextReply?: string;
  Tag?: string;
  Headers: Array<{
    Name: string;
    Value: string;
  }>;
  Attachments: Array<{
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
  }>;
}
```

## Sources

- [Inbound webhook | Postmark Developer Documentation](https://postmarkapp.com/developer/webhooks/inbound-webhook)
- [Webhooks overview | Postmark Developer Documentation](https://postmarkapp.com/developer/webhooks/webhooks-overview)
- [Guide to Postmark Webhooks: Features and Best Practices](https://hookdeck.com/webhooks/platforms/guide-to-postmark-webhooks-features-and-best-practices)
