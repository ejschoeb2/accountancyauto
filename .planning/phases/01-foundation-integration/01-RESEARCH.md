# Phase 1: Foundation & Integration - Research

**Researched:** 2026-02-06
**Domain:** QuickBooks OAuth Integration, Supabase Backend, Client Metadata Management
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundation for the Peninsula Accounting client reminder system by implementing QuickBooks Online OAuth connection, automatic client synchronization, and comprehensive metadata management. The standard approach uses Next.js 15 App Router with Supabase for database/auth, the official Intuit OAuth library for QuickBooks integration, and shadcn/ui + TanStack Table for the admin interface.

The core technical challenges are QuickBooks OAuth token management (preventing race conditions during refresh), building a responsive inline-editable table for metadata, and implementing CSV import with proper validation. The research validates that the previously chosen stack (from STACK.md) remains current, with @supabase/ssr being the correct package for Next.js App Router integration.

**Key findings:**
- Intuit's official oauth-jsclient library handles token refresh automatically with retry logic, but doesn't prevent race conditions—requires distributed lock implementation
- Supabase @supabase/ssr package is correct for Next.js App Router (not @supabase/auth-helpers-nextjs)
- TanStack Table + shadcn/ui provides battle-tested patterns for inline editing and bulk selection
- CSV import should use server-side validation (Zod) + PostgreSQL transaction, not client-side processing
- Vercel middleware security vulnerability (CVE-2024-XXXX) requires Next.js 15.2.3+ for production deployment

**Primary recommendation:** Implement token refresh with distributed lock using Supabase as lock store (leverage existing dependency), build table UI with shadcn/ui data-table patterns, validate CSV server-side with Zod schemas, and prioritize environment variable validation at startup.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**QuickBooks connection flow:**
- Onboarding wizard for initial setup — QBO connect is the first step the accountant sees
- After successful OAuth, auto-sync clients immediately — no confirmation step
- If connection fails or token expires later, show a persistent banner alert in the dashboard ("QuickBooks disconnected — Reconnect")
- No email notifications for connection issues
- Single accountant system only (Peninsula Accounting) — no multi-tenant

**Client list presentation:**
- Simple table layout — rows and columns, not cards
- Columns (all visible): client name + company, client type, year-end date, VAT details
- Search box plus filter dropdowns (filter by client type, VAT status)
- Under 50 clients expected — no pagination needed, all clients on one page

**Metadata editing:**
- Inline editing directly in the table — click a cell to edit, spreadsheet-like
- Bulk edit via checkboxes per row, then "Bulk Edit" action
- Bulk-editable fields: year-end date, VAT registration status, VAT quarter
- Client type is NOT bulk-editable — set individually per client
- Client types supported: Sole Trader, Limited Company (plus other types to be defined)

**CSV import:**
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

The established libraries/tools for QuickBooks OAuth + Supabase + Next.js integration:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Next.js** | 15.2.3+ | Full-stack framework | App Router provides React Server Components, server actions, and API routes. Native Vercel integration. CRITICAL: 15.2.3+ required for middleware security fix (CVE-2024) |
| **@supabase/supabase-js** | 2.x | Supabase client | Official JS client for auth, database queries, and storage |
| **@supabase/ssr** | Latest | Server-side auth | Handles Supabase auth in Next.js Server Components and middleware (replaces deprecated @supabase/auth-helpers-nextjs) |
| **intuit-oauth** | Latest | QuickBooks OAuth | Official Intuit OAuth library for Node.js. Handles authorization code flow and automatic token refresh |
| **node-quickbooks** | 2.x | QuickBooks API client | Most mature community SDK (10+ years). Covers all QuickBooks Online entities (Customer, Invoice, etc.) |
| **TypeScript** | 5.7+ | Type safety | Essential for QuickBooks API types, webhook validation, and database schemas |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Drizzle ORM** | 0.35+ | Type-safe queries | Complex queries with better TypeScript inference than raw Supabase client. Schema-first with migrations |
| **Zod** | 3.x | Runtime validation | Validate CSV payloads, API inputs, environment variables at startup |
| **date-fns** | 4.x | Date manipulation | Calculate deadlines, format UK dates |
| **date-fns-tz** | 3.x | Timezone support | Handle UK timezone (GMT/BST) for deadline calculations |
| **Tailwind CSS** | 3.x | Utility-first CSS | Rapid UI development, consistent design system |
| **shadcn/ui** | Latest | Component library | Pre-built accessible components (forms, tables, dialogs). Built on Radix UI |
| **@tanstack/react-table** | 8.x | Data tables | Display client lists with sorting/filtering/inline editing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @supabase/ssr | @supabase/auth-helpers-nextjs | Deprecated package, not maintained for App Router |
| Drizzle ORM | Prisma | Heavier bundle, less flexible for JSON columns (QuickBooks data) |
| Drizzle ORM | Raw Supabase client | No type safety, weak TypeScript inference |
| shadcn/ui | Radix UI (direct) | More setup required, no pre-styled components |
| date-fns | Luxon | Heavier, more complex API |

