# Future Development Roadmap

This document outlines the planned development phases beyond the current foundation (reminder engine, delivery system, and dashboard). Each phase builds on the previous, with the ordering chosen to minimise risk and ensure the right infrastructure and compliance groundwork exists before more complex features are introduced.

---

## Phase 1 — Multi-Tenancy & Onboarding ✅

**Goal:** Transform the application from a single-firm tool into a platform that can serve multiple independent accounting practices, each with full data isolation.

### What This Involves

**Database restructuring** — An `organisations` table is introduced as the root entity. Every existing table (clients, reminders, email logs, etc.) gains an `org_id` foreign key. All Supabase Row Level Security (RLS) policies are rewritten to scope every query to the authenticated user's organisation, making cross-tenant data access impossible at the database level.

**Authentication & user management** — Users belong to an organisation. The sign-in flow becomes org-aware: a user logs in and their session is scoped to their firm. Firms need the ability to invite additional team members (e.g. a junior accountant alongside the principal), with role-based access if needed (admin vs. standard user).

**Onboarding flow** — A new firm signing up needs a guided setup experience: create organisation, enter firm details, configure default reminder settings, and invite team members. This is the first thing a new customer sees and sets the tone for the product.

**Billing integration** — Multi-tenancy only makes commercial sense with a subscription model. Stripe is the standard choice: monthly billing per firm, a permanent free tier for smaller practices, and a billing management page within the app. This should be implemented in this phase so the infrastructure is ready when the marketing site launches.

**Super-admin view** — A separate, protected internal view for managing all tenants: see active firms, handle billing issues, and monitor overall system health. Not customer-facing but essential for operating the platform.

### Why This Comes First

Every subsequent phase depends on data being scoped to an organisation. Building document storage, AI features, or HMRC integrations on a single-tenant foundation would require a painful, risky retrofit later. This is the hardest phase architecturally but the right one to do first.

### Note on HMRC APIs

After completing this phase, it is worth discussing with the accountant whether HMRC API integration should be brought forward. It is a strong marketing differentiator (MTD-compatible software) and knowing clients' appetite for it early will inform the marketing site messaging. VAT MTD is the most feasible integration given its modern REST/JSON/OAuth API — see `roadmap_research.md` for full analysis of filing type complexity and API availability.

---

## Phase 2 — Marketing Frontend & Privacy Policy ✅

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
- AI processing disclosure: that an in-app AI assistant (Phase 7) may process client names, statuses, deadlines, and counts to answer queries — no financial figures or document content is ever sent to the AI provider; a Data Processing Agreement must be in place with the provider before this feature is enabled
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

## Phase 3 — Document Storage ✅

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

## Phase 4 — Client Record Collection & Chasing Portal ✅

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

## Phase 5 — Document Integration & Document-Aware Reminders ✅

**Goal:** Unify the document collection system with the filing type workflow and extend the reminder engine to be document-aware — eliminating the disconnect between what documents a client has sent and how the reminder pipeline behaves. No new infrastructure; this phase is integration and extension of what already exists.

### Background: The Gap

Phases 3 and 4 built a complete document collection system: storage, classification, portal links, checklists, inbound email extraction. But the implementation left documents as a parallel system sitting *alongside* the filing workflow rather than inside it. The result is a client page with six separate cards (Filing Management, Documents, Generate Upload Link, Checklist Customisation, Compliance, Email Log) where three of those should be contextual features of the filing card itself. More critically, the reminder engine has no awareness of documents at all — the "Records Received" checkbox is a manual toggle, not driven by actual submissions, and reminder emails cannot include what documents are still outstanding.

### What This Involves

**Documents inside filing type cards** — The standalone "Documents" card is removed. Each filing type card (CT600, Self Assessment, VAT Return, Companies House) gains an expandable document section inline. The collapsed card header shows a progress summary: "3 of 8 documents received · last received 12 Feb". Expanding shows the full document list (filename, type, confidence, received date, source, download), plus the outstanding checklist items not yet provided. The data model already supports this — both `client_documents` and `filing_document_requirements` are scoped by `filing_type_id`. The UI does not reflect this relationship; this phase fixes that.

