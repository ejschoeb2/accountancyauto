# Future Development Roadmap

This document outlines the planned development phases beyond the current foundation (reminder engine, delivery system, and dashboard). Each phase builds on the previous, with the ordering chosen to minimise risk and ensure the right infrastructure and compliance groundwork exists before more complex features are introduced.

---

## Phase 1 — Multi-Tenancy & Onboarding

**Goal:** Transform the application from a single-firm tool into a platform that can serve multiple independent accounting practices, each with full data isolation.

### What This Involves

**Database restructuring** — An `organisations` table is introduced as the root entity. Every existing table (clients, reminders, email logs, etc.) gains an `org_id` foreign key. All Supabase Row Level Security (RLS) policies are rewritten to scope every query to the authenticated user's organisation, making cross-tenant data access impossible at the database level.

**Authentication & user management** — Users belong to an organisation. The sign-in flow becomes org-aware: a user logs in and their session is scoped to their firm. Firms need the ability to invite additional team members (e.g. a junior accountant alongside the principal), with role-based access if needed (admin vs. standard user).

**Onboarding flow** — A new firm signing up needs a guided setup experience: create organisation, enter firm details, configure default reminder settings, and invite team members. This is the first thing a new customer sees and sets the tone for the product.

**Billing integration** — Multi-tenancy only makes commercial sense with a subscription model. Stripe is the standard choice: monthly billing per firm, free trial period, and a billing management page within the app. This should be implemented in this phase so the infrastructure is ready when the marketing site launches.

**Super-admin view** — A separate, protected internal view for managing all tenants: see active firms, handle billing issues, and monitor overall system health. Not customer-facing but essential for operating the platform.

### Why This Comes First

Every subsequent phase depends on data being scoped to an organisation. Building document storage, AI features, or HMRC integrations on a single-tenant foundation would require a painful, risky retrofit later. This is the hardest phase architecturally but the right one to do first.

### Note on HMRC APIs

After completing this phase, it is worth discussing with the accountant whether HMRC API integration should be brought forward. It is a strong marketing differentiator (MTD-compatible software) and knowing clients' appetite for it early will inform the marketing site messaging. See Phase 5 for full details.

---

## Phase 2 — Marketing Frontend & Privacy Policy

**Goal:** Create a public-facing presence that explains the product, attracts new accounting firms, and establishes the legal and compliance framework required before more sensitive features (document storage, client data collection, HMRC API submission, AI) are built.

### What This Involves

**Marketing site** — A clean, professional static site targeted at small-to-medium UK accounting practices. Key pages:
- Landing page with value proposition and feature overview
- Features page with detailed breakdown of the reminder engine, dashboard, and upcoming capabilities
- Pricing page tied to the Stripe subscription tiers set up in Phase 1
- About page establishing credibility
- Contact / demo request form
- Sign-up flow that routes directly into the onboarded app

The site should be built with a separate deployment from the app itself (e.g. a static Next.js export or a dedicated site), so it can be updated independently without touching the application.

**Privacy Policy** — This is not a boilerplate checkbox. Given that subsequent phases introduce document storage (Phase 3), client data collection via a client-facing portal (Phase 4), HMRC API submission (Phase 5), and AI processing (Phase 6), the privacy policy must be written with full awareness of what is coming and establish clear commitments before those features go live. It must cover:

- What personal data is collected and why (lawful basis under UK GDPR Article 6)
- Email processing: inbound emails from clients, content logged and stored
- Document storage: what files are stored, where (EU-region Supabase), for how long (6 years in line with HMRC record-keeping requirements, per Article 17(3)(b) exemption)
- AI processing disclosure: that an in-app AI assistant (Phase 6) may process client names, statuses, deadlines, and counts to answer queries — no financial figures or document content is ever sent to the AI provider; a Data Processing Agreement must be in place with the provider before this feature is enabled
- Data Processing Agreements: confirmation that DPAs are in place with all third-party processors (Supabase, Postmark, and the AI provider when the AI agent feature is activated)
- Data Subject Access Requests: how clients can request their data and the 30-day response commitment
- Data breach procedure: notification to affected parties and the ICO within 72 hours
- ICO registration number (the practice must be registered; if not, do this before this phase launches — £40/year)
- Right to erasure: how clients can request deletion and the conditions under which it applies

