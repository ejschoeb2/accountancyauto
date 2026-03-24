import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Getting Started with Prompt — Guides",
  description:
    "Set up your Prompt organisation, connect your email provider, configure filing types, and add your first clients.",
};

export default function GettingStartedPage() {
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
              <span className="inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                Getting Started
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                <BookOpen size={10} />
                Guide
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-5">
              Getting Started with Prompt
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Prompt is an automated reminder system built for UK accounting practices. It tracks
              filing deadlines for every client, sends reminder emails on a schedule you control,
              and gives clients a simple portal to upload documents — all without manual
              intervention. This guide walks you through the full initial setup.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">What Prompt does</h2>
              <p className="mb-4">
                Most accounting practices manage client reminders through a mix of spreadsheets,
                calendar alerts, and manual emails. This works when your client list is small, but
                it doesn't scale — and it's easy for things to slip through the gaps.
              </p>
              <p className="mb-4">
                Prompt replaces that process with a single system. You enter your clients once, and
                Prompt automatically calculates every relevant filing deadline — Corporation Tax,
                CT600, Companies House accounts, VAT returns, and Self Assessment — based on each
                client's year-end date and entity type.
              </p>
              <p>
                When a deadline approaches, Prompt sends reminder emails to your clients on the
                schedule you've set up, using the templates you've written. If you've enabled the
                client portal, each reminder includes a link where the client can upload their
                documents directly. Once all documents are received, the reminders stop
                automatically.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Step 1: The setup wizard</h2>
              <p className="mb-4">
                When you first sign in, Prompt walks you through a short setup wizard. The wizard
                collects the basic information needed to get your organisation running:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 mb-4">
                <li>
                  <strong>Practice name</strong> — this appears in the Prompt dashboard and is used
                  as the sender name for outgoing emails.
                </li>
                <li>
                  <strong>Contact email</strong> — the address clients can reply to if they have
                  questions about a reminder.
                </li>
                <li>
                  <strong>Filing types</strong> — you'll choose which types of filing your practice
                  handles. Only the types you activate will generate deadlines and reminders.
                </li>
              </ul>
              <p>
                The wizard is intentionally brief. You don't need to add clients, configure
                templates, or set up email sending before you can complete it — those all happen
                afterwards at your own pace.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Step 2: Connect your email sending provider</h2>
              <p className="mb-4">
                Prompt sends reminder emails through Postmark, a transactional email service. By
                default, emails are sent from a Prompt address, but we strongly recommend setting
                up a custom sending domain so that reminders arrive from your own practice domain
                rather than from Prompt's.
              </p>
              <p className="mb-4">
                To set up a custom domain, go to <strong>Settings → Email</strong> and follow the
                DNS configuration steps. You'll add a few DNS records to your domain registrar —
                typically a DKIM record and an SPF entry — and Prompt will verify the configuration
                automatically.
              </p>
              <p>
                Once verified, all outgoing reminders will show your domain as the sender. This
                improves deliverability and means clients recognise the email as coming from your
                practice rather than an unfamiliar address.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Step 3: Configure your filing types and reminder schedules</h2>
              <p className="mb-4">
                Each filing type in Prompt has its own reminder schedule — a sequence of emails
                sent at specific intervals before the deadline. The default schedules are designed
                to work well for most practices, but you can adjust the timing and number of
                reminders to match how your practice operates.
              </p>
              <p className="mb-4">
                Go to <strong>Deadlines</strong> in the main navigation to see all active filing
                types and their schedules. For each type, you can:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 mb-4">
                <li>Edit the reminder schedule (number of steps, days between each)</li>
                <li>Assign a different email template to each step in the sequence</li>
                <li>Deactivate a filing type entirely if your practice doesn't handle it</li>
                <li>Create custom filing types for internal deadlines or non-standard obligations</li>
              </ul>
              <p>
                You don't need to configure templates before activating a filing type — Prompt
                will use a default template until you create your own.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Step 4: Add your clients</h2>
              <p className="mb-4">
                Clients are the core of Prompt. Each client has a year-end date, an entity type,
                and an email address — and from those three pieces of information, Prompt calculates
                all of their relevant deadlines automatically.
              </p>
              <p className="mb-4">
                You have two options for adding clients:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-2 mb-4">
                <li>
                  <strong>Add manually</strong> — use the Add Client dialog in the Clients section
                  to enter one client at a time. This is the right approach when you're adding a
                  handful of clients or onboarding a new client mid-year.
                </li>
                <li>
                  <strong>Import from CSV</strong> — if you're migrating from a spreadsheet or
                  another tool, the CSV import lets you bring your entire client list in at once.
                  You'll map your columns to Prompt's fields, and Prompt will validate the data
                  before importing.
                </li>
              </ul>
              <p>
                Once clients are in the system, Prompt immediately begins calculating their
                deadlines. Any client whose deadline is within the reminder window will start
                receiving emails on the next pipeline run, which happens daily.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Step 5: Set up email templates</h2>
              <p className="mb-4">
                Email templates define what your reminder emails say. You can use placeholder
                variables — like the client's name, the filing type, and the deadline date — so
                a single template works for your entire client base with the correct details filled
                in automatically.
              </p>
              <p className="mb-4">
                Go to <strong>Email Templates</strong> in the navigation to create your templates.
                A good starting point is three templates per major filing type: an early reminder,
                a mid-point chase, and a final urgent reminder. Each should have a different tone
                that escalates appropriately as the deadline gets closer.
              </p>
              <p>
                Once your templates are ready, return to the Deadlines section and assign them to
                the appropriate steps in each filing type's reminder schedule.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Your dashboard is ready</h2>
              <p className="mb-4">
                Once you have clients in the system and templates configured, the Prompt dashboard
                gives you a live view of your practice's compliance status. The upcoming deadlines
                widget shows what's coming up across your entire client base. The workload forecast
                helps you spot busy periods weeks or months in advance. The to-do list surfaces
                items that need your attention today.
              </p>
              <p>
                From here, Prompt runs automatically every day. Reminders go out on schedule,
                portal uploads are tracked, and your dashboard reflects the current state of every
                client — without you having to chase anything manually.
              </p>
            </section>

          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