**Inline portal link generation** — The standalone "Generate Upload Link" card is removed. Generating an upload link becomes a contextual action within each filing card, automatically scoped to that filing type and the correct tax year — no dropdown needed. The portal token infrastructure from Phase 4 is unchanged.

**Inline checklist customisation** — The standalone "Checklist Customisation" card is removed. Per-client document checklist adjustments (toggle items on/off, add ad-hoc items) become accessible via a settings icon on each filing card, presented as a modal or inline editor. The `client_document_checklist_customisations` table is unchanged.

**`{{documents_required}}` template variable** — A new template variable that resolves at send time to a formatted list of documents still outstanding for that client/filing type combination. The scheduler already knows the client and filing type at send time. It queries `filing_document_requirements` (plus `client_document_checklist_customisations` for per-client overrides) and cross-references against `client_documents` to produce the outstanding items. The result is rendered as an HTML list fragment and injected into the email body. If all documents have been received, the variable resolves to an empty string and accountants should word their templates accordingly. This variable works within the existing TipTap-based template editor with no changes to how templates are stored or edited — it appears in the variable picker alongside `{{client_name}}` and `{{deadline}}`.

**`{{portal_link}}` template variable** — A new template variable that generates a fresh signed upload link for the relevant filing type at send time and injects the URL into the email. Clients receive a direct link to the upload portal in every reminder that includes it, without the accountant having to manually generate and copy links. The portal token generated at send time uses the same infrastructure as the manual generation in Phase 4, with the same expiry and security model.

**Auto-set Records Received** — When all required documents for a filing type are uploaded (whether via the portal or inbound email), `records_received_for` is automatically set for that filing type, pausing the reminder queue. This makes the existing manual "Records Received" checkbox an override rather than the primary mechanism — the system updates it automatically, the accountant can still set it manually if needed (e.g. records received by post). The trigger is the document upload pipeline (Postmark webhook and portal upload handler), which already has the client ID and filing type.

**Consolidated API fetch** — The current client page makes four independent `GET /api/clients/{id}/documents` calls (one per DocumentCard) and filters client-side. This is replaced with a single fetch that includes document counts and the most recent received date per filing type, embedded in the filing management response. The full document list for a specific filing card only fetches when that card is expanded.

### What This Is Not

This phase contains no new tables, no new external services, no new scheduling infrastructure, and no new email provider configuration. It is purely integration work — connecting systems that were built in parallel but never wired together. The data model already supports every feature described here.

### Why This Comes Fifth

Phases 3 and 4 must exist before this is meaningful. The document storage, classification, portal token system, and checklist tables are all prerequisites. This phase is the natural completion of those phases — closing the loop between document receipt and the reminder pipeline that was left open during implementation. Phase 6 (HMRC API) benefits from this being in place because "Records Received" will be accurate by the time submission features are built.

---

## Phase 6 — Document Verification

**Goal:** Eliminate two separate manual burdens with one underlying capability: the client-side "wrong document" resubmission loop (accountant sends "please resend the correct year") and the accountant-side PDF triage burden (opening every uploaded file to verify it is what was requested). A layered verification system provides factual feedback to the client at the moment of upload and surfaces a pre-read summary to the accountant before they open a single file.

### Background: Two Problems, One Solution

**The client loop:** A client uploads their P60 for 2022-23. The accountant opens it, spots the wrong year, and emails back asking for 2023-24. The client has already left the portal. This exchange — upload, wait, email, resubmit — happens repeatedly for a small but consistent subset of clients, and it is entirely preventable if the system can detect the mismatch at the moment of upload.

**The accountant triage burden:** A practice with 200 clients approaching Self Assessment deadline could receive hundreds of uploaded files. The accountant currently has to open each one to verify it is the right document, the right year, and apparently complete. This is a repetitive mechanical task that consumes time better spent on professional work.

Both problems share a root cause: the system accepts documents without reading them. This phase fixes that.

### The Two-Layer Architecture

**Layer 1 — Client-facing: factual checks at upload time (no AI)**

Immediately after a client uploads a file, the portal runs deterministic checks and reports back. This happens before the file is accepted into the checklist. The key design principle: only factual, verifiable outputs go to the client — never AI judgements or completeness assessments.

