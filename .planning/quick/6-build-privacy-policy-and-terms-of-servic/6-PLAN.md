---
phase: quick-06
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(marketing)/privacy/page.tsx
  - app/(marketing)/terms/page.tsx
  - components/marketing/footer-section.tsx
autonomous: true
requirements: [LEGAL-01, LEGAL-02]
must_haves:
  truths:
    - "User can navigate to /privacy and see a comprehensive UK GDPR-compliant privacy policy"
    - "User can navigate to /terms and see complete terms of service"
    - "Footer links for Privacy Policy and Terms of Service navigate to the correct pages"
    - "Both pages have consistent layout with MarketingNav and FooterSection"
  artifacts:
    - path: "app/(marketing)/privacy/page.tsx"
      provides: "Privacy policy page with UK GDPR-compliant content"
      min_lines: 150
    - path: "app/(marketing)/terms/page.tsx"
      provides: "Terms of service page with all required sections"
      min_lines: 120
    - path: "components/marketing/footer-section.tsx"
      provides: "Footer with working /privacy and /terms links"
      contains: "href=\"/privacy\""
  key_links:
    - from: "components/marketing/footer-section.tsx"
      to: "app/(marketing)/privacy/page.tsx"
      via: "anchor href"
      pattern: "href=\"/privacy\""
    - from: "components/marketing/footer-section.tsx"
      to: "app/(marketing)/terms/page.tsx"
      via: "anchor href"
      pattern: "href=\"/terms\""
---

<objective>
Create privacy policy and terms of service pages for the Prompt marketing site with UK GDPR-compliant content, and update the footer to link to them.

Purpose: Legal compliance pages required before public launch. Privacy policy must cover UK GDPR requirements for a SaaS that processes accountant and client PII. Terms must cover SaaS subscription terms under England & Wales law.
Output: Two new marketing pages (`/privacy`, `/terms`) and updated footer links.
</objective>

<execution_context>
@C:/Users/ejsch/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/ejsch/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/marketing/footer-section.tsx
@app/(marketing)/layout.tsx
@app/(marketing)/page.tsx
@components/marketing/nav.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create privacy policy and terms of service pages</name>
  <files>app/(marketing)/privacy/page.tsx, app/(marketing)/terms/page.tsx</files>
  <action>
Create two new pages following the existing marketing page pattern (MarketingNav at top, content area, FooterSection at bottom). Both are server components (no "use client" needed — content is static).

Each page exports metadata for SEO. Use the same `max-w-4xl mx-auto px-6` container pattern for the prose content area. Style headings, paragraphs, and lists with Tailwind utility classes directly (no @tailwindcss/typography plugin — it is not installed). Suggested prose styles:
- Section headings: `text-2xl font-bold mt-10 mb-4`
- Sub-headings: `text-xl font-semibold mt-8 mb-3`
- Paragraphs: `text-base text-muted-foreground leading-relaxed mb-4`
- Lists: `list-disc pl-6 space-y-2 text-muted-foreground mb-4`
- Strong/bold inline: `font-semibold text-foreground`
- Top title: `text-3xl lg:text-4xl font-bold mb-2` with a `text-sm text-muted-foreground mb-8` for "Last updated: February 2026"
- Add `py-16 lg:py-24` vertical padding to the content wrapper

**Privacy Policy (`app/(marketing)/privacy/page.tsx`)** must include ALL of these sections:

1. **Introduction** — Prompt provides automated client reminder services for UK accounting practices. This policy explains how we collect, use, and protect personal data under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.

2. **Identity & Contact Details** — Prompt (the trading name). Contact: privacy@phasetwo.uk. Data controller for platform data; data processor for client data stored by accountants.

3. **Data We Collect:**
   - Account data: email address, name, organisation name and slug
   - Client data (stored by accountants as data controllers): client names, email addresses, UTRs (Unique Taxpayer References), company registration numbers, addresses
   - Billing data: Stripe handles all card details — we never see or store card numbers. We store Stripe customer ID and subscription status.
   - Authentication data: magic link emails, session cookies
   - Usage data: email send logs, audit trail entries

