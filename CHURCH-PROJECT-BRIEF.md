# Church Compliance Reminder System — Project Brief

> This document is a briefing for an AI agent starting `/gsd:new-milestone` on a new project.
> This codebase is a **duplicate** of an existing working product called **Prompt** — a UK accounting practice reminder system. The goal is to transform it into a church compliance reminder system.

---

## What This Codebase Already Does

This is a fully working, production-deployed SaaS application built with **Next.js + Supabase + Postmark + Stripe + Vercel**. It currently:

- Lets UK accounting firms manage their client list
- Tracks compliance deadlines per client (Corporation Tax, CT600, Companies House, VAT, Self Assessment)
- Sends automated email reminders on configurable schedules before each deadline
- Uses TipTap-based rich email templates with variable substitution (client name, deadline date, documents needed, portal upload link)
- Runs a two-stage cron pipeline: queue builder (hourly) → email sender (10 min later)
- Supports multi-tenant orgs with per-org Postmark tokens, per-user sender identities
- Has a full onboarding wizard (org creation → firm details → plan selection → client import → email setup → portal config → storage)
- Includes a client upload portal where clients can upload documents
- Has Stripe billing integration with multiple pricing tiers
- Tracks email delivery via Postmark webhooks (delivered, bounced, opened)
- Has client unsubscribe functionality with HMAC-signed tokens
- Supports inbound email processing via Postmark
- Has document storage with HMRC retention period tracking

**The infrastructure, auth, billing, email pipeline, cron system, UI framework, and general architecture all stay the same.** What changes is the domain — from accounting deadlines to church compliance deadlines.

---

## What We're Transforming It Into

A **church compliance reminder system** — a SaaS tool that helps UK churches stay on top of their regulatory, safeguarding, insurance, and governance deadlines.

### Target Users
- Church administrators / office managers
- Church treasurers
- Clergy responsible for compliance
- Diocesan staff overseeing multiple parishes
- Could also serve other charities (but church-first positioning)

### Value Proposition
Churches face dozens of recurring compliance deadlines across multiple regulatory bodies (Charity Commission, HMRC, ICO, diocese, insurers, local authority). Missing them can mean fines, loss of charity status, safeguarding failures, or insurance voidance. Currently most churches track these in spreadsheets or not at all. The only competitor in this space is CharityProof (generic charity compliance, not church-tailored) and ChurchSuite (church management platform — broader, more expensive, compliance is not their focus).

### Distribution Angle
The project founder has a direct contact in the church network who says this would be very useful. Church communities are tight-knit — word of mouth and denominational networks are a strong distribution channel.

---

## Domain Model Mapping

### Terminology Changes

| Accounting (Current) | Church (New) |
|---|---|
| Firm / Practice | Church / Parish |
| Accountant | Administrator / Treasurer |
| Client | Obligation / Compliance Item (or keep "item") |
| Filing type | Compliance type / Deadline type |
| Year end date | Renewal date / Period end |
| VAT stagger group | N/A (remove) |
| Records received | Documents received / Evidence collected |
| CT600, Companies House, etc. | See church deadline types below |

**Important decision needed:** The current system has "clients" as the primary entity — each client has filing types assigned. For the church version, the model could be:
- **Option A:** Keep "clients" but rename to "obligations" — each obligation is a compliance item (e.g., "DBS Check - John Smith", "Public Liability Insurance", "Charity Commission Annual Return")
- **Option B:** Restructure around "compliance areas" (Safeguarding, Finance, Property, Governance) with items under each
- **Option C:** Keep it simple — "items" with a "type" field, flat list like the current client list

The simplest transformation is Option A — rename clients to obligations/items, keep the same data structure, just change the filing types.

### Church Compliance Deadline Types (Replace Accounting Filing Types)

#### Charity Commission (Registered Charities)
| Type | Deadline | Details |
|---|---|---|
| Annual Return | 10 months after financial year end | All registered charities. Late = public default notice, potential inquiry |
| Annual Accounts | 10 months after financial year end | Filed with annual return. Charities >£25k income must file accounts. >£1m require audit |
| Serious Incident Reports | As they occur | Must report safeguarding incidents, fraud, significant financial loss |
| Trustee Updates | Within 60 days of change | Report changes to trustees/PCC members |

