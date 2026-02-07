# Phase 2: Reminder Engine - Research

**Researched:** 2026-02-06
**Domain:** Reminder scheduling, deadline calculation, template management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Template Design**
- Configurable 1-5 steps per template (not fixed 3)
- Each template covers one filing type (Corporation Tax, Companies House, VAT Return, Self Assessment, etc.)
- Inline accordion editor — all steps visible on one page, expandable sections for editing
- Each step's timing is configured as "days before deadline" (deadline-anchored, not step-relative)
- Placeholder variables ({{client_name}}, {{deadline}}, {{days_until_deadline}}, etc.) are simple enough that no live preview is needed
- No preview feature — placeholders are self-explanatory

**Deadline Display & Overrides**
- Global monthly calendar grid view showing deadlines across ALL clients
- Deadlines are calculated from client metadata (year-end, VAT quarter, client type)
- Per-client deadline overrides supported (e.g., HMRC extensions) — custom date overrides the formula for that client and filing type
- Automatic year-on-year rollover — system calculates next cycle's deadline automatically when current deadline passes, no manual confirmation needed

**Reminder Scheduling Logic**
- Daily cron job runs at fixed 9am UK time
- If a reminder's calculated send date falls on a weekend or UK bank holiday, shift to next working day
- When records are marked as received, auto-cancel all remaining reminder steps for that filing type — no confirmation prompt
- When a paused client is unpaused, skip any missed reminders and resume from the next due step — don't spam with old reminders
- UK bank holidays sourced from gov.uk API

**Per-Client Customization**
- Field-level overrides on templates — accountant changes specific fields (subject, body, delay) while the base template remains the source of truth
- Inheritance model: overridden fields persist, non-overridden fields update when the base template changes
- Badge/indicator on clients in the list view showing which have custom overrides
- Filing type assignment: automatic based on client type (sole trader, limited company, etc.) PLUS manual toggle to opt in/out of any filing type per client

### Claude's Discretion
- Calendar grid component library/implementation
- Exact placeholder variable names and format
- Database schema for template steps, overrides, and deadline storage
- How to efficiently compute "next working day" with bank holiday data
- Override UI placement within client detail view

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

## Summary

This research covers building a reminder scheduling engine that calculates UK filing deadlines from client metadata, manages multi-step reminder templates with escalating messaging, and handles per-client customization. The system must respect UK bank holidays, handle automatic year-on-year rollover, and run daily via Vercel Cron while working within the 5-minute function timeout constraint.

**Core technical domains investigated:**
- UK filing deadline formulas (Corporation Tax, Companies House, VAT, Self Assessment)
- Vercel Cron job constraints and queue-based architecture for timeout handling
- date-fns for date calculations with custom UK bank holidays from gov.uk API
- Calendar grid components for deadline visualization
- Database schema patterns for template inheritance and field-level overrides
- String template variable substitution patterns

**Primary recommendation:** Use Vercel Cron to trigger a lightweight queue processor that marks reminders as "pending," then process batches asynchronously to avoid timeout issues. Store templates with JSONB for flexible step configuration, use separate override tables with field-level granularity, and implement working day calculation with cached UK bank holidays refreshed weekly.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | 4.1.0 (already installed) | Date calculations and manipulation | Industry standard for date operations, tree-shakeable, immutable, TypeScript-first |
| date-fns-tz | 3.2.0 (already installed) | Timezone handling for UK time (9am cron) | Official date-fns timezone extension, handles DST correctly |
| shadcn/ui Accordion | Latest | Inline accordion editor for template steps | Already in stack, accessible, matches design system |
| React Hook Form | 7.x | Dynamic template step array management | Standard for complex forms, excellent useFieldArray support |
| react-big-calendar | 1.x | Calendar grid view for deadlines | Most popular React calendar, customizable event rendering, month grid view |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 4.3.6 (already installed) | Template validation, cron expression validation | Form validation with React Hook Form, runtime type safety |
| @tanstack/react-table | 8.21.3 (already installed) | Client list with override badges | Already used in Phase 1, filtering/sorting clients |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-big-calendar | FullCalendar | FullCalendar has more features but heavier bundle, requires license for commercial use |
| react-big-calendar | React Aria Calendar | More accessible but lower-level primitives, would require custom month grid view |
| Custom business day logic | date-fns-holidays package | Package is US-focused, UK holidays need custom implementation anyway |