**Terms of Service** — Covering acceptable use, liability limitations, and the firm's responsibilities as a data controller for their own clients' data.

**Cookie policy** — Required for analytics or any tracking on the marketing site.

### Why This Comes Second

The privacy policy written here defines the compliance boundaries for Phases 3 through 6. Building document storage, client portals, HMRC integrations, or AI features without this foundation means making implementation decisions that may not be legally defensible. Writing it first forces clarity on exactly what you are allowed to build and how.

---

## Phase 3 — Document Storage

**Goal:** Allow client-sent documents (received via inbound email) to be stored securely within the application, linked to the relevant client record, and accessible to the accountant at the point of submission — eliminating the need to search through email inboxes.

### What This Involves

**Supabase Storage setup** — A dedicated storage bucket with strict access policies. The bucket must be private (no public URLs). All access goes through the application layer, never directly to storage. The Supabase project must be confirmed to be in the EU West (Ireland) region for UK GDPR compliance.

**Attachment extraction on inbound email** — When a client email arrives via the Postmark webhook, any attachments are extracted and uploaded to Supabase Storage, organised by client and year: `/clients/{client_id}/{tax_year}/{filename}`. The file metadata (name, type, size, received date, storage path) is recorded in a `documents` database table, tagged with the client ID.

**Document type classification** — On ingest, attempt to classify the document type (P60, P11D, bank statement, SA return, etc.) based on filename patterns and, where possible, file metadata. This classification powers the workflow in later phases and makes DSAR responses straightforward.

**Client document UI** — Within the client detail view in the dashboard, a documents tab shows all stored files with received date, document type, and a download button. The download button generates a short-lived signed URL (e.g. 1-hour expiry) — direct storage URLs are never exposed.

**Submission workflow improvement** — On the client's compliance items (the existing HMRC/Companies House deadline cards), a "View Documents" panel shows relevant stored files alongside the existing "Take me to HMRC" button. The accountant can download the file and switch to the HMRC portal in one place, without touching their email.

**Audit logging** — Every document download is logged: who downloaded it, when, and which file. This satisfies ICO accountability requirements and provides a record if a DSAR or breach investigation is ever needed.

**Retention enforcement** — A scheduled job (Supabase Edge Function or cron) flags documents that have passed the 6-year retention period for review and deletion. Deletion must remove both the storage object and the database record.

**DSAR export** — A mechanism (even if initially manual) to pull all documents and data associated with a given client, enabling the practice to respond to Data Subject Access Requests within the statutory 30-day window.

**Email reply templates** — Rather than AI-generated replies, inbound emails will have a pre-loaded acknowledgment template that auto-fills client variables (name, document type if classified, relevant deadline). The accountant can edit before sending. This delivers the same time saving as AI drafting for routine acknowledgments with zero compliance overhead and no third-party API calls.

### Why This Comes Third

It is a contained, high-value improvement with clear compliance boundaries already defined in the privacy policy. It directly improves the accountant's daily workflow without introducing any dependency on external AI services.

---

## Phase 4 — Client Record Collection & Chasing Portal

**Goal:** A client-facing portal that allows accountants to request specific documents from their clients, track what has been provided, and automatically chase with escalating reminders until everything needed for a filing is received — closing the gap between "reminder sent to accountant" and "records received".

### Background: Why This Matters

The single biggest time sink for UK accountants is not preparing returns or filing them — it is chasing clients for the records needed to start the work. A practice with 200 clients approaching Self Assessment deadline may spend weeks sending manual emails, following up, and tracking who has provided what in a spreadsheet. The existing Peninsula system already knows *which* filings are due and *when*. This phase adds the ability to actively collect the data needed for those filings.

### What This Involves

**Filing-specific checklists** — Each filing type has a configurable checklist of documents/data the accountant needs from the client. Sensible defaults are provided:

- **Self Assessment:** P60/P45, bank interest certificates, dividend vouchers, rental income/expenses summary, self-employment income & expenses, pension contribution statements, Gift Aid records, student loan details, capital gains records
- **CT600 / Companies House Accounts:** Trial balance export, bank statements, loan agreements, fixed asset register, director loan account movements, share capital changes, payroll summaries
- **VAT Return:** Sales/purchase day books or bookkeeping export, bank statements for the quarter, any manual adjustments (bad debt relief, partial exemption calculations)

