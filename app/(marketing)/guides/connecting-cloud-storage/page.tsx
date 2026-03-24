import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Connecting Cloud Storage — Guides",
  description:
    "How to connect Dropbox, Google Drive, or OneDrive to Prompt for automatic document sync, including folder structure and re-authorisation.",
};

export default function ConnectingCloudStoragePage() {
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
              Connecting Cloud Storage
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Prompt integrates with Dropbox, Google Drive, and Microsoft OneDrive so that
              documents uploaded by clients are automatically synced to your existing cloud
              storage. This guide covers how the integration works, how to connect your provider,
              and what to do when authorisation expires.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Supported providers</h2>
              <p className="mb-4">
                Prompt currently supports three cloud storage providers:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 mb-4">
                <li><strong>Dropbox</strong> — personal and business accounts</li>
                <li><strong>Google Drive</strong> — including Google Workspace accounts</li>
                <li><strong>Microsoft OneDrive</strong> — personal and Microsoft 365 accounts</li>
              </ul>
              <p>
                You can only connect one provider at a time. If you want to switch providers, you
                disconnect the current one and connect a new one — documents already synced remain
                in the old location, but new uploads will go to the new provider.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">How the integration works</h2>
              <p className="mb-4">
                When a client uploads a document through the portal, Prompt stores it internally
                and — if cloud storage is connected — pushes a copy to your cloud storage account
                at the same time.
              </p>
              <p className="mb-4">
                A few things to understand about how this works:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-3 mb-4">
                <li>
                  <strong>Prompt only writes — it never deletes.</strong> If you remove a document
                  from Prompt, the copy in your cloud storage is not affected. Your cloud storage
                  is treated as an append-only archive.
                </li>
                <li>
                  <strong>Sync is one-way.</strong> Files you add directly to the cloud storage
                  folder are not imported into Prompt. The integration is for exporting from Prompt
                  to your storage, not the other way around.
                </li>
                <li>
                  <strong>Manual uploads are also synced.</strong> If you upload a document
                  directly inside Prompt (rather than via the client portal), it's still pushed
                  to cloud storage.
                </li>
              </ul>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Connecting your provider</h2>
              <p className="mb-4">
                Go to <strong>Settings → Integrations</strong> and click Connect next to your
                preferred provider. You'll be redirected to the provider's authorisation page,
                where you sign in (if not already) and grant Prompt permission to write files to
                your account.
              </p>
              <p className="mb-4">
                Prompt requests the minimum permissions needed — write access to a specific folder
                rather than full access to your entire storage account. On Google Drive, this
                means Prompt can only see and modify files it creates itself. On Dropbox and
                OneDrive, access is scoped to a dedicated Prompt folder.
              </p>
              <p>
                Once connected, you'll see the provider listed as active on the Integrations page,
                along with the folder path where documents will be stored.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Folder structure</h2>
              <p className="mb-4">
                Documents are organised into a consistent folder hierarchy within the Prompt
                folder in your cloud storage:
              </p>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-5 font-mono text-[13px] text-foreground/80 leading-relaxed">
                <p>Prompt/</p>
                <p>&nbsp;&nbsp;├── Clients/</p>
                <p>&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── Acme Ltd/</p>
                <p>&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── Corporation Tax 2024/</p>
                <p>&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── bank-statements-q4.pdf</p>
                <p>&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── VAT Return Q1 2025/</p>
                <p>&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── vat-records.xlsx</p>
                <p>&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── John Smith/</p>
                <p>&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── Self Assessment 2024/</p>
                <p>&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── p60-2024.pdf</p>
              </div>
              <p className="mt-4">
                Each client gets their own folder, and within that, each filing period gets a
                subfolder. If a client's name changes in Prompt, new files go into a folder with
                the new name — existing files in the old folder are left in place.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Re-authorising expired connections</h2>
              <p className="mb-4">
                Cloud storage authorisations expire periodically. When this happens, new uploads
                won't be synced, and you'll see a warning on the Integrations settings page and
                in the dashboard notification area.
              </p>
              <p className="mb-4">
                To re-authorise, go to <strong>Settings → Integrations</strong> and click
                Reconnect next to your provider. This takes you through the same OAuth flow as
                the initial connection. No files are lost during a re-authorisation — once the
                connection is restored, Prompt will catch up on any uploads that were missed while
                the connection was expired.
              </p>
              <p>
                To avoid interruptions, Prompt sends an email notification to organisation Admins
                a few days before a connection is due to expire, where the expiry date is known
                in advance.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Cloud storage alongside Prompt's built-in hosting</h2>
              <p className="mb-4">
                Connecting cloud storage doesn't replace Prompt's built-in document storage —
                both work in parallel. Every uploaded document remains accessible inside Prompt
                regardless of whether you've connected a cloud provider. Cloud storage is an
                additional copy, not a replacement.
              </p>
              <p>
                This means you can disconnect your cloud storage at any point without losing
                access to any documents. Everything uploaded to date remains available in Prompt's
                document viewer and activity log.
              </p>
            </section>

          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