Checks that run:
- **File integrity:** Corrupt or zero-byte file, password-protected PDF (cannot be processed)
- **File size sanity:** Suspiciously small file against expected range for that document type — likely blank or incomplete
- **Page count:** Against expected range for the document type (e.g. a P60 is 1-2 pages — a 12-page PDF is probably wrong)
- **Duplicate detection:** Hash comparison against files already uploaded for this checklist item
- **Tax year extraction via server-side OCR:** P60s, P45s, and SA302s have rigid fixed-format HMRC layouts. Tesseract OCR can reliably locate the tax year field on these documents. If the extracted year does not match what was requested, the portal flags it immediately: *"This P60 appears to be for tax year 2022-23. You were asked for 2023-24. Please check and re-upload if needed."*

The client sees this feedback while they are still on the portal and can correct immediately — no round-trip email required. If the check passes, the file is accepted and the checklist item is marked uploaded.

Crucially: no AI is involved in client-facing feedback. Every output is a deterministic fact extracted from the document. The accuracy risk of AI false negatives — the accountant-facing concern — does not apply here. A wrong-year flag is either correct or not flagged at all.

**Layer 2 — Accountant-facing: AI verification summary in the dashboard**

Within the client's filing card in the dashboard, each uploaded document shows a pre-read summary before the accountant opens it:

> **P60 received ✓** — Tax year 2023-24 · Employer: Tesco Stores Ltd · PAYE ref: 123/AB456
> **Bank statement received ✓** — 3 pages · Period: Oct–Dec 2024
> **⚠ SA302 received — tax year 2022-23** — Client was asked for 2023-24. Already flagged to client at upload.
> **⚠ PDF received — could not classify** — Please verify this matches a requested document.

The accountant resolves issues at summary level and only opens files that need attention. Because Layer 1 already caught and flagged wrong-year cases to the client, many issues will be resolved before the accountant even looks at the dashboard.

The `classification_confidence` field on `client_documents` (already in the data model) is the hook for this layer — populated at document ingest for every upload.

### Build Progression

**Phase 6 launch — rules + OCR (Layers 1 and 2 without third-party AI):**
- File integrity, size, page count, duplicate checks (Layer 1 client-facing)
- Server-side OCR for known HMRC fixed-format documents: P60, P45, SA302, P11D (tax year extraction, employer name, PAYE reference)
- Accountant dashboard summary populated from OCR and rules output
- No third-party AI dependency — all processing on Prompt's own infrastructure
- Covers the highest-frequency documents (P60 and SA302 alone account for the majority of SA100 submissions)

**Phase 6 v2 — AI layer for unstructured documents (third-party AI, opt-in per org):**
- For documents that don't match a known HMRC fixed-format template, a vision model (Claude) attempts classification and description
- Requires DPA with AI provider and disclosure in privacy policy: *"Uploaded documents may be analysed by an AI system to assist your accountant in reviewing submissions"*
- Per-organisation opt-in toggle — enabled by default for Firm and Practice tiers, off for Solo
- AI output is accountant-facing only — never shown to clients
- Build only after v1 is live and demand for broader document type coverage is confirmed by customer feedback

### Privacy Position

**Layer 1 (client-facing):** No privacy concerns. All processing is on Prompt's own infrastructure. OCR output stays on-platform. The client's own document is being checked against a request they made — no third-party involvement.

**Layer 2 without AI:** Same as Layer 1 — the accountant-facing summary is generated from the same on-platform OCR.

**Layer 2 with AI (v2):** Requires a DPA with the AI provider, an opt-in consent flow per organisation, and an update to the privacy policy. The document is already on Prompt's server as part of the existing data processing relationship — the AI layer is an extension of that relationship, not a new one. Financial data is not special-category data under UK GDPR. A DPIA is recommended given the combination of AI + financial document content. Standard SaaS compliance work.

### Market Gap

Dext and AutoEntry (the leading document extraction tools) focus exclusively on invoices and receipts. Neither covers UK HMRC tax documents — P60s, SA302s, P45s, P11Ds. No practice management tool currently offers server-side OCR for these document types. This is a genuine gap in the market, flagged in competitor research, and one Prompt can own directly.

### Why This Comes Sixth

Phases 3, 4, and 5 must exist first: the document storage infrastructure, the upload portal and checklist system, and the integrated filing card view. By Phase 6, every prerequisite is in place — the `client_documents` table, `classification_confidence` field, portal upload handler, and the filing card UI that will surface the verification summary. Phase 6 adds intelligence to the pipeline that was built in Phases 3-5.

