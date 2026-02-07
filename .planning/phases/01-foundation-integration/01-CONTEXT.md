# Phase 1: Foundation & Integration - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

QuickBooks Online OAuth connection, automatic client sync, and filing metadata management for all clients. Accountant connects QBO, sees synced clients in a table, and configures client type, year-end dates, and VAT details — individually or in bulk via CSV import.

</domain>

<decisions>
## Implementation Decisions

### QuickBooks connection flow
- Onboarding wizard for initial setup — QBO connect is the first step the accountant sees
- After successful OAuth, auto-sync clients immediately — no confirmation step
- If connection fails or token expires later, show a persistent banner alert in the dashboard ("QuickBooks disconnected — Reconnect")
- No email notifications for connection issues
- Single accountant system only (Peninsula Accounting) — no multi-tenant

### Client list presentation
- Simple table layout — rows and columns, not cards
- Columns (all visible): client name + company, client type, year-end date, VAT details
- Search box plus filter dropdowns (filter by client type, VAT status)
- Under 50 clients expected — no pagination needed, all clients on one page

### Metadata editing
- Inline editing directly in the table — click a cell to edit, spreadsheet-like
- Bulk edit via checkboxes per row, then "Bulk Edit" action
- Bulk-editable fields: year-end date, VAT registration status, VAT quarter
- Client type is NOT bulk-editable — set individually per client
- Client types supported: Sole Trader, Limited Company (plus other types to be defined)

### CSV import
- Primary use case: one-time initial bulk setup of metadata
- Match CSV rows to QBO clients by company name
- Unmatched rows: skip and show a summary report of what couldn't be imported
- Overwrite behavior: CSV values always replace existing metadata — simple, predictable
- No preview step — import applies immediately

### Claude's Discretion
- Onboarding wizard step count and flow design
- Table styling, spacing, and responsive behavior
- Inline edit interaction details (save on blur, enter key, etc.)
- CSV column format and template download
- Error state handling and loading states
- Search/filter implementation details

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

*Phase: 01-foundation-integration*
*Context gathered: 2026-02-06*
