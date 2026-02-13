# Stack Research: Inbound Email Processing + AI Classification

**Project:** Peninsula Accounting Client Reminder System v3.0
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

v3.0 adds **inbound email processing** and **AI-powered reply classification** to the existing reminder system. This research focuses exclusively on NEW stack additions needed for receiving client email replies, classifying them with Claude API, and enabling reply-from-dashboard capability.

**Core additions:** Postmark Inbound API (webhook receiver), Anthropic SDK (Claude 4.5 Haiku for classification), structured output validation (Zod + Claude structured outputs), plus-addressing pattern for reply tracking.

**Key integration points:** Webhook runs as Vercel API route, writes to existing `email_log` table + new `client_replies` table, uses existing Postmark client for reply-from-dashboard sends.

## New Stack Requirements

### AI Classification

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@anthropic-ai/sdk` | ^0.74.0 | Claude API client for TypeScript | Official Anthropic SDK with structured outputs support (released Nov 2025). Provides type-safe API calls with guaranteed JSON schema compliance. |
| Claude Haiku 4.5 | (model ID) | Email reply classification | **Best fit for classification tasks**: 4-5x faster than Sonnet 4.5 at fraction of cost ($0.80/$4.00 per MTok vs $3/$15). Achieves 90% of Sonnet performance for agentic tasks. Handles simple classification with high confidence at scale. |
| Claude Sonnet 4.5 | (fallback) | Complex reply classification | For edge cases where Haiku confidence is LOW, Sonnet provides deeper reasoning at moderate cost. Use 2-stage pipeline: Haiku classifies complexity, routes ambiguous cases to Sonnet. |

**Cost estimates (February 2026):**
- Haiku 4.5: $0.80 input / $4.00 output per million tokens
- Sonnet 4.5: $3.00 input / $15.00 output per million tokens
- Expected reply size: ~500 tokens input (email body + context), ~100 tokens output (classification JSON)
- **Per-reply cost**: $0.0004 (Haiku) vs $0.0019 (Sonnet)
- At 1000 replies/month: **$0.40/month (Haiku only)**, $1.90/month (Sonnet only)

**Rate limits:** Anthropic uses 4-tier system. Tier 1 ($5 deposit): 40 RPM, 40K ITPM, 8K OTPM. Tier 4 ($400+ spend): 4000 RPM, 2M ITPM, 400K OTPM. For Peninsula's expected volume (~50 replies/day), Tier 1 is sufficient.

### Inbound Email Processing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Postmark Inbound API | (existing account) | Receive client email replies as webhook | Already using Postmark for outbound. Inbound requires MX record setup + webhook URL configuration. **No additional library needed** — webhook delivers JSON payload to Next.js API route. |
| Plus-addressing | (pattern) | Reply tracking via MailboxHash | Postmark extracts `user+hash@domain.com` into `MailboxHash` field. Use format `replies+{clientId}-{filingTypeId}@{domain}` to route replies to correct context. **No library needed** — built into email standard. |

**Postmark Inbound Setup Requirements:**
1. **MX Record:** Point subdomain (e.g., `replies.peninsula.com`) to `inbound.postmarkapp.com` with priority 10
2. **Inbound Server:** Configure in Postmark dashboard with webhook URL pointing to `/api/webhooks/inbound`
3. **Webhook Authentication:** Postmark **does NOT support HMAC signatures**. Instead: Basic HTTP Auth in URL (`https://user:pass@domain.com/webhook`) + IP allowlisting + HTTPS required. Validate Postmark-specific headers (`MessageStream`, `From`, `To`) to confirm origin.

**Payload format:** JSON POST to webhook URL with fields:
- `FromFull`: Sender details (`Email`, `Name`, `MailboxHash`)
- `ToFull`: Array of recipients with `MailboxHash` extracted
- `MailboxHash`: Extracted from `+hash` in email address (e.g., `replies+abc123@domain.com` → `abc123`)
- `Subject`, `HtmlBody`, `TextBody`, `StrippedTextReply` (body without quoted text)
- `MessageID`: Unique ID for email (for threading)