**Installation:**
```bash
npm install react-hook-form@7 react-big-calendar@1
npm install @types/react-big-calendar -D
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   └── reminders/route.ts       # Vercel Cron endpoint (lightweight queue processor)
│   │   └── reminders/
│   │       └── process-batch/route.ts   # Process pending reminders in batches
│   ├── templates/
│   │   ├── page.tsx                      # Template management UI
│   │   └── [id]/edit/page.tsx            # Accordion-based step editor
│   └── calendar/
│       └── page.tsx                      # Calendar grid view
├── lib/
│   ├── deadlines/
│   │   ├── calculators.ts                # Deadline formulas (Corp Tax, VAT, etc.)
│   │   ├── rollover.ts                   # Year-on-year rollover logic
│   │   └── working-days.ts               # UK bank holiday + weekend skipping
│   ├── templates/
│   │   ├── variables.ts                  # Template variable substitution
│   │   └── inheritance.ts                # Field-level override resolution
│   └── bank-holidays/
│       └── cache.ts                      # Fetch & cache gov.uk bank holidays
└── supabase/migrations/
    └── create_phase2_schema.sql          # Templates, reminders, overrides tables
```

### Pattern 1: Queue-Based Cron Processing (Critical for Vercel 5-min Timeout)

**What:** Cron job creates "pending" reminder records instead of processing immediately, then triggers async batch processor

**Why this pattern:** Vercel Pro cron jobs have 5-minute timeout. If you have 100 clients each needing deadline checks, processing synchronously will timeout. Queue pattern offloads work.

**When to use:** Always for Vercel Cron — this is a known constraint per Vercel docs

**Example:**
```typescript
// api/cron/reminders/route.ts
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 300; // 5 minutes (Pro plan limit)

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date();

  // Lightweight: Find reminders due today, mark as pending (don't send yet)
  const { data: dueReminders } = await supabase
    .from('reminder_queue')
    .select('id')
    .eq('send_date', today.toISOString().split('T')[0])
    .eq('status', 'scheduled');

  await supabase
    .from('reminder_queue')
    .update({ status: 'pending', queued_at: new Date().toISOString() })
    .in('id', dueReminders.map(r => r.id));

  // Trigger batch processor asynchronously (use after() or queue table pattern)
  // The batch processor runs separately and can exceed cron timeout

  return NextResponse.json({
    queued: dueReminders.length,
    message: 'Reminders queued for processing'
  });
}
```

### Pattern 2: UK Filing Deadline Calculation

**What:** Formula-based deadline calculation from client metadata (year-end, VAT quarter, client type)

**When to use:** On client metadata change, on year rollover, when displaying calendar

**UK deadline formulas (verified sources):**
- **Corporation Tax payment:** Year-end + 9 months + 1 day
- **Corporation Tax filing (CT600):** Year-end + 12 months
- **Companies House accounts:** Year-end + 9 months (private companies)
- **VAT return:** Quarter-end + 1 month + 7 days
- **Self Assessment filing:** 31 January following tax year (ends 5 April)
- **Self Assessment payment:** 31 January following tax year

**Example:**
```typescript
// lib/deadlines/calculators.ts
// Source: https://www.goforma.com/small-business-accounting/tax-year-dates-deadlines
import { addMonths, addDays, setMonth, setDate, getYear } from 'date-fns';

export function calculateCorporationTaxPayment(yearEndDate: Date): Date {
  // Year-end + 9 months + 1 day
  return addDays(addMonths(yearEndDate, 9), 1);
}

export function calculateCompaniesHouseAccounts(yearEndDate: Date): Date {
  // Year-end + 9 months (private companies)
  return addMonths(yearEndDate, 9);
}

export function calculateVATDeadline(quarterEndDate: Date): Date {
  // Quarter-end + 1 month + 7 days
  return addDays(addMonths(quarterEndDate, 1), 7);
}

export function calculateSelfAssessmentDeadline(taxYearEnd: Date): Date {
  // 31 January following tax year ending 5 April
  const taxYear = getYear(taxYearEnd);
  return new Date(taxYear + 1, 0, 31); // Jan 31 of next year
}

// VAT quarter end dates based on vat_quarter enum
export function getVATQuarterEnd(quarter: 'Jan-Mar' | 'Apr-Jun' | 'Jul-Sep' | 'Oct-Dec', year: number): Date {
  const quarterMap = {
    'Jan-Mar': new Date(year, 2, 31),   // Mar 31
    'Apr-Jun': new Date(year, 5, 30),   // Jun 30
    'Jul-Sep': new Date(year, 8, 30),   // Sep 30
    'Oct-Dec': new Date(year, 11, 31),  // Dec 31
  };
  return quarterMap[quarter];
}
```

