import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Understanding Document Verdicts — Guides",
  description:
    "How Prompt classifies uploaded documents, what each verdict level means, and how to review and clear flagged documents.",
};

function VerdictPill({
  label,
  bg,
  text,
  dot,
}: {
  label: string;
  bg: string;
  text: string;
  dot: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${bg} ${text}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export default function UnderstandingDocumentVerdictsPage() {
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
              <span className="inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700">
                Documents
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                <FileText size={10} />
                Article
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-5">
              Understanding Document Verdicts
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              When a client uploads a document, Prompt doesn't just store it — it analyses the
              content and assigns a verdict that tells you how confident it is that the document
              is what it should be. This article explains how that works, what each verdict means,
              and what to do when a document needs your attention.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Why verdicts exist</h2>
              <p className="mb-4">
                Clients uploading their own documents don't always know exactly what's needed.
                They might upload last year's P60 when you need this year's, attach a bank
                statement for the wrong account, or simply grab the wrong file from their
                downloads folder. Without any automated check, you'd only discover this problem
                during preparation — after the reminder sequence has already stopped.
              </p>
              <p>
                Verdicts give you an early-warning system. Most of the time a document is exactly
                what it should be and the verdict confirms that automatically. When something
                looks off, Prompt flags it for your review before you've committed to treating
                the document as received.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-6">The four verdict levels</h2>

              <div className="space-y-4">

                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <VerdictPill label="Verified" bg="bg-green-100" text="text-green-700" dot="bg-green-500" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The document matches the expected type with high confidence. The classification
                    pipeline identified the document correctly, and all applicable validation
                    rules — such as tax year and PAYE reference — passed. No action required.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <VerdictPill label="Likely match" bg="bg-amber-100" text="text-amber-700" dot="bg-amber-400" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The document probably matches the expected type, but the pipeline's confidence
                    is below the threshold for a full Verified verdict. This typically happens
                    when the document's text content is partially legible, the format is unusual,
                    or the classification matched on fewer signals than normal.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                    Likely match documents are accepted into the checklist without requiring manual
                    review. You'll see the amber indicator in the document list as a note, but
                    no action is required unless you want to inspect it.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <VerdictPill label="Low confidence" bg="bg-red-100" text="text-red-700" dot="bg-red-500" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The pipeline could not reliably identify the document as matching the expected
                    type. This might mean the client has uploaded the wrong document entirely, or
                    the file is a scan of poor quality that couldn't be read properly.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                    Low confidence documents are flagged for your review. They appear in the
                    to-do list and in the activity log with the red indicator. They do not count
                    as received on the checklist until you either accept or reject them after
                    manual inspection.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <VerdictPill label="Review needed" bg="bg-amber-100" text="text-amber-700" dot="bg-amber-400" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The document was identified correctly, but a specific validation rule failed.
                    Common reasons include: the tax year on the document doesn't match the filing
                    period, the employer name or PAYE reference doesn't match what's on file for
                    the client, or a required field is missing or unreadable.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                    Review needed is the most important verdict to act on, because the document
                    has been identified as real but potentially incorrect for this specific filing.
                    Like Low confidence, these documents don't count as received until cleared.
                  </p>
                </div>

              </div>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">How the classification pipeline works</h2>
              <p className="mb-4">
                When a document is uploaded, Prompt runs it through a multi-step pipeline:
              </p>
              <ol className="list-decimal list-outside ml-5 space-y-3 mb-4">
                <li>
                  <strong>Text extraction</strong> — the file's text content is extracted. For
                  PDFs this uses the embedded text layer. For image files and scanned documents,
                  OCR is used to read the content.
                </li>
                <li>
                  <strong>Document type classification</strong> — the extracted text is matched
                  against patterns associated with known document types: P60s, P11Ds, SA302s,
                  VAT return confirmations, bank statements, and more. The classifier assigns a
                  confidence score based on how many matching signals were found.
                </li>
                <li>
                  <strong>Validation rules</strong> — if the document type is identified above
                  the confidence threshold, specific rules are applied depending on the type.
                  A P60 will be checked for a matching tax year and PAYE reference. A corporation
                  tax document will be checked for the correct company registration period.
                </li>
                <li>
                  <strong>Verdict assignment</strong> — the combination of confidence score and
                  validation outcome determines the final verdict.
                </li>
              </ol>
              <p>
                The pipeline runs automatically on upload and typically completes within a few
                seconds. The verdict is visible in the document list as soon as processing is
                complete.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Filtering by verdict in the activity log</h2>
              <p className="mb-4">
                The document activity log (<strong>Documents → Activity</strong>) shows every
                document uploaded across your entire practice. You can filter the log by verdict
                to quickly surface documents that need attention:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 mb-4">
                <li>
                  Filter to <strong>Low confidence</strong> and <strong>Review needed</strong>
                  to see everything flagged for review across all clients.
                </li>
                <li>
                  Filter to <strong>Verified</strong> during busy periods to confirm that
                  high-volume uploads are landing cleanly.
                </li>
                <li>
                  Combine the verdict filter with a client or date filter to focus on a specific
                  filing period.
                </li>
              </ul>
              <p>
                Flagged documents also appear in the dashboard to-do list, so you don't need to
                check the activity log proactively — items that need review will surface
                automatically.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Clearing review flags</h2>
              <p className="mb-4">
                To clear a flag, open the document from the activity log or the client detail
                page. You'll see the verdict, the specific reason it was flagged, and a preview
                of the document.
              </p>
              <p className="mb-4">
                After reviewing, you have two options:
              </p>
              <div className="space-y-3 mb-4">
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="font-semibold text-foreground text-sm mb-1">Accept the document</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You've reviewed it and are satisfied it's correct despite the flag. Accepting
                    changes the verdict to Verified, counts the document as received on the
                    checklist, and clears it from the to-do list.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="font-semibold text-foreground text-sm mb-1">Reject the document</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The document isn't what you need. Rejecting removes it from the checklist.
                    You can optionally send the client a notification asking them to upload a
                    replacement — this uses the standard portal link so they can re-upload
                    without needing to contact you first.
                  </p>
                </div>
              </div>
              <p>
                Until a flagged document is either accepted or rejected, it doesn't count as
                received. This means the reminder sequence continues running for that client —
                which is the correct behaviour, since you don't yet have the document you need.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Adjusting upload validation in settings</h2>
              <p className="mb-4">
                If you find that the pipeline is flagging documents too aggressively — or not
                aggressively enough — you can adjust the validation settings in{" "}
                <strong>Settings → Upload Checks</strong>.
              </p>
              <p className="mb-4">
                The available modes are:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2">
                <li>
                  <strong>Strict</strong> — all four verdict levels are active, and both Low
                  confidence and Review needed documents require manual clearance before counting
                  as received.
                </li>
                <li>
                  <strong>Standard</strong> (default) — Low confidence and Review needed require
                  clearance. Likely match is accepted automatically.
                </li>
                <li>
                  <strong>Relaxed</strong> — only Review needed requires manual clearance. Low
                  confidence documents are accepted automatically with an amber indicator.
                </li>
                <li>
                  <strong>Off</strong> — no validation is run. All uploads are accepted
                  immediately as received. Not recommended for practices that handle HMRC
                  penalty exposure.
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
