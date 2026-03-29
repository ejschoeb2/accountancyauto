import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Setting Up a Custom Sending Domain — Guides",
  description:
    "Configure a custom email domain with DKIM and SPF records so reminder emails are sent from your practice's own domain.",
};

export default function SettingUpACustomSendingDomainPage() {
  return (
    <main className="min-h-screen">
      <MarketingNav />

      <section className="pt-10 lg:pt-14 pb-20 lg:pb-28">
        <div className="max-w-3xl mx-auto px-4">

          {/* Back link */}
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft size={15} />
            Back to guides
          </Link>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <span className="inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                Settings
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                <BookOpen size={10} />
                Guide
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-5">
              Setting Up a Custom Sending Domain
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              By default, reminder emails are sent from a Prompt address. Setting up a custom
              sending domain means your clients see emails coming from your own practice domain,
              which improves deliverability and builds trust.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Why use a custom domain?</h2>
              <p className="mb-4">
                When emails come from your own domain (e.g. <code className="text-sm bg-muted px-1.5 py-0.5 rounded">reminders@yourfirm.co.uk</code>),
                clients are far more likely to recognise and open them. It also reduces the chance
                of emails landing in spam, because the receiving mail server can verify the message
                genuinely came from your domain.
              </p>
              <p>
                Without a custom domain, emails are sent from a shared Prompt address. This works
                fine functionally, but your clients may not recognise the sender and could ignore
                or mark the email as spam.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">What you need</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Access to your domain&apos;s DNS settings (usually through your domain registrar
                  or hosting provider — e.g. Cloudflare, GoDaddy, 123 Reg, Namecheap).
                </li>
                <li>
                  The domain you want to send from (e.g. <code className="text-sm bg-muted px-1.5 py-0.5 rounded">yourfirm.co.uk</code>).
                </li>
              </ul>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Step-by-step setup</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">1. Go to Settings &rarr; Email</h3>
                  <p>
                    Navigate to the <strong>Settings</strong> page and switch to the <strong>Email</strong> tab.
                    You&apos;ll find the <strong>Custom Sending Domain</strong> card.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">2. Enter your domain</h3>
                  <p>
                    Type your practice domain (e.g. <code className="text-sm bg-muted px-1.5 py-0.5 rounded">yourfirm.co.uk</code>)
                    into the input field and click <strong>Set Up Domain</strong>. Prompt will generate
                    the DNS records you need to add.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">3. Add the DNS records</h3>
                  <p className="mb-3">
                    Prompt will display the exact DNS records to add. There are typically two types:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>DKIM record</strong> — A TXT record that lets receiving mail servers verify
                      the email was genuinely sent by your domain and hasn&apos;t been tampered with.
                    </li>
                    <li>
                      <strong>Return-Path (CNAME)</strong> — A record that routes bounce notifications
                      back to Prompt so delivery failures are tracked correctly.
                    </li>
                  </ul>
                  <p className="mt-3">
                    Prompt includes setup instructions for the most common domain providers (Cloudflare,
                    GoDaddy, 123 Reg, and others). Select your provider to see tailored instructions.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">4. Wait for verification</h3>
                  <p>
                    DNS changes can take anywhere from a few minutes to 48 hours to propagate, though
                    most providers update within an hour. Prompt will automatically check and verify
                    your records once they&apos;re live.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">5. Start sending</h3>
                  <p>
                    Once verified, all future emails — automated reminders and ad-hoc sends — will
                    come from your custom domain. No further configuration is needed.
                  </p>
                </div>
              </div>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Troubleshooting</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Records not verifying?</strong> Double-check that you&apos;ve added the
                  records to the correct domain (not a subdomain) and that there are no typos in
                  the record values.
                </li>
                <li>
                  <strong>Using Cloudflare?</strong> Make sure the DNS record proxy status is set
                  to <strong>DNS only</strong> (grey cloud), not <strong>Proxied</strong> (orange
                  cloud). Cloudflare&apos;s proxy can interfere with email DNS records.
                </li>
                <li>
                  <strong>Already have SPF/DKIM records?</strong> If your domain already has
                  existing email infrastructure, you may need to merge records rather than replace
                  them. Consult your IT provider if unsure.
                </li>
              </ul>
            </section>

          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