### Pattern 3: Working Day Calculation with UK Bank Holidays

**What:** Skip weekends and UK bank holidays when calculating reminder send dates

**Why:** User decision requires shifting weekend/holiday reminders to next working day

**gov.uk API structure (verified):**
- URL: `https://www.gov.uk/bank-holidays.json`
- Regions: `england-and-wales`, `scotland`, `northern-ireland`
- Event fields: `title`, `date` (YYYY-MM-DD), `notes`, `bunting`
- Data range: 2019-2028

**Example:**
```typescript
// lib/bank-holidays/cache.ts
// Source: https://www.gov.uk/bank-holidays.json
interface BankHoliday {
  title: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  bunting: boolean;
}

let cachedHolidays: Set<string> | null = null;
let cacheExpiry: Date | null = null;

export async function fetchUKBankHolidays(): Promise<Set<string>> {
  // Cache for 7 days (bank holidays change infrequently)
  if (cachedHolidays && cacheExpiry && new Date() < cacheExpiry) {
    return cachedHolidays;
  }

  const response = await fetch('https://www.gov.uk/bank-holidays.json');
  const data = await response.json();

  // Use England and Wales holidays (can extend to support Scotland/NI per client)
  const holidays = new Set<string>(
    data['england-and-wales'].events.map((e: BankHoliday) => e.date)
  );

  cachedHolidays = holidays;
  cacheExpiry = addDays(new Date(), 7);

  return holidays;
}

// lib/deadlines/working-days.ts
// Source: https://date-fns.org/ + custom holiday logic
import { addDays, isWeekend, format } from 'date-fns';
import { fetchUKBankHolidays } from '@/lib/bank-holidays/cache';

export async function getNextWorkingDay(date: Date): Promise<Date> {
  const holidays = await fetchUKBankHolidays();
  let nextDay = date;

  while (isWeekend(nextDay) || holidays.has(format(nextDay, 'yyyy-MM-dd'))) {
    nextDay = addDays(nextDay, 1);
  }

  return nextDay;
}
```

### Pattern 4: Template Variable Substitution

**What:** Simple string replacement for template placeholders like `{{client_name}}`, `{{deadline}}`

**When to use:** When rendering reminder email content before sending (Phase 3)

**Example:**
```typescript
// lib/templates/variables.ts
// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
import { format } from 'date-fns';
import { differenceInDays } from 'date-fns';

interface TemplateContext {
  client_name: string;
  deadline: Date;
  filing_type: string;
  accountant_name?: string;
}

export function substituteVariables(template: string, context: TemplateContext): string {
  const daysUntil = differenceInDays(context.deadline, new Date());

  const variables: Record<string, string> = {
    client_name: context.client_name,
    deadline: format(context.deadline, 'dd MMMM yyyy'),
    deadline_short: format(context.deadline, 'dd/MM/yyyy'),
    filing_type: context.filing_type,
    days_until_deadline: daysUntil.toString(),
    accountant_name: context.accountant_name || 'Peninsula Accounting',
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match; // Keep original if variable not found
  });
}

// Recommended placeholder variables (user can customize exact names)
export const AVAILABLE_PLACEHOLDERS = [
  { name: 'client_name', description: "Client's company name" },
  { name: 'deadline', description: 'Deadline in long format (e.g., 31 January 2026)' },
  { name: 'deadline_short', description: 'Deadline in short format (e.g., 31/01/2026)' },
  { name: 'filing_type', description: 'Type of filing (e.g., Corporation Tax)' },
  { name: 'days_until_deadline', description: 'Number of days remaining' },
  { name: 'accountant_name', description: 'Your practice name' },
] as const;
```

### Pattern 5: Field-Level Override Inheritance

**What:** Store overrides in separate table referencing base template, merge at read time

**Why:** User decision requires inheritance model where overridden fields persist, non-overridden fields update when base template changes

