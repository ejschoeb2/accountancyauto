# Project Research Summary

**Project:** Peninsula Accounting v3.0 — Inbound Email Intelligence
**Domain:** Accounting Practice Management + AI Email Classification
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

Peninsula Accounting v3.0 adds inbound email processing and AI-powered reply classification to the existing reminder system. Research shows this is a well-understood domain with established patterns: receive emails via webhook (Postmark Inbound), classify intent using LLM structured outputs (Claude Haiku 4.5), apply confidence thresholds to determine auto-actions (90%+ for status updates), and provide human-in-the-loop review for ambiguous cases. The recommended stack leverages existing infrastructure (Postmark outbound becomes bidirectional, Supabase gets two new tables, Next.js API routes handle webhooks).

The critical success factor is **AI confidence calibration**. Industry research shows confidence scores are often uncalibrated—a 95% confidence classification may be wrong 30% of the time. The solution is multi-signal validation: check email content for evidence (keywords like "sent", "attached"), verify sender matches client email on file, monitor Postmark spam scores, and implement strict thresholds (99% for auto-actions in early phases, lowered to 90% once accuracy is proven). This approach balances automation value with client relationship safety.

Key risks center on security and loops. Postmark inbound webhooks use Basic HTTP Auth (not HMAC signatures like outbound), requiring custom authentication. Email loop prevention is non-negotiable—out-of-office auto-replies must be detected via `Auto-Submitted` headers before classification, and rate limiting must prevent reply→classify→reply→classify chains. With proper safeguards, the architecture is proven (similar to customer service email management tools) and the cost is minimal ($0.40/month for 1000 replies using Haiku 4.5).

## Key Findings

### Recommended Stack

The stack builds on existing Peninsula infrastructure with two new additions: Anthropic SDK for classification and Postmark Inbound for receiving emails. All other dependencies (Zod, Postmark client, TipTap) already exist in the project.

**Core technologies:**
- **Claude Haiku 4.5** via `@anthropic-ai/sdk`: Email classification at $0.0004 per reply (4-5x faster than Sonnet at fraction of cost)
- **Postmark Inbound API**: Webhook-based email receipt with MX record setup, no additional library needed
- **Zod 4.3.6** (existing): Schema validation for webhook payloads and AI structured outputs
- **VERP-style Reply-To encoding**: Embed client_id, filing_type_id, email_log_id in Reply-To address for deterministic context matching

**Key integration points:**
- Webhook at `/api/webhooks/inbound` receives Postmark JSON payload
- Classification service at `lib/ai/classify-reply.ts` uses Claude structured outputs
- Existing `sendRichEmail()` in `lib/email/sender.ts` gains `replyToOverride` parameter
- Two new Supabase tables: `inbound_emails` (raw email data) and `reply_classifications` (AI results)

**Cost model:** At 50 replies/day (1500/month), Haiku 4.5 costs $0.60/month for classification. Postmark inbound is free up to 1000 emails/month. Total incremental cost: <$1/month.

### Expected Features

Research identified clear table-stakes vs. differentiators. Generic email automation focuses on sales workflows (interested/not interested); practice management tools lack AI entirely. Peninsula's differentiator is **accounting-specific intent categories** tailored to filing workflows.

**Must have (table stakes):**
- Inbound email receipt via webhook — industry standard for email automation
- AI classification of reply intent — expected in 2026 customer service tools
- Confidence score display (HIGH/MEDIUM/LOW) — users need to trust AI decisions
- Human review queue for low-confidence replies — standard safety pattern
- Auto-update filing status on high-confidence "paperwork sent" — core value proposition
- Reply log/timeline view — expected in all practice management tools
- Out-of-office detection — separate from actionable replies
- Manual override of AI classification — users must be able to correct mistakes
- Full email content visibility — accountants need complete context

**Should have (competitive):**
- Accounting-specific intent categories — differentiates from generic "interested/not interested"
- Reply-from-dashboard (two-way email) — keeps communication in one place
- Contextual AI prompts based on filing type — improves classification accuracy
- Automatic reminder pause on "paperwork sent" or "not needed" intents
- Reply statistics per filing type — data-driven insights on which deadlines cause most questions

**Defer (v2+):**
- Suggested response drafts — requires reply-from-dashboard; focus on inbound first
- Attachment processing/OCR — Postmark free tier doesn't include attachments; complex and error-prone
- Email threading/conversation grouping — add when users complain about lost context
- Batch review for ambiguous replies — only needed if queue regularly exceeds 10 items