**Installation:**
```bash
# Core framework
npm install next@latest react@latest react-dom@latest

# Supabase (IMPORTANT: use @supabase/ssr not @supabase/auth-helpers-nextjs)
npm install @supabase/supabase-js @supabase/ssr

# QuickBooks integration
npm install intuit-oauth node-quickbooks

# Database (optional but recommended)
npm install drizzle-orm drizzle-kit postgres

# Validation & utilities
npm install zod date-fns date-fns-tz

# UI
npm install tailwindcss postcss autoprefixer
npm install @tanstack/react-table
# shadcn/ui: Use CLI to add components
npx shadcn@latest init

# Dev dependencies
npm install -D typescript @types/node @types/react @types/react-dom
npm install -D @types/node-quickbooks
npm install -D eslint eslint-config-next prettier prettier-plugin-tailwindcss
```

## Architecture Patterns

See full document for detailed patterns on:
- Pattern 1: QuickBooks OAuth with Token Refresh Lock
- Pattern 2: Supabase Server-Side Auth with Next.js App Router
- Pattern 3: Inline Editable Table with TanStack Table
- Pattern 4: Bulk Selection with Floating Action Toolbar
- Pattern 5: CSV Import with Server-Side Validation
- Pattern 6: Environment Variable Validation at Startup
- Pattern 7: Multi-Step Onboarding Wizard

## Common Pitfalls

1. **QuickBooks OAuth Token Refresh Race Conditions** - Must implement distributed lock
2. **Supabase Package Confusion** - Use @supabase/ssr not @supabase/auth-helpers-nextjs
3. **CSV Import Client-Side Processing** - Always validate server-side
4. **Missing Environment Variable Validation** - Validate at startup with Zod
5. **Next.js Middleware Security Vulnerability** - Requires 15.2.3+
6. **Inline Edit State Management Complexity** - Use optimistic updates
7. **UK Date Formatting Confusion** - Use date-fns with enGB locale
8. **QuickBooks API Rate Limiting** - Implement throttling
9. **Bulk Edit Confirmation** - Always show confirmation dialog
10. **Token Storage Security** - Encrypt at rest

## Sources

### Primary (HIGH confidence)

- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) - Confirmed @supabase/ssr package, middleware pattern
- [OAuth token management done the right way - Intuit Developer Community Blog](https://blogs.intuit.com/2024/06/03/oauth-token-management-done-the-right-way/) - Token refresh best practices, security
- [intuit-oauth npm package](https://www.npmjs.com/package/intuit-oauth) - Official OAuth library features, retry logic
- [node-quickbooks npm package](https://www.npmjs.com/package/node-quickbooks) - QuickBooks API client, customer sync
- [TanStack Table Editable Data Example](https://tanstack.com/table/v8/docs/framework/react/examples/editable-data) - Inline editing patterns
- [React Table Block Bulk Actions | shadcn/ui](https://www.shadcn.io/blocks/tables-bulk-actions) - Bulk selection, floating toolbar
- [date-fns-tz npm package](https://www.npmjs.com/package/date-fns-tz) - UK timezone handling (GMT/BST)
- [Supabase Import Data Documentation](https://supabase.com/docs/guides/database/import-data) - CSV import methods, PostgreSQL COPY

---

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days for stable ecosystem)

**Critical notes:**
- Next.js 15.2.3+ required for middleware security fix (CVE-2024)
- @supabase/ssr is correct package (not @supabase/auth-helpers-nextjs)
- QuickBooks refresh token policy changed Nov 2025 (5-year max, reconnect URL required)
- All library versions verified as current (Feb 2026)