Accountants can customise checklists per client (e.g. a landlord client needs different Self Assessment documents than a sole trader).

**Client-facing upload portal** — A secure, branded page (no login required — accessed via a unique, time-limited link sent by email) where the client can:
- See what documents are needed and why (linked to the specific filing and deadline)
- Upload files against each checklist item
- Add notes or messages to their accountant
- See their progress (3 of 7 items provided)

The portal must be simple enough for non-technical clients. No app download, no account creation — just a link in an email.

**Automated chasing sequence** — When the accountant requests records from a client, the system sends an initial email with the portal link and begins a configurable chasing sequence:
- Initial request (e.g. 12 weeks before deadline)
- First follow-up if incomplete (e.g. 8 weeks before deadline)
- Second follow-up with urgency (e.g. 4 weeks before deadline)
- Final warning (e.g. 2 weeks before deadline)
- Overdue notice if deadline passes without records

The sequence pauses automatically when all checklist items are provided. Each email shows what is still outstanding, not the full list — so the client sees only what they still need to do.

**Accountant dashboard integration** — Within the existing Peninsula dashboard:
- A "Records Collection" view showing all active requests across clients
- Traffic light status per client: all received / partially received / nothing received / overdue
- Bulk actions: send requests to all clients with upcoming Self Assessment deadlines
- Automatic update of the existing "records received" toggle when all checklist items are uploaded

**File storage** — Uploaded files are stored in Supabase Storage (building on the infrastructure from Phase 3). Files are linked to the client, the filing type, and the specific checklist item.

**Notification to accountant** — When a client uploads documents, the accountant receives a notification (in-app and optionally by email): "John Smith has uploaded 3 documents for their Self Assessment — 2 items still outstanding."

### Technical Complexity

Medium. The core components are:
- Supabase Storage for file uploads (existing infrastructure from Phase 3)
- Unique token-based portal links (no client authentication needed)
- Email sequences via Postmark (extending the existing reminder engine)
- Checklist CRUD with per-client customisation
- Dashboard UI for tracking collection status

No HMRC APIs, no iXBRL, no accounting domain expertise required. The accountant defines what they need; the system handles the chasing and collection logistics.

### Market Context

This overlaps with features offered by **TaxDome** (client portal + practice management), **Senta/Xero Practice Manager** (automated client tasks), and **Dext** (receipt/document capture). TaxDome in particular has grown rapidly by combining practice management with a client portal. However, none of these are tightly integrated with a UK-specific filing deadline and reminder engine the way Peninsula is. The combination of "we know what's due, we chase the client for what's needed, and we track that it arrived" is a complete pre-filing workflow.

### Why This Comes Fourth

This is the highest-value expansion with the lowest technical risk. It solves a genuine daily pain point for accountants, requires no specialist tax knowledge to build, and is a natural extension of the existing reminder system. It builds on the storage infrastructure from Phase 3 and extends the Postmark email engine already in place. It also creates a direct relationship with the accountant's clients for the first time, which increases the platform's stickiness and opens future opportunities (e.g. the client portal could later show filing status, deadline reminders direct to clients, or payment collection).

---

## Phase 5 — HMRC API Integration

**Goal:** Allow the accountant to submit VAT returns (and eventually Self Assessment) directly from within the application, using HMRC's official Making Tax Digital APIs — eliminating manual portal logins for supported submission types.

### Background: What HMRC APIs Cover (and What They Don't)

Understanding the scope of this phase requires understanding two distinct categories of HMRC interaction:

**MTD form-submission APIs** — These are the APIs this phase targets. They accept structured data (VAT figures, income totals) and submit it directly to HMRC on behalf of a client. They are well-documented, have a sandbox environment, and are a realistic build target.

**iXBRL / Corporation Tax filing** — This is a completely different category and is explicitly out of scope. Filing a Corporation Tax return (CT600) requires submitting accounts and tax computations in Inline XBRL (iXBRL) format — a mandatory XML-based tagging standard that has been required by HMRC since April 2011. Generating valid iXBRL is not an API integration problem; it is an accounts production problem. Software like BTC Software, Iris, and Digita are built around this capability as their core product. Attempting to replicate it here would mean building a rival to established tax preparation software — a multi-year undertaking that is well beyond the scope of a practice management tool. This product correctly sits *alongside* that software: the accountant uses BTC or equivalent to file the CT600; they use this application to track that it is due, chase the client for records, and log that it has been submitted.