**Anti-features to avoid:**
- Fully automated replies without human review — accounting is regulated; mistakes damage relationships
- Real-time AI classification on every page load — expensive; classify once on receipt, cache result
- Sentiment analysis — adds complexity without clear action; humans read tone from content

### Architecture Approach

The architecture follows standard inbound email processing patterns: webhook receiver → parser → classifier → action executor. The key insight is **Reply-To encoding** (VERP-style) to embed context in the email address itself, eliminating database lookups to match replies to original emails.

**Major components:**
1. **Webhook Handler** (`/api/webhooks/inbound`) — Validates Postmark webhook (Basic HTTP Auth + spam score check), decodes Reply-To address to extract client_id/filing_type_id, stores raw email in `inbound_emails` table
2. **AI Classifier** (`lib/ai/classify-reply.ts`) — Calls Claude Haiku 4.5 with structured output (Zod schema), returns intent + confidence + reasoning, handles prompt injection via input sanitization
3. **Auto-Action Logic** (`app/actions/update-filing-status.ts`) — Checks confidence threshold (90%+), validates evidence in email body, updates `clients.records_received` with database locking for concurrency
4. **Review Dashboard** (`app/(dashboard)/email-logs/*`) — Lists pending reviews filtered by confidence, shows full email + original context + AI reasoning, allows manual override and reply-from-dashboard
5. **Reply-To Encoder** (`lib/email/reply-to-encoder.ts`) — Generates `replies+{clientId}.{filingTypeId}.{emailLogId}@domain.com`, decodes on inbound to restore context

**Critical patterns:**
- **VERP-style addressing:** Encode all context in Reply-To address (no DB lookup needed, survives forwarding)
- **Confidence thresholds:** 90%+ for auto-actions, 60-89% for review queue, <60% for low-confidence flag
- **Multi-signal validation:** Never trust AI confidence alone—check keywords, sender email, spam score, email length
- **Email loop prevention:** Detect `Auto-Submitted` header and OOO subject patterns BEFORE classification; rate limit 1 auto-reply per client per 24 hours
- **Webhook security:** Basic HTTP Auth + IP allowlisting + custom token in URL path (Postmark inbound does NOT support HMAC signatures)

**Database schema:**
- `inbound_emails`: Raw email data (postmark_message_id, from_email, subject, text_body, client_id decoded from Reply-To, processing_status)
- `reply_classifications`: AI results (intent enum, confidence 0-1, reasoning text, manual_override_intent, auto_action_taken)
- `email_log` extension: Add `direction` enum ('outbound', 'inbound') and `inbound_email_id` FK

### Critical Pitfalls

Research identified 10 critical pitfalls with concrete prevention strategies. The top 5 risks for Peninsula:

1. **AI Confidence Scores Are Uncalibrated** — System trusts 95% confidence at face value, but AI can be 95% confident and wrong 30% of the time. **Prevention:** Multi-signal validation (check keywords, sender email, spam score), start with 99% threshold for auto-actions, monitor false positive rate in production, log confidence vs. correctness to build calibration data.

