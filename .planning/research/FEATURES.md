# Feature Research: v4.0 Document Collection

**Domain:** Document collection portal for UK accounting practice management SaaS
**Researched:** 2026-02-23
**Confidence:** HIGH for HMRC document formats (gov.uk verified); HIGH for retention law (TMA 1970 / CH14600 verified); MEDIUM for competitor portal UX patterns (WebSearch, multiple corroborating sources); MEDIUM for filing-to-document mappings (accountant checklist sources, multiple corroborating)

---

## Context

This document covers the new feature set being added in v4.0: document collection infrastructure. The existing product already handles sending reminders to clients. v4.0 closes the loop — when a client responds to a reminder, either by attaching files to their reply email or by following a link to a branded upload portal, those documents are captured, classified, and surfaced in the filing type cards the accountant already uses.

The competitive context:
- **TaxDome** (global, US-first, UK presence): full client portal requiring app download or login; strong but heavyweight
- **Karbon** (US/AU/UK): magic-link document requests as part of task workflows; portal launched mid-2025
- **Senta** (UK-native): client portal with document drag-and-drop, unlimited eSigning, no per-document pricing
- **Dext** (UK): receipt/invoice capture specialist — AI OCR extraction, not a portal for accountant-collected docs
- **ContentSnare / Clustdoc**: dedicated document collection tools with conditional checklist logic — not integrated with UK filing deadlines

None of these competitors tightly integrate document collection with a UK-specific deadline engine. This is Prompt's differentiation: document checklists are driven by the same filing type engine that already powers reminders. A client's upload portal shows exactly what is needed for their SA100 / CT600 / VAT return deadline — not a generic checklist.

---

## HMRC Document Catalog

Before mapping features, the domain-specific document types must be established. These are the HMRC-defined forms and standard client-supplied documents used in UK accounting.

### HMRC-Issued / PAYE Forms

| Document | Issued By | Purpose | Key Fields | Deadline |
|----------|-----------|---------|------------|----------|
| **P60** | Employer (mandatory) | Annual summary of pay and tax for PAYE employee | Total taxable pay, income tax deducted, NI contributions, student loan deductions, employer PAYE ref, NI number | Must be issued by 31 May after tax year end |
| **P45** | Employer (on leaving) | Pay and tax to leaving date; handed to new employer | Tax code, pay to leaving date, tax deducted to leaving date, parts 1 (HMRC), 1A (employee), 2+3 (new employer) | Issued on leaving date |
| **P11D** | Employer (to HMRC and employee) | Benefits in kind received (company car, private medical, loans, etc.) | Employee/employer ID, benefit category sections (A–N: accommodation, car, loans, subscriptions, etc.), Class 1A NIC liability | Submitted to HMRC by 6 July; copy to employee by same date |
| **SA302** | HMRC (or accountant-generated from filing software) | Tax calculation from self assessment return; income proof for mortgages | Income by source, total tax charged, NIC, allowances/reliefs, amount due/refundable | Generated on completion of SA return; used retrospectively (last 4 years) |
| **P32** | Employer-generated (payroll software) | Monthly employer payment record for PAYE/NIC due to HMRC | Total income tax, employee+employer NI, student loan deductions, employment allowance, apprenticeship levy, net amount due each period | Internal reconciliation; not submitted to HMRC but retained as record |
| **SA100** | Client completes | Main self assessment tax return form | UTR, NINO, income sources, reliefs, supplementary pages required | File by 31 January (online) following tax year end |
| **SA302 / Tax Year Overview** | HMRC online account | Supporting income evidence (pair of documents) | SA302: detailed calculation; Tax Year Overview: confirms filing and amount due | On demand from HMRC online or via accountant filing software |

### Client-Supplied Documents (Not HMRC-Issued)

These are documents clients collect from third parties and provide to their accountant.

