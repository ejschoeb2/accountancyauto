import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Writing Effective Email Templates — Guides",
  description:
    "How to write reminder email templates that escalate appropriately, use placeholder variables correctly, and actually get opened.",
};

export default function WritingEffectiveEmailTemplatesPage() {
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
              <span className="inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                Email Templates
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                <BookOpen size={10} />
                Guide
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-5">
              Writing Effective Email Templates
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The emails your clients receive are the front line of your reminder system. A
              well-written sequence gets documents in on time and reflects well on your practice.
              A poorly-written one gets ignored. This guide covers how to structure, write, and
              escalate your reminder templates for maximum effect.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Why templates matter</h2>
              <p className="mb-4">
                Automated reminders only work if clients actually open and act on them. An email
                that reads like a system-generated form letter — with no personal touch, no
                context about why it matters, and no clear call to action — is easy to dismiss.
              </p>
              <p>
                Good templates feel like they came from a person. They're specific about the
                deadline, clear about what's needed, and appropriately urgent given how much time
                is left. Because Prompt fills in the dynamic details automatically, you can write
                a template once and have it feel personal for every client it goes to.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Available placeholder variables</h2>
              <p className="mb-4">
                When you write a template, you can insert placeholder variables that Prompt
                replaces with the correct value for each recipient when the email is sent.
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/60 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="text-left font-semibold px-4 py-3 text-foreground">Variable</th>
                      <th className="text-left font-semibold px-4 py-3 text-foreground">What it inserts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    <tr>
                      <td className="px-4 py-3 font-mono text-[13px] text-violet-700">{"{{client_name}}"}</td>
                      <td className="px-4 py-3 text-muted-foreground">The client's name or company name</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono text-[13px] text-violet-700">{"{{filing_type}}"}</td>
                      <td className="px-4 py-3 text-muted-foreground">The type of filing (e.g. "Corporation Tax return")</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono text-[13px] text-violet-700">{"{{deadline_date}}"}</td>
                      <td className="px-4 py-3 text-muted-foreground">The formatted deadline date (e.g. "31 January 2026")</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono text-[13px] text-violet-700">{"{{days_remaining}}"}</td>
                      <td className="px-4 py-3 text-muted-foreground">The number of days left until the deadline</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono text-[13px] text-violet-700">{"{{upload_link}}"}</td>
                      <td className="px-4 py-3 text-muted-foreground">A unique, secure link to the client's portal upload page</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono text-[13px] text-violet-700">{"{{practice_name}}"}</td>
                      <td className="px-4 py-3 text-muted-foreground">Your practice name, as set in organisation settings</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                In the template editor, variables are inserted as clickable pills rather than raw
                text — this prevents typos and makes it easy to see at a glance which dynamic
                content is in use.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Structuring a reminder sequence</h2>
              <p className="mb-4">
                Most filing types benefit from a three-email sequence: an early notice, a
                mid-point chase, and a final urgent reminder. The content and tone of each should
                be deliberately different.
              </p>
              <div className="space-y-5">
                <div className="rounded-xl border border-border/60 p-5 bg-muted/20">
                  <p className="text-[13px] font-semibold text-foreground uppercase tracking-wide mb-2">Email 1 — Early notice</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Sent 6–8 weeks before the deadline. The tone is informational and low-pressure.
                    Your client has plenty of time — this email is a heads-up, not an alarm.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Focus on: what's coming up, what you'll need from them, and an easy way to
                    start the process (the upload link). Keep it short — one or two paragraphs.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 p-5 bg-muted/20">
                  <p className="text-[13px] font-semibold text-foreground uppercase tracking-wide mb-2">Email 2 — Mid-point chase</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Sent 2–4 weeks before. The tone is friendly but more direct. Your client has
                    had time to gather what's needed — this is a reminder to actually send it.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Focus on: the deadline date specifically, what's still outstanding, and the
                    upload link prominently. Reference the previous email if it feels natural.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 p-5 bg-muted/20">
                  <p className="text-[13px] font-semibold text-foreground uppercase tracking-wide mb-2">Email 3 — Final urgent reminder</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Sent 7–10 days before. The tone is clearly urgent. Use language that conveys
                    the real consequences of missing the deadline — HMRC penalties, Companies House
                    late filing fees — without being alarmist.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Focus on: the exact deadline, the consequences of missing it, and a single
                    clear call to action. This isn't the time for pleasantries — get to the point.
                  </p>
                </div>
              </div>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Subject line best practices</h2>
              <p className="mb-4">
                Subject lines determine whether the email gets opened at all. A few principles
                that consistently work well for reminder emails:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-3 mb-4">
                <li>
                  <strong>Be specific about the deadline type.</strong> "Action required: Corporation
                  Tax deadline" performs better than "Important reminder" because the recipient
                  immediately knows what it's about.
                </li>
                <li>
                  <strong>Include the date in final reminders.</strong> "Corporation Tax deadline —
                  10 days remaining" creates appropriate urgency without being vague.
                </li>
                <li>
                  <strong>Keep it short.</strong> Subject lines over 50 characters are truncated on
                  mobile. The key information should be in the first 40 characters.
                </li>
                <li>
                  <strong>Avoid spam trigger words.</strong> Words like "URGENT!!!", excessive
                  capitalisation, and misleading phrases ("Re: your enquiry") reduce deliverability
                  and damage trust.
                </li>
              </ul>
              <p>
                You can use placeholder variables in subject lines too — {"{{client_name}}"} and
                {"{{deadline_date}}"} are especially effective at increasing open rates by making
                the email feel personal and specific.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">A note on tone escalation</h2>
              <p className="mb-4">
                Tone escalation is what separates a good reminder sequence from a great one. Each
                email in your sequence should feel a little more pressing than the last — not
                because you're trying to alarm your clients, but because the deadline genuinely is
                getting closer.
              </p>
              <p className="mb-4">
                A common mistake is writing all three emails in the same register. If your early
                reminder already sounds urgent, your final reminder has nowhere to go — and clients
                learn to ignore the sequence entirely.
              </p>
              <p>
                Start light, end firm. And if a client uploads their documents after email one,
                Prompt stops the sequence automatically — so clients who respond promptly never
                receive the more urgent follow-ups.
              </p>
            </section>

          </div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