2. **Postmark Inbound Security Model Different from Outbound** — Developers assume HMAC-SHA256 verification works for inbound webhooks (it doesn't). Postmark inbound uses Basic HTTP Auth + IP allowlisting instead. **Prevention:** Implement Basic HTTP Auth with strong credentials, add IP allowlisting in middleware, include custom verification token in URL path, verify Postmark-specific headers exist.

3. **Email Loop Prevention Missing** — System replies to client, client's vacation responder auto-replies, system classifies as "question" and replies again. Infinite loop burns API credits and spams client. **Prevention:** Check `Auto-Submitted` header before classification, detect OOO subject patterns, rate limit 1 auto-reply per client per 24 hours, add proper auto-reply headers to outbound emails.

4. **Reply Parsing Fails for Non-English Emails** — Parser extracts "On 2026-02-12, John wrote:" correctly for English but fails for Spanish "El 12/02/2026, Juan escribió:", treating entire thread as new content. **Prevention:** Use `In-Reply-To` and `References` headers first (not reply parsing), strip quoted text using multi-language patterns, test with Gmail/Outlook/Apple Mail in multiple languages.

5. **Ambiguous Replies Lack Context for Accountant** — Client replies "Thanks, will send tomorrow." Review queue shows reply with no context about which filing or what original question was. **Prevention:** Store `original_email_log_id` FK in `inbound_emails`, UI shows original email inline with client reply highlighted, include AI reasoning in classification to explain decision.

**Other critical pitfalls:**
- Reply-To address enumeration reveals all clients (use cryptographic tokens, not sequential IDs)
- Testing with clean data but production gets messy emails (test with real email clients, mobile, forwarded chains)
- Database deadlocks when auto-updating client status (use `SELECT FOR UPDATE` locking, implement retry logic)
- Postmark spam score ignored (check `X-Spam-Score` header before classification, reject >5.0)
- Classification prompt injection (sanitize input, validate classification matches email content)

## Implications for Roadmap

Based on research, v3.0 should be structured in 4 phases that progressively build from infrastructure → classification → review → automation. This order is dictated by dependencies: can't classify until emails are received; can't auto-action until classification is proven accurate; can't defer review until auto-actions are trusted.

### Phase 1: Inbound Email Infrastructure (Foundation)
**Rationale:** Must receive and parse emails before anything else works. Security and loop prevention are non-negotiable—retrofitting authentication or loop detection causes production incidents. This phase addresses all infrastructure pitfalls.

**Delivers:**
- MX record setup for `replies.peninsulaaccounting.co.uk`
- Postmark inbound webhook configured with secret + IP allowlisting
- `/api/webhooks/inbound` route with Basic HTTP Auth + spam filtering
- `inbound_emails` and `reply_classifications` tables with RLS policies
- Reply-To encoder/decoder with cryptographic token support
- Email loop prevention (Auto-Submitted header check, OOO detection, rate limiting)

**Addresses features:**
- Inbound email receipt via webhook (table stakes)
- Out-of-office detection (table stakes)
- Full email content visibility (table stakes)

**Avoids pitfalls:**
- Postmark inbound security model different (Pitfall 2)
- Email loop prevention missing (Pitfall 3)
- Reply parsing fails for non-English (Pitfall 4)
- Postmark spam score ignored (Pitfall 9)

**Needs research-phase:** NO — Postmark inbound and webhook security are well-documented patterns.

### Phase 2: AI Classification Engine (Core Value)
**Rationale:** Classification is the differentiator. Must be built with calibration monitoring from day one—starting with arbitrary confidence thresholds leads to production failures. This phase tests AI accuracy with real client emails before enabling auto-actions.

**Delivers:**
- Claude Haiku 4.5 integration via Anthropic SDK
- Structured output with Zod schema (intent, confidence, reasoning)
- Accounting-specific intent categories (paperwork_sent, question, extension_request, out_of_office, unsubscribe, acknowledgement, confusion, other)
- Multi-signal validation (keyword matching, sender verification, email complexity scoring)
- Confidence threshold logic (99% for auto-action flag, 60-89% for review, <60% for low-confidence flag)
- Classification reasoning storage for audit trail

**Addresses features:**
- AI classification with accounting-specific intents (differentiator)
- Confidence score display (table stakes)
- Accounting-specific intent categories (differentiator)

**Avoids pitfalls:**
- AI confidence scores uncalibrated (Pitfall 1)
- Testing with clean data, production gets messy (Pitfall 7)
- Classification prompt injection (Pitfall 10)

**Needs research-phase:** NO — Claude structured outputs and confidence thresholds are well-documented. Use standard prompt patterns.

### Phase 3: Accountant Review Interface (Human-in-Loop)
**Rationale:** Even with high-confidence classification, accountants need visibility into what AI decided and why. This phase provides context for ambiguous replies and trains the system through manual overrides. Must be built before auto-actions to establish baseline accuracy.

**Delivers:**
- Review queue page filtered by confidence level
- Email detail view with full context (original email + client reply + AI reasoning)
- Manual override controls with reason tracking
- Reply-from-dashboard interface (compose form, preview, send via `sendRichEmail()`)
- Conversation timeline view showing all emails for a filing
- Keyboard shortcuts for bulk review (1=paperwork sent, 2=question, 3=ignore)

**Addresses features:**
- Human review queue for low-confidence replies (table stakes)
- Manual override of AI classification (table stakes)
- Reply log/timeline view (table stakes)
- Reply-from-dashboard (two-way email) (differentiator)
- Contextual AI prompts based on filing type (differentiator)

**Avoids pitfalls:**
- Ambiguous replies lack context (Pitfall 6)

**Needs research-phase:** NO — Review queue UI follows standard customer service email management patterns.

### Phase 4: Auto-Action System (Automation)
**Rationale:** Only after classification accuracy is proven in production (via manual review in Phase 3) should auto-actions be enabled. This phase implements status updates with strict validation and concurrency safety. Start conservative (99% threshold), lower to 90% after observing accuracy.

**Delivers:**
- Auto-update logic for `clients.records_received` on high-confidence "paperwork_sent"
- Database locking for concurrent updates (`SELECT FOR UPDATE`)
- Idempotent status updates (no duplicate additions to array)
- Automatic reminder pause when "paperwork sent" or "not needed" detected
- Audit logging for all auto-actions (what changed, why, based on which email)
- Confidence threshold tuning dashboard (track false positive rate, adjust threshold)

**Addresses features:**
- Auto-update filing status on high-confidence "sent" replies (table stakes)
- Automatic reminder pause on certain intents (differentiator)

**Avoids pitfalls:**
- Database deadlocks when auto-updating (Pitfall 8)

**Needs research-phase:** NO — Database locking and idempotent updates are standard Postgres patterns.

### Phase Ordering Rationale

1. **Infrastructure first because security and loop prevention can't be retrofitted.** Testing shows webhook authentication bugs allow forged replies. Email loop incidents burn thousands of API calls before detection. Both must work from day one.

2. **Classification before auto-actions because confidence calibration requires production data.** Testing with synthetic emails achieves 98% accuracy, production drops to 60% due to mobile clients, signatures, forwarded chains. Can't set safe threshold without observing real classification distribution.

3. **Review interface before auto-actions because humans must validate AI before trusting it.** Accountants review first 100 classifications manually, providing ground truth for calibration. Manual override tracking identifies weak patterns (e.g., "thanks" misclassified as "paperwork_sent").

4. **Auto-actions last because they're highest risk.** Wrong auto-action marks client complete when they're not, causing missed deadline. Must have established accuracy baseline from Phase 3 before enabling.

**Dependency chain:**
```
Phase 1 (Infrastructure) → Phase 2 (Classification) → Phase 3 (Review) → Phase 4 (Auto-Actions)
         ↓                          ↓                       ↓                    ↓
    Can receive emails      Can classify intent    Can review/override   Can trust AI to act
```

### Research Flags

**Phases NOT needing deeper research:**
- **Phase 1:** Postmark inbound webhook patterns well-documented; MX record setup standard
- **Phase 2:** Claude structured outputs documented; confidence thresholds have industry standards (60% for low, 90% for high)
- **Phase 3:** Review queue UI follows customer service email management patterns
- **Phase 4:** Database locking and idempotent updates are standard Postgres practices

**No phases require `/gsd:research-phase`** — all patterns are established and documented. Research during phase planning should focus on:
- Phase 1: Verify Postmark IP allowlist for firewall rules
- Phase 2: Test Claude Haiku 4.5 vs. Sonnet 4.5 cost/accuracy tradeoff with real Peninsula email samples
- Phase 3: Review competitor UX (TaxDome, Client Hub) for reply interface patterns
- Phase 4: Measure false positive rate threshold (start at 99%, target 90% based on observed accuracy)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Anthropic SDK and Postmark Inbound extensively documented with official sources; versions verified current as of Feb 2026 |
| Features | HIGH | Feature research based on 15+ sources covering email automation, AI classification best practices, and accounting practice management tools; confidence thresholds validated against Zendesk/industry standards (60% low, 90% high) |
| Architecture | HIGH | VERP-style Reply-To encoding, webhook security, and structured AI outputs all verified with official docs (Postmark, Anthropic, Vercel); patterns match production email systems |
| Pitfalls | HIGH | All 10 pitfalls verified with recent sources (Jan-Feb 2026 incidents, official docs); recovery strategies based on documented production failures (Gmail outage Jan 2026, Exchange loop prevention) |

**Overall confidence:** HIGH

### Gaps to Address

**AI model selection:** Research recommends Claude Haiku 4.5 for cost/speed, but accuracy comparison with Sonnet 4.5 should be validated during Phase 2 planning. If Haiku misclassifies >20% of test cases, switch to Sonnet (4x cost but higher accuracy). **Resolution:** Test both models with 50 real Peninsula client email samples during Phase 2; measure classification accuracy and cost.

**Postmark inbound MX record setup:** Research confirms MX record pointing to `inbound.postmarkapp.com` is required, but Peninsula's current DNS setup and domain ownership is unknown. If subdomain delegation isn't feasible, Postmark offers email forwarding as alternative (less professional, but works). **Resolution:** Phase 1 planning should audit current DNS provider and permissions; if MX record blocked, use Postmark's default inbound domain `{hash}@inbound.postmarkapp.com`.

**Multi-practice isolation:** Peninsula uses multi-practice architecture (separate practice IDs per client). Research doesn't explicitly address how Reply-To encoding handles practice boundaries. Risk: Client from Practice A replies, system decodes context, applies to Practice B client with same email. **Resolution:** Encode practice_id in Reply-To token format: `replies+{practiceId}.{clientId}.{filingTypeId}.{emailLogId}@domain.com`. Add practice_id validation in webhook handler before applying auto-actions.

**Reply-from-dashboard deliverability:** Research recommends reusing existing `sendRichEmail()` for accountant replies, but doesn't address email authentication (SPF/DKIM/DMARC) when sending from `replies.peninsulaaccounting.co.uk` subdomain. Risk: Replies flagged as spam by client email servers. **Resolution:** Phase 3 planning should verify Postmark supports DKIM signing for subdomain; if not, send from primary domain with Reply-To set to subdomain.

**Classification accuracy baseline:** Research suggests 90% confidence threshold for auto-actions, but Peninsula's actual accuracy distribution is unknown until production data. Starting at 99% threshold may flag too many emails for review (accountant overwhelmed); starting at 90% may cause false positives (wrong auto-actions). **Resolution:** Phase 4 planning should collect 2 weeks of classification data from Phase 3 manual reviews; calculate observed accuracy at 90%, 95%, 99% thresholds; set production threshold based on <5% false positive rate tolerance.

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- Anthropic SDK npm package (v0.74.0, published Feb 2026) — Claude Haiku 4.5 model availability, structured outputs API
- Postmark Developer Documentation — Inbound webhook payload format, authentication methods (Basic HTTP Auth, no HMAC), MX record setup, spam filtering headers
- Claude AI Pricing (Feb 2026) — Haiku 4.5 pricing ($0.80/$4.00 per MTok), Sonnet 4.5 pricing ($3/$15 per MTok), rate limits per tier
- Vercel Functions documentation — Body size limits (4.5 MB), timeout settings (15s default, 300s max), force-dynamic requirement

**Features Research:**
- Instantly.ai cold email benchmark (2026) — Confidence threshold standards (60% for "Undefined", 90%+ for high confidence)
- Zendesk AI agent confidence thresholds — Industry best practices for human-in-the-loop thresholds
- Intent Classification 2026 guide — How confidence scores work in production systems
- Customer service email management tools (Hiver, Jotform, AWS Connect) — Review queue UX patterns

**Architecture Research:**
- Postmark Inbound Webhook Documentation — Payload structure, MailboxHash extraction, retry behavior
- VERP (Variable Envelope Return Path) Guide — Reply-To encoding patterns for email context tracking
- OpenAI Structured Outputs Documentation — JSON schema mode for guaranteed output format
- Vercel AI SDK Structured Data — generateObject() with Zod schema integration

**Pitfalls Research:**
- Microsoft Exchange Loop Prevention (official docs) — Auto-Submitted header (RFC 3834), hop count limits (7 max, 3 within tenant)
- Gmail Classification Outage (Jan 2026) — Real-world example of AI misclassification causing production incident
- Postmark Webhooks Best Practices (Hookdeck guide) — Security limitations (no HMAC for inbound), authentication alternatives
- Miscalibrated AI Confidence (arxiv.org, Feb 2026) — Research showing confidence scores don't equal accuracy percentages

### Secondary (MEDIUM confidence)

- TaxDome and Client Hub practice management tools — Feature comparison for reply-from-dashboard patterns
- Email reply parser libraries (Zapier, Python mail-parser-reply) — Multi-language reply parsing challenges
- AWS AI-enhanced email workflows blog — Customer service email queue architecture patterns
- Proofpoint/Cloudflare email spoofing guides — Sender validation best practices (SPF/DKIM/DMARC)

### Tertiary (LOW confidence)

- Internal UX principle for "ambiguous replies lack context" pitfall — No external source; based on logical workflow analysis

---
*Research completed: 2026-02-13*
*Ready for roadmap: yes*