**Retry behavior:** Postmark retries webhook 10 times with growing intervals if non-200 response. Returns 403 to stop retries.

### Validation & Type Safety

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Schema validation for inbound webhooks + Claude responses | **Already in project** (v4.3.6 in package.json). Use for: (1) Validating Postmark webhook payload structure, (2) Defining classification response schema, (3) Type-safe parsing with `z.email()` for sender validation. |

**Claude Structured Outputs:** Claude API now supports `output_format` parameter with JSON schema (public beta, released Nov 2025). Requires `anthropic-beta: structured-outputs-2025-11-13` header. Works with Sonnet 4.5 and Haiku 4.5. **Use this instead of prompting for JSON** — guarantees schema compliance via constrained decoding.

Example classification schema:
```typescript
const ClassificationSchema = z.object({
  intent: z.enum(['paperwork_sent', 'request_extension', 'question', 'out_of_office', 'unsubscribe', 'unclear']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  reasoning: z.string().max(200),
  suggestedAction: z.enum(['auto_update_status', 'flag_for_review', 'no_action']),
});
```

Pass Zod schema to Claude as JSON Schema via `zodToJsonSchema()` utility (from `zod-to-json-schema` package).

### Vercel Serverless Function Considerations

| Configuration | Value | Rationale |
|---------------|-------|-----------|
| Body size limit | 4.5 MB (default) | Postmark emails typically <1 MB. If attachments needed later, use streaming functions (no limit). |
| Timeout (Pro) | 15s default, 300s max | Webhook processing (parse + classify + DB write) should complete in <5s. Set `maxDuration = 30` for safety margin. Existing cron uses 300s — keep that for batch sends. |
| `force-dynamic` | Required | Webhook route MUST be dynamic (not static). Add `export const dynamic = 'force-dynamic'` to `/api/webhooks/inbound/route.ts`. |

**Integration note:** Existing `/api/cron/send-emails/route.ts` already uses `maxDuration = 300` and `force-dynamic`. Follow same pattern for webhook route.

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | ^4.1.0 | Date parsing for email timestamps | **Already in project**. Use for parsing Postmark `Date` field (format varies by sending mailserver). |
| `@tiptap/html` | ^3.19.0 | Convert plain text to TipTap JSON | **Already in project**. Use for reply-from-dashboard: convert accountant's plain text reply to TipTap format for storage consistency. |
| `zod-to-json-schema` | ^3.24.1 | Convert Zod schemas to JSON Schema for Claude structured outputs | **NEW DEPENDENCY**. Required for passing Zod schemas to Claude API `output_format` parameter. |

## Installation