#### HMRC
| Type | Deadline/Frequency | Details |
|---|---|---|
| Gift Aid Claims | Quarterly or annual (church choice) | Claim 25p per £1 of eligible donations. No hard deadline but 4-year backstop |
| GASDS Claims | Annual (with Gift Aid claim) | Gift Aid Small Donations Scheme — up to £8k/year without declarations |
| Payroll / RTI | Monthly (if staff employed) | PAYE returns for employed staff |
| Corporation Tax (if applicable) | 12 months after period end | Only if church has non-primary-purpose trading income |

#### Safeguarding
| Type | Frequency | Details |
|---|---|---|
| DBS Checks | Every 3-5 years (depends on diocese) | For anyone working with children/vulnerable adults |
| Safeguarding Training (Basic) | Every 3 years | All volunteers |
| Safeguarding Training (Leadership) | Every 3 years | Clergy, wardens, PCC safeguarding lead |
| Safeguarding Policy Review | Annual | Must be reviewed and re-adopted annually |
| Safeguarding Audit/Self-Assessment | Annual (diocesan requirement) | Parish safeguarding dashboard/return |

#### Insurance
| Type | Frequency | Details |
|---|---|---|
| Public Liability Insurance | Annual renewal | Essential for any church with public access |
| Employer's Liability Insurance | Annual renewal | Legal requirement if any paid staff |
| Buildings & Contents Insurance | Annual renewal | Often required by diocese |
| Trustee Indemnity Insurance | Annual renewal | Protects PCC members |

#### Property & Health and Safety
| Type | Frequency | Details |
|---|---|---|
| Fire Risk Assessment | Annual review (full assessment every 3-5 years) | Legal requirement for all non-domestic premises |
| Electrical Installation (EICR) | Every 5 years | Fixed wiring inspection |
| PAT Testing | Annual | Portable appliance testing |
| Gas Safety Certificate | Annual | If gas appliances present |
| Asbestos Survey Review | Annual review | Must maintain asbestos register |
| Quinquennial Inspection | Every 5 years | Church of England specific — architect's survey of church fabric |
| Lightning Conductor Test | Annual | If installed |
| Legionella Risk Assessment | Every 2 years | Water safety |

#### Governance (Church of England specific)
| Type | Deadline | Details |
|---|---|---|
| APCM (Annual Parochial Church Meeting) | By 30 April each year | Legal requirement — elect PCC, present accounts |
| Electoral Roll Revision | Annual (before APCM) | Every 6 years: complete renewal |
| PCC Meeting Minutes | Within 7 days of meeting | Must be recorded and filed |
| Terrier & Inventory Update | Annual | Record of church property and furnishings |
| Log Book Update | Ongoing | Record of all works and alterations |

#### Data Protection
| Type | Frequency | Details |
|---|---|---|
| ICO Registration Renewal | Annual | Data protection fee — £40 or £60 depending on size |
| Privacy Notice Review | Annual | GDPR requirement |
| Data Protection Impact Assessment | As needed | For new data processing activities |

#### Food Safety (if church runs café/events)
| Type | Frequency | Details |
|---|---|---|
| Food Hygiene Rating | Inspection-based | If preparing/serving food regularly |
| Food Safety Training | Every 3 years | For regular food handlers |

### Deadline Calculation Changes

The current system calculates deadlines from `year_end_date` per client. The church system needs more flexibility:

- **Period-based deadlines** (like current): Annual return = year end + 10 months
- **Fixed-date deadlines**: APCM = 30 April every year, regardless of year end
- **Renewal-based deadlines**: DBS check = last check date + 3 years, insurance = policy start + 12 months
- **Rolling deadlines**: Gift Aid claims = quarterly from chosen start

The `year_end_date` field on clients/obligations should become more generic — perhaps `reference_date` or `period_end_date` — and the deadline formula per type should specify how to calculate from it.

Some types (DBS, insurance) are tied to a specific date (last renewal), not a period end. The system may need a `last_completed_date` field that auto-advances when marked complete.

---

## What Needs to Change (Scope Overview)

### Must Change
1. **Filing types / seed data** — Replace all accounting filing types with church compliance types above
2. **Deadline calculation formulas** — New formulas for each church deadline type
3. **Onboarding wizard copy** — "Set up your firm" → "Set up your church", accounting-specific steps become church-specific
4. **Client model terminology** — Throughout UI: "client" → whatever we choose (obligation/item/requirement)
5. **Email template defaults** — Seed templates need church-appropriate wording
6. **Schedule defaults** — Default reminder schedules for church deadlines (e.g., 90 days, 60 days, 30 days, 7 days before)
7. **Landing/marketing pages** — Hero section, about page, features, pricing — all church-focused
8. **App name and branding** — New name, logo, favicon, OG images, email footer text
9. **VAT-specific logic** — Remove `vat_stagger_group` and any VAT-specific code
10. **Import/CSV** — Column mappings need updating for church data (no company number, no UTR, add church-specific fields)