### What This Involves

**HMRC Agent Services Account** — The accounting practice must be registered with HMRC's Agent Services Account before any API integration is possible. This is an HMRC administrative process (not a development task) that can take several weeks and should be initiated well before this phase begins.

**MTD VAT API** — The first and most mature MTD API. Capabilities:
- Retrieve a client's VAT obligations (what returns are due and when)
- Submit a VAT return on behalf of a client
- View previously submitted returns and payment status

This directly replaces the current workflow of logging into the HMRC VAT portal, which currently appears as a "Take me to HMRC" link in the app. It is the strongest near-term marketing differentiator — many accounting practices are already mandated to use MTD-compatible software for VAT and will recognise the value immediately.

**OAuth 2.0 client authorisation** — This is the critical architectural decision that makes HMRC API integration safe. Rather than storing client credentials, each client authorises the software via HMRC's own OAuth flow: the accountant sends the client a link, the client logs into their HMRC account and grants permission, and the app receives an OAuth token. The client's credentials never pass through the application. Tokens are stored encrypted, scoped to a specific client and org, and refreshed automatically.

**MTD for Income Tax Self Assessment (ITSA)** — HMRC is phasing in mandatory MTD for ITSA from April 2026 (>£50k earnings) and April 2027 (>£30k). Quarterly update submission via API will be required for these clients. Building the VAT integration first establishes the OAuth and API patterns that ITSA reuses. Given the mandation timeline, this should be treated as a near-term priority once VAT submission is stable. See Phase 7 for the dedicated ITSA platform.

**Submission UI** — On the client's deadline card for VAT or Self Assessment, the current "Take me to HMRC" button is replaced (or supplemented) with a "Submit Return" flow: the accountant selects the period, reviews the figures (pulled from stored documents where possible), confirms, and submits. The submission reference returned by HMRC is logged against the client record.

**Sandbox testing** — HMRC provides a full sandbox environment. All integration work should be developed and tested against the sandbox before any live submissions are made.

### What Remains Out of Scope

- **Corporation Tax (CT600) filing** — Requires iXBRL accounts production. Out of scope entirely; a partnership/integration approach with an existing CT filing provider (e.g. BTC Software or TaxCalc) is a more practical alternative.
- **Companies House filing** — Separate API, separate registration, lower priority than MTD.
- **Payroll RTI submissions** — Out of scope entirely; a different category of software.

### Why This Comes Fifth

HMRC API integration is the most technically complex phase: OAuth flows, token management across multiple tenants, HMRC's own onboarding requirements, and the compliance burden of submitting official tax returns. By Phase 5, the multi-tenant architecture is stable, the practice is registered with HMRC agent services (initiated at the end of Phase 1), there are paying customers whose needs inform exactly which APIs to prioritise, and the document storage system means submission can be tied to stored source documents for a complete audit trail.

If customer feedback after Phase 1 indicates strong demand for this feature earlier, it is reasonable to bring it forward — it is a credible marketing differentiator, particularly as MTD for ITSA becomes mandatory.

---

## Phase 6 — AI Agent Interface (Long-Term)

**Goal:** An in-app conversational interface that allows the accountant to query and update their client data using plain English — removing the need to navigate to specific screens for routine lookups and status changes.

### What This Involves

**Chat UI** — A persistent chat panel or modal within the dashboard. The accountant types naturally: *"How many clients have CT600 outstanding?"*, *"Which emails are going out tomorrow?"*, *"Mark John Smith's VAT return as records received."* The interface shows the conversation history for the session.

**Tool calling architecture** — The AI does not have direct database access. Instead, a defined set of named tools is registered with the AI provider (Claude or GPT-4). When the model determines a tool is needed, it returns a structured call with parameters. Your server action executes the corresponding Supabase query — scoped to the authenticated user's `org_id` — and returns the result to the model, which then formulates the natural language response. The AI can never run arbitrary queries; it can only call tools you have explicitly defined.

Example tool set:
- `get_client_stats(filter?)` — counts and lists clients by status
- `get_scheduled_emails(date?)` — returns emails queued for a given date
- `search_clients(query)` — finds clients by name or reference
- `update_client_status(client_id, field, value)` — write operation (requires confirmation)
- `get_deadline_summary(period?)` — upcoming deadlines across all clients