| Document Category | Examples | Used For |
|-------------------|----------|----------|
| **Bank statements** | Current account, business account — full year | All filing types (income/expense verification) |
| **Sales invoices / receipts** | Customer invoices, till receipts, Stripe/PayPal exports | Self-employment, CT600, VAT |
| **Purchase invoices / receipts** | Supplier invoices, expense receipts | Self-employment, CT600, VAT |
| **Payroll records** | Payslips, RTI FPS/EPS submissions, payroll journal | CT600, SA100 (director salary) |
| **Dividend vouchers** | Board minute authorising dividend + dividend voucher per payment | SA100 (director shareholders), CT600 |
| **Loan agreements** | Director loan account documentation, business loans | CT600 (interest relief), P11D (beneficial loans) |
| **Property income records** | Rental agreements, letting agent statements, mortgage statements | SA100 (SA105 supplementary) |
| **Capital gains evidence** | Contract/completion statement, original purchase cost, improvement costs | SA100 (SA108 supplementary) |
| **Pension certificates** | Pension provider annual statement | SA100 (higher rate relief) |
| **Mortgage statements** | Annual summary | CT600 (finance costs for property companies), SA100 (SA105) |
| **Hire purchase / leasing agreements** | Vehicle/equipment lease contracts | CT600 (capital allowances) |
| **Fixed asset register / schedules** | List of assets, acquisition costs, disposal proceeds | CT600 (capital allowances, balancing charges) |
| **Share certificates / EIS certificates** | Enterprise Investment Scheme certificates | SA100 (EIS relief, SA108 gains) |
| **VAT records** | Sales/purchase daybooks, VAT account, MTD software export | VAT return |
| **Confirmation statement (CS01)** | Filed with Companies House — confirms company officers, shareholders, SIC code | Companies House annual obligation |
| **Previous year's accounts / CT600** | Prior year statutory accounts, prior CT600 | CT600 (comparative figures, losses brought forward) |
| **AML / KYC documents** | Passport or driving licence, utility bill, certificate of incorporation | Client onboarding (MLR 2017 obligations) |

---

## Filing Type to Required Document Mapping

This drives the checklist engine. For each filing type in the existing system, here are the documents typically required.

### SA100 — Self Assessment Tax Return

**Applicable client types:** Sole traders, individuals, director-shareholders of limited companies.

| Document | Mandatory | Conditional | Condition |
|----------|-----------|-------------|-----------|
| UTR (Unique Taxpayer Reference) | Yes | — | — |
| NI number | Yes | — | — |
| P60 | Yes | — | If employed (PAYE) |
| P45 | No | Yes | If changed job during the year |
| P11D | No | Yes | If employer-provided benefits in kind |
| Self-employment accounts (profit/loss) | No | Yes | If sole trader / freelance income |
| Sales invoices / receipts (full year) | No | Yes | If sole trader income |
| Purchase invoices / expenses | No | Yes | If self-employed expenses claimed |
| Bank statements (business) | No | Yes | If self-employed |
| Bank statements (personal) | Yes | — | For interest income, all clients |
| Dividend vouchers | No | Yes | If director-shareholder or investor |
| Rental income records | No | Yes | If property income (SA105) |
| Mortgage / finance cost statements | No | Yes | If property income |
| Capital gains disposal evidence | No | Yes | If asset sold (SA108) |
| Pension contribution certificates | No | Yes | If claiming higher rate relief |
| Gift Aid records | No | Yes | If donations made |
| Child benefit amount (if received) | No | Yes | If income over £50,270 (High Income Child Benefit Charge) |
| Student loan repayment reference | No | Yes | If repaying student loan plan 1/2/4 |
| Prior year SA302 / Tax Year Overview | No | Yes | New client, or if HMRC enquiry |

**Key notes:**
- SA100 has 9 supplementary pages (SA101–SA110). The checklist should be conditional by which supplementary pages apply.
- Director-shareholders of limited companies need both SA100 (personal) and CT600 (company) — these are separate filing types in the system but documents overlap (dividend vouchers, director loan account).

---

### CT600 — Corporation Tax Return

**Applicable client types:** Limited companies, LLPs filing as companies.

| Document | Mandatory | Conditional | Condition |
|----------|-----------|-------------|-----------|
| Year-end trial balance / bookkeeping records | Yes | — | — |
| Bank statements (all business accounts, full year) | Yes | — | — |
| Sales invoices / turnover reconciliation | Yes | — | — |
| Purchase invoices / expense receipts | Yes | — | — |
| Payroll records (FPS/EPS, P60s issued) | No | Yes | If company employs staff or pays director salary |
| Director loan account statement | No | Yes | If director has borrowed from or lent to company |
| Dividend vouchers (all dividends declared) | No | Yes | If dividends paid during year |
| Fixed asset schedule / acquisitions list | No | Yes | If assets purchased (capital allowances) |
| Hire purchase / lease agreements | No | Yes | If vehicle or equipment under finance |
| R&D expenditure schedule | No | Yes | If claiming R&D tax relief |
| Prior year statutory accounts | Yes (first filing or new client) | — | — |
| Prior year CT600 | No | Yes | If losses brought forward, or new client |
| Mortgage / loan interest statements | No | Yes | If company has borrowing |
| Share capital changes / new share issues | No | Yes | If share structure changed |
| P11D (if applicable) | No | Yes | If benefits in kind provided to directors/employees |