4. **Our Role as Data Processor** — When accountants store client PII, we act as a data processor under Article 28 UK GDPR. Accountants are data controllers for their client data and are responsible for having lawful basis to store and process it. We process client data only as instructed (sending reminders, rendering email templates).

5. **Lawful Basis for Processing:**
   - Contract performance (Article 6(1)(b)) — providing the SaaS service
   - Legitimate interests (Article 6(1)(f)) — security, fraud prevention, service improvement
   - Legal obligation (Article 6(1)(c)) — tax records, regulatory compliance

6. **How We Use Your Data** — Processing activities:
   - Account management and authentication
   - Email template rendering with client data placeholders (TipTap rich text to email-safe HTML)
   - Automated deadline-based reminder sending via configurable schedules
   - Ad-hoc email sending on behalf of accountants
   - Transactional email delivery via Postmark
   - Subscription billing via Stripe

7. **Sub-processors** — table format listing:
   - Supabase Inc. (USA) — Database hosting, authentication, row-level security
   - MessageBird B.V. / Postmark (Netherlands/USA) — Transactional email delivery
   - Stripe Inc. (USA) — Payment processing, subscription management
   - Vercel Inc. (USA) — Application hosting, CDN, serverless functions

8. **International Data Transfers** — Sub-processors in the USA operate under appropriate safeguards including Standard Contractual Clauses (SCCs) and, where applicable, UK International Data Transfer Agreements (IDTAs).

9. **Data Retention** — Data retained for duration of active subscription. On account termination, data deleted within 30 days. Email logs retained for 12 months for compliance. Stripe retains payment data per their own retention policy.

10. **Data Security** — Row-level security (RLS) for complete tenant isolation. All connections encrypted via TLS. Organisation-scoped data access — no cross-tenant data visibility. Authentication via secure magic links (no passwords stored).

11. **Multi-tenancy & Data Isolation** — Each organisation's data is completely isolated using database-level row-level security policies. No organisation can access another's data. Super-admin access is restricted and audited.

12. **Your Rights Under UK GDPR** — list of rights:
    - Right of access (Article 15)
    - Right to rectification (Article 16)
    - Right to erasure (Article 17)
    - Right to restrict processing (Article 18)
    - Right to data portability (Article 20)
    - Right to object (Article 21)
    - Contact privacy@phasetwo.uk to exercise any right

13. **Cookies** — We use only strictly necessary cookies for authentication session management (Supabase auth). No tracking cookies, no analytics cookies, no third-party advertising cookies. No cookie consent banner is required as these are strictly necessary under the Privacy and Electronic Communications Regulations 2003 (PECR).

14. **Children** — Our services are not directed at individuals under the age of 18.

15. **Complaints** — Right to lodge a complaint with the Information Commissioner's Office (ICO). Provide ICO website: ico.org.uk. ICO helpline: 0303 123 1113.

16. **Changes to This Policy** — We may update this policy. Changes posted on this page with updated date.

**Terms of Service (`app/(marketing)/terms/page.tsx`)** must include ALL of these sections:

1. **Introduction** — These terms govern use of Prompt, an automated client reminder service for UK accounting practices operated by Prompt ("we", "us", "our"). By using Prompt you agree to these terms.

2. **Service Description** — SaaS platform that automates client reminder emails for UK accountants. Features include: deadline tracking (Corporation Tax, VAT, Self Assessment, Companies House), customisable email templates, automated and ad-hoc email sending, client management, multi-user team access.

3. **Account Registration & Responsibilities** — Must provide accurate email. Responsible for account security. Must not share credentials. Must notify us of unauthorised access.

4. **Acceptable Use** — Must not: use for unlawful purposes, send spam or unsolicited emails, upload malicious content, attempt to breach security or access other organisations' data, exceed reasonable usage limits.

