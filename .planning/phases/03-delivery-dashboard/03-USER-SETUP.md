# Phase 3: User Setup Guide

External services require manual configuration before Phase 3 functionality works.

## Postmark Email Service

**Why:** Transactional email delivery for client reminders

### 1. Create Postmark Account

1. Go to https://postmarkapp.com
2. Sign up for a new account
3. Complete email verification

### 2. Create Server and Get API Token

1. In Postmark dashboard, go to **Servers** → **Create Server**
2. Name it: "Peninsula Accounting Production" (or similar)
3. Go to **API Tokens** tab
4. Copy the **Server API Token**
5. Add to `.env.local`:
   ```
   POSTMARK_SERVER_TOKEN=your-server-api-token-here
   ```

### 3. Configure Webhook Secret

1. In Postmark dashboard, go to **Servers** → **[Your Server]** → **Webhooks**
2. Click **Create Webhook**
3. Set URL: `https://your-domain.vercel.app/api/webhooks/postmark` (update after deployment)
4. Enable these events:
   - Delivery
   - Bounce
   - Spam Complaint
5. Copy the **Webhook Secret**
6. Add to `.env.local`:
   ```
   POSTMARK_WEBHOOK_SECRET=your-webhook-secret-here
   ```

### 4. Configure Sender Signature

1. Go to **Sender Signatures** → **Add Domain or Single Address**
2. Add: `reminders@peninsulaaccounting.co.uk`
3. Complete email verification (check inbox for verification link)
4. Set as default sender

### 5. Add Accountant Reply-To Email

Add your real email address for Reply-To header:

```
ACCOUNTANT_EMAIL=info@peninsulaaccounting.co.uk
```

Clients will see replies go to this address when they hit "Reply" to reminders.

### 6. DNS Configuration for Deliverability

**CRITICAL:** Configure SPF, DKIM, and DMARC before sending production emails. Without these, emails may be marked as spam.

1. In Postmark dashboard, go to **Sender Signatures** → **[Your Domain]**
2. Copy the provided DNS records:
   - **DKIM** TXT record
   - **Return-Path** CNAME record
3. Add to your DNS provider (e.g., Cloudflare, Namecheap, GoDaddy):
   - Add DKIM TXT record exactly as shown
   - Add Return-Path CNAME record exactly as shown
4. Add SPF record if not already present:
   ```
   Type: TXT
   Name: @
   Value: v=spf1 include:spf.mtasv.net ~all
   ```
5. Add DMARC record (recommended):
   ```
   Type: TXT
   Name: _dmarc
   Value: v=DMARC1; p=none; rua=mailto:info@peninsulaaccounting.co.uk
   ```

**Verification:**
- Postmark will show verification status in dashboard (usually 24-48 hours for DNS propagation)
- Test email delivery with `npm run test:email` (after 03-02 cron implementation)

## Environment Variables Summary

Add these to `.env.local`:

```bash
# Postmark Email Service
POSTMARK_SERVER_TOKEN=your-server-api-token-here
POSTMARK_WEBHOOK_SECRET=your-webhook-secret-here
ACCOUNTANT_EMAIL=info@peninsulaaccounting.co.uk

# Existing from Phase 1 and 2
# (keep these as well)
```

## Verification

After setup, verify configuration:

```bash
# Check env vars are loaded
npm run dev
# Visit http://localhost:3000 and check console for any missing env var warnings

# TypeScript compilation
npx tsc --noEmit
# Should pass with no errors

# Test Postmark connection (after 03-02 implementation)
# This will be added in the next plan
```

## Production Deployment Checklist

Before going live:

- [ ] Postmark server created and API token added to Vercel env vars
- [ ] Sender signature verified (email confirmation clicked)
- [ ] DNS records added and verified in Postmark dashboard (green checkmarks)
- [ ] Webhook URL configured to production domain
- [ ] Test email sent successfully with deliverability check
- [ ] Reply-To email tested (send reminder, hit reply, confirm it goes to ACCOUNTANT_EMAIL)

## Support

**Postmark:**
- Documentation: https://postmarkapp.com/developer
- Support: https://postmarkapp.com/support

**DNS/Deliverability:**
- Postmark's Email Deliverability Guide: https://postmarkapp.com/guides/email-deliverability
- Test email spam score: https://www.mail-tester.com

---

**Next steps:** After environment variables are configured, proceed to Phase 3 Plan 2 (send-emails cron job) which will use these credentials to send reminders.