**Submission format note:** CT600 must be submitted in iXBRL format. From April 2026, HMRC's own online tool is being discontinued — commercial software required. The accountant needs the source records to prepare statutory accounts + tax computation in iXBRL. Prompt collects the source records; the accountant prepares the CT600 using their filing software.

---

### VAT Return

**Applicable client types:** VAT-registered clients (any type above the £90,000 threshold, or voluntarily registered).

| Document | Mandatory | Conditional | Condition |
|----------|-----------|-------------|-----------|
| MTD-compatible software export (VAT account) | Yes | — | All VAT-registered businesses must use MTD-compatible software since April 2022 |
| Sales daybook / output tax schedule | Yes | — | — |
| Purchase daybook / input tax schedule | Yes | — | — |
| Bank statements (reconciliation period) | Yes | — | — |
| VAT invoices (samples or full set on HMRC request) | No (not submitted) | Yes | Must be retained 6 years; HMRC may request |
| Import VAT certificates (C79) | No | Yes | If goods imported |
| EU acquisition records | No | Yes | If purchasing from EU (post-Brexit reverse charge) |
| Bad debt relief schedule | No | Yes | If claiming bad debt relief |
| Partial exemption workings | No | Yes | If partially exempt business |
| Prior quarter's VAT return | Yes (new client / first quarter) | — | Comparatives needed |

**Stagger group note:** The system already stores `vat_stagger_group` (1, 2, or 3). Checklist generation for VAT should use this to determine the correct quarter end dates for document labelling.

---

### Companies House Annual Accounts

**Applicable client types:** All incorporated limited companies (including dormant).

| Document | Mandatory | Conditional | Condition |
|----------|-----------|-------------|-----------|
| Year-end trial balance (same as CT600 — shared workflow) | Yes | — | — |
| Bank statements | Yes | — | — |
| Directors' report content (narrative) | No | Yes | Required for small companies filing full accounts; not required for micro-entity or abridged filing |
| Confirmation statement (CS01) data | Yes | — | Officers, shareholders, SIC codes, registered office — needed to verify accuracy in accounts |
| Audit report | No | Yes | Required for medium/large companies (turnover > £10.2m or >50 employees) |
| Previous year statutory accounts | Yes (new client) | — | Comparative figures required |

**Filing thresholds:**
- Micro-entity: turnover ≤ £632k, balance sheet ≤ £316k, ≤ 10 employees — abbreviated balance sheet only
- Small company: turnover ≤ £10.2m, balance sheet ≤ £5.1m, ≤ 50 employees — can file abridged accounts
- Medium/Large: full accounts including auditor's report

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that accountants using any document collection tool expect. Missing these = product feels incomplete or unsafe.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Document storage with private access control** | Documents contain sensitive financial data — publicly accessible storage is a disqualifier | LOW | Supabase Storage private bucket. Signed URLs only. Org-scoped paths enforce tenant isolation. |
| **File upload from client (any format)** | Clients upload PDFs, JPGs, Excel files, CSV exports — cannot restrict formats | LOW | Accept PDF, image (JPG/PNG), Excel/CSV, XML (MTD exports). 25MB per file max reasonable. |
| **Checklist per filing type** | Accountants want to know what's outstanding before chasing clients | MEDIUM | Default checklist per filing type (SA100, CT600, VAT, Companies House). Conditional items (see mapping above). |
| **Mark document as received** | Core workflow — accountant needs to mark items complete without requiring upload | LOW | Each checklist item: Not requested / Requested / Received / Not applicable. Manual override always available. |
| **Document download (signed URL)** | Accountant must be able to retrieve any uploaded document | LOW | Time-limited signed URL (Supabase `createSignedUrl`). Expires after 1 hour. No permanent public URLs. |
| **Audit trail of access** | Compliance requirement — who downloaded which document when | LOW | `document_access_log` table: who, what, when, IP, action (view/download/delete). |
| **6-year retention with flagging** | HMRC requires records retained 6 years from end of accounting period (CH14600). Accountants are legally responsible for knowing this. | MEDIUM | Retention date per document calculated from filing period. Cron job flags documents approaching or past retention date. |
| **Link document to filing type** | Documents must be contextualised — a P60 is for SA100 2024/25, not floating unattached | LOW | `client_documents` FK to filing type + tax period. Documents linked to specific filing year, not just client. |
| **Client upload portal (no login required)** | Clients will not create accounts on their accountant's software. Industry-wide expectation: magic link / token access. | MEDIUM | Token-based access (UUID in URL). No password. No account creation. Prompt-branded with firm name. Time-limited token (30 days). |
| **Visible to accountant in client detail view** | Documents must surface where the accountant already works — the client's filing status cards | LOW | Document count + most recent upload shown inline per filing type card. Expand to full list. |
| **Accountant notification on upload** | Accountant needs to know when a client has submitted documents | LOW | In-app notification. Email notification via Postmark. Configurable per-accountant. |
| **Delete document** | GDPR right to erasure; also correcting mis-uploads | LOW | Soft delete with audit log entry. Hard delete from Storage after 30-day grace period. |