### Might Change
- **Pricing tiers** — Different tier names/limits for churches (small parish, large parish, multi-parish, diocese)
- **Dashboard widgets** — Might want compliance-area grouping (Safeguarding, Finance, Property, Governance) instead of filing-type grouping
- **Document categories** — Church-specific document types (DBS certificates, insurance policies, inspection reports vs tax returns, accounts)
- **Portal** — Upload portal concept works but wording changes

### Stays the Same
- Auth system (Supabase Auth, email/password, magic link)
- Reminder pipeline architecture (cron → queue → send)
- Email rendering (TipTap → HTML pipeline)
- Postmark integration
- Stripe billing integration (just different products/prices)
- Multi-tenant org model
- Per-user sender settings
- Circuit breaker, retry logic, distributed locking
- Webhook handling (Postmark delivery/bounce)
- Unsubscribe mechanism
- Audit logging
- RLS policies (structure stays, table names may change)

---

## Technical Architecture Reference

Read `ARCHITECTURE.md` for the full technical architecture. Key points:

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Email:** Postmark (per-org server tokens, delivery webhooks, inbound processing)
- **Billing:** Stripe (subscriptions, webhook-driven status sync)
- **Hosting:** Vercel (serverless, cron jobs via vercel.json)
- **UI:** shadcn/ui + Tailwind CSS + Framer Motion
- **State:** Server actions + React Server Components (minimal client state)

### Key Directories
```
app/
├── (auth)/          — Login, signup, setup wizard
├── (dashboard)/     — Main app (clients, schedules, templates, settings, email logs)
├── (marketing)/     — Landing page, about, pricing
├── actions/         — Server actions (CRUD, settings, billing)
├── api/
│   ├── cron/        — Scheduled jobs (reminders, send-emails, retention, trial)
│   ├── webhooks/    — Postmark, Stripe webhooks
│   └── ...          — REST endpoints
components/          — UI components (shadcn-based)
lib/
├── email/           — Postmark client, sender, template rendering, circuit breaker
├── reminders/       — Scheduler, queue builder
├── billing/         — Stripe client, usage limits
├── documents/       — Storage, classification, retention
├── supabase/        — Client factories (browser, server, admin, middleware)
└── ...
supabase/
└── migrations/      — Timestamped SQL migrations (apply in order)
```

---

## Naming Suggestions (Decide Before Starting)

The app needs a new name. Some ideas to consider:
- **Steward** (stewardship is a church concept)
- **Comply** (direct, generic enough for wider charity use)
- **Parish** / **ParishGuard** / **ParishKeeper**
- **ChurchTrack**
- **Watchful**
- **Vestry** (the room where church admin happens)

The name choice affects: app title, domain, email sender defaults, branding throughout, Stripe product names, Postmark server name.

---

## Milestone Planning Notes

When creating the milestone roadmap, consider this ordering:

1. **Foundation** — Rename core domain concepts, update DB seeds, filing types → compliance types, deadline formulas. This unblocks everything else.
2. **Backend** — Migrations for new fields, remove accounting-specific columns (company_number, UTR, vat_stagger_group), add church-specific fields. Update server actions.
3. **Onboarding** — Transform the setup wizard for church context.
4. **Dashboard & UI** — Update all page copy, component labels, table headers, empty states.
5. **Marketing** — Landing page, about, pricing page with church positioning.
6. **Branding** — Name, logo, favicon, email templates, OG images.
7. **Import** — Update CSV import for church data format.
8. **Testing & Polish** — End-to-end walkthrough, fix anything missed.

Phases 1-2 are sequential. Phases 3-6 can largely be parallelised. Phase 7-8 are cleanup.

---

## What NOT to Change

- Do not refactor the architecture. It works. Just change the domain.
- Do not add new features (SMS, WhatsApp, etc.) — that comes later.
- Do not change the billing/subscription model structure — just update product names and tier labels.
- Do not restructure the database schema beyond what's needed for the domain swap. Keep the same table relationships.
- Do not touch the email pipeline internals (circuit breaker, retry logic, cron scheduling). Just update the content that flows through it.

---

## Environment

- The developer will set up: new Supabase project, new Vercel deployment, new Stripe products
- Postmark: same account, new Server
- All env vars will be configured before development starts
- Supabase migrations from the original project have already been applied to the new project