5. **Subscription & Billing:**
   - Free trial period available
   - Paid plans billed monthly via Stripe
   - Prices may change with 30 days notice
   - Cancellation takes effect at end of current billing period
   - No refunds for partial months
   - We may suspend access for non-payment

6. **Data Processing** — We process client data as a data processor on your behalf. You remain the data controller for client data. You must have lawful basis to store client PII. Refer to our Privacy Policy for full details. We will not access, use, or disclose client data except as necessary to provide the service.

7. **Intellectual Property** — We own all IP in the platform. You retain ownership of your data. You grant us a licence to process your data solely to provide the service.

8. **Availability & Support** — We aim for high availability but do not guarantee 100% uptime. We may perform maintenance with reasonable notice. Support provided via email.

9. **Limitation of Liability:**
   - Service provided "as is"
   - We are not liable for: indirect or consequential losses, loss of profit, loss of data (beyond our reasonable control), actions taken based on reminders sent through the service
   - Maximum liability capped at fees paid in the 12 months preceding the claim
   - Nothing excludes liability for death/personal injury from negligence, fraud, or fraudulent misrepresentation

10. **Indemnification** — You indemnify us against claims arising from: your use of the service, your client data, your breach of these terms.

11. **Termination:**
    - You may cancel your subscription at any time
    - We may terminate for material breach (with 14 days notice to cure)
    - We may terminate immediately for: illegal activity, non-payment exceeding 30 days, actions that harm other users
    - On termination, data deleted within 30 days

12. **Changes to Terms** — We may update these terms with 30 days notice via email. Continued use after notice period constitutes acceptance.

13. **Governing Law** — These terms are governed by the laws of England and Wales. Courts of England and Wales have exclusive jurisdiction.

14. **Contact** — Questions about these terms: legal@phasetwo.uk
  </action>
  <verify>
Run `npx next build 2>&1 | head -30` to confirm both pages compile without errors. Verify files exist:
- `app/(marketing)/privacy/page.tsx`
- `app/(marketing)/terms/page.tsx`
  </verify>
  <done>Both /privacy and /terms pages render with MarketingNav, comprehensive legal content, and FooterSection. Privacy policy covers all 16 UK GDPR sections. Terms cover all 14 sections.</done>
</task>

<task type="auto">
  <name>Task 2: Update footer links to point to /privacy and /terms</name>
  <files>components/marketing/footer-section.tsx</files>
  <action>
In `components/marketing/footer-section.tsx`, update the two placeholder `href="#"` links:
- Change `<a href="#">Privacy Policy</a>` to `<a href="/privacy">Privacy Policy</a>`
- Change `<a href="#">Terms of Service</a>` to `<a href="/terms">Terms of Service</a>`

No other changes to the footer component.
  </action>
  <verify>Grep for `href="#"` in `components/marketing/footer-section.tsx` — should return zero matches (no remaining placeholder links). Grep for `href="/privacy"` and `href="/terms"` should each return one match.</verify>
  <done>Footer Privacy Policy link points to /privacy and Terms of Service link points to /terms. No remaining # placeholder links in the footer navigation.</done>
</task>

</tasks>

<verification>
1. `npx next build` completes without errors
2. No `href="#"` placeholder links remain in footer-section.tsx
3. Both pages follow the marketing layout pattern (MarketingNav + content + FooterSection)
4. Privacy policy contains sections for: UK GDPR, data processor role, sub-processors, international transfers, individual rights, ICO complaints
5. Terms contain sections for: governing law (England & Wales), limitation of liability, billing terms, data processing, termination
</verification>

<success_criteria>
- /privacy page renders comprehensive UK GDPR-compliant privacy policy with all 16 sections
- /terms page renders complete terms of service with all 14 sections
- Footer links navigate to correct pages
- Both pages share consistent layout with the marketing homepage (MarketingNav + FooterSection)
- Build succeeds with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/6-build-privacy-policy-and-terms-of-servic/6-SUMMARY.md`
</output>
