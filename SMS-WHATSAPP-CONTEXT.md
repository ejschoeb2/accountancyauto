# SMS & WhatsApp Notification Channels — Phase Context

## Goal
Add SMS and WhatsApp as notification channels alongside the existing email system. Clients should be able to receive deadline reminders via their preferred channel (email, SMS, WhatsApp, or multiple).

## Why
- Increases reminder open/response rates (SMS has ~98% open rate vs ~20% for email)
- Differentiating feature for both Prompt (accounting) and the planned church compliance fork
- Build once here, benefit both products post-fork

---

## Current Email Pipeline (How It Works Today)

### Architecture
```
Vercel Cron (:00) → /api/cron/reminders → scans clients + schedules → inserts into reminder_queue
Vercel Cron (:10) → /api/cron/send-emails → reads pending queue → sends via Postmark → logs to email_log
```

### Key Files
| File | Role |
|------|------|
| `app/api/cron/reminders/route.ts` | Queue stage — scans orgs, clients, schedules; populates `reminder_queue` |
| `app/api/cron/send-emails/route.ts` | Send stage — reads pending queue, sends via Postmark per-org |
| `lib/email/sender.ts` | Core send functions: `sendRichEmailForOrg()`, `sendRichEmail()`, `sendReminderEmail()` |
| `lib/email/render-tiptap.ts` | Renders TipTap JSON templates to HTML + plain text |
| `lib/email/client.ts` | Postmark client setup |
| `lib/email/circuit-breaker.ts` | Circuit breaker pattern for Postmark API calls |

### Database Tables
| Table | Role |
|-------|------|
| `reminder_queue` | Pending reminders (populated by cron, consumed by send-emails) |
| `email_log` | Outbound delivery history (Postmark message ID, status, timestamps) |
| `email_templates` | Reusable TipTap JSON templates per org/user |
| `schedules` | Reminder schedules per filing type per org/user |
| `clients` | Client list — has `email`, `name`, `year_end_date`, `vat_stagger_group`, etc. |
| `app_settings` | Per-org and per-user settings (email sender config, send hour, etc.) |

### Multi-Tenant Design
- Each org has its own Postmark server token (`organisations.postmark_server_token`)
- Per-user sender identity (name, address, reply-to) stored in `app_settings`
- Cron jobs iterate over active orgs sequentially
- Circuit breaker protects against Postmark outages

---

## Proposed Design

### Notification Channel Abstraction
Create a `NotificationChannel` interface that Email, SMS, and WhatsApp implement:

```typescript
interface NotificationChannel {
  type: 'email' | 'sms' | 'whatsapp';
  send(params: NotificationParams): Promise<NotificationResult>;
  isAvailable(orgId: string): Promise<boolean>;
}
```

### Database Changes Needed
1. **`clients` table** — add `notification_channels` (jsonb array, default `['email']`) and `phone_number` (text, nullable)
2. **`reminder_queue` table** — add `channel` column ('email' | 'sms' | 'whatsapp') so the send stage knows which provider to use
3. **`notification_log` table** (or extend `email_log`) — track SMS/WhatsApp delivery status
4. **`app_settings`** — new keys for Twilio config per org (`twilio_account_sid`, `twilio_auth_token`, `twilio_phone_number`, `twilio_whatsapp_number`)
5. **`organisations`** — optionally add `twilio_account_sid`, `twilio_auth_token` columns (similar to `postmark_server_token`)

### Pipeline Changes
1. **Queue stage** (`/api/cron/reminders`) — when inserting into `reminder_queue`, create one entry per channel per client (a client with `['email', 'sms']` gets two queue entries)
2. **Send stage** (`/api/cron/send-emails`) — route by `channel` column: email → Postmark, sms/whatsapp → Twilio
3. **Template rendering** — SMS/WhatsApp need plain text (max ~160 chars for SMS, 1024 for WhatsApp). Existing `render-tiptap.ts` already produces plain text — may just need truncation/reformatting

### Client Preferences UI
- Add phone number field to client form
- Add notification channel multi-select (email, SMS, WhatsApp)
- Opt-in tracking for compliance

---

## Twilio Integration Details

### Provider Choice: Twilio
- Industry standard for SMS + WhatsApp
- Single SDK handles both channels
- `npm install twilio`
- Same API pattern: `client.messages.create({ to, from, body })`
- WhatsApp: prefix number with `whatsapp:` (e.g., `whatsapp:+447700900000`)

### SMS
- Works immediately after account setup
- UK numbers supported
- Cost: ~$0.04/SMS to UK numbers
- No template approval needed

### WhatsApp
- Requires WhatsApp Business sender registration in Twilio console
- **Message templates must be submitted to Meta for approval (1-3 business days)**
- Templates use numbered placeholders: "Hi {{1}}, your {{2}} deadline is due on {{3}}"
- Once approved, sending is identical to SMS (just different `from` number)

### Environment Variables (New)
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+44xxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Regulatory Notes
- Transactional reminders (deadline alerts) fall under "legitimate interest" under GDPR
- Explicit opt-in is still best practice and required by WhatsApp/Meta policy
- Must provide opt-out mechanism for all channels

---

## Setup Steps (What the Developer Needs To Do)

1. **Create Twilio account** at twilio.com (free trial = $15 credit for testing)
2. **Get a Twilio phone number** with SMS capability (~$1/month)
3. **Note Account SID + Auth Token** from Twilio console dashboard
4. **For WhatsApp:** Go to Messaging > Try it out > Send a WhatsApp message (sandbox for dev)
5. **For production WhatsApp:** Register as WhatsApp Business sender, submit message templates to Meta
6. **Add env vars** to `.env.local` and Vercel project settings
7. **Optionally:** Set up per-org Twilio credentials (like existing per-org Postmark tokens) for multi-tenant

---

## Estimated Scope
- **Database migrations:** 2-3 migrations (client fields, queue channel, notification log)
- **New lib code:** `lib/sms/client.ts`, `lib/sms/sender.ts`, channel abstraction
- **Modified cron:** Update both cron routes to handle multi-channel
- **UI changes:** Client form (phone + channel prefs), settings page (Twilio config)
- **Tests:** Unit tests for channel routing, integration tests for Twilio send

---

## Out of Scope (For Now)
- Two-way SMS/WhatsApp conversations (inbound handling)
- MMS / media messages
- WhatsApp interactive messages (buttons, lists)
- Per-user Twilio credentials (org-level only initially)