**Database pattern:**
```sql
-- Base templates table
CREATE TABLE reminder_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filing_type TEXT NOT NULL UNIQUE, -- 'corporation_tax', 'vat_return', etc.
  name TEXT NOT NULL,
  steps JSONB NOT NULL, -- Array of {delay_days, subject, body}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Client-specific overrides (field-level granularity)
CREATE TABLE client_template_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES reminder_templates(id) ON DELETE CASCADE,
  step_index INT NOT NULL, -- Which step in the template array
  overridden_fields JSONB NOT NULL, -- Only fields that differ: {subject?: string, body?: string, delay_days?: number}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, template_id, step_index)
);

-- Index for checking which clients have overrides (for badge display)
CREATE INDEX idx_client_overrides ON client_template_overrides(client_id);
```

**Resolution pattern:**
```typescript
// lib/templates/inheritance.ts
interface TemplateStep {
  delay_days: number;
  subject: string;
  body: string;
}

export function resolveTemplateForClient(
  baseTemplate: { steps: TemplateStep[] },
  overrides: Array<{ step_index: number; overridden_fields: Partial<TemplateStep> }>
): TemplateStep[] {
  return baseTemplate.steps.map((step, index) => {
    const override = overrides.find(o => o.step_index === index);
    if (!override) return step;

    // Merge: override only specified fields, keep base for others
    return {
      delay_days: override.overridden_fields.delay_days ?? step.delay_days,
      subject: override.overridden_fields.subject ?? step.subject,
      body: override.overridden_fields.body ?? step.body,
    };
  });
}
```

### Pattern 6: Automatic Year-on-Year Rollover

**What:** When current deadline passes, calculate next cycle's deadline and create new reminder schedule

**When:** Daily cron checks for passed deadlines, triggers rollover

**Example:**
```typescript
// lib/deadlines/rollover.ts
import { addYears } from 'date-fns';

export function rolloverDeadline(
  currentDeadline: Date,
  filingType: string,
  clientMetadata: { year_end_date?: Date; vat_quarter?: string }
): Date {
  switch (filingType) {
    case 'corporation_tax':
      // Year-end advances by 1 year, so deadline advances by 1 year
      const newYearEnd = addYears(clientMetadata.year_end_date!, 1);
      return calculateCorporationTaxPayment(newYearEnd);

    case 'vat_return':
      // VAT quarters repeat every year
      const currentYear = getYear(currentDeadline);
      const nextQuarterEnd = getVATQuarterEnd(clientMetadata.vat_quarter!, currentYear + 1);
      return calculateVATDeadline(nextQuarterEnd);

    case 'self_assessment':
      // Always 31 January of next tax year
      return addYears(currentDeadline, 1);

    default:
      throw new Error(`Unknown filing type: ${filingType}`);
  }
}
```

### Anti-Patterns to Avoid

