# AI Integration & Roadmap Considerations

This document captures research and strategic analysis on how AI should be integrated into Prompt, GDPR and privacy considerations for the client-facing portal (Phase 4), and an evaluation of each AI opportunity against market context.

---

## Table of Contents

1. [UK Filing Types: What Happens Between Reminder and Submission](#1-uk-filing-types-what-happens-between-reminder-and-submission)
2. [Market Position: Where Prompt Sits](#2-market-position-where-prompt-sits)
3. [Phase 4 — Client Portal: GDPR & Privacy Analysis](#3-phase-4--client-portal-gdpr--privacy-analysis)
4. [AI in UK Accounting Software: Current Landscape](#4-ai-in-uk-accounting-software-current-landscape)
5. [AI Opportunities for Prompt: Ranked](#5-ai-opportunities-for-prompt-ranked)
6. [Phase 6 — AI Agent Interface: Re-evaluation](#6-phase-6--ai-agent-interface-re-evaluation)
7. [AI Document Review: Analysis & Recommendation](#7-ai-document-review-analysis--recommendation)
8. [Competitor Software Overview](#8-competitor-software-overview)
9. [Bootstrapping Predictive Data: Historical Email Import Analysis](#9-bootstrapping-predictive-data-historical-email-import-analysis)
10. [Key Decisions & Conclusions](#10-key-decisions--conclusions)

---

## 1. UK Filing Types: What Happens Between Reminder and Submission

Prompt tracks 5 filing types. Understanding what happens between "reminder sent" and "filed with HMRC/Companies House" is essential for knowing where AI can and cannot help.

### Companies House Annual Accounts

- **Deadline:** Year-end + 9 months (private companies)
- **What the accountant does:** Imports trial balance from bookkeeping software → maps to FRC taxonomy → applies year-end adjustments → generates FRS 102/105 statutory accounts → auto-applies iXBRL tagging → submits iXBRL file to Companies House
- **Complexity:** High. Requires FRS 102 knowledge, professional judgement on disclosures, taxonomy mapping, and specialist accounts production software (TaxCalc, BTC, IRIS)
- **API:** No REST API for accounts filing. Older XML-based gateway only. From April 2027, Companies House will require ALL accounts in iXBRL format
- **Can Prompt automate this?** No. This is a multi-year accounts production engineering problem. Companies like BTC Software have been building this for 20+ years

### CT600 Corporation Tax Return

- **Deadline:** Year-end + 12 months
- **What the accountant does:** Prepares statutory accounts (as above) → builds corporation tax computation (capital allowances, disallowable expenses, reliefs, losses) → completes CT600 form + supplementary pages → packages as XML envelope containing CT600 data + iXBRL accounts + iXBRL tax computations → submits via HMRC Corporation Tax Online API
- **Complexity:** Very high. The most complex filing. Requires complete statutory accounts, tax computation, and dual iXBRL tagging using different taxonomies. HMRC rejects any submission with PDF accounts
- **API:** XML-based, Government Gateway authentication. Not a modern REST API
- **Can Prompt automate this?** No. Same reasons as Companies House, plus corporation tax law encoding

### VAT Returns (MTD)

- **Deadline:** Quarter-end + 1 month + 7 days
- **What the accountant does:** Ensures bookkeeping records are complete → calculates 9 box values (output VAT, input VAT, net VAT, sales/purchases totals) → bookkeeping software usually calculates automatically → submits via HMRC VAT MTD API
- **Complexity:** Low-medium. Just 9 numbers. Bookkeeping software does the heavy lifting
- **API:** Modern REST API, JSON, OAuth 2.0. Third-party software submits directly. "Bridging software" can submit from spreadsheets
- **Can Prompt automate this?** Theoretically possible (see Phase 5 in ROADMAP.md), but the value is in computing the 9 boxes correctly from bookkeeping data, which Xero/QuickBooks already handle natively

### Self Assessment (SA100)

- **Deadline:** 31 January following tax year
- **What the accountant does:** Gathers source documents (P60/P45, bank interest, dividends, rental accounts, self-employment records, capital gains, pensions, Gift Aid) → completes SA100 main form + supplementary pages (SA102-SA109) → applies tax knowledge for reliefs and allowances → submits via Self Assessment Online XML API
- **Complexity:** Medium-high. Huge variety of income types and supplementary pages. Client data gathering is the hardest part
- **API:** XML-based, Government Gateway authentication
- **Can Prompt automate this?** No. Too many income types, supplementary pages, and tax planning decisions requiring professional judgement

### Confirmation Statement (Companies House)

- **Deadline:** Within 14 days of review date, at least annually
- **What the accountant does:** Logs into Companies House WebFiling → reviews pre-populated data (officers, PSCs, shareholders, address, SIC codes) → confirms or updates → pays fee (~£34 online) → submits
- **Complexity:** Very low. 10-15 minutes. Just a confirmation exercise
- **Can Prompt automate this?** Technically yes, but the filing is so simple that most accountants just do it on the website directly. Little value in automating

### Summary

| Filing | Complexity | Modern API? | Can Prompt Automate? |
|--------|-----------|------------|------------------------|
| Companies House Accounts | Very high | No (XML only) | No |
| CT600 | Very high | No (XML) | No |
| VAT (MTD) | Low-medium | Yes (REST/JSON/OAuth) | Theoretically, but crowded market |
| Self Assessment | Medium-high | No (XML) | No |
| Confirmation Statement | Very low | Partial | Not worth it |

**Conclusion:** Prompt's role is tracking deadlines, sending reminders, chasing clients for records, and managing the workflow. The actual filing preparation requires specialist software (TaxCalc, BTC, IRIS) built over decades. The one exception is VAT MTD, covered in Phase 5 of the roadmap.

---

## 2. Market Position: Where Prompt Sits

The UK accounting software market has a well-established three-layer stack:

| Layer | Purpose | Examples |
|-------|---------|---------|
| Bookkeeping | Day-to-day transactions, bank feeds, VAT | Xero, QuickBooks, FreeAgent, Sage |
| Accounts Production + Tax Filing | Trial balance → statutory accounts → HMRC/CH submission | TaxCalc, BTC Software, IRIS, Taxfiler |
| Practice Management | Deadlines, reminders, job tracking, client CRM | Karbon, Senta/XPM, TaxDome, Accountancy Manager |

**Prompt sits firmly in Layer 3.** The trend is toward "best of breed" stacks (separate tools for each layer) rather than monolithic suites.

### Competitor Detail

**QuickBooks (UK):** Bookkeeping tool with filing bolted on. VAT MTD: yes. CT600: yes, via Pro Tax (accountant-only). Self Assessment: no. Accounts production via Workpapers — relatively new, many accountants still use separate software.

**BTC Software:** Pure compliance/filing tool — no bookkeeping. CT600, SA100, partnership, trust returns: full preparation + direct HMRC submission. Companies House: full accounts production with auto iXBRL + direct submission. Pricing from ~£38/month. Target: small practices (sole practitioners, firms <10 staff).

**VT Software:** Budget hybrid — bookkeeping (VT Transaction+) + accounts production (VT Final Accounts as Excel add-in). Companies House: generates iXBRL + submits via VT Filer. CT600: cannot file — must pair with TaxCalc/BTC/Taxfiler. Pricing: £90-175/year. Known for being simple, reliable, Excel-based.

---

## 3. Phase 4 — Client Portal: GDPR & Privacy Analysis

### Financial Data Is NOT Special Category Data

Under UK GDPR Article 9, special category data is an exhaustive list: racial/ethnic origin, political opinions, religious/philosophical beliefs, trade union membership, genetic data, biometric data, health data, sex life, and sexual orientation.

**Financial data (P60s, bank statements, tax records) is explicitly NOT on this list.** The ICO states: "While other data may also be sensitive, such as an individual's financial data, this does not raise the same fundamental issues and so does not constitute special category data."

However, the ICO considers financial data "sensitive in practice" — requiring stronger-than-baseline security measures.

### Data Controller vs Processor Roles

- **The accounting firm** (Prompt's customer) = **data controller** (determines purpose and means of processing)
- **Prompt** (the SaaS platform) = **data processor** (processes on behalf of the firm)
- This dual role is standard for SaaS but creates specific obligations

### Token-Based Upload Portal: Viable with Controls

The proposed approach — unique time-limited link sent by email, no login required, upload-only — has market precedent:

- **Karbon** uses magic links for client requests (device-bound, 30-day expiry)
- **MyDocSafe** (UK-based, ISO 27001) offers no-login upload links marketed to accountants
- **ACCA endorses** secure portals with audit trails as GDPR-compliant

**Key advantage: upload-only is inherently lower risk** than a full portal. If a link is compromised, the attacker can only upload files — they cannot view or download existing documents. This dramatically reduces breach impact compared to TaxDome/Karbon/Senta where clients access all their documents.

### Required Security Measures

- **Short token expiration:** 24-72 hours (not 30 days like Karbon)
- **TLS in transit, AES-256 at rest:** Supabase Storage handles this
- **Audit logging:** Every upload and access attempt logged
- **Data Processing Agreement:** Mandatory under Article 28 with each accounting firm
- **Breach notification procedures:** Financial data breaches are high-priority for ICO reporting

### Recommended Additional Controls

- **Device binding:** Lock the token to the first device that uses it
- **Secondary verification:** Client enters postcode or DOB (pre-configured by accountant)
- **Single-use tokens:** Each upload session generates a new token
- **Upload-only scope:** Never expose existing documents via the same link

### Professional Body Position

None of the three professional bodies (ICAEW, ACCA, AAT) prescribe a specific authentication method. They are outcome-based: encryption, access controls, audit trails, documented procedures. A well-designed token upload system with the controls above meets their standard.

### Timing Assessment

**Build Phase 4 in its current roadmap position (after Phases 1-3), not earlier:**

- Phase 1 (multi-tenancy) provides the org-scoped infrastructure
- Phase 2 (privacy policy) defines the compliance boundaries — write it knowing Phase 4 is coming
- Phase 3 (document storage) builds the Supabase Storage infrastructure the portal will use
- By Phase 4, there will be paying customers whose feedback shapes the feature

**The portal doesn't require credibility in tax/filing.** It's a workflow/logistics feature ("we'll chase your clients for documents"), not a professional competence claim. Accountants don't need to trust Prompt's tax knowledge for this.

### Conclusion

Concerns do NOT outweigh opportunity. The GDPR position is solid, the market approach has precedent, and the upload-only design limits breach impact. The work needed (DPA, security measures, audit logging) is standard SaaS compliance, not exceptional.

---

## 4. AI in UK Accounting Software: Current Landscape

### What's Shipped (2025-2026)

| Product | AI Features Shipped | Focus |
|---------|-------------------|-------|
| **TaxDome** | Auto-tagging/categorising documents, AI-powered reporting analytics | Document management, reporting |
| **Karbon** | Email summarisation, prioritisation, drafting; practice intelligence analytics | Communication, workflow |
| **Xero (JAX)** | Agentic AI — auto bank reconciliation, data entry, payment chasing, natural language queries | Bookkeeping automation |
| **QuickBooks/Intuit** | 6 AI agents (accounting, payments, customer, finance, payroll, sales tax). 3M+ users | SMB automation |
| **Sage Copilot** | Conversational AI across Sage products, close automation, AP automation | Mid-market finance |
| **IRIS** | Tax anomaly detection (compares 2 years of returns, flags differences) | Tax compliance |
| **Dext** | 99.5%+ extraction accuracy on invoices/receipts, AI line item extraction, AI agent (beta) | Document extraction |

### What's Announced/Beta

- **Karbon AI Agents (2026):** Autonomous "teammates" — Bookkeeper Agent, Tax Admin Agent, Fractional CFO Agent, Client Onboarding Specialist. "Ask Karbon" natural language interface
- **Xero Partner Hub:** AI for practice management (XPM users), expected early 2026
- **Intuit Business Tax Agent:** Automated tax preparation (beta)

### What Accountants Actually Want

**Karbon State of AI 2026 (nearly 600 respondents):**
- 98% of firms use AI
- Average savings: 60 minutes/day per employee
- 82% say AI positively impacts collaboration and client relationships
- Data security concerns at 83% (up 7% YoY)

**Wolters Kluwer UK Survey (100 UK accountants):**
- Top use: Drafting reports/summaries/client communications (70%)
- Top concern: Result accuracy (43%), data security (42%)

**Top time sinks accountants want solved:**
1. Chasing clients for records (51% say least enjoyable task)
2. Bank reconciliations and expense coding
3. Invoice processing
4. Compliance deadline tracking
5. Data collection for tax returns
6. Repetitive client communications

### Market Gaps (as of February 2026)

| Gap | Current Status |
|-----|---------------|
| Predictive client behaviour (who'll be late?) | Nobody shipping this |
| Intelligent adaptive client chasing | Nobody (basic reminders only) |
| UK-specific tax document extraction (P60, SA302) | Not well-served (Dext/AutoEntry focus on invoices/receipts) |
| Cross-practice "Google-like search" | Cited as top want, nobody shipping |
| AI-native practice management for small UK firms | Nobody (IRIS slow, Karbon/TaxDome US-centric) |
| Capacity planning / workload prediction | Data fragmentation prevents it |

### Key Insight

AI is no longer a differentiator in itself (98% of firms use it). The differentiator is **how deeply and contextually** AI is integrated, and whether it solves a specific painful problem better than alternatives. The cautionary tale: Botkeeper raised ~$90M, put AI at the centre of their pitch, shut down February 2026 after 11 years.

---

## 5. AI Opportunities for Prompt: Ranked

*This section was revised in February 2026 after deeper analysis of the scheduling system and document pipeline. The original ranking is preserved in git history.*

### Key revision: why intelligent chasing fell

The original #1 ranking for adaptive client chasing assumed that a responsive client would be burdened with unnecessary reminders under a fixed schedule. This is wrong once you account for the auto-pause mechanism: when all required documents are uploaded, `records_received_for` is auto-set and the reminder queue stops. A responsive client who submits at week 8 receives 2 emails and nothing further. A difficult client who submits the week before the deadline receives the full sequence. The differentiation happens automatically through the client's own behaviour — AI adaptive timing adds very little on top of this.

What remains from the original "intelligent chasing" case is entirely rules-based and does not require AI: a non-engagement alert (client has received N emails, opened none, deadline is approaching — flag to accountant to call), and a risk dashboard sorted by deadline proximity and activity signals. These are Phase 6 features but they are product work, not AI work.

---

### #1: Document Verification — checking uploads against what was requested

**The highest-value AI opportunity.** This is accountant-facing, not client-facing — a critical distinction from the "Full AI Document Review" concept in the original ranking.

When a client uploads files to the portal, the accountant currently has to open each one manually to verify it is what was requested, for the right tax year, and apparently complete. A practice with 200 clients approaching Self Assessment deadline could be opening hundreds of PDFs to do basic triage. AI eliminates this triage layer.

**What the accountant sees before opening a single file:**

> **P60 received ✓** — Tax year 2023-24 · Employer: Tesco Stores Ltd · PAYE ref: 123/AB456
> **Bank statement received ✓** — 3 pages · Period: Oct–Dec 2024
> **⚠ P60 received but tax year is 2022-23** — Client was asked for 2023-24. Please check.
> **⚠ PDF received — could not classify** — Please verify this matches a requested document.

The accountant resolves issues at summary level and only opens files that need attention. Simple errors (wrong year, wrong document) are caught before the accountant has invested time reviewing the content.

**Privacy position:** Excellent. The document is already on Prompt's server. Processing it to generate an internal summary for the accountant is within the existing data processing relationship — no different from generating a thumbnail or reading metadata. No disclosure to the client is needed because the output is internal only. No DPA complications beyond what already exists.

**Implementation in layers — no third-party AI required for the high-value cases:**

- **Layer 1 — Rules (zero AI):** File type check, file size (suspiciously small = potentially blank), page count against expected range. The `classification_confidence` field on `client_documents` already exists as the hook for this.
- **Layer 2 — Server-side OCR (no third-party API):** P60s, P45s, and SA302s have rigid fixed-format HMRC layouts. Open-source OCR (Tesseract) can locate tax year, PAYE reference, employer name, and NI number fields reliably. Processing happens on Prompt's own infrastructure — no data leaves the platform. This covers the most common SA100 documents and produces the highest-value verifications.
- **Layer 3 — Third-party vision model (conditional):** For documents that don't match a known HMRC template, a vision model (Claude or GPT-4o) can attempt classification and description. Requires a DPA and disclosure in the privacy policy: *"Uploaded documents may be analysed by an AI system to assist your accountant in reviewing submissions."* Requires an opt-in toggle per organisation. Build only after Layers 1-2 are in place and demand for broader coverage is confirmed.

Layers 1-2 cover P60s, P45s, SA302s, and basic file integrity — the most common cases — without any third-party dependency.

**Why this ranks first:** It directly removes a repetitive manual task from the accountant's day, it is architecturally clean (builds on the existing `classification_confidence` field and document pipeline), and the highest-value implementation requires no external AI provider.

---

### #2: HMRC Correspondence Parsing

**A genuinely new opportunity not in the original analysis.**

Accountants receive letters from HMRC on behalf of clients: enquiry openings (code 9A), compliance check requests, penalty notices, coding notices. Today these sit in physical or email inboxes with no systematic tracking. Each one has a response deadline, a client reference, and a required action — and missing an HMRC enquiry deadline is one of the most costly mistakes a practice can make.

If the accountant forwards an HMRC letter to Prompt's inbound email address (already exists as infrastructure), AI extracts:
- Which client the letter relates to (match on UTR, NI number, or company number)
- Type of correspondence (enquiry, penalty, coding notice, confirmation)
- Response deadline if stated
- Key reference number

This creates a task linked to the right client record with a deadline. No competitor does this automatically. HMRC enquiries are high-stress, high-value moments where Prompt adds real value precisely when the accountant needs it most.

**Privacy position:** Good. These letters are already in the accountant's possession as part of their engagement. The accountant is actively choosing to forward specific letters. No client-initiated action; no client data going anywhere new.

**Implementation:** The inbound email infrastructure already exists. The AI task (extract structured fields from a formal HMRC letter) is well-suited to a language model — HMRC correspondence follows predictable formats. Requires a DPA with the AI provider and disclosure in the privacy policy.

---

### #3: AI-Drafted Client Communications

**Meets a proven demand and keeps sensitive data on-platform.**

70% of UK accountants already use AI (ChatGPT, Copilot) for drafting client communications. The problem: they are copying client names, deadlines, and sometimes financial figures into ChatGPT to do it. This creates a DPA gap — client data going to a third party without a formal processing agreement in place with that provider for each client.

Prompt already holds all the structured context: client name, filing type, deadline, records received status, documents on file. An in-product drafting tool that uses this context to generate a communication draft — with the accountant reviewing and editing before sending — keeps everything within the platform and within the existing DPA framework.

**Types of communication this covers:**
- Filing confirmation letters: *"Your Self Assessment for 2023-24 has been submitted. Your tax liability is [accountant fills in figure]. Payment is due 31 January 2025."*
- Deadline reminder drafts for clients the accountant wants to contact personally
- Explanatory covering notes for HMRC query responses (feeds naturally from #2 above)
- Year-end summary letters confirming what was filed and key figures

**What AI does not do:** Fill in financial figures. Those remain manually entered by the accountant. AI provides structure, tone, and boilerplate from the structured data Prompt already holds. The accountant verifies and completes before anything is sent. Nothing is auto-sent.

**Why this matters for the product:** It addresses a genuine workflow gap (accountants drafting comms outside the platform) and brings that work inside Prompt, increasing daily engagement and stickiness. The DPA compliance angle is a legitimate selling point for cautious firms.

---

### #4: Practice Workload Forecasting

**Low complexity, high usefulness, mostly rules-based.**

Prompt knows every deadline for every client. Aggregating these into a forward workload view is trivial technically but genuinely useful operationally — a sole practitioner or small firm needs to know that January is going to be overwhelming so they can start chasing clients earlier in the autumn and plan around holidays.

**What the accountant sees:** A monthly breakdown of upcoming filing deadlines across all clients for the next 6 months, with the heaviest months highlighted. Optionally, a natural language narrative generated by AI: *"January 2026 is your heaviest month — 47 Self Assessment filings are due. Based on your current records-received rate, 12 clients are still outstanding. Consider starting SA chasing 2 weeks earlier for your larger clients."*

The core workload view requires no AI at all — it is a simple aggregation of deadline data that already exists. The AI component (narrative, recommendations) is an optional layer on top.

---

### #5: Natural Language Practice Queries (Phase 7)

Chat interface for querying practice data: *"How many clients have CT600 outstanding?"*, *"Which emails go out this week?"*, *"Who hasn't sent their SA documents yet?"*

This matches what Karbon, Xero, and Sage are building. It is a table-stakes feature for a modern practice management tool but does not differentiate Prompt from competitors — everyone is shipping this. The value is real (saves navigating to specific screens for routine lookups) but it is not the primary AI investment. Build it as Phase 7 on top of the mature data model.

---

### Removed from ranking: Adaptive chasing and inbound email intelligence

**Adaptive chasing:** The auto-pause mechanism (records auto-received when all documents uploaded) does the differentiation work. Responsive clients exit the sequence early regardless of the schedule. Adaptive AI timing on top of this is marginal in impact and significant in complexity. The rules-based non-engagement alert (client hasn't opened anything, deadline approaching — flag to accountant) captures the genuine value without a model. Descoped as an AI opportunity.

**Inbound email intelligence:** The basic version is already built (keyword detection on inbound emails, auto-update of `records_received_for`). As the portal becomes the primary submission channel, the volume of email-first submissions will decline. Marginal improvement via AI (better classification of document type in the email body) is not a priority. The existing detection is sufficient.

**Full client-facing AI document review:** Still problematic for the reasons in section 7 below — accuracy risk creating false confidence, professional liability concerns, and a simpler alternative (checklist self-confirmation) covering 80% of the value at zero risk. Not ranked because the accountant-facing verification (#1 above) is a strictly better version of the same underlying capability.

---

### Summary Table

| Priority | AI Feature | Third-party AI? | Privacy overhead | When |
|----------|-----------|----------------|-----------------|------|
| 1 | **Document verification** — check uploads against request, extract tax year/type | Layer 1-2: no. Layer 3: yes | Minimal (internal output only) | Phase 6 |
| 2 | **HMRC correspondence parsing** — extract deadline, client, action from forwarded letters | Yes (DPA required) | Low (accountant-forwarded, internal output) | Phase 6 |
| 3 | **AI-drafted client communications** — structure and boilerplate; accountant adds figures | Yes (DPA required) | Managed (data stays on platform) | Phase 6/7 |
| 4 | **Practice workload forecasting** — forward deadline load, capacity planning | Optional | None | Phase 6 |
| 5 | **Natural language practice queries** — "who's outstanding for CT600?" | Yes (DPA required) | Low | Phase 7 |
| — | Adaptive chasing | — | — | Descoped |
| — | Inbound email intelligence | — | — | Largely done (keyword detection) |
| — | Client-facing document review | — | — | Conditional on demand only |

**The revised pattern:** The highest-value AI is about reducing accountant triage work (document verification, correspondence parsing) and keeping accountant workflows inside the platform (communication drafting). Scheduling intelligence was overstated — the auto-pause mechanism already does what adaptive AI was supposed to do.

---

## 6. Phase 6 — AI Agent Interface: Re-evaluation

### Current Design

A chat interface where accountants query and update client data using natural language: "How many clients have CT600 outstanding?", "Mark John Smith's VAT return as records received."

### Assessment

**Strengths:**
- Natural language querying is a clear industry trend (Karbon's "Ask Karbon", Xero's JAX, Sage Copilot)
- Technically straightforward with tool-calling APIs (Claude/GPT-4)
- Low risk (read-only queries against own data, no external document processing)
- Accountants like it for quick lookups

**Weaknesses:**
- **Convenience feature, not a pain-point solver.** The accountant can already see their dashboard. Chat saves seconds, not hours
- **Every competitor is building this.** Karbon, Xero, Sage, Intuit all have or are shipping natural language interfaces. No differentiation
- **Requires mature data model to be useful.** With 20 clients, it's faster to look at the dashboard. Only shines at scale
- **Ongoing AI cost per query.** For a small practice tool, margin impact matters

### Recommendation

**Keep Phase 6 but recognise it as "matching competitors" not "beating competitors."** The real AI differentiation is in Phase 4 (smart chasing + prediction).

**Consider merging the chat concept into Phase 4's chasing workflow** rather than building a standalone chat interface. Instead of a generic "ask anything" chat, make it a focused assistant for the chasing workflow:
- "Show me who's at risk of missing their CT600 deadline"
- "Draft a personal follow-up to Sarah Jones — she's ignored 3 automated chases"
- "What records am I still waiting on from my limited company clients?"

This is more valuable than a generic data query tool because it's tied to the specific workflow where accountants spend most of their time.

---

## 7. AI Document Review: Analysis & Recommendation

### The Idea

Client uploads documents to the portal. AI immediately reviews them and provides instant feedback: "Your P60 appears to be missing page 2" or "We need bank statements for months 4-6 which are not included."

### GDPR Position

- Financial data is NOT special category data — simplifies the position
- AI giving advisory feedback is NOT automated decision-making under Article 22 (it's guidance, not a binding decision)
- Both Anthropic and OpenAI offer DPAs, don't train on API data, and offer EU/UK regional processing
- UK-US Data Bridge (effective October 2023) provides lawful transfer mechanism
- A DPIA would be required (AI + financial data hits ICO's high-risk threshold)
- Explicit transparency needed at upload point: "your documents will be reviewed by an AI system"

### Practical Concerns (More Significant Than GDPR)

1. **Accuracy risk:** If AI says "everything looks good" but the P60 is missing page 2, the client stops uploading. The accountant discovers the gap weeks later near the deadline. A false negative is worse than no AI at all because it creates false confidence

2. **Professional liability:** If wrong AI feedback leads to a missed deadline, the accounting firm is liable. Many PI insurers have "Silent AI" coverage gaps. ICAEW's top PI claims include "failure to meet a deadline"

3. **The simpler alternative covers 80% of the value with 0% of the risk:** Checklists where the client ticks "I have uploaded my P60" catches missing document categories without reading any content

### Recommended Layered Approach

| Layer | What It Does | Privacy Risk | Complexity | When |
|-------|-------------|-------------|-----------|------|
| Rules-based | File type, size, page count, duplicates | None | Low | Phase 4 launch |
| Checklist | Client self-confirms what they've uploaded | None | Low | Phase 4 launch |
| Local OCR | Template-match known docs (P60, P45) server-side | Minimal (no third party) | Medium | Phase 4 v2 |
| AI review | Full content analysis for completeness | High (DPA, DPIA, consent) | High | Phase 4 v3, only if demand warrants |

### Conclusion

Build layers 1-2 at Phase 4 launch. Add layer 3 (server-side OCR for known UK document types) after launch — this fills a genuine market gap since Dext/AutoEntry don't cover P60s/SA302s. Only add layer 4 (full AI review) if customer feedback demonstrates clear demand and the privacy infrastructure (DPA, DPIA, PI insurance confirmation) is in place.

**The most valuable AI document feature isn't validation (checking completeness) — it's extraction (pulling structured data from P60s/SA302s and pre-populating the accountant's workflow).** This is where the market gap is.

---

## 8. Competitor Software Overview

### Practice Management Tools (Prompt's direct competitors)

| Tool | AI Features | Client Portal | Target Market | Pricing |
|------|-----------|--------------|--------------|---------|
| **Karbon** | Email summarisation/drafting/prioritisation, practice intelligence, AI agents (2026) | Magic links, device-bound, 30-day expiry | Global (US-centric development) | Premium |
| **TaxDome** | Document auto-tagging, AI-powered reporting | Full account with email/password + MFA, SOC 2 Type II | Global (US-centric) | Mid-range |
| **Senta (IRIS)** | Limited (tax anomaly detection via IRIS) | Email/password or Google login | UK-focused | Mid-range |
| **Accountancy Manager** | None significant | Basic | UK-focused | Budget |

### Filing/Compliance Tools (adjacent, not competitors)

| Tool | What It Does | AI Features |
|------|-------------|-------------|
| **BTC Software** | CT600, SA100, accounts production, iXBRL, Companies House filing | None significant |
| **TaxCalc** | CT600, SA100, accounts production, iXBRL | None significant |
| **VT Software** | Bookkeeping + accounts production (Excel-based). Cannot file CT600 | None |

### Bookkeeping Tools (upstream in the workflow)

| Tool | AI Features |
|------|-------------|
| **Xero** | JAX (agentic AI): bank reconciliation, data entry, payment chasing, natural language queries |
| **QuickBooks** | 6 AI agents: accounting, payments, customer, finance, payroll, sales tax |
| **Sage** | Sage Copilot: conversational AI, close automation, AP automation |
| **FreeAgent** | Limited (AI expense management partnership) |

### Document Processing Tools

| Tool | Accuracy | Focus | AI Capability |
|------|---------|-------|--------------|
| **Dext** | 99.5%+ | Invoices, receipts | AI line item extraction, AI agent (beta) |
| **AutoEntry** | ~99% | Invoices, receipts, bank statements | Standard OCR |
| **Hubdoc (Xero)** | ~99% | Invoices, receipts | Stagnating since Xero acquisition |

**Gap:** None of these cover UK-specific tax documents (P60, P45, SA302).

---

## 9. Bootstrapping Predictive Data: Historical Email Import Analysis

### The Cold Start Problem

The highest-value AI feature — adaptive client chasing with predictive risk scoring — requires behavioural data: how quickly each client responds, how many chases they need, when in the cycle they typically engage. Without data, "intelligent chasing" is just regular chasing with a marketing claim.

The default approach (collect data through the portal over time) means waiting 12+ months for a full tax season before the AI becomes useful. This raises the question: could accountants import their historical email data to bootstrap the model from day one?

### The Concept

Accountants have years of email correspondence with clients. Those emails contain exactly the patterns the predictive model needs:

- When the accountant first asked for records
- How many follow-ups were sent before the client responded
- Response times per client across multiple seasons
- Seasonal patterns (clients who always submit late in January)
- Which clients ignore emails but respond to specific subject lines

If Prompt could ingest this history, the predictive model would be bootstrapped immediately with years of real behavioural data rather than starting from zero.

### Technical Feasibility

**This is very feasible from a technical standpoint.** Modern LLMs are excellent at understanding email threads and extracting structured data. The patterns to extract are straightforward:

- Date accountant first asked for records
- Number of follow-ups sent
- Date client eventually responded (or didn't)
- Time of year / which filing type was involved
- Tone escalation patterns
- Whether the client responded to the accountant or to an automated reminder

Across a few hundred email threads per client over 2-3 years, a rich behavioural profile emerges almost immediately.

**Integration options:**
- OAuth with Gmail (Google Workspace) and Microsoft 365 (Outlook/Exchange)
- PST/MBOX file export and upload
- Forwarding specific threads to a Prompt inbox

### Why It's Appealing

- **Instant value on onboarding.** "Connect your email and we'll tell you which 10 clients are most likely to be late this Self Assessment season" — compelling first-use experience
- **Predictive from day one.** No waiting a full tax cycle
- **Rich signal.** Years of history is far more data than one season of portal usage
- **Differentiator.** No competitor is doing this

### Why It's Problematic

#### Privacy: This Is Heavy

This is a fundamentally different proposition from the upload portal. Processing years of unstructured client correspondence through an AI model means:

- **Every email contains personal data** — client names, financial details, personal circumstances, possibly attachments with bank details and tax figures
- **Purpose limitation (GDPR principle).** Those emails were sent for accountant-client communication, not for AI behavioural analysis. Using them for a different purpose requires either a compatible lawful basis or fresh consent from the data subjects (the clients themselves)
- **The clients don't know Prompt exists.** When a client emailed their accountant about Self Assessment in 2024, they had no expectation that email would be processed by an AI system in 2026. Even if the accountant's engagement letter covers "using software to manage your affairs," feeding historical emails into a third-party AI for behavioural profiling is a stretch
- **Volume of sensitive data.** Potentially thousands of emails containing financial details going through an AI provider's API. Even with DPAs and no-training guarantees, this is a large attack surface
- **DPIA almost certainly required.** New technology + large-scale processing + financial data + repurposing of data = mandatory DPIA under ICO guidance

Compare to the portal approach: the portal processes one document at a time, uploaded by the client themselves, with clear consent at the point of upload. Email import processes years of correspondence that the client never consented to being AI-analysed.

#### Trust: The Onboarding Paradox

The feature asks accountants to hand over their entire client email history to a SaaS product they've just signed up for. This is a huge trust ask at the exact moment trust is lowest — they haven't used the product yet, don't know if it's reliable, don't know how data is handled.

This is the opposite of how trust-building works. Ask for the minimum on day one; earn the right to ask for more.

#### Technical Complexity

- **Two email APIs.** OAuth with Google Workspace and Microsoft 365 — different auth flows, different data formats, different approval processes. Google's OAuth approval for apps that read email content requires a security audit
- **Parsing quality.** Real email threads are messy — mixed topics, CC'd people, forwarded chains, signatures, disclaimers, auto-replies. Isolating "record chasing" conversations from general correspondence works ~80% of the time and produces noise ~20%
- **Client matching.** Email addresses must be mapped to clients in Prompt. Clients use personal and work emails interchangeably, sometimes have multiple addresses, sometimes emails come from a spouse or PA
- **Processing cost.** Thousands of emails through an LLM API is not cheap. A practice with 200 clients and 3 years of history could have tens of thousands of relevant email threads

### Lighter Alternatives That Solve the Cold Start Problem

#### Option A: Accountant Self-Report (Recommended for Launch)

During client setup in Prompt, ask the accountant to rate each client:

- "How responsive is this client typically?" (Very responsive / Average / Needs chasing / Very difficult)
- "How many follow-ups do they usually need?" (0 / 1-2 / 3-5 / 5+)
- "When do they typically submit records?" (Well before deadline / Close to deadline / After deadline)

**Zero privacy overhead.** The accountant knows their clients — they've been dealing with them for years. This takes 30 seconds per client and provides a useful starting signal for the adaptive chasing algorithm. No email access, no AI processing, no GDPR concerns.

Frame it as part of client setup: "Tell us about this client so we can personalise their reminder schedule."

#### Option B: Email Metadata Only (No Content)

Connect email via OAuth but only extract **metadata**: dates, subject lines, sender/recipient, response times. Never read the email body.

- Subject lines like "RE: RE: RE: Self Assessment Records Needed" reveal the client needed 3 chases
- Timestamps between accountant's email and client's reply give response time
- Seasonal patterns emerge from dates alone
- **Massively reduced privacy exposure** — processing email headers, not content
- No need to send anything to an AI provider — pure timestamp/pattern analysis on Prompt's own infrastructure

This gives response time patterns and chase frequency without reading a single email body.

#### Option C: Forward Specific Threads

Let accountants forward specific chase email threads to a dedicated Prompt email address. The system reads that one thread and extracts the chasing pattern.

- **Opt-in, per-thread.** The accountant controls exactly what's shared
- **Self-selecting for relevance.** They'll forward the frustrating chasing threads — exactly the ones worth learning from
- **Lower volume.** Dozens of threads, not thousands
- **Weaker privacy concern.** The accountant is actively choosing to share specific emails with a tool they're using to manage that client

#### Option D: Connect and Learn Going Forward

Instead of importing historical emails, connect to the accountant's email going forward (via OAuth) and learn in real-time. When the accountant sends a chase email via their normal email client, Prompt detects it (by subject line, recipient matching, or accountant tagging). When the client replies, Prompt records the response time.

- No historical data processing
- Real-time learning from natural behaviour
- The accountant doesn't change their workflow
- Data accumulates naturally but faster than portal-only (captures email-based chasing too, not just portal interactions)

### Recommended Progression

| Stage | Approach | Data Quality | Privacy Overhead | Trust Required |
|-------|----------|-------------|-----------------|---------------|
| Phase 4 launch | Accountant self-report per client | Low-medium (subjective but useful) | None | None |
| Phase 4 v2 | Email metadata connection (dates, subjects, no content) | Medium-high | Low (no content processed) | Medium |
| Phase 4 v3 | Real-time email monitoring | High (learns from actual behaviour) | Medium | High |
| Long-term | Historical email import with AI parsing | Very high | Very high | Very high |

### Conclusion

The self-report approach is underrated. Accountants know exactly which clients are difficult. Asking them to encode that knowledge during client setup is fast, free, and private. It won't be as precise as AI-parsed email history, but it's enough to differentiate chasing schedules from day one: difficult clients get earlier, more frequent reminders; responsive clients get lighter-touch sequences.

The full email import idea isn't bad — it's premature. It's the kind of feature to offer established customers who already trust the platform, not new sign-ups on day one. By Phase 4 v3, customers will have been using Prompt for a year, trust the platform, and would willingly connect their email for better insights. That's the right moment to ask.

The metadata-only approach (Option B) is the sweet spot for Phase 4 v2 — it captures most of the behavioural signal (response times, chase frequency) with minimal privacy exposure and no AI processing costs.

---

## 10. Key Decisions & Conclusions

### Strategic Position

Prompt is a **practice management tool** (Layer 3). It should not attempt to be an accounts production or tax filing tool (Layer 2). The value is in tracking deadlines, chasing clients, and managing workflow — not in preparing or filing returns.

### The iXBRL / CT600 Question

Building iXBRL accounts production would be a multi-year project requiring deep accounting expertise, FRS 102 knowledge, taxonomy mapping, and ongoing tax law maintenance. Companies like BTC Software have been building this for 20+ years. **This has been removed from the roadmap (previously Phase 6).** A partnership/integration approach with an existing CT filing provider is the practical alternative if demand warrants it.

### Where AI Creates Maximum Value

**Phase 4 (Client Record Collection & Chasing Portal) is the AI centre of gravity.** Nearly all high-value AI opportunities live here:

1. Adaptive client chasing that learns per-client behaviour patterns
2. Predictive risk scoring for deadline compliance
3. Inbound email intelligence (auto-detecting records arriving by email)
4. UK tax document OCR/extraction (P60, SA302 — a market gap)
5. AI-drafted personalised follow-up emails

**Phase 6 (AI chat interface) is a "match competitors" feature, not a "beat competitors" feature.** Worth building eventually, but not the primary AI investment.

### Phase 4 Build Strategy

1. **Launch:** Rule-based chasing + checklists + basic validation. No AI. Collect behavioural data. Zero privacy overhead
2. **v2 (after first tax season):** Adaptive chasing sequences, risk prediction, server-side OCR for UK tax documents, deadline risk dashboard
3. **v3 (if demand warrants):** Optional AI document review with full consent flow, DPA, DPIA

### The Data Moat

Prompt's long-term AI advantage is **proprietary behavioural data on client responsiveness.** After one tax season, Prompt will know: which clients respond to which type of chase, at what timing, through what channel. This data compounds each season and is impossible for competitors to replicate without the same client chasing infrastructure. This is the moat.

---

*Last updated: 21 February 2026*