---

### Differentiators (Competitive Advantage)

Features not universally expected, but valuable — especially in the context of this product's existing filing deadline engine.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Passive collection from inbound email attachments** | Clients who already reply to reminders with attachments have their documents captured automatically — zero extra client friction | HIGH | Postmark inbound webhook already implemented. Extend to extract attachments. Store in Supabase Storage. Attempt auto-classification against document_types catalog. Significant value: no competitor captures email attachments into a structured document store. |
| **Checklist auto-generated from client profile** | Instead of a generic "what do I upload?" page, the client upload portal shows exactly what documents are needed for their specific filing type — P60 if PAYE, self-employment accounts if sole trader, etc. | HIGH | Requires conditional logic: client type + employment status + property income flag → filtered checklist. SA100 has 9 supplementary pages; only relevant ones should appear. This is the core differentiator. |
| **Deadline-anchored document requests** | Send upload portal link as part of the existing reminder schedule (not manually) — document collection becomes automated alongside email reminders | MEDIUM | Upload token generation triggered by reminder send. Link embedded in reminder email template via placeholder. Clients receive "please upload documents for your SA return — due 31 January" with a direct link. |
| **Per-client checklist customisation** | Different clients have different circumstances. Accountant can toggle items on/off, add ad-hoc items per client-filing pair | MEDIUM | Default checklist from `filing_document_requirements` table. Per-client overrides stored separately. Accountant UI: toggle, add item, add note. |
| **Auto-classification of uploaded documents** | Rule-based classification of uploaded files (P60, P45, bank statement, invoice) based on filename patterns, MIME type, and upload context | HIGH | Confidence: MEDIUM. Start with rule-based heuristics (filename matching "P60", "bank statement", "invoice"). True ML classification is a v4.x enhancement. Flag unclassified documents for accountant review. |
| **Dashboard activity feed: real-time submissions** | Accountant can see at a glance which clients have recently submitted documents across the whole practice | LOW | Activity feed on dashboard: "[Client name] uploaded 3 documents for SA100 2024/25 — 12 minutes ago". Sorted by recency. Valuable for busy practices with many active checklists. |
| **DSAR export (ZIP + JSON manifest)** | GDPR compliance — if a client's data subject requests all personal data held, the accountant can produce a ZIP archive with all stored documents and a machine-readable manifest | HIGH | Rare but legally required. ZIP: all documents for client. JSON manifest: file names, types, upload dates, access log. Must be initiatable from client detail page. |
| **Retention enforcement cron + deletion workflow** | Proactively surfacing documents approaching or past their 6-year retention date prevents the accountant from unknowingly holding data beyond statutory limits (a data protection risk) | MEDIUM | Cron job (Supabase Edge Function, weekly). Flag documents where retention_date < NOW(). Accountant dashboard: "12 documents due for deletion review". Two-step deletion: flag → confirm → delete from Storage. |
| **Inbound email body parsed for document context** | If a client emails "here is my P60 and bank statement for last year" and attaches files, extract the email body text to enrich document classification | HIGH | Confidence: LOW. Significant NLP complexity. Defer to v4.x. Initial v4.0 should just store the attachment with the email reference. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **OCR / data extraction from documents** | "Extract the numbers from the P60 automatically" | Significant ML complexity; UK tax form layouts change annually; accuracy must be near-100% for tax purposes — errors could cause incorrect filings. Dext (specialist) charges premium for this. | Store documents securely; let the accountant read them. Classification by document type (what it is) is achievable; data extraction (what it says) is a separate, hard product. Flag for v5+. |
| **E-signatures on documents** | "Have clients sign engagement letters through the portal" | Separate product category (HelloSign, DocuSign, Senta offers this). UK eIDAS requires qualified signatures for some document types. Adds significant legal complexity. | Out of scope for v4.0. Document as v5+ feature. Senta offers this — it's a differentiator there, but requires a full e-sign workflow. |
| **Client-facing document history / portal account** | "Let clients log back in to see their previous uploads" | Client accounts require password management, account recovery, session management — significant auth complexity for clients who interact infrequently (once or twice a year). Industry pattern: magic links are preferred over client accounts. | Token-based access for each upload session. If a client needs to see past uploads, accountant shares signed URL. No client login required. |
| **Two-way sync with cloud storage (Google Drive / Dropbox)** | "Automatically push received documents to our Google Drive" | Accountant-side cloud storage sync adds OAuth integration complexity (per provider), token management, file conflict resolution. High maintenance surface area. | Accountant can download any document via signed URL and save wherever they like. Build bulk download (ZIP) instead. |
| **Bulk client import via upload portal** | "Let clients upload all their documents in one ZIP" | ZIP extraction creates security risk (zip bombs, path traversal). Client UX for zipping files is worse than multi-file drag-and-drop. | Accept multiple individual files in one upload session. 10 files at once is sufficient. |
| **Public document sharing links (no expiry)** | "Create a permanent link to share with the client" | Permanent links to financial documents are a GDPR and security risk. No expiry = no access revocation. | Always use time-limited signed URLs (1 hour for download, 30 days for upload token). Regenerate on demand. |
| **Document version control** | "Keep all versions of a document when client resubmits" | Full version history for tax documents is rarely needed — the correct document replaces the incorrect one. Version control adds storage cost and UI complexity for marginal gain. | Allow replacing a document (upload new, mark old as superseded). Retain superseded version for 30 days then hard delete. Audit log records the replacement event. |
| **AI-generated document summaries** | "Summarise what each document contains" | LLM summarisation of financial documents carries hallucination risk. Accountants are trained to read these documents; a summary adds no professional value and could introduce errors that propagate to filings. | Document type label (P60, bank statement, etc.) plus upload date is sufficient metadata. Let the accountant read the document. |