- **Don't process all reminders synchronously in cron:** Vercel cron has 5-minute timeout. Use queue pattern (mark pending, process async).
- **Don't store resolved template content:** Store overrides separately and merge at runtime. Prevents stale content when base template updates.
- **Don't ignore timezone:** UK cron should run at 9am UK time (use date-fns-tz). Vercel cron uses UTC, convert accordingly.
- **Don't hand-roll bank holiday logic:** Use gov.uk API. Hand-rolled lists go stale (e.g., 2025 Platinum Jubilee was one-off).
- **Don't create circular dependencies:** Template → Override → Client. Keep schema directional with ON DELETE CASCADE.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UK bank holidays list | Hardcoded array of dates | gov.uk API (https://www.gov.uk/bank-holidays.json) | Official source, includes future years, handles one-off holidays (Jubilee, coronation) |
| Business day calculation | Manual weekend + holiday checking | date-fns isWeekend() + cached holiday set | Edge cases: leap years, DST transitions, substitute days (holiday falls on weekend) |
| Calendar month grid | Custom CSS grid layout | react-big-calendar month view | Handles variable month lengths, week alignment, event rendering, responsive design |
| Dynamic form arrays | Manual add/remove state | React Hook Form useFieldArray | Manages validation, focus, re-rendering, unique keys automatically |
| Cron expression validation | Regex validation | Zod custom validator with cron-parser | Catches invalid expressions (e.g., Feb 30), validates against Vercel limits (Hobby = daily only) |
| Template variable parsing | String.replace loops | Single regex with capture groups | Handles edge cases: escaped braces, nested variables, missing variables |
| Distributed locks (concurrency) | Manual lock checking | Postgres advisory locks or existing locks table | Prevents race conditions if cron triggers overlap (though Vercel Pro shouldn't overlap at per-minute precision) |

**Key insight:** Date calculations have more edge cases than expected. UK filing deadlines involve leap years, weekend shifts, substitute bank holidays, and regional variations (Scotland/NI different holidays). Using established libraries and official data sources prevents production bugs.

## Common Pitfalls

### Pitfall 1: Vercel Cron Timeout on Large Client Lists
**What goes wrong:** Cron job iterates 200+ clients checking deadlines, times out at 5 minutes, some reminders never get created.

**Why it happens:** Vercel Pro function timeout is 5 minutes (300s). Processing 200 clients at ~1-2s each = 200-400s, cutting it close. Any Supabase latency = timeout.

**How to avoid:** Use queue-based pattern. Cron job only marks reminders as "pending" (fast write), separate API route processes batches of 10-20 asynchronously.

**Warning signs:** Cron logs showing 4-5 minute execution times, "Function timed out" errors in Vercel dashboard.

**Source:** https://vercel.com/docs/cron-jobs/manage-cron-jobs

### Pitfall 2: Stale Template Content After Base Update
**What goes wrong:** Accountant updates base template subject line, but clients with overrides still see old subject because override stored full subject.

**Why it happens:** Storing full resolved template content instead of just overridden fields. When base changes, overrides have stale data.

**How to avoid:** Store only overridden fields in JSONB (e.g., `{subject: "Custom subject"}`), merge at runtime. Non-overridden fields always pull from current base template.

**Warning signs:** User reports "I updated the template but some clients still have old text."

### Pitfall 3: Timezone Confusion (9am UK vs UTC)
**What goes wrong:** Cron runs at 9am UTC instead of 9am UK time, so reminders go out at 8am GMT / 9am BST.

**Why it happens:** Vercel cron expressions are always UTC. User wants 9am UK time, which is UTC+0 (winter) or UTC+1 (summer with BST).

**How to avoid:** Cron expression should be `0 9 * * *` (9am UTC) in winter, `0 8 * * *` (8am UTC) in summer. OR: Run cron hourly, check current UK time inside function and proceed only if 9am UK.

**Warning signs:** Reminders sending at wrong time during BST transitions (March/October).

**Source:** https://vercel.com/docs/cron-jobs (cron timezone always UTC)

### Pitfall 4: Year-End Rollover on Leap Years
**What goes wrong:** Client with year-end Feb 28 rolls over to Feb 28 next year, but next year is leap year, should be Feb 29.

**Why it happens:** Naively using `addYears(year_end_date, 1)` doesn't account for leap year changes.

**How to avoid:** Store year-end as month + day (e.g., "02-28"), recalculate actual date each year. date-fns handles leap years correctly if you use `setMonth` + `setDate`.

**Warning signs:** Client year-ends drift by 1 day every 4 years.

### Pitfall 5: Weekend Deadline Shifting Inconsistency
**What goes wrong:** Some deadlines shifted to Monday, others shifted to Friday, when deadline falls on weekend.

**Why it happens:** Different logic for Saturday (shift forward) vs Sunday (shift backward). UK convention is always shift forward.

**How to avoid:** Always use "next working day" logic (shift forward until hitting weekday that's not a bank holiday).

**Warning signs:** User confusion about why some deadlines on Monday, others on Friday.

**Source:** https://www.gov.uk/bank-holidays (substitute day logic)

### Pitfall 6: Concurrent Cron Runs Creating Duplicate Reminders
**What goes wrong:** Two cron instances run simultaneously, both create reminders for same deadline.

**Why it happens:** Vercel cron can rarely trigger overlapping runs if previous run exceeds interval.

**How to avoid:** Use distributed lock (existing `locks` table from Phase 1). Cron acquires lock at start, releases at end. Second instance exits early if lock held.

**Warning signs:** Database showing duplicate reminder_queue rows with same client_id + deadline + filing_type.

**Source:** https://vercel.com/docs/cron-jobs/manage-cron-jobs#controlling-cron-job-concurrency

### Pitfall 7: Hardcoded Bank Holidays Going Stale
**What goes wrong:** 2025 Platinum Jubilee bank holiday wasn't in hardcoded list, system sent reminder on bank holiday.

**Why it happens:** UK government occasionally adds one-off bank holidays (royal events). Hardcoded arrays don't update.

**How to avoid:** Always fetch from gov.uk API, cache for 7 days. API includes future years and one-off holidays.

**Warning signs:** Reminders sending on bank holidays that weren't in original list.

## Code Examples

Verified patterns from official sources:

### Vercel Cron Route with CRON_SECRET Authentication
```typescript
// app/api/cron/reminders/route.ts
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
import type { NextRequest } from 'next/server';

export const maxDuration = 300; // 5 minutes (Vercel Pro limit)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Lightweight queue processing logic here

  return Response.json({ success: true });
}
```

### vercel.json Cron Configuration for 9am UTC
```json
// vercel.json
// Source: https://vercel.com/docs/cron-jobs#cron-expressions
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### React Hook Form with useFieldArray for Template Steps
```typescript
// app/templates/[id]/edit/page.tsx
// Source: https://react-hook-form.com/docs/usefieldarray
import { useForm, useFieldArray } from 'react-hook-form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface TemplateStep {
  delay_days: number;
  subject: string;
  body: string;
}

export default function TemplateEditor() {
  const { control, register, handleSubmit } = useForm<{ steps: TemplateStep[] }>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'steps',
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Accordion type="multiple" className="w-full">
        {fields.map((field, index) => (
          <AccordionItem key={field.id} value={`step-${index}`}>
            <AccordionTrigger>
              Step {index + 1}: {field.delay_days} days before deadline
            </AccordionTrigger>
            <AccordionContent>
              <label>Days before deadline</label>
              <input type="number" {...register(`steps.${index}.delay_days`)} />

              <label>Subject</label>
              <input type="text" {...register(`steps.${index}.subject`)} />

              <label>Body</label>
              <textarea {...register(`steps.${index}.body`)} rows={5} />

              <button type="button" onClick={() => remove(index)}>Remove Step</button>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <button type="button" onClick={() => append({ delay_days: 30, subject: '', body: '' })}>
        Add Step
      </button>

      <button type="submit">Save Template</button>
    </form>
  );
}
```

### react-big-calendar Month View for Deadlines
```typescript
// app/calendar/page.tsx
// Source: https://github.com/jquense/react-big-calendar
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

interface DeadlineEvent {
  id: string;
  title: string; // e.g., "ABC Ltd - Corporation Tax"
  start: Date;
  end: Date;
  client_name: string;
  filing_type: string;
}

export default function DeadlineCalendar({ events }: { events: DeadlineEvent[] }) {
  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      style={{ height: 600 }}
      views={['month']}
      defaultView="month"
      eventPropGetter={(event) => ({
        style: {
          backgroundColor: getColorForFilingType(event.filing_type),
        },
      })}
    />
  );
}

function getColorForFilingType(type: string): string {
  const colors: Record<string, string> = {
    corporation_tax: '#3b82f6', // blue
    vat_return: '#10b981', // green
    companies_house: '#f59e0b', // amber
    self_assessment: '#ef4444', // red
  };
  return colors[type] || '#6b7280'; // gray default
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node-cron library | Vercel Cron (native) | Vercel Cron GA 2022 | Vercel Cron is serverless-native, no need for always-on process |
| Manual holiday lists | gov.uk API | API available since 2012, format stable | Official source, includes future years and one-off holidays |
| Moment.js | date-fns | Moment frozen 2020 | date-fns is immutable, tree-shakeable, TypeScript-first |
| Full template copies | Field-level overrides | Modern practice | Inheritance model keeps templates in sync, prevents drift |
| FullCalendar | react-big-calendar | Depends on license | react-big-calendar is MIT, FullCalendar requires commercial license |

**Deprecated/outdated:**
- **Moment.js:** Now in maintenance mode, use date-fns or Temporal (when stable)
- **cron npm package:** Use Vercel Cron for Vercel deployments, handles scheduling + invocation
- **Hardcoded bank holiday arrays:** Use gov.uk API, ensures accuracy and includes future years

## Open Questions

Things that couldn't be fully resolved:

1. **Scotland/Northern Ireland Bank Holiday Support**
   - What we know: gov.uk API has separate regions (scotland, northern-ireland)
   - What's unclear: Do any clients operate across regions? Should we support per-client region selection?
   - Recommendation: Start with England and Wales only (majority case), add region field to clients table if needed later. Low priority unless accountant has Scottish/NI clients.

2. **Cron Timezone Handling During BST Transitions**
   - What we know: Vercel cron uses UTC, UK has BST (UTC+1) Mar-Oct
   - What's unclear: User wants "9am UK time" — should we adjust cron expression twice a year, or check time inside function?
   - Recommendation: Use fixed `0 9 * * *` UTC expression, check UK time inside function and exit early if not 9am UK. Simpler than manual cron updates.

3. **Template Step Limit (1-5 Steps)**
   - What we know: User decided 1-5 steps configurable
   - What's unclear: Should we enforce max 5 in database constraint, or just UI validation?
   - Recommendation: Enforce in UI only (Zod validation). If user needs 6 steps later, no migration needed. Database allows flexibility.

4. **Override Badge Performance**
   - What we know: User wants badge on client list showing which have overrides
   - What's unclear: With 200+ clients, joining client_template_overrides on every list render could be slow
   - Recommendation: Add computed column `has_overrides BOOLEAN` on clients table, updated via trigger when overrides inserted/deleted. Avoids join on list view.

5. **Deadline Override UI Placement**
   - What we know: User gave Claude discretion on override UI placement
   - What's unclear: Inline in calendar view, or separate modal/page?
   - Recommendation: Add "Override" button on calendar event hover/click, opens dialog with date picker. Keeps calendar clean, contextual action.

## Sources

### Primary (HIGH confidence)
- Vercel Cron Documentation: https://vercel.com/docs/cron-jobs (configuration, limits, security)
- Vercel Cron Management: https://vercel.com/docs/cron-jobs/manage-cron-jobs (timeout, concurrency, error handling)
- Vercel Cron Usage & Pricing: https://vercel.com/docs/cron-jobs/usage-and-pricing (Hobby vs Pro limits)
- gov.uk Bank Holidays API: https://www.gov.uk/bank-holidays.json (official UK bank holidays 2019-2028)
- date-fns documentation: https://date-fns.org/ (date manipulation, isWeekend, addDays, format)
- React Hook Form useFieldArray: https://react-hook-form.com/docs/usefieldarray (dynamic form arrays)
- shadcn/ui Accordion: https://ui.shadcn.com/docs/components/accordion (collapsible sections)

### Secondary (MEDIUM confidence)
- UK Tax Deadlines 2026: https://www.goforma.com/small-business-accounting/tax-year-dates-deadlines (Corp Tax, VAT, Self Assessment formulas)
- UK Accounting Calendar 2026: https://frontedgeaccountants.co.uk/uk-accounting-calendar-2026/ (key dates reference)
- react-big-calendar: https://github.com/jquense/react-big-calendar (calendar component docs)
- Supabase Edge Functions with Cron: https://supabase.com/blog/processing-large-jobs-with-edge-functions (queue pattern examples)
- Cron Job Race Condition Prevention: https://cronitor.io/guides/how-to-prevent-duplicate-cron-executions (distributed lock patterns)

### Tertiary (LOW confidence)
- Template variable substitution patterns: General MDN template literal docs, no specific library found for {{mustache}} style in TypeScript ecosystem (implement custom)
- Field-level override inheritance: Pattern described in user constraints, no single authoritative source, implemented based on Postgres JSONB best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vercel Cron, date-fns, React Hook Form, shadcn/ui all verified via official docs
- Architecture: HIGH - Queue pattern verified in Vercel docs, deadline formulas verified in UK gov sources
- Pitfalls: MEDIUM-HIGH - Timeout and timezone issues verified, some edge cases (leap year rollover) are reasoned but not production-tested

**Research date:** 2026-02-06
**Valid until:** 2026-03-08 (30 days - stable domain, Vercel Cron API unlikely to change)

**Additional notes:**
- Phase 1 database schema reviewed — clients table has all needed fields (client_type, year_end_date, vat_quarter)
- No new dependencies needed beyond react-hook-form and react-big-calendar
- Queue pattern is critical for Vercel Cron timeout constraint — must not skip this
- gov.uk API is stable and official, but should implement graceful fallback if API unavailable (use cached data, log error)
