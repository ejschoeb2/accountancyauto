import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Privacy Policy — Prompt",
  description:
    "How Prompt collects, uses, and protects personal data under UK GDPR and the Data Protection Act 2018.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <MarketingNav />

      <div className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-6">

          {/* Page header */}
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: February 2026</p>

          {/* 1. Introduction */}
          <h2 className="text-2xl font-bold mt-10 mb-4">1. Introduction</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Prompt provides automated client reminder services for UK accounting practices. This policy explains how we collect, use, and protect personal data under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            By using Prompt, you agree to the collection and use of information in accordance with this policy. We are committed to protecting your privacy and the privacy of the clients whose data is entrusted to us by your organisation.
          </p>

          {/* 2. Identity & Contact Details */}
          <h2 className="text-2xl font-bold mt-10 mb-4">2. Identity and Contact Details</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Prompt is the trading name for this service. For the purposes of UK GDPR, we act as:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li><span className="font-semibold text-foreground">Data controller</span> for platform data — information collected when you create and manage your account, including your name, email address, and subscription details.</li>
            <li><span className="font-semibold text-foreground">Data processor</span> for client data — personal data about your clients that you store within the platform. In this capacity, we process data only on your instructions.</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            For all privacy-related enquiries, contact us at: <span className="font-semibold text-foreground">privacy@phasetwo.uk</span>
          </p>

          {/* 3. Data We Collect */}
          <h2 className="text-2xl font-bold mt-10 mb-4">3. Data We Collect</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We collect and process the following categories of personal data:
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-3">Account Data</h3>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Email address and name</li>
            <li>Organisation name and slug (your unique URL identifier)</li>
            <li>Role within your organisation (admin or member)</li>
            <li>Account creation and last active timestamps</li>
          </ul>

          <h3 className="text-xl font-semibold mt-8 mb-3">Client Data (Stored by Accountants as Data Controllers)</h3>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Client names and email addresses</li>
            <li>UTRs (Unique Taxpayer References)</li>
            <li>Company registration numbers</li>
            <li>Postal addresses</li>
            <li>Filing deadlines and accounting period dates</li>
            <li>VAT stagger group information</li>
          </ul>

          <h3 className="text-xl font-semibold mt-8 mb-3">Billing Data</h3>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Stripe handles all card details — we never see or store card numbers, CVV codes, or full payment card information</li>
            <li>We store your Stripe customer ID and subscription status</li>
            <li>Subscription plan, billing period, and trial end date</li>
          </ul>

          <h3 className="text-xl font-semibold mt-8 mb-3">Authentication Data</h3>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Magic link emails (one-time login links sent via Postmark)</li>
            <li>Session cookies for maintaining authenticated state</li>
          </ul>

          <h3 className="text-xl font-semibold mt-8 mb-3">Usage Data</h3>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Email send logs (timestamps, delivery status, email type)</li>
            <li>Audit trail entries for account and client changes</li>
            <li>Inbound email metadata (for reply tracking)</li>
          </ul>

          {/* 4. Our Role as Data Processor */}
          <h2 className="text-2xl font-bold mt-10 mb-4">4. Our Role as Data Processor</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            When accountants store client PII within Prompt, we act as a <span className="font-semibold text-foreground">data processor</span> under Article 28 of UK GDPR. Accountants are the data controllers for their client data and are responsible for:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Having a lawful basis to collect and store client personal data</li>
            <li>Ensuring clients are informed that their data may be used for automated reminders</li>
            <li>Maintaining appropriate data processing agreements with their own clients</li>
            <li>Ensuring the accuracy of client data entered into the platform</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We process client data only as instructed — specifically for sending reminders, rendering email templates, and delivering email communications. We will not access, use, or disclose client data for any other purpose.
          </p>

          {/* 5. Lawful Basis */}
          <h2 className="text-2xl font-bold mt-10 mb-4">5. Lawful Basis for Processing</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We rely on the following lawful bases under Article 6 of UK GDPR:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li><span className="font-semibold text-foreground">Contract performance (Article 6(1)(b))</span> — Processing your account data is necessary to provide the Prompt SaaS service and fulfil our contractual obligations to you.</li>
            <li><span className="font-semibold text-foreground">Legitimate interests (Article 6(1)(f))</span> — We process certain data for security purposes, fraud prevention, and service improvement where our legitimate interests are not overridden by your privacy rights.</li>
            <li><span className="font-semibold text-foreground">Legal obligation (Article 6(1)(c))</span> — We may process data where required by law, including for tax records, regulatory compliance, and responding to lawful requests from public authorities.</li>
          </ul>

          {/* 6. How We Use Your Data */}
          <h2 className="text-2xl font-bold mt-10 mb-4">6. How We Use Your Data</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We use personal data for the following processing activities:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Account management and user authentication via secure magic links</li>
            <li>Email template rendering with client data placeholders (rich text editor output to email-safe HTML)</li>
            <li>Automated deadline-based reminder sending via configurable schedules</li>
            <li>Ad-hoc email sending on behalf of accountants to their clients</li>
            <li>Transactional email delivery via Postmark</li>
            <li>Subscription billing management via Stripe</li>
            <li>Audit trail recording for account and client changes</li>
            <li>Inbound email reply tracking and client record updates</li>
            <li>System notifications (trial reminders, payment failures) sent to account holders</li>
          </ul>

          {/* 7. Sub-processors */}
          <h2 className="text-2xl font-bold mt-10 mb-4">7. Sub-processors</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We engage the following sub-processors to provide the Prompt service. Each has been assessed for compliance with UK GDPR requirements:
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-4 font-semibold text-foreground">Sub-processor</th>
                  <th className="text-left py-3 pr-4 font-semibold text-foreground">Location</th>
                  <th className="text-left py-3 font-semibold text-foreground">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border">
                  <td className="py-3 pr-4">Supabase Inc.</td>
                  <td className="py-3 pr-4">USA</td>
                  <td className="py-3">Database hosting, authentication, row-level security</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 pr-4">MessageBird B.V. / Postmark</td>
                  <td className="py-3 pr-4">Netherlands / USA</td>
                  <td className="py-3">Transactional email delivery</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 pr-4">Stripe Inc.</td>
                  <td className="py-3 pr-4">USA</td>
                  <td className="py-3">Payment processing, subscription management</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Vercel Inc.</td>
                  <td className="py-3 pr-4">USA</td>
                  <td className="py-3">Application hosting, CDN, serverless functions</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 8. International Data Transfers */}
          <h2 className="text-2xl font-bold mt-10 mb-4">8. International Data Transfers</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Our sub-processors in the USA receive personal data as part of providing the Prompt service. These transfers are conducted under appropriate safeguards including:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Standard Contractual Clauses (SCCs) as approved by the European Commission and adapted for UK use</li>
            <li>UK International Data Transfer Agreements (IDTAs) where applicable</li>
            <li>Each sub-processor&apos;s own UK GDPR-compliant data processing agreements</li>
          </ul>

          {/* 9. Data Retention */}
          <h2 className="text-2xl font-bold mt-10 mb-4">9. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Account and client data is retained for the duration of your active subscription</li>
            <li>On account termination or cancellation, all data is deleted within 30 days</li>
            <li>Email logs are retained for 12 months for compliance and audit purposes</li>
            <li>Stripe retains payment and billing data per their own retention policy, independent of our deletion</li>
            <li>Backup data may be retained for up to 7 days beyond deletion requests (database backup rotation)</li>
          </ul>

          {/* 10. Data Security */}
          <h2 className="text-2xl font-bold mt-10 mb-4">10. Data Security</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We implement appropriate technical and organisational measures to protect personal data:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Row-level security (RLS) enforced at the database level for complete tenant isolation</li>
            <li>All connections encrypted via TLS in transit</li>
            <li>Organisation-scoped data access — no cross-tenant data visibility at any layer</li>
            <li>Authentication via secure magic links — no passwords are stored</li>
            <li>API routes protected by server-side session verification</li>
            <li>Environment secrets managed outside of application code</li>
          </ul>

          {/* 11. Multi-tenancy & Data Isolation */}
          <h2 className="text-2xl font-bold mt-10 mb-4">11. Multi-tenancy and Data Isolation</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Prompt is a multi-tenant SaaS platform. Each organisation&apos;s data is completely isolated using database-level row-level security policies. No organisation can access, view, or influence another organisation&apos;s data under any circumstances.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Super-admin access for platform operations is restricted to authorised personnel and is audited. Super-admins can view organisation metadata (such as subscription status and user counts) but cannot access client data.
          </p>

          {/* 12. Your Rights Under UK GDPR */}
          <h2 className="text-2xl font-bold mt-10 mb-4">12. Your Rights Under UK GDPR</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            As a data subject, you have the following rights under UK GDPR:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li><span className="font-semibold text-foreground">Right of access (Article 15)</span> — You may request a copy of the personal data we hold about you.</li>
            <li><span className="font-semibold text-foreground">Right to rectification (Article 16)</span> — You may request correction of inaccurate or incomplete personal data.</li>
            <li><span className="font-semibold text-foreground">Right to erasure (Article 17)</span> — You may request deletion of your personal data, subject to legal retention obligations.</li>
            <li><span className="font-semibold text-foreground">Right to restrict processing (Article 18)</span> — You may request that we limit how we use your personal data in certain circumstances.</li>
            <li><span className="font-semibold text-foreground">Right to data portability (Article 20)</span> — You may request a machine-readable copy of your personal data for transfer to another controller.</li>
            <li><span className="font-semibold text-foreground">Right to object (Article 21)</span> — You may object to processing based on legitimate interests.</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            To exercise any of these rights, contact us at <span className="font-semibold text-foreground">privacy@phasetwo.uk</span>. We will respond within one month of receipt of your request.
          </p>

          {/* 13. Cookies */}
          <h2 className="text-2xl font-bold mt-10 mb-4">13. Cookies</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We use only <span className="font-semibold text-foreground">strictly necessary cookies</span> for authentication session management, provided by Supabase Auth. These cookies are required for the service to function and cannot be disabled while using the platform.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We do not use tracking cookies, analytics cookies, advertising cookies, or any third-party cookies for marketing purposes. No cookie consent banner is required under the Privacy and Electronic Communications Regulations 2003 (PECR) as these are strictly necessary cookies.
          </p>

          {/* 14. Children */}
          <h2 className="text-2xl font-bold mt-10 mb-4">14. Children</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Our services are not directed at individuals under the age of 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us at privacy@phasetwo.uk and we will delete that information.
          </p>

          {/* 15. Complaints */}
          <h2 className="text-2xl font-bold mt-10 mb-4">15. Complaints</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            If you are dissatisfied with how we handle your personal data, you have the right to lodge a complaint with the <span className="font-semibold text-foreground">Information Commissioner&apos;s Office (ICO)</span>, the UK&apos;s supervisory authority for data protection:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Website: <span className="font-semibold text-foreground">ico.org.uk</span></li>
            <li>Helpline: <span className="font-semibold text-foreground">0303 123 1113</span></li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We would, however, appreciate the opportunity to address your concerns before you approach the ICO. Please contact us at privacy@phasetwo.uk in the first instance.
          </p>

          {/* 16. Changes to This Policy */}
          <h2 className="text-2xl font-bold mt-10 mb-4">16. Changes to This Policy</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We may update this privacy policy from time to time. Changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date. For significant changes, we will notify you via email to the address associated with your account. We encourage you to review this policy periodically.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Your continued use of Prompt after any changes constitutes acceptance of the updated policy.
          </p>

        </div>
      </div>

      <FooterSection />
    </main>
  );
}
