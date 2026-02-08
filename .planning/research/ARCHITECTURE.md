# Architecture: Template & Schedule Separation

**Domain:** Email reminder automation (decoupling templates from scheduling)
**Researched:** 2026-02-08
**Confidence:** HIGH -- based on direct analysis of existing codebase, not external sources

## Problem Statement

The current `reminder_templates` table conflates two distinct concerns:

1. **Email content** -- subject line, body text, placeholder variables
2. **Scheduling logic** -- `delay_days` (when to send relative to deadline), step ordering

These are embedded together in a `steps` JSONB array where each step contains `{step_number, delay_days, subject, body}`. This means:
- You cannot reuse the same email content with different timing
- You cannot change timing without touching the template
- Ad-hoc sends are impossible (no concept of "just send this email now")
- The override system (`client_template_overrides`) mixes content and timing overrides in one `overridden_fields` JSONB blob

## Current Architecture (v1.0)

### Data Flow

```
reminder_templates.steps[N]     -- contains subject, body, delay_days
        |
        v
client_template_overrides       -- per-client step-level field overrides
        |
        v
resolveTemplateForClient()      -- merges base + overrides via inheritance.ts
        |
        v
queue-builder.ts                -- calculates send_date = deadline - delay_days
        |                          inserts into reminder_queue
        v
reminder_queue                  -- scheduled items with template_id + step_index
        |
        v
scheduler.ts                   -- marks 'scheduled' -> 'pending', resolves variables
        |
        v
send-emails cron                -- picks up 'pending', renders via React Email, sends via Postmark
        |
        v
email_log                      -- delivery tracking
```

### Tables Involved

| Table | Role | Key Columns |
|-------|------|-------------|
| `reminder_templates` | Template + schedule combined | `steps` JSONB (subject, body, delay_days per step) |
| `client_template_overrides` | Per-client field overrides | `template_id`, `step_index`, `overridden_fields` JSONB |
| `reminder_queue` | Scheduled sends | `template_id`, `step_index`, `send_date`, `status` |
| `email_log` | Delivery history | `reminder_queue_id`, `postmark_message_id` |

### Key Coupling Points

1. **`queue-builder.ts` lines 139-153**: Finds template by `filing_type_id`, iterates `resolvedSteps`, uses `step.delay_days` to calculate `send_date`. Template content and scheduling are inseparable here.

2. **`scheduler.ts` lines 117-131**: Fetches template by ID, accesses `template.steps[reminder.step_index]` to get subject/body. The `step_index` on `reminder_queue` is the bridge between scheduling and content.

3. **`client_template_overrides`**: The `overridden_fields` JSONB stores `{subject?, body?, delay_days?}` -- a mix of content and timing overrides in one record.

4. **`lib/templates/inheritance.ts`**: `resolveTemplateForClient()` merges both content and timing fields identically since they live in the same object.

5. **`lib/validations/template.ts`**: Single schema validates subject + body + delay_days together.

---

## Recommended Architecture (v1.1)

### Design Principles

1. **Separate what changes independently.** Email wording changes at a different pace than scheduling timing. They should be independent entities.
2. **Compose, don't embed.** Schedules should reference email templates by ID, not contain copies of content.
3. **Keep the queue contract stable.** The `reminder_queue` and downstream send pipeline should need minimal changes.
4. **Migrate in place.** No parallel systems -- convert the old structure into the new one with a single migration.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `email_templates` | Store reusable email content (subject, body, category) | Referenced by `schedule_steps`, `ad_hoc_sends` |
| `schedules` | Define a named timing sequence for a filing type | Contains `schedule_steps` |
| `schedule_steps` | Pair an email template with a timing (delay_days) | References `email_templates`, belongs to `schedules` |
| `ad_hoc_sends` | One-off email sends outside the schedule | References `email_templates`, `clients` |
| `client_template_overrides` (revised) | Per-client email content overrides | References `email_templates` |
| `client_schedule_overrides` (new) | Per-client timing overrides | References `schedule_steps` |
| `reminder_queue` (unchanged core) | Scheduled send items | References `schedule_steps` instead of `reminder_templates` |

### Proposed Schema

#### 1. `email_templates` (NEW)

