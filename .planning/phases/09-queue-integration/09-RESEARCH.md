# Phase 9: Queue Integration - Research

**Researched:** 2026-02-08
**Domain:** Database migration, queue processing, cron job architecture
**Confidence:** HIGH

## Summary

This phase completes the v1.1 migration by rewiring the automated reminder cron queue builder to read from the new normalized tables (schedules, schedule_steps, email_templates) instead of the old JSONB-embedded reminder_templates structure. The migration follows a clean cutover strategy with no dual-write complexity.

The current v1.0 queue builder (`lib/reminders/queue-builder.ts`) reads from `reminder_templates` table with JSONB `steps` arrays and applies client overrides via `client_template_overrides`. The v1.1 architecture uses four normalized tables: `schedules` (one per filing type), `schedule_steps` (ordered steps with FK to email_templates), `email_templates` (standalone reusable content), and override tables (client_email_overrides, client_schedule_overrides).

Per user decisions, this migration uses direct code replacement with no feature flags, ignores all client override tables (simplified precedence: filing type → schedule → steps → templates), and logs failures to audit log only. The v1.1 rendering pipeline (TipTap JSON → HTML → variable substitution → React Email) is already implemented and will be the sole rendering path.

**Primary recommendation:** Rewrite buildReminderQueue() to read from schedules/schedule_steps/email_templates, use renderTipTapEmail() for content rendering, implement graceful failure handling with audit log entries, remove all v1.0 code references after testing, and drop reminder_templates table in a separate migration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cutover strategy:**
- Direct code replacement — rewrite queue builder to read new tables, delete old code entirely
- No feature flag or gradual rollover — clean break
- Git history serves as reference for old code, no commented-out blocks
- V1.1 rendering pipeline only — all templates go through TipTap JSON -> HTML rendering
- New tables are the sole source of truth — old reminder_templates.steps JSONB is never consulted

**Override precedence:**
- No per-client overrides at all — client_email_overrides and client_schedule_overrides are not used
- Simple path: filing type -> schedule -> schedule_steps -> email_templates
- Every client with the same filing type gets identical emails at identical timing
- Override tables left in database (not dropped) but completely ignored by queue builder

