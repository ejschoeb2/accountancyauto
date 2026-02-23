import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Terms of Service — Prompt",
  description:
    "Terms governing use of Prompt, the automated client reminder service for UK accounting practices. Governed by English law.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <MarketingNav />

      <div className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-6">

          {/* Page header */}
          <h1 className="text-3xl lg:text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: February 2026</p>

          {/* 1. Introduction */}
          <h2 className="text-2xl font-bold mt-10 mb-4">1. Introduction</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            These terms govern your use of Prompt, an automated client reminder service for UK accounting practices operated by Prompt (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By creating an account or using the service, you agree to be bound by these terms.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            If you are accepting these terms on behalf of an organisation, you represent that you have the authority to bind that organisation to these terms.
          </p>

          {/* 2. Service Description */}
          <h2 className="text-2xl font-bold mt-10 mb-4">2. Service Description</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Prompt is a SaaS platform that automates client reminder emails for UK accountants. The service includes:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Deadline tracking for Corporation Tax, VAT, Self Assessment, and Companies House filings</li>
            <li>Customisable email templates with client data merge fields</li>
            <li>Automated and ad-hoc email sending to clients</li>
            <li>Client management with filing status tracking</li>
            <li>Multi-user team access with role-based permissions</li>
            <li>Email delivery via Postmark with inbound reply tracking</li>
            <li>Subscription billing management</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We reserve the right to modify, update, or discontinue features of the service with reasonable notice.
          </p>

          {/* 3. Account Registration */}
          <h2 className="text-2xl font-bold mt-10 mb-4">3. Account Registration and Responsibilities</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            To use Prompt, you must register for an account. You agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Provide accurate, current, and complete information during registration</li>
            <li>Maintain the security of your account and magic link emails</li>
            <li>Not share your login credentials or account access with unauthorised individuals</li>
            <li>Notify us immediately at legal@phasetwo.uk if you become aware of any unauthorised access to your account</li>
            <li>Ensure all team members you invite to your organisation comply with these terms</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            You are responsible for all activities that occur under your account and for the actions of any team members you add to your organisation.
          </p>

          {/* 4. Acceptable Use */}
          <h2 className="text-2xl font-bold mt-10 mb-4">4. Acceptable Use</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            You must not use Prompt to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Send spam, unsolicited commercial email, or messages to individuals who have not consented to receive them</li>
            <li>Violate any applicable law or regulation, including the UK GDPR, PECR, or CAN-SPAM Act</li>
            <li>Upload, store, or transmit malicious code, viruses, or harmful content</li>
            <li>Attempt to breach or circumvent our security measures, or access another organisation&apos;s data</li>
            <li>Use the service in a way that could damage, disable, overburden, or impair our infrastructure</li>
            <li>Exceed reasonable usage limits in a manner that adversely affects other users</li>
            <li>Misrepresent your identity or affiliation when sending emails through the service</li>
            <li>Use the service for any purpose other than automated client communications for legitimate accounting practice operations</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We reserve the right to suspend or terminate accounts that violate these acceptable use provisions, without refund.
          </p>

          {/* 5. Subscription & Billing */}
          <h2 className="text-2xl font-bold mt-10 mb-4">5. Subscription and Billing</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li><span className="font-semibold text-foreground">Free trial:</span> New accounts receive a free trial period to evaluate the service. No payment details are required during the trial.</li>
            <li><span className="font-semibold text-foreground">Paid plans:</span> Following the trial, continued use requires a paid subscription. Plans are billed monthly via Stripe.</li>
            <li><span className="font-semibold text-foreground">Price changes:</span> We may change subscription prices with 30 days&apos; written notice via email. Continued use after the notice period constitutes acceptance of the new price.</li>
            <li><span className="font-semibold text-foreground">Cancellation:</span> You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. You retain access until that date.</li>
            <li><span className="font-semibold text-foreground">Refunds:</span> We do not provide refunds for partial billing periods or unused time remaining after cancellation.</li>
            <li><span className="font-semibold text-foreground">Non-payment:</span> We may suspend or downgrade access to the service if payment fails. We will attempt to notify you via email before suspending access.</li>
            <li><span className="font-semibold text-foreground">Taxes:</span> Prices are shown excluding VAT where applicable. VAT will be charged as required by applicable law.</li>
          </ul>

          {/* 6. Data Processing */}
          <h2 className="text-2xl font-bold mt-10 mb-4">6. Data Processing</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We process your client data as a data processor on your behalf under Article 28 of UK GDPR. You remain the data controller for all client personal data you enter into the platform. You must:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Have a lawful basis under UK GDPR to collect and store client personal data</li>
            <li>Ensure your clients are informed that their data may be used to send automated reminder emails</li>
            <li>Maintain appropriate data processing agreements with your clients where required</li>
            <li>Not enter special category data (such as health data, biometric data, or criminal record data) into the platform; financial documents that are necessary for the purpose of tax return preparation and filing (including P60s, SA302s, bank statements, dividend vouchers, and similar HMRC or Companies House records) are permitted as they fall within the ordinary scope of accountancy services</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We will not access, use, share, or disclose client data except as strictly necessary to provide the service. Our full data processing practices are set out in our{" "}
            <a href="/privacy" className="underline text-foreground hover:text-muted-foreground transition-colors">Privacy Policy</a>.
          </p>

          {/* 7. Intellectual Property */}
          <h2 className="text-2xl font-bold mt-10 mb-4">7. Intellectual Property</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We own all intellectual property rights in the Prompt platform, including its software, design, trademarks, and documentation. These terms do not grant you any rights to our intellectual property other than the limited right to use the service as described.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            You retain full ownership of your data — including client records, email templates, and schedules you create within the platform. You grant us a limited, non-exclusive licence to process your data solely as necessary to provide and operate the service.
          </p>

          {/* 8. Availability & Support */}
          <h2 className="text-2xl font-bold mt-10 mb-4">8. Availability and Support</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We aim to maintain high availability of the Prompt service but do not guarantee 100% uptime. The service is provided on a best-efforts basis. We may:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Perform scheduled maintenance, which we will aim to schedule outside of UK business hours with reasonable notice</li>
            <li>Experience unplanned outages due to infrastructure failures, third-party dependencies, or security incidents</li>
            <li>Modify or update the service, including changing or removing features, with reasonable notice</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Support is provided via email. We will respond to support requests within 2 business days. We do not currently offer phone or live chat support.
          </p>

          {/* 9. Limitation of Liability */}
          <h2 className="text-2xl font-bold mt-10 mb-4">9. Limitation of Liability</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind, express or implied. To the maximum extent permitted by applicable law:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>We are not liable for any indirect, incidental, consequential, or punitive losses or damages</li>
            <li>We are not liable for loss of profit, loss of revenue, loss of goodwill, or loss of anticipated savings</li>
            <li>We are not liable for loss of data beyond what is within our reasonable control</li>
            <li>We are not liable for any actions taken, or not taken, by your clients based on reminders sent through the service — Prompt is a communication tool and does not provide accounting, tax, or legal advice</li>
            <li>Our maximum aggregate liability to you for any claim arising from or related to these terms or the service shall not exceed the total fees paid by you in the 12 months immediately preceding the claim</li>
          </ul>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Nothing in these terms limits or excludes liability for: death or personal injury caused by our negligence; fraud or fraudulent misrepresentation; or any other liability that cannot be excluded by law.
          </p>

          {/* 10. Indemnification */}
          <h2 className="text-2xl font-bold mt-10 mb-4">10. Indemnification</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            You agree to indemnify, defend, and hold harmless Prompt and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li>Your use of the service in violation of these terms</li>
            <li>Your client data, including any claims by clients or third parties relating to emails sent through the service</li>
            <li>Your breach of any applicable law or regulation, including data protection law</li>
            <li>Any misrepresentation made by you to your clients or third parties</li>
          </ul>

          {/* 11. Termination */}
          <h2 className="text-2xl font-bold mt-10 mb-4">11. Termination</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
            <li><span className="font-semibold text-foreground">Cancellation by you:</span> You may cancel your subscription at any time via the billing settings in your account. Cancellation takes effect at the end of the current billing period.</li>
            <li><span className="font-semibold text-foreground">Termination for breach:</span> We may terminate your account for material breach of these terms after giving 14 days&apos; written notice and an opportunity to cure the breach.</li>
            <li><span className="font-semibold text-foreground">Immediate termination:</span> We may terminate your account immediately, without notice or refund, for: illegal activity using the service; non-payment exceeding 30 days after the due date; actions that cause harm to other users or to the platform; or serious breach of the acceptable use provisions.</li>
            <li><span className="font-semibold text-foreground">Effect of termination:</span> Upon termination, your right to access the service ceases immediately. All data associated with your account will be deleted within 30 days of the termination date.</li>
          </ul>

          {/* 12. Changes to Terms */}
          <h2 className="text-2xl font-bold mt-10 mb-4">12. Changes to These Terms</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            We may update these terms from time to time. We will provide at least 30 days&apos; notice of material changes via email to the address associated with your account. The updated terms will also be posted on this page with a revised &ldquo;Last updated&rdquo; date.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Your continued use of the service after the 30-day notice period constitutes acceptance of the updated terms. If you do not agree to the updated terms, you may cancel your account before the changes take effect.
          </p>

          {/* 13. Governing Law */}
          <h2 className="text-2xl font-bold mt-10 mb-4">13. Governing Law</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            These terms are governed by and construed in accordance with the laws of <span className="font-semibold text-foreground">England and Wales</span>. You and we both agree to submit to the exclusive jurisdiction of the courts of England and Wales for the resolution of any disputes arising under or in connection with these terms.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            If any provision of these terms is found to be invalid or unenforceable, the remaining provisions will continue in full force and effect.
          </p>

          {/* 14. Contact */}
          <h2 className="text-2xl font-bold mt-10 mb-4">14. Contact</h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            If you have questions about these terms, please contact us at:
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Email: <span className="font-semibold text-foreground">legal@phasetwo.uk</span>
          </p>

        </div>
      </div>

      <FooterSection />
    </main>
  );
}
