import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export const metadata: Metadata = {
  title: "Managing Your Team & Settings — Guides",
  description:
    "How to invite team members, manage Admin and Member roles, update organisation settings, and remove team members in Prompt.",
};

export default function ManagingTeamAndSettingsPage() {
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
              Managing Your Team & Settings
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Prompt supports multi-user teams with role-based access. This guide covers the
              Admin and Member roles, how to invite and remove team members, and how to keep your
              organisation settings up to date.
            </p>
          </div>

          {/* Tutorial video */}
          <div className="mb-12">
            <div className="aspect-video bg-muted rounded-xl overflow-hidden border border-border/60 shadow-sm shadow-black/5">
              <video
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/tutorials/invite-team-member.mp4`}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-12 text-[15px] leading-relaxed text-foreground/85">

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">The Admin and Member roles</h2>
              <p className="mb-4">
                Every user on a Prompt team has one of two roles: Admin or Member. The role
                determines which parts of the application they can access and what changes they
                can make.
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/60 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="text-left font-semibold px-4 py-3 text-foreground">Capability</th>
                      <th className="text-center font-semibold px-4 py-3 text-foreground">Admin</th>
                      <th className="text-center font-semibold px-4 py-3 text-foreground">Member</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-muted-foreground">
                    <tr>
                      <td className="px-4 py-3">View and manage clients</td>
                      <td className="px-4 py-3 text-center">✓</td>
                      <td className="px-4 py-3 text-center">✓</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">View and manage documents</td>
                      <td className="px-4 py-3 text-center">✓</td>
                      <td className="px-4 py-3 text-center">✓</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Send ad-hoc emails</td>
                      <td className="px-4 py-3 text-center">✓</td>
                      <td className="px-4 py-3 text-center">✓</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Edit email templates</td>
                      <td className="px-4 py-3 text-center">✓</td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Configure filing types and schedules</td>
                      <td className="px-4 py-3 text-center">✓</td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Manage organisation settings</td>
                      <td className="px-4 py-3 text-center">✓</td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Invite and remove team members</td>
                      <td className="px-4 py-3 text-center">✓</td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Access billing and subscription</td>
                      <td className="px-4 py-3 text-center">✓</td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                The first person to create an organisation is automatically an Admin. Subsequent
                invitations default to Member, but the inviting Admin can change the role before
                sending.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Inviting a team member</h2>
              <p className="mb-4">
                Go to <strong>Settings → Team</strong> and click Invite member. Enter the person's
                email address and select their role — Admin or Member.
              </p>
              <p className="mb-4">
                Prompt sends the invitation by email. The recipient clicks the link in the email
                to create their account and join your organisation. Invitations expire after 7
                days — if someone doesn't accept in time, you can resend the invitation from the
                Team settings page.
              </p>
              <p>
                Pending invitations are shown in the team list with an "Invited" status until
                they're accepted. You can cancel a pending invitation at any time before the
                recipient accepts it.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Changing a team member's role</h2>
              <p className="mb-4">
                On the <strong>Settings → Team</strong> page, find the team member you want to
                update and use the role selector next to their name. Changes take effect
                immediately — the team member's access level updates the next time they perform
                an action, without requiring them to log out and back in.
              </p>
              <p>
                You cannot remove Admin access from yourself if you're the only Admin in the
                organisation. Promote another team member to Admin first.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Removing a team member</h2>
              <p className="mb-4">
                When someone leaves your practice, remove them from{" "}
                <strong>Settings → Team</strong>. This revokes their access immediately — they'll
                be signed out of any active sessions within a few minutes and won't be able to
                sign in again.
              </p>
              <p className="mb-4">
                Removing a team member doesn't delete any of the activity associated with their
                account. Actions they took — client changes, emails sent, documents reviewed —
                remain in the audit log with their name attached, so your compliance history stays
                complete.
              </p>
              <p>
                If you need to temporarily restrict access without permanently removing someone —
                for example, during a handover period — you can change their role to Member to
                limit what they can do without fully removing them.
              </p>
            </section>

            <hr className="border-border/50" />

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">Organisation settings</h2>
              <p className="mb-4">
                The organisation settings page (accessible to Admins at{" "}
                <strong>Settings → Organisation</strong>) controls the core configuration for
                your Prompt account:
              </p>
              <ul className="list-disc list-outside ml-5 space-y-3">
                <li>
                  <strong>Practice name</strong> — used as the sender name in outgoing reminder
                  emails and displayed throughout the Prompt dashboard.
                </li>
                <li>
                  <strong>Sender email</strong> — the email address that appears in the From field
                  of outgoing reminders. If you've set up a custom domain, this should use that
                  domain.
                </li>
                <li>
                  <strong>Reply-to address</strong> — where client replies are directed. This can
                  be different from the sender address, for example if you have a dedicated inbox
                  for client queries.
                </li>
                <li>
                  <strong>Timezone</strong> — controls when the daily reminder pipeline runs
                  relative to your local time. Default is Europe/London.
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