---

## Feature Dependencies

```
[Document types catalog (filing_document_requirements)]
    └──required by──> [Checklist per filing type]
                          └──required by──> [Client upload portal checklist view]
                          └──required by──> [Per-client checklist customisation]
                          └──drives──> [Auto-classification on upload]

[Supabase Storage private bucket]
    └──required by──> [Document storage with access control]
                          └──required by──> [File upload from client]
                          └──required by──> [Document download (signed URL)]
                          └──required by──> [DSAR export]
                          └──required by──> [Retention enforcement cron]

[client_documents table]
    └──required by──> [Documents inline in filing type cards]
    └──required by──> [Accountant notification on upload]
    └──required by──> [Dashboard activity feed]
    └──required by──> [DSAR export]
    └──required by──> [Retention enforcement cron]

[document_access_log table]
    └──required by──> [Audit trail of access]
    └──feeds──> [DSAR export (manifest)]

[Upload token system (upload_tokens table)]
    └──required by──> [Client upload portal (no login)]
                          └──enhances──> [Deadline-anchored document requests]
                                             └──requires──> [Reminder template placeholder: {{upload_link}}]

[Postmark inbound webhook (already built)]
    └──extended by──> [Passive collection: attachment extraction]
                          └──requires──> [Supabase Storage bucket]
                          └──requires──> [client_documents table]
                          └──optionally uses──> [Auto-classification]

[Retention enforcement cron]
    └──requires──> [client_documents.retention_date column]
    └──requires──> [Supabase Edge Function runtime]

[DSAR export]
    └──requires──> [client_documents (all for client)]
    └──requires──> [document_access_log (all for client)]
    └──requires──> [Supabase Storage download (all files for client)]
    └──output──> [ZIP archive + JSON manifest]
```

### Dependency Notes

- **Document types catalog is the foundation:** Everything in the checklist and auto-classification system depends on `document_types` and `filing_document_requirements` being populated accurately before any other feature is built.
- **Storage bucket before client portal:** The upload portal cannot function without a configured Storage bucket with correct RLS policies. Build and test storage in isolation before wiring the portal.
- **Token system is independent of auth:** Upload tokens are UUID-based, stored in a dedicated table, and do not involve Supabase Auth. This is intentional — clients do not have accounts.
- **Passive collection extends existing Postmark webhook:** The inbound webhook route already parses the Postmark payload. Passive collection adds attachment extraction logic to that existing route. No new webhook infrastructure is needed.
- **Retention date must be set at upload time:** If `retention_date` is null, the retention cron cannot function. Default: `upload_date + 6 years + 1 day after end of the relevant accounting period`. This requires the document to be linked to a filing period, not just a client — which is enforced by the filing type FK on `client_documents`.

