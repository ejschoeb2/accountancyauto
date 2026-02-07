# Phase 3: Delivery & Dashboard - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated email sending of due reminders via Postmark, delivery status tracking, a monitoring dashboard with traffic-light client indicators, and an audit log of all sent communications. The reminder queue and scheduling logic already exist from Phase 2 — this phase processes the queue into actual emails and provides visibility.

</domain>

<decisions>
## Implementation Decisions

### Email presentation
- HTML emails with Peninsula Accounting branding (logo, colours, professional layout)
- Sender identity: practice name only — From: "Peninsula Accounting" <reminders@peninsulaaccounting.co.uk>
- Reply-To set to accountant's real email address so clients can respond directly
- Minimal footer: practice name + "This is an automated reminder from Peninsula Accounting"
- No unsubscribe link (these are legitimate business communications, not marketing)

### Dashboard layout
- New dedicated /dashboard page (separate from existing /clients page)
- Summary cards at top: key metrics (e.g., overdue count, reminders sent today, paused clients)
- Client status list below with essential columns only: client name, traffic-light indicator, next deadline, days until deadline
- Manual refresh (data loads on page visit, refresh button available — no auto-polling)
- This becomes the landing page after login

### Traffic-light logic
- 4-state system: green, amber, red, grey
- GREEN: Records received for that filing period — nothing to chase
- AMBER: At least one reminder has been sent but records not yet received — actively chasing
- RED: Filing deadline has passed and records haven't been received — genuinely overdue
- GREY: Client has reminders paused or no active deadlines — inactive/not applicable

### Audit log design
- Two locations: global log tab on dashboard + per-client log on client detail page (same data, different filters)
- Summary line per entry: client name, filing type, date sent, delivery status (delivered/bounced/failed)
- Basic filters: client name search and date range
- Failed/bounced emails trigger a warning banner on the dashboard — "X reminders failed to deliver"

### Claude's Discretion
- Postmark API integration approach and webhook handling
- Email HTML template structure and CSS
- Summary card metrics selection and layout
- Dashboard sorting defaults
- Audit log pagination approach
- Banner alert dismissal behavior

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Postmark integration and dashboard patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-delivery-dashboard*
*Context gathered: 2026-02-07*
