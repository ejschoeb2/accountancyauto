import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Managing Portal Documents & Checklists — Guides",
  description:
    "How to view, download, and manage client document uploads, mark records as received manually, and customise checklists per client.",
};

export default function ManagingPortalDocumentsPage() {
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
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                <BookOpen size={10} />
                Guide
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-5">
              Managing Portal Documents & Checklists
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Every document uploaded through the portal is tracked against the client and filing
              it belongs to. This guide explains how to view and manage uploads, record documents
              received outside the portal, and customise the document checklist for individual
              clients.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">How document tracking works</h2>
              <p className="mb-4">
                Each active filing in Prompt has a document checklist — a list of the documents
                you need from the client before you can complete the filing. The default checklist
                for each filing type is based on what HMRC and Companies House typically require,
                but you can customise it for any individual client.
              </p>
              <p className="mb-4">
                When a client uploads a document through their portal link, it's automatically
                matched to the correct filing and added to the checklist. Prompt also runs
                validation checks on the upload — checking file type, content, and other criteria
                depending on your settings — and assigns a verdict to each document.
              </p>
              <p>
                Once all items on the checklist are marked as received, the filing's reminder
                sequence stops. Your client won't receive any more chasing emails for that period.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Viewing uploads from the client detail page</h2>
              <p className="mb-4">
                The most direct way to manage a client's documents is from their detail page. Open
                a client from the Clients table, then scroll to the filing you want to review.
                Each filing shows its checklist with the current status of every document — whether
                it's been uploaded, manually marked as received, or is still outstanding.
              </p>
              <p className="mb-4">
                Clicking on an uploaded document opens the document preview, where you can:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 mb-4">
                <li>Preview the document in-browser without downloading it</li>
                <li>See the verdict assigned by Prompt's validation pipeline</li>
                <li>Download the original file</li>
                <li>Remove the document if it was uploaded in error</li>
              </ul>
              <p>
                You can also view all uploads across your entire client base from{" "}
                <strong>Documents → Activity Log</strong>, which lets you search and filter by
                client, filing type, date, and document verdict.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Marking documents as received manually</h2>
              <p className="mb-4">
                Not every client uses the portal. Some will email documents directly, others will
                post physical copies. When that happens, you can mark the document as received
                manually so that Prompt's checklist reflects the real state of things.
              </p>
              <p className="mb-4">
                On the client detail page, find the relevant checklist item and use the Mark as
                received option. This updates the checklist status to received without requiring
                an actual file upload — the reminder pipeline treats manually received documents
                the same as portal uploads when checking whether all documents are in.
              </p>
              <p>
                If you later receive the digital version, you can upload it and the record will be
                linked to the same checklist item, replacing the manual entry with the actual file.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Customising the checklist per client</h2>
              <p className="mb-4">
                Every client is different. A sole trader filing a Self Assessment return needs
                different documents than a limited company with PAYE and rental income. Prompt's
                default checklists cover the standard case for each filing type, but you can
                adjust them per client to match their specific circumstances.
              </p>
              <p className="mb-4">
                From the client detail page, open the checklist editor for any filing. You can:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 mb-4">
                <li>Remove checklist items that don't apply to this client</li>
                <li>Add items that are specific to this client's situation</li>
                <li>Rename items to match the terminology the client is familiar with</li>
              </ul>
              <p>
                Customisations apply to that client's filing only and don't affect the default
                checklist for other clients. If you want to change the default for all new
                clients, update the template in{" "}
                <strong>Settings → Document Checklists</strong>.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Clearing review flags</h2>
              <p className="mb-4">
                When Prompt's validation pipeline can't automatically verify a document, it
                assigns a "Review needed" verdict and flags it for your attention. These flags
                appear in the to-do list on the dashboard and in the document activity log.
              </p>
              <p className="mb-4">
                To clear a review flag, open the document from the client detail page or the
                activity log, inspect it manually, and mark it as either accepted or rejected.
                Accepting clears the flag and updates the verdict to Verified. Rejecting removes
                the document from the checklist and can optionally trigger a notification to the
                client asking them to upload a replacement.
              </p>
              <p>
                Documents with uncleared review flags don't count as received for the purposes of
                stopping the reminder sequence — so clearing flags promptly keeps your checklists
                accurate.
              </p>
            </section>

          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