**Write operations with confirmation** — Any tool that modifies data must go through an explicit confirmation step in the UI. The AI identifies the intended change, presents a summary card (*"Update John Smith's CT600 status to Records Received — confirm?"*), and only executes after the accountant clicks confirm. There is no path to an unconfirmed write.

**Security boundaries** — The `org_id` is taken from the server-side session, never from the user's message. It is injected into every tool call before execution. A user cannot prompt the AI to query another organisation's data.

**Context on every request** — Each API call includes lightweight context about the organisation (total client count, current date, user name) so the model can give useful answers without needing a tool call for basic questions.

**Rate limiting** — Per-organisation daily message limits to control API costs: aligned to the subscription tier (Practice and Firm tiers have higher limits). Usage shown in the UI so firms can see their consumption.

**Model selection** — Claude Haiku (or equivalent fast, low-cost model) for the majority of queries. The cost per conversation turn is negligible at ~£0.001-0.002, making this viable even for lower-tier plans. A DPA with the chosen AI provider must be in place before this feature is enabled — the same provider and agreement used for any other AI features in the application.

### What This Is Not

The agent cannot submit tax returns, send emails on behalf of the firm, or access document content. It is a read-and-status-update interface only. Any action involving HMRC submissions, client-facing communications, or financial figures remains the accountant's direct responsibility.

### Why This Comes Sixth

This feature requires multi-tenancy (for org scoping), a rich enough data model (built across Phases 1-5) to make the queries meaningful, and a mature enough privacy policy (Phase 2) to cover the data being shared with the AI provider. By Phase 6, the foundation is complete and the feature can be built cleanly on top of it. It is also the most differentiating capability relative to traditional practice management software — it is worth doing well rather than rushing.

---

## Phase 7 — MTD for Income Tax Self Assessment (ITSA) — Dedicated Platform

**Goal:** Build a dedicated, early-to-market MTD ITSA compliance capability — allowing accountants to manage and submit quarterly digital updates and end-of-period statements for self-employed clients and landlords as the HMRC mandate rolls out.

### Background: The ITSA Mandate

HMRC is phasing in Making Tax Digital for Income Tax Self Assessment on a mandatory basis:
- **April 2026:** Self-employed individuals and landlords earning over £50,000 must comply
- **April 2027:** Threshold drops to £30,000
- **Future:** Expected to drop further to £20,000 and eventually cover all self-employed taxpayers

Under MTD ITSA, affected taxpayers must:
1. Keep digital records of income and expenses
2. Submit **quarterly updates** to HMRC (cumulative income and expenses for the period)
3. Submit an **End of Period Statement (EOPS)** after the tax year ends, confirming the figures are complete
4. Submit a **Final Declaration** (replacing the current SA100 return) confirming the final tax position

This is a fundamentally new obligation — not a digitisation of the existing SA100 process, but a shift to quarterly reporting. Many accounting practices do not yet have software in place for it, and the incumbent bookkeeping tools (Xero, QuickBooks) will handle it for clients already using them — but many sole traders and landlords do not use bookkeeping software at all.

### What This Involves

**Client eligibility tracking** — Extend the existing client data model to identify which clients are affected by MTD ITSA:
- Income threshold tracking (above £50k, above £30k)
- Business type (self-employed, landlord, or both)
- NINO (National Insurance Number) for HMRC API identification
- MTD ITSA registration status

**Quarterly deadline management** — Peninsula already manages quarterly deadlines for VAT. ITSA quarterly deadlines follow a different pattern:
- Q1: 6 April – 5 July → deadline 5 August
- Q2: 6 July – 5 October → deadline 5 November
- Q3: 6 October – 5 January → deadline 5 February
- Q4: 6 January – 5 April → deadline 5 May
- EOPS: by 31 January following the tax year
- Final Declaration: by 31 January following the tax year

This extends the existing deadline calculator engine with a new filing type.

**Income & expense data entry** — A simple interface for the accountant (or client, via the portal from Phase 4) to enter quarterly income and expenses by category:
- Turnover / gross income
- Allowable business expenses (by category: premises, travel, staff, office, etc.)
- Property income and expenses (for landlords)
- Capital allowances

This does not require full double-entry bookkeeping — HMRC's ITSA API accepts summary figures by category, not individual transactions.