**Failure handling:**
- Missing template: skip that step, log warning, continue with remaining steps for the client
- Rendering failure (missing placeholder data): skip that email, log error to audit log, continue with other clients
- Failures logged to audit log only — no dashboard indicator needed
- Postmark failures: mark as pending for retry on next cron run (transient failures don't permanently lose emails)

**Old table cleanup:**
- Drop reminder_templates table via migration after queue is rewired
- Remove old /templates page and /api/templates routes (v1.1 templates UI replaces them)
- Claude audits codebase for ALL old table references and removes them
- DROP TABLE migration is a separate SQL file from queue rewiring migration (independent rollback)

### Claude's Discretion

- Queue builder internal architecture (batch size, query ordering)
- Audit log entry format for skipped/failed emails
- How to identify and remove all v1.0 code references (grep strategy)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core Dependencies (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | Current | Database client | Required for Supabase access |
| @date-fns/utc | Current | UTC date handling | Timezone-safe date operations |
| date-fns | Current | Date formatting/manipulation | Industry standard for date operations |
| @tiptap/html | Current | TipTap JSON to HTML conversion | Official TipTap rendering |
| @react-email/render | Current | Email HTML with inline styles | React Email rendering pipeline |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Postmark client | Current | Email sending | Already integrated for v1.0 |

### No New Dependencies Required

All required libraries are already installed and in use. The v1.1 rendering pipeline (`renderTipTapEmail`) is implemented in `lib/email/render-tiptap.ts`.

## Architecture Patterns

### Recommended Queue Builder Structure

The new queue builder should follow the same high-level flow as v1.0 but read from different tables:

```
Current v1.0 Flow:
1. Fetch client_filing_assignments (active clients)
2. Fetch reminder_templates (JSONB steps array)
3. Fetch client overrides (deadline_overrides, template_overrides)
4. For each client+filing: resolve steps, calculate dates, insert into reminder_queue

New v1.1 Flow:
1. Fetch client_filing_assignments (active clients)
2. Fetch schedules (one per filing_type_id)
3. Fetch schedule_steps (ordered steps with delay_days, urgency_level)
4. Fetch email_templates (subject, body_json for TipTap rendering)
5. For each client+filing: join schedule → steps → templates, calculate dates, insert into reminder_queue
```

### Pattern 1: Normalized Table Joins

**What:** Query schedules, schedule_steps, and email_templates in separate fetches, then join in application code.

**When to use:** When PostgREST FK joins are unreliable (as documented in project memory: "PostgREST FK join cache issue").

**Example:**
```typescript
// Fetch schedules
const { data: schedules } = await supabase
  .from('schedules')
  .select('*')
  .eq('is_active', true);

// Fetch schedule_steps separately
const { data: steps } = await supabase
  .from('schedule_steps')
  .select('*')
  .order('step_number', { ascending: true });

// Fetch email_templates separately
const { data: templates } = await supabase
  .from('email_templates')
  .select('*')
  .eq('is_active', true);

// Join in application code
const scheduleMap = new Map(schedules.map(s => [s.id, s]));
const templateMap = new Map(templates.map(t => [t.id, t]));
const stepsBySchedule = new Map<string, ScheduleStep[]>();
steps.forEach(step => {
  if (!stepsBySchedule.has(step.schedule_id)) {
    stepsBySchedule.set(step.schedule_id, []);
  }
  stepsBySchedule.get(step.schedule_id)!.push(step);
});
```

**Rationale:** This pattern avoids PostgREST schema cache issues (PGRST200) that can occur with FK joins. See `app/actions/audit-log.ts` for reference implementation.

### Pattern 2: Idempotent Queue Insertion

**What:** Check if reminder_queue entry already exists before inserting (using client_id, filing_type_id, step_index, deadline_date as composite key).

**When to use:** Always, to ensure buildReminderQueue() can be run multiple times safely.

**Example from current v1.0:**
```typescript
// Check if this exact reminder already exists (idempotent)
const { data: existing } = await supabase
  .from('reminder_queue')
  .select('id')
  .eq('client_id', client.id)
  .eq('filing_type_id', filingTypeId)
  .eq('step_index', i)
  .eq('deadline_date', deadlineDateStr)
  .single();

if (existing) {
  skipped++;
  continue;
}
```

**Rationale:** Cron jobs may run multiple times, network failures may cause retries. Idempotency prevents duplicate reminders.

### Pattern 3: Graceful Degradation with Logging

**What:** When a step fails (missing template, rendering error), log to audit_log and continue processing other clients/steps.

**When to use:** For all failure scenarios except catastrophic database errors.

**Example structure:**
```typescript
for (const assignment of assignments) {
  try {
    // Build queue entries for this client
    const schedule = scheduleMap.get(assignment.filing_type_id);
    if (!schedule) {
      await logAuditEntry({
        level: 'warning',
        message: `No schedule found for filing type ${assignment.filing_type_id}`,
        client_id: assignment.client_id,
        filing_type_id: assignment.filing_type_id,
      });
      skipped++;
      continue;
    }

    const steps = stepsBySchedule.get(schedule.id) || [];
    for (const step of steps) {
      const template = templateMap.get(step.email_template_id);
      if (!template) {
        await logAuditEntry({
          level: 'warning',
          message: `Missing email template ${step.email_template_id}`,
          client_id: assignment.client_id,
          schedule_step_id: step.id,
        });
        continue; // Skip this step, continue with others
      }

      // Render email content
      try {
        const rendered = await renderTipTapEmail({
          bodyJson: template.body_json,
          subject: template.subject,
          context: { /* ... */ },
        });
        // Insert into reminder_queue...
      } catch (renderError) {
        await logAuditEntry({
          level: 'error',
          message: `Rendering failed: ${renderError.message}`,
          client_id: assignment.client_id,
          template_id: template.id,
        });
        continue; // Skip this email, continue with others
      }
    }
  } catch (error) {
    // Log error but continue with next client
    await logAuditEntry({
      level: 'error',
      message: `Failed to process client: ${error.message}`,
      client_id: assignment.client_id,
    });
  }
}
```

### Pattern 4: Separate Scheduler and Sender Crons

**What:** Keep the two-phase cron architecture:
- `/api/cron/reminders` (9am UK): Build queue, mark due reminders as 'pending', resolve template variables
- `/api/cron/send-emails` (9:10am UK): Send pending emails via Postmark, mark as 'sent'

**When to use:** Already implemented in v1.0, preserve this architecture.

**Why:** Separates queue building (complex logic) from email sending (I/O bound). Allows retry of send phase without rebuilding queue.

**v1.1 Changes:**
- Scheduler (`processReminders`) now calls new buildReminderQueue() that reads v1.1 tables
- Scheduler resolves variables using renderTipTapEmail() instead of plain text substitution
- Scheduler stores `resolved_subject` and `html_body` in reminder_queue (new column for HTML)
- Sender (`/api/cron/send-emails`) uses sendRichEmail() instead of sendReminderEmail()

### Anti-Patterns to Avoid

- **Don't fetch override tables**: User decision is to ignore client_email_overrides and client_schedule_overrides entirely. Fetching them wastes queries.
- **Don't use PostgREST nested joins on FK relationships**: PostgREST schema cache issues (PGRST200) can cause joins to fail. Fetch separately and join in code.
- **Don't delete reminder_queue entries on failure**: Mark as 'cancelled' or 'failed', never delete. Preserves audit trail.
- **Don't halt processing on single failure**: Log error, skip that item, continue with batch. Only abort on catastrophic errors (database down).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry logic for transient Postmark failures | Custom retry counter in queue builder | Mark as 'pending', let next cron run retry | Simpler, leverages existing cron schedule. User decided: "Postmark failures: mark as pending for retry on next cron run" |
| Email variable substitution | Custom template parser | Existing `substituteVariables()` from `lib/templates/variables.ts` | Already handles {{variable}} syntax, date formatting, fallbacks |
| TipTap JSON to HTML rendering | Custom JSON traversal | Existing `renderTipTapEmail()` from `lib/email/render-tiptap.ts` | Already implements full pipeline: TipTap → HTML → variable substitution → React Email → inline styles |
| Idempotency keys | UUID-based deduplication | Composite key check (client_id, filing_type_id, step_index, deadline_date) | Simpler, no extra table needed. Already implemented in v1.0 |
| Dead letter queue | Separate failed_emails table | Status column ('failed') in reminder_queue | Keeps all reminder history in one table, simpler queries |

**Key insight:** The v1.1 rendering pipeline is already complete. Don't reimplement any part of TipTap rendering, variable substitution, or React Email conversion.

## Common Pitfalls

### Pitfall 1: PostgREST Schema Cache Stale FK Joins

**What goes wrong:** Using nested FK joins like `.select('*, schedule_steps(*, email_templates(*))')` may return null for relationships even though FK constraints are valid.

**Why it happens:** PostgREST caches schema metadata. Even after running `NOTIFY pgrst, 'reload schema'`, the cache may not reflect new FK relationships immediately.

**How to avoid:** Fetch reference tables separately and map in application code. See project memory: "PostgREST FK join cache issue (PGRST200)... Workaround: Fetch reference tables separately and map in application code. See `app/actions/audit-log.ts` for example."

**Warning signs:**
- FK joins worked in local dev but fail in production
- Supabase dashboard shows FK constraint exists but PostgREST returns null
- Error code PGRST200 in logs

### Pitfall 2: Deleting Old Code Before Testing New Code

**What goes wrong:** Deleting v1.0 queue-builder.ts or templates routes before verifying v1.1 queue works, then discovering bugs with no fallback.

**Why it happens:** Eagerness to clean up, misunderstanding "clean break" to mean "delete before testing."

**How to avoid:**
1. Write new v1.1 queue builder (rewrite existing function in place or create new version)
2. Test thoroughly in staging/dev (run buildReminderQueue, verify queue entries, send test emails)
3. Deploy to production, monitor first cron run
4. After confirming success, delete old routes and drop reminder_templates table
5. Use separate migrations: one for adding v1.1 logic, one for dropping old tables

**Warning signs:**
- Planning to delete files in the same commit as rewriting logic
- No test plan before removal
- Single migration that both adds and drops tables

### Pitfall 3: Assuming renderTipTapEmail() Throws on Missing Variables

**What goes wrong:** Expecting renderTipTapEmail() to throw errors when context variables are missing, causing unnecessary error handling.

**Why it happens:** Misunderstanding how substituteVariables() handles missing context.

**How to avoid:** Review `lib/email/render-tiptap.ts` - it builds a `safeContext` with fallbacks:
```typescript
const safeContext: TemplateContext = {
  client_name: context.client_name || '[Client Name]',
  deadline: context.deadline || new Date(),
  filing_type: context.filing_type || '[Filing Type]',
  accountant_name: context.accountant_name || 'Peninsula Accounting',
}
```

Missing variables won't throw errors - they'll use placeholder text like '[Client Name]'. This is intentional for graceful degradation.

**Warning signs:**
- Wrapping renderTipTapEmail() in try/catch expecting it to fail on missing data
- Adding validation logic for context before calling render

### Pitfall 4: Forgetting to Update reminder_queue Schema

**What goes wrong:** Storing TipTap-rendered HTML in `resolved_body` column designed for plain text, causing rendering issues or clipping.

**Why it happens:** v1.0 used plain text in resolved_body. v1.1 renders rich HTML.

**How to avoid:**
- Check if reminder_queue needs new column (e.g., `html_body TEXT`) or if resolved_body can hold HTML
- Verify column size limits (PostgreSQL TEXT is unlimited, but check if there are application limits)
- Update send-emails cron to use sendRichEmail() which expects html and text params

**Warning signs:**
- Emails render without formatting
- Gmail clips emails at 102KB (React Email render should use `pretty: false` to avoid this)

### Pitfall 5: Not Logging Skipped Steps to Audit Log

**What goes wrong:** Silently skipping steps with missing templates or rendering failures, making debugging impossible.

**Why it happens:** Treating skips as "normal" without logging.

**How to avoid:** User decision is "Missing template: skip that step, log warning, continue." Every skip must log to audit_log with:
- Warning/error level
- Client ID
- Filing type or schedule step ID
- Clear message about what was skipped and why

**Warning signs:**
- No audit log entries for missing templates
- Clients report not receiving emails with no trace in logs

## Code Examples

### Example 1: New buildReminderQueue() Structure (v1.1)

```typescript
// Source: Adapted from current lib/reminders/queue-builder.ts

export async function buildReminderQueue(supabase: SupabaseClient): Promise<BuildResult> {
  let created = 0;
  let skipped = 0;

  // Step 1: Fetch active client assignments
  const { data: assignments } = await supabase
    .from('client_filing_assignments')
    .select('*, clients!inner(*)')
    .eq('is_active', true);

  if (!assignments?.length) return { created: 0, skipped: 0 };

  // Step 2: Fetch v1.1 normalized tables (NO OVERRIDES per user decision)
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_active', true);

  const { data: scheduleSteps } = await supabase
    .from('schedule_steps')
    .select('*')
    .order('step_number', { ascending: true });

  const { data: emailTemplates } = await supabase
    .from('email_templates')
    .select('*')
    .eq('is_active', true);

  // Step 3: Build lookup maps (application-level joins)
  const scheduleMap = new Map(schedules?.map(s => [s.filing_type_id, s]) || []);
  const templateMap = new Map(emailTemplates?.map(t => [t.id, t]) || []);

  const stepsBySchedule = new Map<string, typeof scheduleSteps>();
  scheduleSteps?.forEach(step => {
    if (!stepsBySchedule.has(step.schedule_id)) {
      stepsBySchedule.set(step.schedule_id, []);
    }
    stepsBySchedule.get(step.schedule_id)!.push(step);
  });

  // Step 4: Fetch bank holidays (for working day calculation)
  const holidays = await getUKBankHolidaySet();

  // Step 5: Process each client+filing assignment
  for (const assignment of assignments) {
    const client = assignment.clients;
    const filingTypeId = assignment.filing_type_id;

    // Skip if reminders paused or records received
    if (client.reminders_paused || client.records_received_for?.includes(filingTypeId)) {
      skipped++;
      continue;
    }

    // Find schedule for this filing type
    const schedule = scheduleMap.get(filingTypeId);
    if (!schedule) {
      // Log warning and skip
      await logWarning(supabase, {
        message: `No schedule found for filing type ${filingTypeId}`,
        client_id: client.id,
        filing_type_id: filingTypeId,
      });
      skipped++;
      continue;
    }

    // Calculate deadline (same logic as v1.0)
    const deadlineDate = calculateDeadline(filingTypeId, {
      year_end_date: client.year_end_date ?? undefined,
      vat_quarter: client.vat_quarter ?? undefined,
    });

    if (!deadlineDate) {
      skipped++;
      continue;
    }

    // Get steps for this schedule
    const steps = stepsBySchedule.get(schedule.id) || [];

    // Process each step
    for (const step of steps) {
      const template = templateMap.get(step.email_template_id);

      if (!template) {
        // Log warning and skip this step
        await logWarning(supabase, {
          message: `Missing template ${step.email_template_id} for schedule step`,
          client_id: client.id,
          schedule_step_id: step.id,
        });
        continue; // Skip this step, continue with others
      }

      // Calculate send_date (same as v1.0)
      let sendDate = subDays(new UTCDate(deadlineDate), step.delay_days);
      sendDate = new UTCDate(getNextWorkingDay(sendDate, holidays));

      // Check idempotency (same composite key as v1.0)
      const { data: existing } = await supabase
        .from('reminder_queue')
        .select('id')
        .eq('client_id', client.id)
        .eq('filing_type_id', filingTypeId)
        .eq('step_index', step.step_number)
        .eq('deadline_date', format(deadlineDate, 'yyyy-MM-dd'))
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Insert queue entry (template_id now points to schedule, not old reminder_templates)
      const { error: insertError } = await supabase
        .from('reminder_queue')
        .insert({
          client_id: client.id,
          filing_type_id: filingTypeId,
          template_id: schedule.id, // Changed: now references schedule, not reminder_templates
          step_index: step.step_number,
          deadline_date: format(deadlineDate, 'yyyy-MM-dd'),
          send_date: format(sendDate, 'yyyy-MM-dd'),
          status: 'scheduled',
        });

      if (insertError) {
        await logError(supabase, {
          message: `Failed to insert queue entry: ${insertError.message}`,
          client_id: client.id,
        });
        skipped++;
      } else {
        created++;
      }
    }
  }

  return { created, skipped };
}
```

### Example 2: Updated processReminders() with v1.1 Rendering

```typescript
// Source: Adapted from lib/reminders/scheduler.ts

// Inside processReminders(), after marking reminders as 'pending':
for (const reminder of dueReminders) {
  try {
    const client = reminder.clients as Client;
    const filingType = reminder.filing_types as FilingType;

    // NEW: Fetch schedule and step from v1.1 tables
    const { data: schedule } = await supabase
      .from('schedules')
      .select('*')
      .eq('filing_type_id', reminder.filing_type_id)
      .single();

    if (!schedule) {
      await logError(supabase, {
        message: `No schedule found for reminder ${reminder.id}`,
        reminder_id: reminder.id,
      });
      continue;
    }

    const { data: scheduleSteps } = await supabase
      .from('schedule_steps')
      .select('*')
      .eq('schedule_id', schedule.id)
      .order('step_number', { ascending: true });

    const step = scheduleSteps?.find(s => s.step_number === reminder.step_index);
    if (!step) {
      await logError(supabase, {
        message: `Step ${reminder.step_index} not found in schedule ${schedule.id}`,
        reminder_id: reminder.id,
      });
      continue;
    }

    // NEW: Fetch email template
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', step.email_template_id)
      .single();

    if (!template) {
      await logError(supabase, {
        message: `Template ${step.email_template_id} not found`,
        reminder_id: reminder.id,
      });
      continue;
    }

    // NEW: Render using v1.1 pipeline
    const context = {
      client_name: client.company_name,
      deadline: new UTCDate(reminder.deadline_date),
      filing_type: filingType.name,
      accountant_name: 'Peninsula Accounting',
    };

    try {
      const rendered = await renderTipTapEmail({
        bodyJson: template.body_json,
        subject: template.subject,
        context,
      });

      // Update reminder with rendered content
      await supabase
        .from('reminder_queue')
        .update({
          resolved_subject: rendered.subject,
          html_body: rendered.html,        // NEW column for HTML
          resolved_body: rendered.text,    // Plain text fallback
        })
        .eq('id', reminder.id);

    } catch (renderError) {
      await logError(supabase, {
        message: `Rendering failed: ${renderError.message}`,
        reminder_id: reminder.id,
        template_id: template.id,
      });
      // Skip this email, continue with others
    }
  } catch (error) {
    result.errors.push(`Error processing reminder ${reminder.id}: ${error.message}`);
  }
}
```

### Example 3: Audit Log Helper Functions

```typescript
// NEW helpers for audit logging (to be added in lib/audit/helpers.ts or similar)

interface AuditLogEntry {
  message: string;
  client_id?: string;
  filing_type_id?: string;
  template_id?: string;
  reminder_id?: string;
  schedule_step_id?: string;
}

async function logWarning(supabase: SupabaseClient, entry: AuditLogEntry): Promise<void> {
  // Insert into audit_log or email_log table with warning level
  await supabase.from('email_log').insert({
    client_id: entry.client_id,
    filing_type_id: entry.filing_type_id,
    delivery_status: 'failed',
    bounce_description: `[WARNING] ${entry.message}`,
    subject: 'Queue Builder Warning',
    sent_at: new Date().toISOString(),
  });
}

async function logError(supabase: SupabaseClient, entry: AuditLogEntry): Promise<void> {
  // Insert into email_log with error level
  await supabase.from('email_log').insert({
    client_id: entry.client_id,
    filing_type_id: entry.filing_type_id,
    delivery_status: 'failed',
    bounce_description: `[ERROR] ${entry.message}`,
    subject: 'Queue Builder Error',
    sent_at: new Date().toISOString(),
  });
}
```

### Example 4: Updated Send-Emails Cron for v1.1 HTML

```typescript
// Source: Adapted from app/api/cron/send-emails/route.ts

// Inside send-emails cron, when sending emails:
for (const reminder of pendingReminders) {
  const client = reminder.clients;

  if (!client?.primary_email) {
    // ... mark as failed, continue
  }

  try {
    // NEW: Use sendRichEmail instead of sendReminderEmail
    const result = await sendRichEmail({
      to: client.primary_email,
      subject: reminder.resolved_subject!,
      html: reminder.html_body!,      // NEW: rich HTML from v1.1 rendering
      text: reminder.resolved_body!,  // Plain text fallback
    });

    // Update status and log (same as v1.0)
    await adminClient
      .from('reminder_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', reminder.id);

    await adminClient.from('email_log').insert({
      reminder_queue_id: reminder.id,
      client_id: reminder.client_id,
      filing_type_id: reminder.filing_type_id,
      postmark_message_id: result.messageId,
      recipient_email: client.primary_email,
      subject: reminder.resolved_subject,
      delivery_status: 'sent',
    });

    sentCount++;
  } catch (error) {
    // Mark as failed (will retry on next cron run per user decision)
    await adminClient
      .from('reminder_queue')
      .update({ status: 'pending' }) // Keep as pending for retry
      .eq('id', reminder.id);

    // Log failure
    await adminClient.from('email_log').insert({
      reminder_queue_id: reminder.id,
      client_id: reminder.client_id,
      filing_type_id: reminder.filing_type_id,
      recipient_email: client.primary_email,
      subject: reminder.resolved_subject,
      delivery_status: 'failed',
      bounce_description: error.message,
    });

    failedCount++;
  }
}
```

## State of the Art

### Migration Strategies in 2026

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dual-write patterns for zero-downtime | Clean cutover with feature flags | 2024-2025 | Industry shifted toward simplified migrations for non-critical systems. Dual-write complexity only justified for high-traffic, zero-downtime requirements. |
| Delete old tables immediately | Separate DROP TABLE migration | 2025+ | Allows independent rollback: revert code changes without restoring dropped tables, or revert table drops without reverting code. |
| Retry logic in application code | Status-based retry on next cron run | Ongoing best practice | Simpler than custom retry counters. Leverages existing cron schedule. Prevents infinite loops. |

**Deprecated/outdated:**
- Dual-write for internal tools: Adds complexity without benefit. Clean cutover is acceptable for reminder systems with audit trails.
- Synchronous retry loops: Blocking the cron job to retry Postmark failures. Modern approach: mark as pending, retry on next scheduled run.

### Queue Processing Best Practices (2026)

**From research sources:**

1. **Idempotency**: Always check for existing queue entries before inserting. Use composite keys (client_id, filing_type_id, step_index, deadline_date).

2. **Status transitions**: Standard flow is `scheduled → pending → sent`. Failed sends return to `pending` for retry (not `failed`). Only mark as `failed` after exhausting retries.

3. **Concurrency limits**: Supabase recommends max 8 concurrent jobs, 10 minutes per job. Current cron runs serially, no changes needed.

4. **Graceful degradation**: Don't delete messages from queue until processing completes. If processing times out, retry on next cron run.

**Sources:**
- [Processing large jobs with Edge Functions, Cron, and Queues](https://supabase.com/blog/processing-large-jobs-with-edge-functions)
- [Cron | Supabase Docs](https://supabase.com/docs/guides/cron)

### Clean Cutover Best Practices (2026)

**From research sources:**

1. **Separate migration files**: One migration rewires code logic, separate migration drops old tables. Allows independent rollback.

2. **Git history as reference**: No need to preserve old code in comments. Delete cleanly, rely on git history for reference.

3. **Test before cleanup**: Deploy new code, verify in production, then remove old routes and drop tables.

**Sources:**
- [Cut over - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-database-migration/cut-over.html)
- [Database Migration Patterns](https://medium.com/@jaredhatfield/database-migration-patterns-6b5ede23d06e)

### Idempotent Queue Processing (2026)

**From research sources:**

1. **Deduplication via database**: Store processed IDs in database/cache. For queue systems, use composite key check before insert.

2. **Retry with exponential backoff**: For transient failures (network, service down), retry with increasing delays. For this project: user decision is simpler — mark as pending, retry on next cron run (no custom backoff logic).

3. **Dead letter queues**: Isolate problematic messages after N retries. For this project: user decision is to use `failed` status in reminder_queue (no separate DLQ table).

**Sources:**
- [Retry, DLQ, and Idempotency in Message Processing](https://bugfree.ai/knowledge-hub/retry-dlq-idempotency-message-processing)
- [API Idempotence: Reliability, Resilience, and Automation](https://edana.ch/en/2026/02/01/api-idempotence-the-fundamental-principle-for-reliable-automatable-and-resilient-systems/)
- [Mastering Idempotency: Building Reliable APIs](https://blog.bytebytego.com/p/mastering-idempotency-building-reliable)

## Open Questions

### 1. reminder_queue Schema Changes

**What we know:** v1.0 stores plain text in `resolved_body`. v1.1 renders rich HTML.

**What's unclear:** Does reminder_queue need a new `html_body` column, or should `resolved_body` hold HTML?

**Recommendation:**
- Add `html_body TEXT` column to reminder_queue (for v1.1 HTML content)
- Keep `resolved_body TEXT` for plain text fallback
- Migration: `ALTER TABLE reminder_queue ADD COLUMN html_body TEXT;`
- This preserves backward compatibility and makes intent clear

### 2. Audit Log Table Structure

**What we know:** User wants failures logged to audit log. Current `email_log` table exists.

**What's unclear:** Should we add a separate `queue_audit_log` table or repurpose `email_log`?

**Recommendation:**
- Use existing `email_log` table with `delivery_status = 'failed'`
- Add `bounce_description` field to store error messages (already exists in schema)
- No new table needed — keeps all email events in one place

### 3. Order of Operations for Cleanup

**What we know:** Remove old routes, drop reminder_templates table, audit codebase for references.

**What's unclear:** Exact order and timing of cleanup steps.

**Recommendation:**
1. Deploy v1.1 queue builder (code changes only, no table drops)
2. Monitor first production cron run (verify queue entries created, emails sent)
3. After 1-2 successful runs, remove old routes (app/(dashboard)/templates/page.tsx for v1.0, app/api/templates/[id]/route.ts)
4. After routes removed and tested, run DROP TABLE migration
5. Final audit: grep for 'reminder_templates' and remove all remaining references

## Implementation Checklist

Based on research findings and user constraints:

- [ ] Add `html_body TEXT` column to reminder_queue table (migration)
- [ ] Rewrite buildReminderQueue() to read from schedules/schedule_steps/email_templates
- [ ] Update processReminders() to use renderTipTapEmail() instead of plain text substitution
- [ ] Add audit logging helpers (logWarning, logError) for graceful degradation
- [ ] Update send-emails cron to use sendRichEmail() instead of sendReminderEmail()
- [ ] Test in development: run buildReminderQueue(), verify queue entries, send test emails
- [ ] Deploy to production, monitor first cron run
- [ ] Remove old routes: app/api/templates/[id]/route.ts, possibly old templates page if v1.0-specific
- [ ] Create separate migration to DROP TABLE reminder_templates
- [ ] Audit codebase for all 'reminder_templates' references and remove
- [ ] Remove lib/templates/inheritance.ts (no longer used - overrides ignored)
- [ ] Remove validation schemas for old template structure

## Sources

### Primary (HIGH confidence)

- **Codebase analysis:**
  - `lib/reminders/queue-builder.ts` - Current v1.0 queue builder implementation
  - `lib/reminders/scheduler.ts` - Scheduler with variable resolution
  - `app/api/cron/send-emails/route.ts` - Email sending cron
  - `lib/email/render-tiptap.ts` - v1.1 rendering pipeline
  - `lib/email/sender.ts` - sendReminderEmail (v1.0) and sendRichEmail (v1.1)
  - `supabase/migrations/20260208000001_create_v11_normalized_tables.sql` - v1.1 table schema
  - `app/actions/audit-log.ts` - Example of separate fetch + application join pattern

- **Prior decisions from STATE.md:**
  - [06-01]: PlaceholderNode renderHTML outputs {{id}} syntax for substituteVariables()
  - [06-01]: getSharedExtensions() used by both editor and renderer
  - [06-01]: ReminderEmail template supports both v1.0 plain text and v1.1 htmlBody
  - [06-01]: sendReminderEmail() preserved unchanged during v1.1 development
  - [06-01]: React Email render(pretty: false) to avoid Gmail 102KB clipping

### Secondary (MEDIUM confidence)

- [Processing large jobs with Edge Functions, Cron, and Queues - Supabase Blog](https://supabase.com/blog/processing-large-jobs-with-edge-functions) - Queue processing best practices
- [Cron | Supabase Docs](https://supabase.com/docs/guides/cron) - Official Supabase cron documentation
- [Cut over - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-database-migration/cut-over.html) - Clean cutover migration strategy
- [Database Migration Patterns - Medium](https://medium.com/@jaredhatfield/database-migration-patterns-6b5ede23d06e) - Industry patterns for database migrations
- [Retry, DLQ, and Idempotency in Message Processing - bugfree.ai](https://bugfree.ai/knowledge-hub/retry-dlq-idempotency-message-processing) - Queue processing patterns
- [API Idempotence - edana.ch](https://edana.ch/en/2026/02/01/api-idempotence-the-fundamental-principle-for-reliable-automatable-and-resilient-systems/) - Idempotency patterns for 2026

### Tertiary (LOW confidence)

None - all research findings verified against codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Current v1.0 implementation provides clear migration path
- Pitfalls: HIGH - Documented in project memory and codebase comments
- Queue processing patterns: MEDIUM - Verified with official Supabase docs but adapted to project context
- Migration timing: MEDIUM - Based on industry best practices but project-specific execution order needs validation

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable domain, Supabase/queue patterns don't change rapidly)