---

## MVP Definition (v4.0 Launch)

### Launch With (v4.0)

Minimum set to deliver a working, compliant document collection capability.

- [x] **Document types catalog** — Filing type → required document mappings. JSON or database seed. Foundation for everything else.
- [x] **client_documents table + Supabase Storage bucket** — Schema and storage infrastructure. Private bucket, EU West region, org-scoped paths.
- [x] **document_access_log table** — Audit trail. Required for GDPR compliance and DSAR.
- [x] **Retention date calculation** — Set at upload time. `retention_date` column on `client_documents`. Required by law (TMA 1970 / FA 1998 s12B).
- [x] **Active collection: client upload portal** — Token-based, no login, Prompt-branded with firm name, filing type checklist, drag-and-drop file upload. This is the primary client-facing feature.
- [x] **Passive collection: attachment extraction from inbound email** — Extend existing Postmark webhook to extract attachments and store in Supabase Storage. Auto-classify against document_types.
- [x] **Documents inline in filing type cards** — Document count and most recent upload date per filing type. Expand to file list with download link.
- [x] **Accountant notification on upload** — In-app notification + Postmark email. Configurable.
- [x] **Per-client checklist customisation** — Toggle items on/off, add ad-hoc items.
- [x] **Retention enforcement cron job** — Weekly Edge Function. Flag documents past or approaching retention date. Dashboard warning.
- [x] **DSAR export** — ZIP + JSON manifest for all documents held for a specific client. Initiatable from client detail page.
- [x] **Privacy policy + Terms amendments** — 7 identified gaps must be addressed before any client document data is collected. Legal requirement.

### Add After Validation (v4.x)

Features to add once core document collection is working and validated in production.

- [ ] **Dashboard activity feed** — Real-time cross-client submission feed. Add when practice size warrants it (>20 active clients).
- [ ] **Deadline-anchored document requests** — `{{upload_link}}` placeholder in reminder templates. Add when reminder template system is extended in a later sprint. Requires upload token generation to be integrated with cron.
- [ ] **Improved auto-classification** — ML-based or more sophisticated rule-based document type detection. Add when accountant feedback identifies misclassification as a friction point.
- [ ] **Bulk download (ZIP) of all documents per filing** — Quality of life for accountants wanting to download everything for a client-year to their local machine or their own filing system.
- [ ] **Email body parsing for document context** — Low confidence, high complexity. Only if passive collection proves insufficient for accurate classification.

### Future Consideration (v5+)

- [ ] **E-signatures** — Full engagement letter signing workflow. Separate product build. Competes with Senta's unlimited eSigning feature.
- [ ] **OCR / data extraction** — Extract specific fields from P60s, bank statements, etc. to pre-populate accounting software. Requires near-100% accuracy to be safe for tax use. Dext does this as a dedicated product.
- [ ] **Client portal login / document history** — If clients frequently need to review past uploads. Only justified if client-side engagement metrics show demand.
- [ ] **MTD API submission** — Submit VAT returns directly to HMRC MTD API from within Prompt. Phase 4 of strategic roadmap. Requires agent authorisation, MTD-compatible software recognition by HMRC, and significant compliance work.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Document types catalog (seed data) | HIGH | LOW | P1 — v4.0 foundation |
| client_documents table + Storage bucket | HIGH | MEDIUM | P1 — v4.0 foundation |
| document_access_log | HIGH | LOW | P1 — v4.0 compliance |
| Retention date calculation | HIGH | LOW | P1 — v4.0 legal requirement |
| Client upload portal (active collection) | HIGH | MEDIUM | P1 — v4.0 core |
| Checklist per filing type on upload portal | HIGH | MEDIUM | P1 — v4.0 differentiator |
| Passive collection (email attachments) | HIGH | MEDIUM | P1 — v4.0 differentiator |
| Documents inline in filing type cards | HIGH | LOW | P1 — v4.0 visibility |
| Accountant notification on upload | HIGH | LOW | P1 — v4.0 workflow |
| Per-client checklist customisation | MEDIUM | MEDIUM | P1 — v4.0 |
| Retention enforcement cron | HIGH | MEDIUM | P1 — v4.0 compliance |
| DSAR export | MEDIUM | HIGH | P1 — v4.0 legal requirement |
| Privacy policy + Terms amendments | HIGH | LOW | P1 — v4.0 must precede data collection |
| Dashboard activity feed | MEDIUM | LOW | P2 — v4.x |
| Deadline-anchored document requests | HIGH | MEDIUM | P2 — v4.x |
| Auto-classification improvements | MEDIUM | HIGH | P2 — v4.x |
| Bulk download (ZIP) | LOW | LOW | P2 — v4.x |
| E-signatures | MEDIUM | HIGH | P3 — v5+ |
| OCR / data extraction | MEDIUM | HIGH | P3 — v5+ |
| Client portal login / history | LOW | HIGH | P3 — v5+ |