```bash
# New dependencies for v3.0
npm install @anthropic-ai/sdk zod-to-json-schema

# Verify existing dependencies (already in package.json)
# - zod ^4.3.6
# - postmark ^4.0.5
# - date-fns ^4.1.0
# - @tiptap/html ^3.19.0
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Postmark Inbound | SendGrid Inbound Parse, AWS SES + Lambda | Only if migrating entire email stack. Postmark simplest since already using for outbound. |
| Claude Haiku 4.5 | GPT-4o-mini, Gemini 2.0 Flash | If Anthropic rate limits hit or cost optimization needed. GPT-4o-mini is $0.15/$0.60 per MTok (cheaper but requires OpenAI account). |
| Vercel API Route | Supabase Edge Function | If webhook needs direct DB access without app-level auth. Edge Functions run on Deno (closer to Supabase DB), but Vercel API routes sufficient for 50 replies/day. |
| Plus-addressing | Custom domain routing | If subdomain setup not feasible. Use Postmark's default `{hash}@inbound.postmarkapp.com` instead. Less professional but works. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Claude Opus 4.6 for classification | **5x cost** ($5/$25 per MTok) for negligible accuracy gain on simple classification tasks. Opus is for complex reasoning, not pattern matching. | Haiku 4.5 for 99% of replies, Sonnet 4.5 for edge cases |
| HMAC signature verification | Postmark **does not provide** HMAC signatures for webhooks. Attempting to implement will fail. | Basic HTTP Auth + IP allowlisting + header validation |
| Batch API for classification | 50% cheaper ($0.40/$2.00 per MTok) but **not real-time**. Emails queued for processing, responses in ~10 minutes. Users expect immediate classification. | Standard Haiku 4.5 API (real-time) |
| Fast Mode Claude | 6x cost premium ($18/$90 per MTok for Haiku) for speed. Classification already completes in <2s with standard API. | Standard Haiku 4.5 (fast enough) |
| Custom email parser | Postmark delivers pre-parsed JSON with `StrippedTextReply` (removes quoted text). No need for regex parsing. | Use `StrippedTextReply` field from Postmark |
| OpenAI moderation API | Not needed — client replies are low-risk (business context). Adds latency + cost for negligible benefit. | Skip moderation, rely on Claude classification |

## Stack Patterns by Variant

**If reply volume exceeds 1000/day:**
- Switch to Batch API for classification (50% cost savings)
- Add queue table for async processing
- Acceptable for non-urgent classifications (e.g., overnight batch)

**If attachments needed in replies:**
- Postmark inbound includes `Attachments` array with base64 content
- Store in Supabase Storage (not DB — files can be large)
- Add `attachment_urls` JSON column to `client_replies` table

**If multi-practice isolation required:**
- Add `practice_id` to webhook URL as query param: `/api/webhooks/inbound?practice_id={id}`
- Validate practice ownership before writing to DB
- Use separate Reply-To addresses per practice (e.g., `replies+practice1-{context}@domain.com`)

**If email threading needed:**
- Use Postmark's `MessageID` and `References` headers to build thread
- Store `in_reply_to_message_id` in `client_replies` table
- Query by `reminder_queue_id` to see all replies for a filing

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@anthropic-ai/sdk@0.74.0` | Node.js ≥18, TypeScript ≥4.5 | Structured outputs require `anthropic-beta: structured-outputs-2025-11-13` header |
| `zod-to-json-schema@3.24.1` | `zod@^4.0.0` | Works with Zod v4.3.6 (in package.json) |
| Postmark Inbound API | Postmark client `^4.0.5` | Inbound uses webhooks (no client library needed), outbound uses existing client |
| Claude Haiku 4.5 | Anthropic SDK `≥0.74.0` | Model ID: `claude-haiku-4-5` (released Dec 2025) |

## Integration Points with Existing Stack

### Postmark
- **Outbound (existing):** `postmark` package (v4.0.5) in `lib/email/sender.ts`, `sendRichEmail()` function
- **Inbound (new):** Webhook receiver at `/api/webhooks/inbound/route.ts`, no package needed (JSON payload)
- **Reply-from-dashboard (new):** Reuse `sendRichEmail()` with `ReplyTo` header set to client's original email

### Supabase
- **Email log (existing):** `email_log` table tracks outbound emails (created in `20260207020738_add_email_log_table.sql`)
- **Client replies (new):** New `client_replies` table stores inbound emails + classification results
- **Foreign keys:** `client_replies.email_log_id` → `email_log.id` (links reply to original outbound email)
- **RLS policies:** Follow existing pattern (authenticated users read/write, service_role full access)

### Next.js / Vercel
- **Webhook route:** `/app/api/webhooks/inbound/route.ts` (POST handler, `force-dynamic`, `maxDuration = 30`)
- **Classification service:** `lib/ai/classify-reply.ts` (Anthropic SDK client, structured outputs)
- **Reply sender:** `app/actions/send-reply.ts` (server action, reuses `sendRichEmail()`)

