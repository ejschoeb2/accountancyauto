# Postmark Inbound Email Setup Guide

This guide provides step-by-step instructions for configuring Postmark to receive inbound emails from clients and automatically process them via webhook.

---

## Overview

When a client sends accounting records via email, Postmark will:
1. Receive the email at your inbound email address
2. Parse the email into structured JSON
3. POST the JSON to your webhook URL
4. Your app processes the email and updates the database

---

## Prerequisites

- Active Postmark account
- Access to your domain's DNS settings
- Deployed Next.js application with webhook endpoint

---

## Step 1: Configure Postmark Server for Inbound

### 1.1 Create or Select a Server

1. Log in to [Postmark](https://account.postmarkapp.com/)
2. Navigate to **Servers** in the left sidebar
3. Either select your existing server or create a new one

### 1.2 Create Inbound Message Stream

Each Postmark server can have **one Inbound Stream**.

1. In your server settings, click on **Message Streams**
2. Click **Add Stream** → **Inbound**
3. Name it something like "Client Records Inbound"
4. Click **Create**

**Note**: You can only have one inbound stream per server.

---

## Step 2: Domain Configuration

You have two options for receiving inbound emails:

### Option A: Use Postmark's Default Domain (Quickest)

Postmark provides a free inbound email address automatically:

```
<unique-id>@inbound.postmarkapp.com
```

**Example**: `7g3k2m9@inbound.postmarkapp.com`

**Pros**: No DNS configuration required, works immediately
**Cons**: Not branded, harder to remember

To use this option, simply skip to Step 3.

### Option B: Use Your Own Domain (Recommended)

Use a branded subdomain like `records@yourdomain.com`.

#### 2.1 Choose Your Inbound Domain

We recommend using a **subdomain** rather than your root domain:

- ✅ Good: `inbound.peninsulaaccounting.com`
- ✅ Good: `records.peninsulaaccounting.com`
- ❌ Avoid: `peninsulaaccounting.com` (root domain)

**Wildcard option**: You can also use `*.yourdomain.com` to route all subdomains to your inbound endpoint.

#### 2.2 Add Domain to Postmark

1. In your Inbound Stream settings, click **Add Domain**
2. Enter your chosen subdomain (e.g., `inbound.peninsulaaccounting.com`)
3. Click **Add Domain**

#### 2.3 Configure DNS MX Record

Postmark will show you the required DNS configuration. You need to add an **MX record**:

**DNS Record Settings:**
```
Type:     MX
Host:     inbound.peninsulaaccounting.com  (or your chosen subdomain)
Value:    inbound.postmarkapp.com
Priority: 10
TTL:      3600 (or your default)
```

**Example for common DNS providers:**

**Cloudflare:**
1. Go to DNS settings for your domain
2. Click **Add record**
3. Type: `MX`
4. Name: `inbound` (subdomain part only)
5. Mail server: `inbound.postmarkapp.com`
6. Priority: `10`
7. Click **Save**

**GoDaddy / Namecheap:**
1. Navigate to DNS Management
2. Add MX Record:
   - Host: `inbound`
   - Points to: `inbound.postmarkapp.com`
   - Priority: `10`

#### 2.4 Verify Domain

1. After adding the MX record, wait 5-15 minutes for DNS propagation
2. Return to Postmark → Inbound Stream → Domains
3. Click **Verify** next to your domain
4. Status should change to **Verified** ✓

**Troubleshooting**: If verification fails, use [MXToolbox](https://mxtoolbox.com/) to check your MX record is configured correctly.

---

## Step 3: Configure Webhook URL

### 3.1 Set Your Webhook Endpoint

1. In your Inbound Stream settings, find the **Webhook** section
2. Enter your webhook URL:
   ```
   https://yourdomain.com/api/webhooks/postmark-inbound
   ```

   **For development/testing:**
   ```
   https://your-dev-domain.vercel.app/api/webhooks/postmark-inbound
   ```

3. Click **Save**

### 3.2 Test Your Webhook

Postmark provides a built-in webhook tester:

1. Click the **Check** button next to your webhook URL
2. Postmark will send a test payload to your endpoint
3. Your endpoint must return HTTP **200 OK**
4. If successful, you'll see a green checkmark ✓

**Expected Response:**
```
✓ Webhook responding correctly
```

**Troubleshooting:**
- ❌ Timeout: Check your webhook endpoint is deployed and accessible
- ❌ 404: Verify the URL path is correct
- ❌ 500: Check your webhook handler code for errors

---

## Step 4: Configure Inbound Email Address

### 4.1 Create Inbound Address

Once your domain is verified (or if using Postmark's default), you can create email addresses:

1. Go to **Inbound Stream** → **Inbound addresses**
2. Click **Add inbound address**

**If using your own domain:**
- Enter: `records` (before the @)
- Your full address will be: `records@inbound.peninsulaaccounting.com`

**If using Postmark's domain:**
- Use the auto-generated address provided by Postmark

3. Click **Create**

### 4.2 Share Address with Clients

Your clients will send accounting records to this email address. Add it to:
- Your website
- Email signatures
- Reminder emails (e.g., "Reply with your records" → include the inbound address)

---

## Step 5: Security Configuration

### 5.1 IP Whitelisting (Optional but Recommended)

To prevent unauthorized webhook calls, whitelist Postmark's IP addresses:

**Postmark's Webhook IPs** (as of 2026):
```
3.134.147.250
18.217.206.57
```

Add these to your firewall/application rules to only accept webhook POSTs from Postmark.

**Next.js Middleware Example:**
```typescript
// middleware.ts
const POSTMARK_IPS = ['3.134.147.250', '18.217.206.57'];

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/webhooks/postmark-inbound')) {
    const ip = request.headers.get('x-forwarded-for') || request.ip;
    if (ip && !POSTMARK_IPS.includes(ip)) {
      return new Response('Unauthorized', { status: 403 });
    }
  }
}
```

### 5.2 Webhook Authentication Token (Optional)

You can add a secret token to your webhook URL for additional verification:

```
https://yourdomain.com/api/webhooks/postmark-inbound?token=your-secret-token
```

Then verify the token in your webhook handler.

---

## Step 6: Testing

### 6.1 Send a Test Email

1. Send an email to your inbound address (e.g., `records@inbound.peninsulaaccounting.com`)
2. Include some test content and optionally attach a file
3. Check your webhook logs to see if the payload was received

**Example Test Email:**
```
To: records@inbound.peninsulaaccounting.com
From: test@example.com
Subject: Corporation Tax Records for Acme Ltd

Hi,

Attached are the records for our corporation tax return.

Thanks!
```

### 6.2 Monitor Activity

In Postmark:
1. Go to **Inbound Stream** → **Activity**
2. You'll see all received inbound emails
3. Click on any email to see:
   - Full raw email
   - Parsed JSON payload
   - Webhook delivery status (200 = success)

### 6.3 Debugging Failed Webhooks

If webhooks fail (status other than 200):
1. Click on the failed message in Activity
2. View the error response from your webhook
3. Check your application logs for errors
4. Fix the issue and Postmark will retry (up to 10 times)

---

## Step 7: Production Deployment

### 7.1 Environment Variables

Store Postmark configuration in environment variables:

```bash
# .env.local
POSTMARK_INBOUND_EMAIL=records@inbound.peninsulaaccounting.com
POSTMARK_WEBHOOK_SECRET=your-secret-token-here
```

### 7.2 Update Webhook URL

When deploying to production:
1. Update the webhook URL in Postmark to your production domain
2. Test with a real email
3. Verify the webhook receives and processes correctly

---

## Webhook Payload Reference

See task #5 documentation for the complete payload structure. Key fields:

```typescript
{
  From: string,              // Sender email
  FromName: string,          // Sender name
  Subject: string,           // Email subject
  TextBody: string,          // Plain text body
  HtmlBody: string,          // HTML body
  Attachments: [             // Array of attachments
    {
      Name: string,
      Content: string,       // Base64-encoded
      ContentType: string,
      ContentLength: number
    }
  ],
  MessageID: string,         // Unique identifier
  Date: string              // Sent date (format varies!)
}
```

---

## Common Issues & Solutions

### Issue: Domain not verifying
- **Solution**: Wait 15-30 minutes for DNS propagation, then verify again
- **Check**: Use `dig MX inbound.yourdomain.com` or [MXToolbox](https://mxtoolbox.com/) to verify MX record

### Issue: Webhook returns 404
- **Solution**: Ensure your webhook route file exists at `app/api/webhooks/postmark-inbound/route.ts`
- **Check**: Test the endpoint manually with a POST request

### Issue: Emails not arriving
- **Solution**:
  1. Check Postmark Activity log to see if emails are being received
  2. Verify your inbound email address is correct
  3. Check spam folder of sending email

### Issue: Webhook timeouts
- **Solution**: Your webhook handler must respond within 30 seconds
- **Best practice**: Return 200 immediately, process email asynchronously

---

## Resources

- [Postmark Inbound Email Documentation](https://postmarkapp.com/inbound-email)
- [Configure Inbound Server Guide](https://postmarkapp.com/developer/user-guide/inbound/configure-an-inbound-server)
- [Inbound Domain Forwarding](https://postmarkapp.com/developer/user-guide/inbound/inbound-domain-forwarding)
- [Inbound Webhook Payload Reference](https://postmarkapp.com/developer/webhooks/inbound-webhook)
- [Setting Up Inbound Email Processing](https://curiousmints.com/setting-up-inbound-email-processing-with-postmark-aj-guide/)

---

## Next Steps

After completing this setup:
1. ✅ Task #7: Create `inbound_emails` database migration
2. ✅ Task #8: Build Postmark webhook API route (`/api/webhooks/postmark-inbound`)
3. ✅ Task #9: Create keyword detector utility
4. ✅ Task #10: Build auto-update logic for `records_received` status
5. ✅ Task #11: Add inbound checker configuration to settings
6. ✅ Task #12: Rename "Email Logs" page to "Emails" and add inbound toggle
7. ✅ Task #13: Build inbound emails table UI

---

**Setup Complete!** Your Postmark inbound email processing is now configured.