**Priority key:**
- P1: Must ship in v4.0
- P2: Add in v4.x after validating core collection works
- P3: Future milestone (v5+)

---

## Competitor Feature Analysis

| Feature | TaxDome | Karbon | Senta | Dext | Prompt v4.0 |
|---------|---------|--------|-------|------|-------------|
| Client portal access | App + web login required | Magic link (launched mid-2025) | Client portal login | Client app / web | Magic link (no login, no app) |
| Document checklist | Yes, custom per client | Yes, via Client Requests | Yes, workflow-triggered | No (receipt capture only) | Yes, driven by UK filing type engine |
| Filing-deadline-aware checklist | No | No | Partial (via jobs/workflows) | No | Yes — SA100, CT600, VAT, Companies House specific |
| Passive collection from email | No | No | No | Email forwarding (for invoices) | Yes — Postmark inbound already implemented |
| UK-specific HMRC document types | Partial | No | No | Partial (receipts/invoices) | Yes — P60, P45, P11D, SA302, P32 catalog |
| Retention enforcement | No (manual) | No | No | Up to 10 years storage (not enforced) | Yes — 6-year cron + flagging |
| DSAR export | No (manual) | No | No | No | Yes — ZIP + JSON manifest |
| Conditional checklist items | No | No | No | No | Yes — conditional by client type, income sources |
| Inline documents in deadline cards | No | No | No | No | Yes — integrated with existing filing type cards |

**Key gap Prompt fills:** No competitor in the UK accounting SaaS market integrates document collection directly with a UK filing deadline engine. The checklist for an SA100 client looks different from a CT600 client. Documents are linked to specific filing years, not just floating in a folder. Passive collection from email replies is completely unique.

---

## UK Compliance Specifics

| Requirement | Source | Implementation Impact |
|------------|--------|-----------------------|
| **6-year record retention (companies)** | CH14600 HMRC Compliance Handbook; Companies Act 2006 s388 | `retention_date` on `client_documents` = filing period end + 6 years. Cron flags/notifies. |
| **5-year retention (individuals, self-employed)** | TMA 1970 s12B | SA100 documents: 5 years from 31 January filing deadline. Store retention_period_years per document_type or per filing type. |
| **Extended retention if HMRC enquiry open** | CH14600 | Flag: `enquiry_hold: boolean` on `client_documents`. While true, skip retention cron for that document. Accountant sets this manually. |
| **5-year retention for AML/KYC records** | MLR 2017 | AML documents (ID, proof of address) retained 5 years after end of business relationship, not end of filing year. |
| **GDPR right to erasure vs legal hold** | UK GDPR Art. 17 + HMRC retention requirements | HMRC retention creates a legal obligation that overrides GDPR right to erasure for the retention period. After retention period expires, erasure requests must be honoured. Document this in privacy policy. |
| **Data processor obligations** | UK GDPR | Prompt processes client data on behalf of accounting firms (controllers). Must have Data Processing Agreement (DPA) with each org. Document in Terms. |
| **Storage in EU** | UK GDPR (adequate transfers) | Supabase EU West region (Ireland). UK adequacy decision applies. Document in Privacy Policy. |

---

## Token-Based Access Patterns

The client upload portal is accessed via a token-link. Pattern used by industry:

| Platform | Access Method | Token Lifetime | Device Binding |
|----------|---------------|---------------|----------------|
| Karbon Client Requests | Magic link per request | 30 days | Yes — link associates with device on first access |
| Financial Cents | Magic link | Session | No |
| Uku | Magic link | Not published | No |
| Canopy | Secure link per task | Not published | No |
| **Prompt v4.0** | UUID token in URL, stored in `upload_tokens` table | 30 days from generation | No (simpler, sufficient for low-frequency use) |

**Recommended implementation:**
- `upload_tokens` table: `id (UUID)`, `client_id`, `filing_type`, `tax_period`, `org_id`, `created_at`, `expires_at` (30 days), `used_at` (null until first access)
- Token is generated by the accountant (manually) or by the reminder cron (automated, future)
- Portal page: `/{org-slug}/upload/{token}` — server-side validation, no Supabase Auth session
- No rate limiting needed for v4.0 (clients are known, volumes are low)
- Token does not expire on use — clients may need multiple sessions to upload all documents