Standalone email content, reusable across schedules and ad-hoc sends.

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "CT600 First Reminder", "Friendly VAT Nudge"
  category TEXT NOT NULL DEFAULT 'reminder',  -- 'reminder', 'follow_up', 'urgent', 'custom'
  subject TEXT NOT NULL,                 -- supports {{placeholders}}
  body TEXT NOT NULL,                    -- supports {{placeholders}}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Migration tracking
  migrated_from_template_id UUID,        -- links back to original reminder_template if migrated
  migrated_from_step_index INT           -- which step this came from
);

CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_active ON email_templates(is_active);
```

**Key decisions:**
- `category` is a free TEXT, not an enum. Categories will evolve (urgency levels, custom tags). Using an enum would require migrations for each new category.
- `subject` and `body` remain plain text with `{{placeholder}}` syntax. The React Email renderer (`lib/email/templates/reminder.tsx`) handles HTML rendering at send time. Rich text editing (Tiptap/etc.) is a UI concern that outputs plain text or HTML to this field.
- `migrated_from_*` columns track provenance during migration. These can be dropped after the migration is confirmed stable.

#### 2. `schedules` (NEW)

Replaces `reminder_templates` as the container for a filing-type-specific reminder sequence.

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Standard CT600 Schedule"
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Migration tracking
  migrated_from_template_id UUID
);

-- One schedule per filing type (matches current constraint)
CREATE UNIQUE INDEX idx_schedules_filing_type ON schedules(filing_type_id) WHERE is_active = true;
```

**Key decisions:**
- The UNIQUE constraint is on `(filing_type_id) WHERE is_active = true` -- partial unique index. This allows inactive/archived schedules while enforcing one active schedule per filing type (matching current behavior where `reminder_templates.filing_type_id` is UNIQUE).
- A schedule without the filing_type_id constraint would be possible for ad-hoc sequences, but that adds complexity without clear value. Keep it simple: schedules are for filing types.

#### 3. `schedule_steps` (NEW)

The join between schedules and email templates with timing.

```sql
CREATE TABLE schedule_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  email_template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE RESTRICT,
  step_number INT NOT NULL,              -- ordering within the schedule (1-based)
  delay_days INT NOT NULL,               -- days before deadline to send
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(schedule_id, step_number)       -- no duplicate step numbers
);

CREATE INDEX idx_schedule_steps_schedule ON schedule_steps(schedule_id);
CREATE INDEX idx_schedule_steps_template ON schedule_steps(email_template_id);
```

**Key decisions:**
- `ON DELETE RESTRICT` for `email_template_id`: prevent deleting an email template that is used in a schedule. The UI should warn the user and require them to either replace the template in the schedule or remove the step first.
- `step_number` is explicit (1-based) rather than relying on array position. This makes reordering and insertion straightforward.
- Maximum 5 steps per schedule (enforced at application level, matching current validation).
- This is a **one-to-many** relationship from email_templates to schedule_steps. One template can be used in multiple schedule steps (even within the same schedule if desired). A schedule step references exactly one template.

#### 4. `ad_hoc_sends` (NEW)

For one-off emails outside the scheduled reminder flow.

```sql
CREATE TABLE ad_hoc_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,                 -- resolved subject at time of send
  body TEXT NOT NULL,                    -- resolved body at time of send
  recipient_client_ids UUID[] NOT NULL,  -- array of client IDs
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sending', 'completed', 'failed')),
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_ad_hoc_sends_status ON ad_hoc_sends(status);
```

**Key decisions:**
- Stores `subject` and `body` as resolved snapshots at send time, not just a template reference. This means ad-hoc sends have a permanent record of what was actually sent, even if the template changes later.
- `recipient_client_ids` is a UUID array rather than a junction table. For ad-hoc sends to a handful of clients (typical use case: 1-20 clients), an array is simpler than a many-to-many table. Individual send results are tracked in `email_log`.
- The `email_template_id` is nullable (`ON DELETE SET NULL`) because the ad-hoc send record should persist even if the template is deleted later.

#### 5. `client_template_overrides` (REVISED)

Changes from overriding `reminder_template` steps to overriding `email_templates` content.

```sql
-- NEW table replacing the old client_template_overrides
CREATE TABLE client_email_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email_template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  overridden_subject TEXT,               -- NULL = use template default
  overridden_body TEXT,                  -- NULL = use template default
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, email_template_id)
);

CREATE INDEX idx_client_email_overrides_client ON client_email_overrides(client_id);
CREATE INDEX idx_client_email_overrides_template ON client_email_overrides(email_template_id);
```

