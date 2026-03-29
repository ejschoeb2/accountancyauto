import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "How the Client Portal Works — Guides",
  description:
    "How Prompt's client portal lets your clients upload documents through a simple, no-login page — with time-limited links, filing-specific checklists, and automatic tracking.",
};

export default function HowTheClientPortalWorksPage() {
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
              <span className="inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-pink-100 text-pink-700">
                Client Portal
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                <FileText size={10} />
                Article
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-5">
              How the Client Portal Works
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The client portal gives your clients a simple, no-login page to upload documents.
              Every reminder email includes a unique portal link tied to a specific client and
              filing, making document collection effortless for both sides.
            </p>
          </div>

          {/* Tutorial video */}
          <div className="mb-12">
            <div className="aspect-[16/10] bg-muted rounded-xl overflow-hidden border border-border/60 shadow-sm shadow-black/5">
              <video
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/tutorials/enable-client-portal.mp4`}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">The client experience</h2>
              <p className="mb-4">
                When a client clicks a portal link — whether from a reminder email or one you've
                shared manually — they land on a simple page showing exactly which documents are
                still outstanding for that filing. There's no account to create and no password
                to remember.
              </p>
              <p className="mb-4">
                The client can drag and drop files or browse to upload them, and the portal works
                on any device — desktop, tablet, or phone. Each upload is instantly tracked against
                the correct filing and checklist item, so documents land in the right place
                automatically.
              </p>
              <p>
                Once all required documents have been uploaded, the portal page updates to show
                that everything has been received, and the client's reminder sequence stops — no
                more chasing emails.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Portal links</h2>
              <p className="mb-4">
                Each portal link is unique to a specific client and filing. This means uploads
                are always associated with the right person and the right deadline — there's no
                ambiguity about who sent what or which period it's for.
              </p>
              <p className="mb-4">
                Links can be generated in two ways:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-3 mb-4">
                <li>
                  <strong>Automatically</strong> — included in reminder emails when the portal is
                  enabled. Each reminder contains a link specific to that client and filing.
                </li>
                <li>
                  <strong>Manually</strong> — generated from the client detail page for any active
                  filing. Useful for sharing via other channels or re-sending a link.
                </li>
              </ul>
              <p>
                Links can be revoked at any time from the client detail page if you need to
                invalidate access.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Link expiry</h2>
              <p className="mb-4">
                Portal links are time-limited for security. Each link's expiry is set automatically
                based on the reminder schedule — typically lasting until the next reminder step is
                due. If it's the final reminder step, the link lasts 30 days.
              </p>
              <p>
                When a link expires, the client sees a message explaining that the link is no longer
                active. They'll receive a fresh link in their next reminder email, or you can
                generate a new one manually from the client detail page.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Enabling the portal</h2>
              <p className="mb-4">
                The client portal is enabled from <strong>Settings → Client Portal</strong>. It's
                a single toggle — once enabled, portal links are automatically included in all
                outgoing reminder emails and available for manual generation from client detail
                pages.
              </p>
              <p>
                You can also configure upload checks from the same settings page, controlling how
                Prompt validates documents as they come in — from automatic acceptance through to
                full classification and verification.
              </p>
            </section>

          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
