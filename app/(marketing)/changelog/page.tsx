"use client";

import { motion } from "framer-motion";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

interface ChangelogEntry {
  version: string;
  date: string;
  heading: string;
  changes: string[];
  isLatest?: boolean;
}

const ENTRIES: ChangelogEntry[] = [
  {
    version: "v2.0",
    date: "March 2026",
    heading: "Getting started wizard, document progress, and smart email cancellation",
    isLatest: true,
    changes: [
      "Getting started wizard redesigned: guided setup flow with client type selection, filing activation, and a review step to check document progress before going live.",
      "Document collection progress visible in the Client Deadlines table — see at a glance how many mandatory documents each client has submitted per filing.",
      "Smart email cancellation: queued reminders are automatically cancelled when a client's records are marked as received, and visual line-through styling marks cancelled emails clearly.",
      "Edit progress mode: toggle inline editing on the deadlines table to update document status and filing assignments without leaving the page.",
      "Open Graph metadata and new favicon for polished link previews when sharing Prompt.",
    ],
  },
  {
    version: "v1.9",
    date: "March 2026",
    heading: "Bulk actions, filing toggles, and deadline overrides",
    changes: [
      "Bulk edit toolbar: select multiple clients and pause, cancel, or reschedule reminders in a single action from the client table.",
      "Filing type toggles with icons: activate or deactivate individual filing types per client with a clear on/off control and deactivation confirmation.",
      "Deadline overrides API: per-client deadline customisation now available, allowing practices to set bespoke dates where HMRC defaults don't apply.",
      "Client type filtering on document requirements: configure which documents are required based on whether a client is a limited company, sole trader, or partnership.",
    ],
  },
  {
    version: "v1.8",
    date: "February 2026",
    heading: "VAT stagger groups, Firm plan, and comparison page",
    changes: [
      "VAT stagger group support: deadlines now calculated automatically for all three HMRC VAT stagger groups — no more manual quarter tracking.",
      "Firm plan: new pricing tier for practices beyond 300 clients, scaling at £0.60 per additional client with no upper ceiling.",
      "Comparison page added to the marketing site, setting Prompt against generic reminder tools and manual processes.",
    ],
  },
  {
    version: "v1.7",
    date: "January 2026",
    heading: "Marketing updates and Self Assessment season",
    changes: [
      "News & updates section live on the marketing site — product announcements and HMRC deadline news in one place.",
      "FAQ section added to the homepage, covering common questions about deadlines, client portals, and billing.",
      "Self Assessment season: January 31 deadline reminders dispatched on schedule across all active organisations.",
    ],
  },
  {
    version: "v1.6",
    date: "December 2025",
    heading: "Client upload portal and document storage",
    changes: [
      "Client portal: clients can now upload documents directly via a secure, no-login token link included in every reminder.",
      "Document storage: uploaded files are stored securely in EU-region infrastructure and visible from the client detail page.",
      "Checklist customisation: configure which documents are required per client, per filing type.",
    ],
  },
  {
    version: "v1.5",
    date: "November 2025",
    heading: "Bulk import, email logs, and inbound replies",
    changes: [
      "Bulk CSV import: add up to 500 clients from a spreadsheet in a single step — with validation and error reporting per row.",
      "Email logs tab: full history of every reminder sent, with delivery status, timestamp, and recipient address.",
      "Inbound email handling: clients can reply directly to reminders and responses are captured and logged against the client record.",
    ],
  },
  {
    version: "v1.4",
    date: "October 2025",
    heading: "Companies House reminders, teams, and audit log",
    changes: [
      "Companies House annual return reminders: confirmation statement deadlines now tracked and chased automatically.",
      "Multi-user teams: invite colleagues to your practice account with role-based access control.",
      "Audit log: every change to client records — edits, deletions, status updates — is tracked with timestamp and user.",
    ],
  },
  {
    version: "v1.3",
    date: "September 2025",
    heading: "Corporation Tax, status badges, and practice settings",
    changes: [
      "Corporation Tax and CT600 deadline tracking: both the payment deadline (9 months + 1 day) and the filing deadline (12 months) are now tracked per client.",
      "Traffic light status badges: each client shows a colour-coded status — green (on track), amber (approaching), red (overdue).",
      "Practice-level settings: configure the daily send hour and the from-address for all outbound reminder emails.",
    ],
  },
  {
    version: "v1.0",
    date: "August 2025",
    heading: "Initial launch",
    changes: [
      "Self Assessment and VAT reminders for UK accountants — the core pipeline that started it all.",
      "Customisable email templates with smart placeholders: client name, deadline date, filing type, and more.",
      "Free tier: up to 10 clients at no cost, no time limit, no credit card required.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="min-h-screen">
      <MarketingNav />

      <section className="py-20 lg:py-28">
        <div className="max-w-screen-xl mx-auto px-4">

          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className="mb-16 lg:mb-20"
          >
            <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
              Changelog
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15] max-w-2xl">
              What&rsquo;s new in Prompt.
            </h1>
            <p className="mt-5 text-base text-muted-foreground max-w-xl leading-relaxed">
              A running record of every release — features shipped, improvements made, and deadlines kept.
            </p>
          </motion.div>

          {/* Timeline */}
          <div className="relative">

            {/* Vertical spine */}
            <div
              className="absolute left-[7.5rem] top-0 bottom-0 w-px bg-border/60 hidden lg:block"
              aria-hidden
            />

            <ol className="space-y-0">
              {ENTRIES.map((entry, index) => (
                <motion.li
                  key={entry.version}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.4, 0, 0.2, 1],
                    delay: index * 0.07,
                  }}
                  className="relative flex flex-col lg:flex-row gap-6 lg:gap-0 pb-14 last:pb-0"
                >

                  {/* Left column: version + date */}
                  <div className="lg:w-48 lg:pr-10 lg:pt-0.5 flex-shrink-0 flex flex-row items-baseline lg:items-end lg:flex-col gap-2 lg:gap-1">

                    {/* Version + date inline on mobile, stacked on desktop */}
                    <div className="flex items-baseline gap-2">
                      <span
                        className={[
                          "text-sm font-bold",
                          entry.isLatest
                            ? "text-violet-600 dark:text-violet-400"
                            : "text-foreground",
                        ].join(" ")}
                      >
                        {entry.version}
                      </span>
                      {entry.isLatest && (
                        <span className="rounded-full bg-violet-100 dark:bg-violet-950 px-2 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                          Latest
                        </span>
                      )}
                    </div>

                    {/* Date */}
                    <span className="text-[12px] text-muted-foreground/60 font-medium whitespace-nowrap lg:text-right">
                      {entry.date}
                    </span>
                  </div>

                  {/* Spine connector dot — desktop only */}
                  <div
                    className="hidden lg:flex absolute left-[7.5rem] top-[3px] -translate-x-1/2 w-3 h-3 rounded-full border-2 items-center justify-center flex-shrink-0 z-10 bg-background"
                    style={{
                      borderColor: entry.isLatest
                        ? "rgb(124 58 237)" // violet-600
                        : "rgb(var(--border))",
                    }}
                    aria-hidden
                  >
                    {entry.isLatest && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-600 block" />
                    )}
                  </div>

                  {/* Right column: content */}
                  <div className="lg:pl-12 flex-1 min-w-0">
                    <h2 className="text-[17px] font-bold text-foreground leading-snug mb-4">
                      {entry.heading}
                    </h2>
                    <ul className="space-y-2.5">
                      {entry.changes.map((change, ci) => (
                        <li key={ci} className="flex items-start gap-3">
                          <span
                            className={[
                              "mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0",
                              entry.isLatest
                                ? "bg-violet-500"
                                : "bg-muted-foreground/40",
                            ].join(" ")}
                            aria-hidden
                          />
                          <span className="text-sm text-muted-foreground leading-relaxed">
                            {change}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Divider between entries — mobile only */}
                    <div className="lg:hidden mt-10 h-px bg-border/50" />
                  </div>

                </motion.li>
              ))}
            </ol>

          </div>

          {/* Bottom note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: ENTRIES.length * 0.07 + 0.2, duration: 0.4 }}
            className="mt-20 text-sm text-muted-foreground/50 text-center"
          >
            Have a feature request?{" "}
            <a
              href="mailto:info@prompt.accountants"
              className="text-violet-500 hover:text-violet-400 transition-colors"
            >
              Let us know.
            </a>
          </motion.p>

        </div>
      </section>

      <FooterSection />
    </main>
  );
}
