# Postmark Inbound Email Setup Guide

This guide walks through configuring Postmark to receive inbound emails from clients and forward them to your application via webhook.

## Prerequisites

- A Postmark account with an active server
- A domain you control (for receiving emails)
- Access to your domain's DNS settings
- Your application deployed and accessible via HTTPS

## Step 1: Set Up an Inbound Domain in Postmark

### 1.1 Navigate to Inbound Settings

1. Log in to your Postmark account
2. Select your server
3. Go to **Inbound** in the sidebar
4. Click **Add Inbound Domain**

### 1.2 Add Your Domain

1. Enter your domain (e.g., `peninsulaaccounting.com`)
2. Postmark will provide MX records you need to add to your DNS

### 1.3 Configure DNS Records

Add the following MX records to your domain's DNS settings:

```
Priority: 10
Hostname: inbound.postmarkapp.com
```

**Note:** DNS propagation can take up to 48 hours, but often completes within a few hours.

### 1.4 Verify Domain

1. Return to Postmark after DNS propagation
2. Click **Verify DNS** on your inbound domain
3. Wait for confirmation that MX records are detected

## Step 2: Configure the Webhook URL

### 2.1 Set Up Basic Authentication

Before configuring the webhook, set up authentication credentials:

1. Generate a strong random password for webhook authentication:
   ```bash
   openssl rand -base64 32
   ```

2. Add credentials to your `.env.local` file:
   ```env
   POSTMARK_WEBHOOK_USERNAME=postmark_inbound
   POSTMARK_WEBHOOK_PASSWORD=your_generated_password_here
   ```

3. **Important:** Never commit these credentials to version control. Ensure `.env.local` is in `.gitignore`.

### 2.2 Configure Webhook in Postmark

1. In Postmark, go to **Inbound** → **Webhooks**
2. Click **Add Webhook**
3. Enter your webhook URL with HTTP Basic Auth:
   ```
   https://postmark_inbound:your_generated_password_here@yourdomain.com/api/postmark/inbound
   ```

   For production:
   ```
   https://postmark_inbound:your_generated_password_here@peninsulaaccounting.com/api/postmark/inbound
   ```

4. Select **Inbound** as the webhook type
5. Click **Save Webhook**

### 2.3 Security Notes

- **HTTPS Only:** Postmark requires HTTPS for webhook URLs
- **No HMAC Signatures:** Unlike other webhook providers, Postmark doesn't cryptographically sign webhook payloads. Security relies on:
  - HTTP Basic Authentication
  - HTTPS transport encryption
  - Optional IP allowlisting
- **Idempotency:** Design your webhook handler to be idempotent (same payload can be processed multiple times safely)

## Step 3: Environment Variables

Add all required environment variables to your `.env.local` file:

```env
# Postmark Configuration
POSTMARK_SERVER_TOKEN=your-postmark-server-token
POSTMARK_WEBHOOK_USERNAME=postmark_inbound
POSTMARK_WEBHOOK_PASSWORD=your_generated_password_here

# Supabase Configuration (if not already present)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Environment Variable Reference

| Variable | Purpose | Where to Find |
|----------|---------|---------------|
| `POSTMARK_SERVER_TOKEN` | For sending emails via Postmark API | Postmark → Servers → API Tokens |
| `POSTMARK_WEBHOOK_USERNAME` | HTTP Basic Auth username | You generate this |
| `POSTMARK_WEBHOOK_PASSWORD` | HTTP Basic Auth password | You generate this |

## Step 4: Test the Webhook

### 4.1 Manual Test via Email

1. Send an email to any address at your configured domain:
   ```
   To: test@peninsulaaccounting.com
   Subject: Test inbound email
   Body: This is a test message
   ```

2. Check your application logs for webhook receipt
3. Verify the email appears in your `inbound_emails` table:
   ```sql
   SELECT * FROM inbound_emails ORDER BY received_at DESC LIMIT 5;
   ```

### 4.2 Test with cURL

You can simulate a webhook POST request locally for development:

```bash
curl -X POST http://localhost:3000/api/postmark/inbound \
  -H "Content-Type: application/json" \
  -u "postmark_inbound:your_password_here" \
  -d '{
    "From": "client@example.com",
    "FromName": "Test Client",
    "FromFull": {
      "Email": "client@example.com",
      "Name": "Test Client",
      "MailboxHash": ""
    },
    "To": "test@peninsulaaccounting.com",
    "Subject": "Test Email",
    "MessageID": "test-message-123",
    "MessageStream": "inbound",
    "Date": "2026-02-16T10:00:00Z",
    "TextBody": "This is a test email body",
    "HtmlBody": "<p>This is a test email body</p>",
    "Headers": [],
    "Attachments": []
  }'
```

Expected response: `200 OK` with JSON `{"success": true}`

### 4.3 Verify Client Status Updates

If a client with "Reminder Sent" status replies to an email:

1. Send an email from the client's email address (matching `clients.email`)
2. Check that client records with `status = 'reminder_sent'` are updated to `'records_received'`
3. Verify the `records_received_for` timestamp is set

## Step 5: Webhook Payload Reference

Postmark sends webhook POSTs with the following key fields:

```typescript
{
  From: string;              // Sender's email address
  FromName: string;          // Sender's display name
  To: string;                // Recipient email address
  Subject: string;           // Email subject line
  TextBody: string;          // Plain text content
  HtmlBody: string;          // HTML content
  Date: string;              // ISO 8601 timestamp
  MessageID: string;         // Unique identifier
  OriginalRecipient: string; // Original destination address
  Attachments: Array<{       // File attachments
    Name: string;
    Content: string;         // Base64-encoded
    ContentType: string;
    ContentLength: number;
  }>;
}
```

See `.planning/research/postmark-inbound-webhooks.md` for the complete payload structure.

## Troubleshooting

### Webhook Not Receiving Requests

1. **Check DNS:** Verify MX records are properly configured
   ```bash
   nslookup -type=MX peninsulaaccounting.com
   ```

2. **Check Webhook URL:** Ensure it's publicly accessible via HTTPS

3. **Check Authentication:** Verify username/password match between Postmark config and environment variables

4. **Check Postmark Activity:** Go to Postmark → Inbound → Activity to see if emails are being received

### 403 Forbidden Responses

- Verify HTTP Basic Auth credentials match exactly
- Check that your route middleware correctly extracts credentials
- Remember: Postmark stops retrying after receiving a 403

### Duplicate Webhooks

- Postmark retries up to 10 times if it doesn't receive a 200 response
- Ensure your handler returns 200 quickly, even if processing is asynchronous
- Implement idempotent processing using `MessageID` field

### Emails Not Matching Clients

- Check that client email addresses in database match exactly (case-insensitive)
- Verify email normalization (trim whitespace, lowercase)
- Check logs to see what email address is in the `From` field

## Next Steps

After completing setup:

1. Test with real client emails
2. Monitor the inbound emails table for activity
3. Set up alerts for webhook failures
4. Document your inbound email address for clients (e.g., `replies@peninsulaaccounting.com`)

## Additional Resources

- [Postmark Inbound Webhook Documentation](https://postmarkapp.com/developer/webhooks/inbound-webhook)
- [Postmark Webhooks Overview](https://postmarkapp.com/developer/webhooks/webhooks-overview)
- Application webhook handler: `app/api/postmark/inbound/route.ts`
- Research notes: `.planning/research/postmark-inbound-webhooks.md`
