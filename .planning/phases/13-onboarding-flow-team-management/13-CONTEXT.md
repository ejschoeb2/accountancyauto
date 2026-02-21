# Phase 13: Onboarding Flow & Team Management - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

A new firm can sign up via a 4-step onboarding wizard (Account, Firm Details, Plan, Trial Started), configure their practice, choose a plan, and invite team members — all without manual admin intervention. Role-based access (admin vs member) controls navigation and route access. Includes a trial-ending-soon notification cron.

</domain>

<decisions>
## Implementation Decisions

### Onboarding Wizard
- Full-page stepper layout with progress bar at top — dedicated, distraction-free
- Step 1 (Account): Magic link authentication — user enters email, receives magic link, clicks to verify
- Step 2 (Firm Details): Minimal — firm name and URL slug only. User enters slug manually with availability validation feedback
- Step 3 (Plan Selection): Pricing cards showing all plan tiers with "Start Trial" buttons — 14-day free trial, no payment upfront
- Step 4 (Trial Started): Confirmation page showing trial details (14 days, plan name) with "Go to Dashboard" CTA button
- Back button allowed — users can navigate back to edit previous steps before completing
- Wizard lives at `/onboarding` on the bare domain (`app.phasetwo.uk/onboarding`) since the org subdomain doesn't exist yet
- Users who already have an org are redirected away from `/onboarding` to their dashboard (no re-entry)
- 14-day free trial period

### Team Management
- Lives as a "Team" card/section on the existing settings page (admin-only)
- Single email input with "Invite" button for sending invites — one at a time
- Two roles only: Admin (full access) and Member (limited access)
- Member list shows: email, role badge (Admin/Member), status (Active/Pending)
- Pending invites appear in the same list as active members with "Pending" status badge and resend/cancel options
- Role changes require confirmation dialog (especially promoting to admin)
- Removing members requires confirmation dialog — removes access immediately
- Team size enforced per plan tier (e.g., Lite=1, Sole Trader=2, Practice=5, Firm=unlimited)
- Last admin cannot be removed — returns error and leaves assignment unchanged

### Invite Recipient Experience
- Invite email: minimal plain text — less likely to hit spam filters
- Invite link goes to an accept page showing org name, who invited them, and "Accept & Join" button
- One org per user — if invitee already belongs to another org, show "You already belong to another organisation" message
- Invite links expire after 7 days — admin can resend if needed
- Admin chooses role (Admin or Member) at invite time
- Accept page: one-click accept, no form fields beyond authentication
- Tokenised link — single use, cannot be reused after acceptance

### Role-Based Navigation
- Admin sees: Dashboard, Clients, Email Logs, Settings (including Team, Billing, Email Config)
- Member sees: Dashboard, Clients, Email Logs — that's it
- Restricted nav items (Settings, Billing, Team) are hidden entirely for Members — not visible at all
- Direct URL access to restricted routes (e.g., `/settings`) silently redirects Member to dashboard
- Members have full edit access to clients — they're accountants doing daily work

### Claude's Discretion
- Progress bar visual design and step indicator style
- Exact pricing card layout and copy
- Invite email exact wording
- Accept page visual design
- Team size limits per plan tier (specific numbers)
- Trial-ending-soon email template and exact timing logic

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-onboarding-flow-team-management*
*Context gathered: 2026-02-21*