**HMRC ITSA API integration** — Building on the OAuth 2.0 and API infrastructure established in Phase 5 (MTD VAT):
- `POST /individuals/business/self-employment/{nino}/{businessId}/period` — submit a quarterly update
- `POST /individuals/business/property/{nino}/{businessId}/period` — submit property quarterly update
- Retrieve obligations, view submitted periods, submit EOPS, submit Final Declaration
- The API follows the same pattern as VAT MTD (REST, JSON, OAuth 2.0, fraud prevention headers)

**Bridging capability** — Many affected clients will keep records in spreadsheets rather than bookkeeping software. A spreadsheet import (CSV/Excel upload) that maps columns to HMRC categories would serve this market segment — effectively acting as "bridging software" for ITSA, similar to how tools like Avalara bridge spreadsheets to MTD VAT.

**Integration with Phase 4** — The client record collection portal can be extended to chase clients quarterly for their income and expense figures, not just annual documents. This creates a complete quarterly workflow: chase client → receive data → review → submit to HMRC → confirm.

### Technical Complexity

High. The HMRC API integration itself follows the same patterns as VAT MTD (Phase 5), but the additional complexity comes from:
- **HMRC production approvals** — Must pass HMRC's software vendor approval process, including fraud prevention header compliance and sandbox testing
- **Multiple business types** — Self-employment and property income have different API endpoints and data structures
- **Cumulative quarterly figures** — Each quarterly update must be cumulative for the year, not standalone
- **EOPS and Final Declaration** — Additional submission types beyond the quarterly updates
- **Client authorisation** — Each client must individually authorise the software via HMRC's OAuth flow

### Market Opportunity

This is a **new obligation** with an approaching deadline. The market for ITSA tools is not yet mature:
- Xero, QuickBooks, and FreeAgent will handle it for clients already using those platforms
- But many sole traders and landlords (especially landlords with simple portfolios) do **not** use bookkeeping software and will need a lightweight solution
- The "bridging software" market for ITSA is significantly less developed than for VAT
- Being early with a tool that combines ITSA submission + deadline management + client chasing (Phases 4 + 7) is a genuinely differentiated offering

### Risk

- HMRC's ITSA rollout has been delayed multiple times (originally planned for April 2024). Further delays are possible.
- The API specification may evolve as HMRC refines the service.
- The production approvals process is bureaucratic and can take months.
- Competition from incumbents (Xero, QuickBooks, FreeAgent) will be strong for clients already on those platforms.

### Why This Phase

The mandation timeline creates genuine market urgency. Accounting practices will need ITSA-capable software, and the combination of Peninsula's deadline tracking, client chasing (Phase 4), and HMRC API infrastructure (Phase 5) puts the platform in a strong position to offer a complete ITSA workflow. The technical foundation from Phase 5 (OAuth, fraud prevention headers, HMRC sandbox testing) directly transfers to ITSA, reducing the incremental build effort. The risk is offset by the potential to establish an early market position in a space where the incumbent tools are still building out their offerings.

---

## Summary

| Phase | Focus | Key Dependency |
|-------|-------|---------------|
| 1 | Multi-tenancy + onboarding + billing | None — foundation phase |
| 2 | Marketing site + privacy policy + T&Cs | Phase 1 (billing tiers must exist) |
| 3 | Document storage + email reply templates | Phase 2 (privacy policy defines storage obligations) |
| 4 | Client record collection & chasing portal | Phase 1 (multi-tenancy), Phase 3 (storage infrastructure) |
| 5 | HMRC API integration (MTD VAT) | Phase 1 complete, HMRC agent registration initiated |
| 6 | AI agent interface | Phases 1-5 complete, DPA with AI provider in place |
| 7 | MTD ITSA dedicated platform | Phase 5 (HMRC API foundation), Phase 4 (client chasing for quarterly data) |

*Note on Phase 5 timing: discuss with the accountant after Phase 1 whether HMRC APIs should be brought forward, particularly given the MTD for ITSA mandation timeline and its value as a marketing feature.*

*Note on CT600/iXBRL: Corporation Tax filing requires iXBRL accounts production — a multi-year undertaking well beyond the scope of this product. A partnership/integration approach with an existing CT filing provider (e.g. BTC Software or TaxCalc) is the practical alternative if demand warrants it.*
