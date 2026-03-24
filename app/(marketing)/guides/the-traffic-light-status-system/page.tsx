import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "The Traffic-Light Status System — Guides",
  description:
    "How Prompt's colour-coded urgency system works, what each colour means, where statuses appear, and how to use them to prioritise your workload.",
};

function StatusPill({
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

export default function TrafficLightStatusSystemPage() {
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
              <span className="inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                Clients
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                <FileText size={10} />
                Article
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-5">
              The Traffic-Light Status System
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Every filing deadline in Prompt is colour-coded by urgency. At a glance, you can
              see the state of every client across your entire practice — what's overdue, what
              needs attention soon, and what's comfortably on track. This article explains each
              colour, the exact thresholds that trigger status changes, and how to use the system
              to prioritise your workload.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-6">The six status levels</h2>

              <div className="space-y-4">

                {/* Overdue */}
                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <StatusPill label="Overdue" bg="bg-red-100" text="text-red-700" dot="bg-red-500" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The deadline has passed and the filing has not been marked as complete. This
                    is the highest urgency level. Overdue filings should be addressed immediately
                    — late penalties from HMRC and Companies House begin accruing from the day
                    after the deadline.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                    Prompt continues sending reminder emails after the deadline until the filing
                    is marked complete or the client is paused.
                  </p>
                </div>

                {/* Critical */}
                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <StatusPill label="Critical" bg="bg-orange-100" text="text-orange-700" dot="bg-orange-500" />
                    <span className="text-[12px] text-muted-foreground">7 days or fewer remaining</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The deadline is within 7 days and the filing is still outstanding. At this
                    stage, even if the client uploads documents today, there may not be enough
                    time to complete the filing before the deadline. Critical filings warrant
                    direct contact — a phone call rather than an email.
                  </p>
                </div>

                {/* Approaching */}
                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <StatusPill label="Approaching" bg="bg-amber-100" text="text-amber-700" dot="bg-amber-400" />
                    <span className="text-[12px] text-muted-foreground">8–28 days remaining</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The deadline is within the next four weeks. There's still time to act, but
                    not time to be complacent. Approaching filings should be on your radar — if
                    a client hasn't responded to reminders yet, this is the point to follow up
                    more actively.
                  </p>
                </div>

                {/* On track */}
                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <StatusPill label="On track" bg="bg-blue-100" text="text-blue-700" dot="bg-blue-500" />
                    <span className="text-[12px] text-muted-foreground">More than 28 days remaining</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The deadline is more than four weeks away. The automated reminder sequence
                    will handle this client. No manual action is needed unless you want to get
                    ahead of the deadline.
                  </p>
                </div>

                {/* Complete */}
                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <StatusPill label="Complete" bg="bg-green-100" text="text-green-700" dot="bg-green-500" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The filing has been marked as complete. No further reminders will be sent for
                    this period. The filing remains visible in the client's history but is no
                    longer counted in urgency summaries or the workload forecast.
                  </p>
                </div>

                {/* Paused / Inactive */}
                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <StatusPill label="Paused" bg="bg-gray-100" text="text-gray-600" dot="bg-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The client or filing has been paused. All automated reminders are on hold.
                    The deadline is still tracked and visible, but no emails will be sent until
                    the client is resumed. This status also applies to inactive clients who have
                    been deactivated without being deleted.
                  </p>
                </div>

              </div>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Where statuses appear</h2>
              <p className="mb-5">
                The traffic-light system is consistent across all parts of the application.
                The same colour always means the same thing, regardless of where you encounter it.
              </p>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-foreground mb-1">Dashboard — urgency summary</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The top of the dashboard shows counts of filings in each urgency band across
                    your entire practice. Clicking a band filters the view to show only clients
                    in that state.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Client table — status column</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Each row in the client table shows the most urgent active filing status for
                    that client. A client with one overdue filing and three on-track filings
                    shows as Overdue. You can filter the table by status to surface all clients
                    in a given state at once.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Client detail page — deadline pills</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Every active filing on a client's detail page shows its own status pill,
                    giving you a per-filing view of urgency. This is where you can see a client
                    with mixed statuses across different filing types.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Dashboard — upcoming deadlines widget</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Each entry in the upcoming deadlines timeline is colour-coded by its current
                    status, so you can see at a glance which upcoming deadlines are already in
                    the approaching or critical bands.
                  </p>
                </div>
              </div>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">What changes a status</h2>
              <p className="mb-4">
                Statuses are recalculated automatically every day when the pipeline runs. They
                can also change immediately in response to manual actions:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-3">
                <li>
                  <strong>Time passing</strong> — a filing moves from On track → Approaching →
                  Critical → Overdue automatically as the deadline gets closer.
                </li>
                <li>
                  <strong>Marking as complete</strong> — immediately changes the status to
                  Complete and stops the reminder sequence.
                </li>
                <li>
                  <strong>Pausing a client</strong> — immediately changes all of that client's
                  active filings to Paused. Resuming restores their previous urgency statuses.
                </li>
                <li>
                  <strong>Overriding a deadline</strong> — if you set a custom deadline date that
                  is further in the future, the status may drop from Critical back to Approaching
                  or On track. If you set a date in the past, the status becomes Overdue
                  immediately.
                </li>
                <li>
                  <strong>All documents received</strong> — when the checklist is fully complete,
                  the reminder sequence stops, but the status remains in its urgency band until
                  you manually mark the filing as complete. This distinction matters: documents
                  received means you have what you need; complete means the filing has been
                  submitted.
                </li>
              </ul>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Using statuses to prioritise your workload</h2>
              <p className="mb-4">
                The most effective way to use the traffic-light system is as a daily triage tool.
                At the start of each day, open the dashboard and check the urgency summary:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-3">
                <li>
                  Any <span className="font-semibold text-red-600">Overdue</span> filings should
                  be your first priority — check whether the client has been in contact and
                  whether a deadline extension is possible.
                </li>
                <li>
                  <span className="font-semibold text-orange-600">Critical</span> filings (7
                  days or fewer) warrant direct outreach if the client hasn't responded to
                  automated reminders.
                </li>
                <li>
                  <span className="font-semibold text-amber-600">Approaching</span> filings
                  (8–28 days) are handled by the automated sequence — review them to confirm
                  the right templates are assigned and the schedule is running.
                </li>
                <li>
                  <span className="font-semibold text-blue-600">On track</span> filings need no
                  action — they're in the automated reminder flow.
                </li>
              </ul>
              <p className="mt-4">
                You can also filter the client table by status to generate a focused work list.
                Filtering to Critical and Overdue at the end of each week gives you a clear
                picture of which clients need personal attention before the next pipeline run.
              </p>
            </section>

          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