### Zod
- **Webhook validation (new):** `lib/schemas/postmark-inbound.ts` validates incoming JSON payload
- **Classification schema (new):** `lib/schemas/reply-classification.ts` defines Claude response structure
- **Form validation (existing):** `react-hook-form` + Zod already used in templates/schedules

## Environment Variables

```bash
# Anthropic API (NEW)
ANTHROPIC_API_KEY=sk-ant-... # From console.anthropic.com

# Postmark (EXISTING)
POSTMARK_API_TOKEN=... # Already configured for outbound

# Webhook Auth (NEW)
WEBHOOK_SECRET=... # For Basic HTTP Auth on inbound webhook URL
# Format: https://{user}:{WEBHOOK_SECRET}@{domain}/api/webhooks/inbound

# Inbound Domain (NEW)
INBOUND_EMAIL_DOMAIN=replies.peninsula.com # Subdomain for MX record
```

## Sources

### Postmark Inbound
- [Inbound webhook documentation](https://postmarkapp.com/developer/webhooks/inbound-webhook) — Payload format, MailboxHash field
- [Postmark webhook overview](https://postmarkapp.com/developer/webhooks/webhooks-overview) — Authentication, retry behavior
- [Parse an email guide](https://postmarkapp.com/developer/user-guide/inbound/parse-an-email) — MailboxHash context tracking pattern
- [Sample inbound workflow](https://postmarkapp.com/developer/user-guide/inbound/sample-inbound-workflow) — End-to-end implementation example
- [Inbound domain forwarding](https://postmarkapp.com/developer/user-guide/inbound/inbound-domain-forwarding) — MX record setup
- [Hookdeck Postmark guide](https://hookdeck.com/webhooks/platforms/guide-to-postmark-webhooks-features-and-best-practices) — Webhook authentication limitations (no HMAC)

### Claude API
- [Claude AI Pricing 2026 Guide](https://www.glbgpt.com/hub/claude-ai-pricing-2026-the-ultimate-guide-to-plans-api-costs-and-limits/) — Pricing verified for Haiku 4.5, Sonnet 4.5
- [Claude API pricing page](https://platform.claude.com/docs/en/about-claude/pricing) — Official February 2026 pricing
- [Claude Haiku 4.5 deep dive](https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity) — Performance metrics for classification tasks
- [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) — Model comparison (Opus, Sonnet, Haiku)
- [Structured outputs documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — JSON schema mode (beta, released Nov 2025)
- [Claude API rate limits](https://platform.claude.com/docs/en/api/rate-limits) — Tier system (Tier 1-4 limits)

### Anthropic SDK
- [@anthropic-ai/sdk npm package](https://www.npmjs.com/package/@anthropic-ai/sdk) — Latest version 0.74.0 (published Feb 2026)
- [anthropic-sdk-typescript GitHub](https://github.com/anthropics/anthropic-sdk-typescript) — TypeScript SDK releases

### Vercel
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — Body size (4.5 MB), timeout (Pro: 15s default, 300s max)
- [How to bypass 4.5MB body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) — Streaming functions for large payloads

### Email Standards
- [Plus addressing and subaddressing](https://verifalia.com/help/email-validations/what-is-plus-addressing-subaddressing) — Email +hash syntax for context tracking
- [Fastmail plus addressing guide](https://www.fastmail.help/hc/en-us/articles/360060591053-Plus-addressing-and-subdomain-addressing) — Plus addressing behavior

### Zod
- [Zod npm package](https://www.npmjs.com/package/zod) — TypeScript-first validation (v4.3.6 in project)
- [Zod email validation](https://www.answeroverflow.com/m/1400374318634107022) — `z.email()` validation patterns

---

*Stack research for: Peninsula Accounting v3.0 — Inbound Email Processing + AI Classification*
*Researched: 2026-02-13*
*Confidence: HIGH (verified with official docs and WebSearch sources)*