---

## Phase 7 — AI Agent Interface (Long-Term)

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

### Why This Comes Seventh

This feature requires multi-tenancy (for org scoping), a rich enough data model (built across Phases 1-6) to make the queries meaningful, and a mature enough privacy policy (Phase 2) to cover the data being shared with the AI provider. By Phase 7, the foundation is complete and the feature can be built cleanly on top of it. The DPA with the AI provider established in Phase 6 v2 covers this feature as well.

---

## Phase 8 — SMS & WhatsApp Notifications

**Goal:** Add SMS (and optionally WhatsApp) as an opt-in secondary notification channel per client, supplementing email for clients who are unresponsive to email alone — without replacing the email-first system or adding configuration burden to the accountant.

### Background: Why a Second Channel

Some clients simply do not engage with email. They open it days late, filter it to a folder, or check personal email infrequently. The same client who ignores three email chasers may respond immediately to a text. A secondary channel at the right point in an unresponsive sequence — not as a replacement for email but as an escalation — meaningfully improves submission rates for the small subset of genuinely difficult clients without adding noise for everyone else.

### What This Involves

**Per-client opt-in, not system-wide** — SMS is not sent to all clients by default. The accountant enables it per client on the client profile: a mobile number field plus a channel toggle ("Also send via SMS"). This keeps the system simple — most clients stay email-only, and the accountant only configures SMS for clients where they know it will help.

**Mobile number field on clients** — A `mobile_number` field is added to the client record, separate from the existing `phone` (which is typically a landline or business line). The accountant enters the client's mobile number when enabling SMS. The system validates UK mobile number format (07xxx / +447xxx) at entry.

**SMS-specific template variants** — Each schedule step that supports SMS needs a separate SMS template alongside the existing email template. SMS is plain text, 160 characters per segment (multi-part messages are supported but add cost). The template editor gains an SMS tab per step: a short-form version of the message with the same `{{variables}}` support. Accountants write it once per step; the system uses the SMS template for SMS sends and the email template for email sends.

**Channel routing in the queue builder** — The reminders cron, when building the queue for a client with SMS enabled, creates two queue entries per step: one for email, one for SMS. Alternatively, SMS may be configured to trigger only at specific steps (e.g. only on the final two chase emails) — this is per-step configurable on the schedule.

**Send provider: Twilio** — Twilio is the standard choice with strong UK carrier coverage. UK-specific: alphanumeric sender IDs are supported ("Prompt" as the sender name rather than a phone number), which is far more professional for a business context. Cost is approximately 4-7p per outbound UK SMS — negligible per client. A Twilio account and API credentials are required at setup; these are added to `ENV_VARIABLES.md` alongside the Postmark credentials.

**Delivery logging** — The existing `email_log` table gains a `channel` column (`email` / `sms`), or SMS sends are logged to a separate `sms_log` table. Delivery receipts (Twilio webhooks) update the log with confirmed delivery status. UK SMS delivery receipts are generally reliable unlike email open tracking.