---

## Sources

**HMRC Document Formats and Filing Requirements:**
- [P45, P60 and P11D forms: workers' guide — GOV.UK](https://www.gov.uk/paye-forms-p45-p60-p11d)
- [P60 — GOV.UK](https://www.gov.uk/paye-forms-p45-p60-p11d/p60)
- [P11D — GOV.UK](https://www.gov.uk/paye-forms-p45-p60-p11d/p11d)
- [SA302 tax calculation — GOV.UK](https://www.gov.uk/understand-self-assessment-bill/tax-calculation-sa302)
- [Get your SA302 — GOV.UK](https://www.gov.uk/sa302-tax-calculation)
- [Self Assessment tax return forms — GOV.UK](https://www.gov.uk/self-assessment-tax-return-forms)
- [Company Tax Return guide CT600 — HMRC](https://www.gov.uk/guidance/the-company-tax-return-guide)
- [P32 Employer Payment Record — Sage](https://www.sage.com/en-gb/blog/glossary/what-is-a-p32/)
- [VAT return — what to include — GOV.UK](https://www.gov.uk/submit-vat-return/what-to-include-in-a-vat-return)
- [File company annual accounts — GOV.UK](https://www.gov.uk/file-your-company-annual-accounts)

**Retention Requirements:**
- [CH14600 — Record Keeping: Corporation tax — HMRC internal manual](https://www.gov.uk/hmrc-internal-manuals/compliance-handbook/ch14600)
- [HMRC Records Management and Retention Policy — GOV.UK](https://www.gov.uk/government/publications/hmrc-records-management-and-retention-and-disposal-policy/records-management-and-retention-and-disposal-policy)
- [How long should accountants keep clients' records? — FreeAgent](https://www.freeagent.com/blog/how-long-should-accountants-keep-clients-records/)

**DSAR / GDPR:**
- [A guide to subject access — ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/subject-access-requests/a-guide-to-subject-access/)
- [Subject access requests — ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/subject-access-requests/)

**Competitor Portal Analysis:**
- [Karbon for Clients — Client Portal Software — Karbon](https://karbonhq.com/feature/client-portal/)
- [TaxDome client portal](https://taxdome.com/client-portal)
- [Senta Document Management](https://www.senta.co/gb/features/document-management-for-accountants/)
- [Dext capture receipts and invoices](https://dext.com/uk/business/product/capture-receipts-and-invoices)
- [Uku Client Portal](https://getuku.com/client-portal)
- [TaxDome Review 2026 — Uku](https://getuku.com/articles/taxdome-review)
- [12 great client portals for accountants — FutureFirm](https://futurefirm.co/client-portals-for-accountants/)
- [ContentSnare document collection software](https://contentsnare.com/document-collection-software/)
- [Clustdoc document collection for accountants](https://clustdoc.com/accounting-software/)

**Supabase Storage:**
- [Supabase Storage: create signed URL](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
- [Supabase Storage: create signed upload URL](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Supabase Storage buckets fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals)

**SA100 Document Checklists:**
- [Self Assessment documents for accountant — a-wise.co.uk](https://a-wise.co.uk/what-documents-do-you-need-for-self-assessment/)
- [What accountants need for Self Assessment — AbraTax](https://www.abratax.co.uk/blog/what-do-accountants-need-for-self-assessment/)
- [Self Assessment Checklist — GoSimpleTax](https://www.gosimpletax.com/blog/tax-return-checklist-and-tips/)

**Year-End / CT600 Checklists:**
- [Year End Accounts Checklist UK — Accounting Wise](https://a-wise.co.uk/year-end-accounts-checklist-uk/)
- [Annual accounting checklist for limited companies — Taxcare](https://taxcare.org.uk/annual-accounting-checklist-for-limited-companies-in-the-uk/)
- [CT600 guide — GOV.UK](https://assets.publishing.service.gov.uk/media/5a815ba9ed915d74e33fdc31/CT600_Guide.pdf)

---

*Feature research for: v4.0 Document Collection — Prompt*
*Researched: 2026-02-23*
*Confidence: HIGH for HMRC document formats and retention law (gov.uk verified); MEDIUM for competitor portal UX patterns and filing-document mappings (multiple accountant checklist sources, corroborating); LOW for email body parsing and ML classification (exploratory, no verified sources)*