**Key decisions:**
- Override granularity is now **per email template per client**, not per step-index. This is cleaner because the email template is the atomic unit of content.
- `overridden_subject` and `overridden_body` are explicit nullable columns, not a JSONB blob. This is more queryable and more explicit about what can be overridden.
- No `delay_days` override here -- timing overrides are separate (see below).

#### 6. `client_schedule_overrides` (NEW)

Per-client timing overrides, separate from content overrides.

```sql
CREATE TABLE client_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  schedule_step_id UUID NOT NULL REFERENCES schedule_steps(id) ON DELETE CASCADE,
  override_delay_days INT NOT NULL,      -- client-specific delay
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, schedule_step_id)
);

CREATE INDEX idx_client_schedule_overrides_client ON client_schedule_overrides(client_id);
```

**Key decisions:**
- Timing overrides are keyed to `schedule_step_id`, not to the schedule as a whole. This means you can override the delay for step 2 without touching step 1 or 3.
- Only `delay_days` is overridable for timing. Adding/removing steps per client is out of scope (too complex, and the current system doesn't support it either).

#### 7. `reminder_queue` (MODIFIED)

Minimal changes to the existing queue. Replace `template_id` + `step_index` with `schedule_step_id`.

```sql
-- Column changes to reminder_queue:
ALTER TABLE reminder_queue ADD COLUMN schedule_step_id UUID REFERENCES schedule_steps(id) ON DELETE SET NULL;
-- Keep template_id and step_index during migration, drop after migration verified
-- ALTER TABLE reminder_queue DROP COLUMN template_id;  -- later
-- ALTER TABLE reminder_queue DROP COLUMN step_index;    -- later
```

**Key decisions:**
- During migration, both old columns (`template_id`, `step_index`) and the new column (`schedule_step_id`) coexist. This allows backward compatibility during the transition.
- The `ON DELETE SET NULL` on `schedule_step_id` means deleting a schedule step doesn't delete queued reminders -- they just lose their link back.
- `resolved_subject` and `resolved_body` columns remain. These are already the "what was actually sent" snapshot.

### Complete Entity Relationship Diagram

```
filing_types
    |
    | 1:1 (active)
    v
schedules
    |
    | 1:N
    v
schedule_steps -----> email_templates <----- client_email_overrides
    |                       |                        |
    |                       | 1:N                    |
    |                       v                        |
    |                 ad_hoc_sends                    |
    |                                                |
    v                                                v
client_schedule_overrides                        clients
    |                                                |
    v                                                v
reminder_queue -----------------------------------> email_log
```

### Relationship Summary

| Relationship | Type | Rationale |
|-------------|------|-----------|
| `filing_types` -> `schedules` | 1:1 (active) | Same as current 1:1 between filing_type and reminder_template |
| `schedules` -> `schedule_steps` | 1:N | A schedule has 1-5 ordered steps |
| `schedule_steps` -> `email_templates` | N:1 | Many steps can reference the same template |
| `email_templates` -> `client_email_overrides` | 1:N | One override per client per template |
| `schedule_steps` -> `client_schedule_overrides` | 1:N | One timing override per client per step |
| `schedule_steps` -> `reminder_queue` | 1:N | Queue items reference their originating step |
| `email_templates` -> `ad_hoc_sends` | 1:N | Ad-hoc sends start from a template |

---

## Migration Strategy

### Phase 1: Create New Tables (Additive Only)

Create all new tables alongside existing ones. No data movement yet. No existing code changes.

```sql
-- Single migration file
CREATE TABLE email_templates (...);
CREATE TABLE schedules (...);
CREATE TABLE schedule_steps (...);
CREATE TABLE ad_hoc_sends (...);
CREATE TABLE client_email_overrides (...);
CREATE TABLE client_schedule_overrides (...);
ALTER TABLE reminder_queue ADD COLUMN schedule_step_id UUID REFERENCES schedule_steps(id) ON DELETE SET NULL;
```

**Risk:** None. Purely additive. Existing system continues working.

### Phase 2: Data Migration (Copy, Don't Move)

A migration function (SQL or TypeScript) that converts existing data:

```
For each reminder_template:
  1. Create a `schedules` row from the template metadata
  2. For each step in template.steps[]:
     a. Create an `email_templates` row from {subject, body}
     b. Create a `schedule_steps` row linking schedule -> email_template with delay_days
  3. For each client_template_override referencing this template:
     a. If overridden_fields contains subject or body:
        Create a `client_email_overrides` row
     b. If overridden_fields contains delay_days:
        Create a `client_schedule_overrides` row

For each reminder_queue entry with template_id + step_index:
  Look up the corresponding schedule_step_id and populate the new column
```

**Key details:**
- This is a **copy** operation. Old data stays intact. New tables are populated.
- The `migrated_from_template_id` and `migrated_from_step_index` columns on `email_templates` track which original step each template came from. This is critical for debugging.
- `client_template_overrides` split: if a single override had `{subject: "Custom", delay_days: 14}`, this becomes TWO records -- one `client_email_overrides` with the subject, one `client_schedule_overrides` with the delay.
- Run this as a Supabase migration (SQL function) or as a one-time API endpoint. SQL function is preferred because it runs in a transaction.

### Phase 3: Dual-Write Period

Update the application code to write to BOTH old and new tables. This is a safety net.

- `queue-builder.ts`: Read from new `schedules` + `schedule_steps` + `email_templates`, but also keep old lookup as fallback.
- Template CRUD API: When creating/editing, write to both `reminder_templates` (old) and `email_templates` + `schedules` (new).
- Override API: Write to both old `client_template_overrides` and new `client_email_overrides` / `client_schedule_overrides`.

**Duration:** Keep dual-write for 1-2 weeks in production. Verify new tables match old tables.

### Phase 4: Cut Over

1. Switch `queue-builder.ts` to read exclusively from new tables.
2. Switch `scheduler.ts` to resolve content from `email_templates` via `schedule_step_id`.
3. Switch override API to new tables only.
4. Remove dual-write code.

### Phase 5: Cleanup

1. Drop `reminder_templates` table (or rename to `_legacy_reminder_templates`).
2. Drop `client_template_overrides` table (or rename).
3. Drop `template_id` and `step_index` columns from `reminder_queue`.
4. Drop `migrated_from_*` columns from `email_templates` and `schedules`.

**Important:** Do NOT drop old tables in the same release as the cutover. Keep them for at least one release cycle as a rollback safety net.

---

## Impact on Existing Code

### Files That MUST Change

| File | Change Required | Complexity |
|------|----------------|------------|
| `lib/reminders/queue-builder.ts` | Read from `schedules` + `schedule_steps` instead of `reminder_templates.steps` | HIGH -- core logic rewrite |
| `lib/reminders/scheduler.ts` | Resolve content from `email_templates` via `schedule_step_id` | MEDIUM -- fetch path changes |
| `lib/templates/inheritance.ts` | `resolveTemplateForClient()` operates on email template + content overrides only | LOW -- simplification |
| `lib/validations/template.ts` | Split into `emailTemplateSchema` + `scheduleSchema` | LOW -- schema split |
| `lib/types/database.ts` | Add new interfaces, deprecate old ones | LOW -- type additions |
| `app/api/templates/route.ts` | CRUD for `email_templates` instead of `reminder_templates` | MEDIUM -- new entity |
| `app/api/templates/[id]/route.ts` | Same | MEDIUM |
| `app/api/clients/[id]/template-overrides/route.ts` | Split into content overrides and timing overrides | MEDIUM |
| `app/(dashboard)/templates/page.tsx` | List `email_templates` instead of `reminder_templates` | LOW -- data source change |
| `app/(dashboard)/templates/[id]/edit/page.tsx` | Edit email template content only (no delay_days) | MEDIUM -- UI restructure |
| `app/(dashboard)/templates/components/template-step-editor.tsx` | Move to schedules page, not templates page | MEDIUM -- relocation |
| `app/(dashboard)/clients/[id]/components/template-overrides.tsx` | Split UI into content overrides vs timing overrides | HIGH -- significant UI change |

### Files That Need NEW Counterparts

| New File | Purpose |
|----------|---------|
| `app/(dashboard)/schedules/page.tsx` | Schedule list page |
| `app/(dashboard)/schedules/[id]/edit/page.tsx` | Schedule editor (step ordering + template selection) |
| `app/api/schedules/route.ts` | Schedule CRUD |
| `app/api/schedules/[id]/route.ts` | Single schedule CRUD |
| `app/api/ad-hoc/route.ts` | Ad-hoc send creation + triggering |
| `lib/validations/email-template.ts` | Email template validation schema |
| `lib/validations/schedule.ts` | Schedule validation schema |

### Files Unaffected

| File | Why Unaffected |
|------|----------------|
| `lib/email/sender.ts` | Takes `{to, subject, body}` -- doesn't care about source |
| `lib/email/templates/reminder.tsx` | React Email renderer -- receives resolved content |
| `app/api/cron/send-emails/route.ts` | Reads `resolved_subject` / `resolved_body` from queue -- doesn't touch templates |
| `lib/deadlines/calculators.ts` | Deadline calculation is independent of templates |
| `lib/templates/variables.ts` | Variable substitution is content-agnostic |
| `lib/bank-holidays/*` | Independent subsystem |

---

## Queue Builder Rewrite Detail

The most impactful change. Current `queue-builder.ts` does:

```
1. Fetch assignments (client + filing_type pairs)
2. Fetch all reminder_templates
3. Fetch all client overrides (deadline + template)
4. For each assignment:
   a. Find template by filing_type_id
   b. Resolve steps with client overrides
   c. For each resolved step:
      - Calculate send_date = deadline - step.delay_days
      - Insert into reminder_queue with template_id + step_index
```

New flow:

```
1. Fetch assignments (client + filing_type pairs)
2. Fetch all active schedules with schedule_steps + email_templates
3. Fetch all client overrides (deadline + schedule + email)
4. For each assignment:
   a. Find schedule by filing_type_id
   b. Resolve email content with client_email_overrides
   c. Resolve timing with client_schedule_overrides
   d. For each resolved step:
      - Calculate send_date = deadline - resolved_delay_days
      - Insert into reminder_queue with schedule_step_id
```

The key simplification: content resolution and timing resolution are now independent operations. `resolveTemplateForClient()` only merges content fields. Timing resolution is a separate lookup.

---

## Suggested Build Order

Based on dependencies and risk:

### Step 1: Schema Migration (database only)
- Create all new tables
- Add `schedule_step_id` to `reminder_queue`
- Run data migration to populate new tables from existing data
- **Verification:** Query new tables, confirm row counts match expectations

### Step 2: Email Template CRUD
- New validation schema (`emailTemplateSchema`)
- New API routes for `email_templates`
- New list + edit pages for email templates
- **No scheduling yet.** Templates are just standalone content at this point.
- **Verification:** Can create, edit, delete email templates independently

### Step 3: Schedule CRUD
- New validation schema (`scheduleSchema`)
- New API routes for `schedules` and `schedule_steps`
- New schedule editor page (select email templates for each step, set delay_days)
- Move step-editor component concept to schedule context
- **Verification:** Can create schedules that reference email templates

### Step 4: Queue Builder Migration
- Rewrite `queue-builder.ts` to read from new tables
- Update `scheduler.ts` to resolve content from email templates
- Update override resolution logic
- **This is the highest-risk step.** Test thoroughly with existing data.
- **Verification:** Run queue builder, confirm identical output to old system

### Step 5: Override System Split
- New `client_email_overrides` API + UI
- New `client_schedule_overrides` API + UI
- Update client detail page template overrides component
- **Verification:** Per-client overrides work for both content and timing independently

### Step 6: Ad-Hoc Sends
- `ad_hoc_sends` table already created in Step 1
- New API for creating ad-hoc sends
- New UI: select clients, pick template, preview, send
- Integrates with existing `sendReminderEmail()` and `email_log`
- **Verification:** Can send an email outside the scheduled flow

### Step 7: Cleanup
- Drop old tables / columns
- Remove dual-write code
- Remove migration tracking columns

---

## Patterns to Follow

### Pattern 1: Composition Over Embedding
**What:** Email templates are standalone entities referenced by ID, not JSON blobs embedded in a parent.
**Why:** Enables reuse, independent editing, and cleaner override boundaries.
**Example:**
```typescript
// GOOD: schedule_step references email_template by ID
interface ScheduleStep {
  id: string;
  schedule_id: string;
  email_template_id: string;  // reference, not embedded content
  step_number: number;
  delay_days: number;
}

// BAD (current): template step embeds content
interface TemplateStep {
  step_number: number;
  delay_days: number;
  subject: string;    // embedded content
  body: string;       // embedded content
}
```

### Pattern 2: Separate Override Dimensions
**What:** Content overrides and timing overrides are stored in separate tables.
**Why:** A client might want custom wording but default timing, or default wording but custom timing. Mixing them in one JSONB blob (current design) makes this awkward.

### Pattern 3: Snapshot at Send Time
**What:** The `reminder_queue.resolved_subject` and `resolved_body` columns capture the exact content sent, and `ad_hoc_sends` stores subject/body snapshots.
**Why:** Templates can change after a send. The queue/log must reflect what was actually sent, not what the template says now.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Many-to-Many Between Schedules and Email Templates
**What:** Creating a full junction table where schedules and templates have a many-to-many relationship.
**Why bad:** Overcomplicates queries and mental model. The `schedule_steps` table already provides the join with ordering. The relationship is `schedule -> [ordered steps] -> email_template`, not `schedule <-> email_template`.

### Anti-Pattern 2: Versioning Templates
**What:** Creating a version history table for email templates to track changes over time.
**Why bad:** Massive complexity for minimal value in a single-user system. The `email_log` already captures what was sent. If the accountant wants to know what a template looked like before they edited it, that is a version control problem (git), not a database problem.

### Anti-Pattern 3: Removing the JSONB Steps Before Migration Is Verified
**What:** Dropping the `steps` JSONB column or `reminder_templates` table before confirming the new system works identically.
**Why bad:** No rollback path. Keep old tables for at least one full deadline cycle (1 month) after cutover.

### Anti-Pattern 4: Trying to Auto-Sync Old and New Tables
**What:** Building triggers that keep `reminder_templates.steps` in sync with `email_templates` + `schedule_steps`.
**Why bad:** Fragile, hard to debug, and temporary. The dual-write period should be explicit in application code, not implicit in database triggers.

---

## Backward Compatibility Plan

### During Migration (Steps 1-4)

| Existing Feature | Compatibility | How |
|-----------------|---------------|-----|
| Template list page | Works | Reads from old `reminder_templates` until Step 2 UI is ready |
| Template edit page | Works | Writes to old table + new tables (dual-write in Step 3) |
| Client template overrides | Works | Old `client_template_overrides` table untouched until Step 5 |
| Queue builder (cron) | Works | Reads old tables until Step 4 cutover |
| Email sending | Works | `send-emails` cron reads `resolved_*` from queue -- source-agnostic |
| Email log / delivery tracking | Works | Unchanged |
| Calendar / deadline views | Works | Unchanged (no template dependency) |

### Risk Mitigations

1. **Feature flag approach:** The queue builder can check a `USE_NEW_SCHEDULES` environment variable. Set to `false` in production initially, `true` when ready.
2. **Data validation function:** Before cutover, run a comparison function that rebuilds the queue from BOTH old and new tables and asserts identical results.
3. **Rollback plan:** If the new queue builder produces incorrect results, flip `USE_NEW_SCHEDULES=false` and the old system takes over immediately. No data loss because old tables are intact.

---

## Open Questions for Phase-Specific Research

1. **Rich text storage format:** Should `email_templates.body` store plain text (current), HTML, or Tiptap JSON? This depends on the rich text editor choice, which is a separate research question. Recommendation: store HTML (output of Tiptap), use plain text fallback for Postmark's `TextBody` field. The React Email template would render the HTML directly instead of wrapping plain text.

2. **Template preview rendering:** How to preview an email template with sample data before it is used in a schedule or ad-hoc send? This needs a preview API endpoint that runs `substituteVariables()` with sample context and returns the rendered HTML.

3. **Schedule step maximum:** Currently enforced at 5 steps. Is this still appropriate? The 5-step limit seems driven by UI constraints, not business requirements. Worth confirming with the accountant.

4. **Cascade behavior for template deletion:** If an email template is deleted, what happens to schedule steps that reference it? Current recommendation is `ON DELETE RESTRICT` (prevent deletion). But this means orphan templates cannot be cleaned up easily. Alternative: `ON DELETE SET NULL` + require schedules to handle null template references. Recommendation: `RESTRICT` is safer. The UI should prevent deletion of templates that are in use.

## Sources

- Direct codebase analysis (HIGH confidence -- all findings verified against source files)
- `supabase/migrations/20260207000002_create_phase2_schema.sql` -- current schema
- `lib/reminders/queue-builder.ts` -- current queue logic
- `lib/reminders/scheduler.ts` -- current scheduling logic
- `lib/templates/inheritance.ts` -- current override resolution
- `lib/types/database.ts` -- current type definitions
- `app/api/clients/[id]/template-overrides/route.ts` -- current override API
- `.planning/PROJECT.md` -- v1.1 requirements