**UK PECR compliance** — UK PECR (Privacy and Electronic Communications Regulations) requires prior consent for marketing texts. Filing deadline reminders sit in legitimate interest territory (they are a service notification about the client's own obligations), but documented consent is best practice. The accountant's existing engagement letter with each client should cover "we may contact you by text regarding your filing obligations." A short confirmation prompt at mobile number entry reminds the accountant of this: *"Confirm that this client has agreed to receive SMS reminders."*

**WhatsApp Business API (stretch goal)** — Via Twilio's WhatsApp integration, the same infrastructure supports WhatsApp message templates. WhatsApp has significantly higher engagement rates than SMS in the UK and supports longer messages. The technical integration is identical to SMS through Twilio. The additional requirement is Meta's WhatsApp Business API approval, which requires each message template to be pre-approved by Meta (a 24-48 hour process per template). This is an optional extension once the SMS foundation is in place.

### What This Is Not

SMS is not a replacement for email. It does not carry document checklists, portal links embedded in rich HTML, or multi-paragraph content. Its role is a short, direct nudge: *"A reminder from Prompt: your Self Assessment records are due in 3 weeks. Please check your email or upload at [short URL]."* The email is still the primary communication vehicle with full content.

### Technical Complexity

Medium. Twilio integration is well-documented with a Node.js SDK. The main work is:
- Adding mobile number to client schema and UI
- SMS template system (new tab in template editor)
- Channel routing in the queue builder and send cron
- Twilio API integration in the send layer
- Delivery receipt webhook from Twilio
- SMS logging

Approximately 2-3 weeks of focused build time. The queue builder and pipeline changes are the most significant, as they affect the core reminder flow. The template editor addition is self-contained.

### Why This Phase Position

Phases 1-5 must be complete (the core scheduling, portal, and document pipeline). Phase 6 (client chasing with risk dashboard) provides the "difficult clients" signal that tells the accountant which clients are worth enabling SMS for — the two features complement each other directly. Phase 8 is a channel extension that adds value on top of a mature core product rather than a foundational feature.

---

## Summary

| Phase | Focus | Status | Key Dependency |
|-------|-------|--------|---------------|
| 1 | Multi-tenancy + onboarding + billing | ✅ Complete | None — foundation phase |
| 2 | Marketing site + privacy policy + T&Cs | ✅ Complete | Phase 1 (billing tiers must exist) |
| 3 | Document storage + email reply templates | ✅ Complete | Phase 2 (privacy policy defines storage obligations) |
| 4 | Client record collection & chasing portal | ✅ Complete | Phase 1 (multi-tenancy), Phase 3 (storage infrastructure) |
| 5 | Document integration + document-aware reminders | ✅ Complete | Phases 3 & 4 (document storage and portal infrastructure) |
| 6 | Document verification — client-facing factual checks at upload + accountant-facing AI summary | Upcoming | Phases 3-5 (storage, portal, integrated filing cards) |
| 7 | AI agent interface — natural language practice queries | Long-term | Phases 1-6 complete, DPA with AI provider in place |
| 8 | SMS & WhatsApp notifications — opt-in secondary channel per client | Long-term | Phase 6 (risk signals to identify which clients need SMS) |

*Note on CT600/iXBRL: Corporation Tax filing requires iXBRL accounts production — a multi-year undertaking well beyond the scope of this product. A partnership/integration approach with an existing CT filing provider (e.g. BTC Software or TaxCalc) is the practical alternative if demand warrants it.*

---

## Long-Term Concept — Storage Provider Sync (Research Only)

**Concept:** The storage provider API watches the client's folder and automatically updates filing management in Prompt when the client drops a file there directly — without going through the upload portal.

### Feasibility by provider

- **Dropbox**: Webhooks push notifications when any file in the app folder changes. Technically solid.
- **OneDrive**: Microsoft Graph subscriptions provide delta notifications. Works, but subscriptions expire (max ~1 year for business accounts) and need periodic renewal.
- **Google Drive**: Blocked by `drive.file` scope — Prompt can only see files it uploaded itself. Files dropped manually into the folder by a client are invisible. Upgrading scope would require all orgs to re-authorise and introduces broader permissions.
- **Supabase**: No native file event webhook. Not applicable.

### Why this is held

Three concerns make this unsuitable to build now:

1. **GDPR / consent**: The portal flow is explicit — the accountant sends a link, the client actively uploads. Passive folder watching is a materially different pattern. Clients need to be informed that files dropped into their folder will be automatically ingested by a third-party system. This requires disclosure in the engagement letter and likely a DPIA.

2. **Scope creep risk**: With no checklist slot selection, any file dropped into the folder gets ingested and associated with a filing. A client misplacing a personal document would be silently processed and stored.

3. **Accountant control**: Automatic ingestion bypasses the accountant's review step. An unreviewed file landing directly in "documents received" could cause workflow problems.

### Recommended future approach

A **delta-sync-as-notification** model rather than auto-ingestion: when the accountant opens a client page (or on a cron), Prompt calls the storage provider's delta API and surfaces new unrecognised files as a review prompt ("3 new files detected in this client's Dropbox folder"). The accountant assigns them to a filing type manually. This keeps accountant control, avoids the passive surveillance concern, and works within `drive.file` scope constraints for Google Drive.

Revisit after the storage workflow is mature and customer demand for this pattern is confirmed.
