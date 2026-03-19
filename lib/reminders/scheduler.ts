import { SupabaseClient } from '@supabase/supabase-js';
import { UTCDate } from '@date-fns/utc';
import { toZonedTime } from 'date-fns-tz';
import { format, addMinutes, addDays } from 'date-fns';
import crypto from 'crypto';
import { buildReminderQueue, buildCustomScheduleQueue, Org } from './queue-builder';
import { renderTipTapEmail } from '@/lib/email/render-tiptap';
import { rolloverDeadline } from '@/lib/deadlines/rollover';
import { resolveDocumentsRequired } from '@/lib/documents/checklist';

export interface ProcessResult {
  queued: number;
  rolled_over: number;
  errors: string[];
  skipped_wrong_hour: boolean;
}

interface Client {
  id: string;
  company_name: string;
  year_end_date: string | null;
  vat_stagger_group: number | null;
}

interface FilingType {
  id: string;
  name: string;
}

/**
 * Process daily reminders for a specific user within an organisation (v3.0 per-accountant)
 * - Acquires per-user per-org distributed lock
 * - Checks if it's the user's configured send_hour (with org-level fallback)
 * - Builds/updates queue for this user's clients using their own schedules and templates
 * - Sets queued_at on due reminders (scoped to this user's clients)
 * - Resolves template variables using v1.1 TipTap rendering with user's sender name
 * - Handles deadline rollover for this user's clients
 */
export async function processRemindersForUser(
  supabase: SupabaseClient,
  org: Org,
  userId: string
): Promise<ProcessResult> {
  const result: ProcessResult = {
    queued: 0,
    rolled_over: 0,
    errors: [],
    skipped_wrong_hour: false,
  };

  // Step 1: Acquire per-user per-org distributed lock
  const lockId = `cron_reminders_${org.id}_${userId}`;
  const expiresAt = addMinutes(new Date(), 5);

  try {
    const { error: lockError } = await supabase
      .from('locks')
      .insert({ id: lockId, org_id: org.id, expires_at: expiresAt.toISOString() });

    if (lockError) {
      // Lock already held
      result.errors.push(`[${org.name}:${userId}] Lock already held by another process`);
      return result;
    }
  } catch (error) {
    result.errors.push(`[${org.name}:${userId}] Failed to acquire lock`);
    return result;
  }

  try {
    // Step 2: Get current UK hour and this user's send hour (with org-level fallback)
    const ukTime = toZonedTime(new Date(), 'Europe/London');
    const ukHour = ukTime.getHours();

    // Try user-specific send hour first
    const { data: userSendHourRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('org_id', org.id)
      .eq('user_id', userId)
      .eq('key', 'reminder_send_hour')
      .maybeSingle();

    let globalSendHour: number;
    if (userSendHourRow) {
      globalSendHour = parseInt(userSendHourRow.value, 10);
    } else {
      // Fallback to org-level default
      const { data: orgSendHourRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('org_id', org.id)
        .is('user_id', null)
        .eq('key', 'reminder_send_hour')
        .maybeSingle();
      globalSendHour = orgSendHourRow ? parseInt(orgSendHourRow.value, 10) : 9;
    }

    // Check if any of this user's custom schedules have a send_hour matching the current hour
    const { data: customHourSchedules } = await supabase
      .from('schedules')
      .select('id')
      .eq('org_id', org.id)
      .eq('owner_id', userId)
      .eq('schedule_type', 'custom')
      .eq('is_active', true)
      .eq('send_hour', ukHour);

    const hasCustomHourMatch = customHourSchedules && customHourSchedules.length > 0;
    const isGlobalHour = ukHour === globalSendHour;

    // Skip early only if neither the global hour matches nor any custom schedules match
    if (!isGlobalHour && !hasCustomHourMatch) {
      result.skipped_wrong_hour = true;
      return result;
    }

    // Step 3: Build/update queue for any new reminders (filing + custom) — idempotent
    // Pass userId so queue builder scopes all resources to this user
    const buildResult = await buildReminderQueue(supabase, org, userId);
    const customBuildResult = await buildCustomScheduleQueue(supabase, org, userId);

    // Step 4: Find due reminders for today, scoped to this user's clients
    const today = format(new UTCDate(), 'yyyy-MM-dd');

    // Fetch all due reminders for today for this org, scoped to this user's clients via owner_id
    const { data: allDueReminders, error: fetchError } = await supabase
      .from('reminder_queue')
      .select('*, clients!inner(*), filing_types(*)')
      .eq('org_id', org.id)
      .eq('clients.owner_id', userId)
      .eq('send_date', today)
      .eq('status', 'scheduled');

    if (fetchError) {
      result.errors.push(`[${org.name}:${userId}] Failed to fetch due reminders: ${fetchError.message}`);
      return result;
    }

    if (!allDueReminders || allDueReminders.length === 0) {
      return result;
    }

    // Build set of custom schedule IDs that match the current hour (for this user)
    const customHourScheduleIds = new Set(
      (customHourSchedules || []).map(s => s.id)
    );

    // Filter reminders based on hour matching:
    // - Filing reminders (filing_type_id IS NOT NULL): only at global hour
    // - Custom reminders with specific send_hour: only at their schedule's hour
    // - Custom reminders with NULL send_hour: only at global hour
    const dueReminders = allDueReminders.filter((reminder) => {
      if (reminder.filing_type_id) {
        // Filing reminder — uses global hour
        return isGlobalHour;
      } else if (reminder.template_id && customHourScheduleIds.has(reminder.template_id)) {
        // Custom reminder with a specific send_hour matching current hour
        return true;
      } else {
        // Custom reminder with NULL send_hour — uses global hour
        return isGlobalHour;
      }
    });

    if (dueReminders.length === 0) {
      return result;
    }

    // Step 5: Set queued_at on due reminders (status stays 'scheduled')
    const reminderIds = dueReminders.map((r) => r.id);
    const { error: updateError } = await supabase
      .from('reminder_queue')
      .update({
        queued_at: new Date().toISOString(),
      })
      .in('id', reminderIds);

    if (updateError) {
      result.errors.push(`[${org.name}:${userId}] Failed to update reminder status: ${updateError.message}`);
      return result;
    }

    result.queued = dueReminders.length;

    // Step 6: Resolve this user's sender name for template rendering context
    // Try user-specific email_sender_name first, fall back to org default
    let accountantName = 'Prompt';
    const { data: userSenderNameRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('org_id', org.id)
      .eq('user_id', userId)
      .eq('key', 'email_sender_name')
      .maybeSingle();

    if (userSenderNameRow?.value) {
      accountantName = userSenderNameRow.value;
    } else {
      const { data: orgSenderNameRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('org_id', org.id)
        .is('user_id', null)
        .eq('key', 'email_sender_name')
        .maybeSingle();
      if (orgSenderNameRow?.value) {
        accountantName = orgSenderNameRow.value;
      }
    }

    // Step 7: Resolve template variables for each due reminder using v1.1 TipTap rendering
    for (const reminder of dueReminders) {
      try {
        const client = reminder.clients as Client;
        const filingType = reminder.filing_types as FilingType | null;

        // Fetch the schedule for this reminder — scoped to this user's schedules
        let schedule;
        if (reminder.filing_type_id) {
          // Filing schedule - lookup by filing_type_id, scoped to this user
          const { data, error: scheduleError } = await supabase
            .from('schedules')
            .select('*')
            .eq('org_id', org.id)
            .eq('owner_id', userId)
            .eq('filing_type_id', reminder.filing_type_id)
            .eq('is_active', true)
            .single();

          if (scheduleError || !data) {
            result.errors.push(`[${org.name}:${userId}] Failed to fetch schedule for reminder ${reminder.id}: ${scheduleError?.message || 'No schedule found'}`);
            continue;
          }
          schedule = data;
        } else {
          // Custom schedule - lookup by template_id (which stores schedule.id), scoped to this user
          const { data, error: scheduleError } = await supabase
            .from('schedules')
            .select('*')
            .eq('org_id', org.id)
            .eq('owner_id', userId)
            .eq('id', reminder.template_id)
            .eq('is_active', true)
            .single();

          if (scheduleError || !data) {
            result.errors.push(`[${org.name}:${userId}] Failed to fetch custom schedule for reminder ${reminder.id}: ${scheduleError?.message || 'No schedule found'}`);
            continue;
          }
          schedule = data;
        }

        // Fetch schedule_steps for that schedule — scoped to this user
        const { data: steps, error: stepsError } = await supabase
          .from('schedule_steps')
          .select('*')
          .eq('org_id', org.id)
          .eq('owner_id', userId)
          .eq('schedule_id', schedule.id)
          .order('step_number', { ascending: true });

        if (stepsError || !steps) {
          result.errors.push(`[${org.name}:${userId}] Failed to fetch schedule steps for reminder ${reminder.id}: ${stepsError?.message || 'No steps found'}`);
          continue;
        }

        // Find the step matching reminder.step_index
        const step = steps.find((s) => s.step_number === reminder.step_index);
        if (!step) {
          result.errors.push(`[${org.name}:${userId}] Step ${reminder.step_index} not found in schedule ${schedule.id} for reminder ${reminder.id}`);
          continue;
        }

        // Fetch the email template for that step — scoped to this user
        const { data: template, error: templateError } = await supabase
          .from('email_templates')
          .select('*')
          .eq('org_id', org.id)
          .eq('owner_id', userId)
          .eq('id', step.email_template_id)
          .single();

        if (templateError || !template) {
          result.errors.push(`[${org.name}:${userId}] Failed to fetch template for reminder ${reminder.id}: ${templateError?.message || 'No template found'}`);
          continue;
        }

        // Render email using v1.1 TipTap pipeline
        // For custom schedules, use the schedule name as the filing_type placeholder
        const filingTypeName = filingType?.name ?? schedule.name;

        // Resolve document-aware variables for filing reminders (Step 7 additions)
        // Custom schedule reminders do not have a filing_type_id; skip for those.

        // Resolve {{documents_required}}: outstanding mandatory docs as HTML bullet list
        let documentsRequired = '';
        if (reminder.filing_type_id) {
          try {
            documentsRequired = await resolveDocumentsRequired(supabase, client.id, reminder.filing_type_id);
          } catch (docError) {
            const docMessage = docError instanceof Error ? docError.message : 'Unknown error';
            result.errors.push(`[${org.name}:${userId}] Failed to resolve documents_required for reminder ${reminder.id}: ${docMessage}`);
            // documentsRequired stays '' — do not abort the reminder
          }
        }

        // Resolve {{portal_link}}: fresh portal upload token with expiry matching next step interval
        // Skip portal token generation entirely when client portal is disabled for this org
        let portalLink = '';
        if (reminder.filing_type_id && org.client_portal_enabled !== false) {
          try {
            const nextStep = steps.find((s) => s.step_number === reminder.step_index + 1);
            const daysToNextStep = nextStep?.delay_days ?? 30; // 30-day fallback for last step
            const tokenExpiry = addDays(new Date(), daysToNextStep);
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const taxYear = new Date(reminder.deadline_date).getFullYear().toString();

            // ADDITIVE INSERT ONLY — per CONTEXT.md locked decision.
            // Do NOT revoke or delete existing tokens. Old tokens from previous reminders
            // remain valid until their own expires_at. Insert a fresh token per send.
            const { error: tokenError } = await supabase.from('upload_portal_tokens').insert({
              org_id: org.id,
              client_id: client.id,
              filing_type_id: reminder.filing_type_id,
              tax_year: taxYear,
              token_hash: tokenHash,
              expires_at: tokenExpiry.toISOString(),
              // created_by_user_id omitted — system-generated token (cron job)
            });

            if (tokenError) {
              result.errors.push(`[${org.name}:${userId}] Failed to generate portal token for reminder ${reminder.id}: ${tokenError.message}`);
              // portalLink stays '' — continue rendering without portal link
            } else {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
              portalLink = `${appUrl}/portal/${rawToken}`;
            }
          } catch (tokenError) {
            const tokenMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
            result.errors.push(`[${org.name}:${userId}] Failed to generate portal token for reminder ${reminder.id}: ${tokenMessage}`);
            // portalLink stays '' — do not abort the reminder
          }
        }

        try {
          const rendered = await renderTipTapEmail({
            bodyJson: template.body_json,
            subject: template.subject,
            context: {
              client_name: client.company_name,
              deadline: new UTCDate(reminder.deadline_date),
              filing_type: filingTypeName,
              accountant_name: accountantName,
              documents_required: documentsRequired,
              portal_link: portalLink,
            },
            clientId: client.id,
          });

          // Update reminder_queue with rendered content
          const { error: resolveError } = await supabase
            .from('reminder_queue')
            .update({
              resolved_subject: rendered.subject,
              resolved_body: rendered.text, // Plain text fallback
              html_body: rendered.html,     // Rich HTML from v1.1 pipeline
            })
            .eq('id', reminder.id);

          if (resolveError) {
            result.errors.push(`[${org.name}:${userId}] Failed to update resolved content for reminder ${reminder.id}: ${resolveError.message}`);
          }
        } catch (renderError) {
          const message = renderError instanceof Error ? renderError.message : 'Unknown rendering error';
          result.errors.push(`[${org.name}:${userId}] Failed to render template for reminder ${reminder.id}: ${message}`);

          // Log rendering failure to email_log
          await supabase.from('email_log').insert({
            org_id: org.id,
            client_id: reminder.client_id,
            filing_type_id: reminder.filing_type_id,
            delivery_status: 'failed',
            bounce_description: `[RENDER] ${message}`,
            subject: 'Template Rendering Failed',
            sent_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`[${org.name}:${userId}] Error processing reminder ${reminder.id}: ${message}`);
      }
    }

    // Step 8: Check for rollover - find deadlines that have passed for this user's clients
    // Only for filing type reminders (not custom schedules)
    const { data: pastDeadlines, error: pastError } = await supabase
      .from('reminder_queue')
      .select('*, clients!inner(*)')
      .eq('org_id', org.id)
      .eq('clients.owner_id', userId)
      .lt('deadline_date', today)
      .eq('status', 'sent')
      .not('filing_type_id', 'is', null)
      .order('deadline_date', { ascending: false });

    if (pastError) {
      result.errors.push(`[${org.name}:${userId}] Failed to fetch past deadlines: ${pastError.message}`);
    } else if (pastDeadlines && pastDeadlines.length > 0) {
      // Group by client + filing type to get the most recent deadline for each
      const deadlineMap = new Map<string, typeof pastDeadlines[0]>();
      for (const deadline of pastDeadlines) {
        const key = `${deadline.client_id}_${deadline.filing_type_id}`;
        if (!deadlineMap.has(key)) {
          deadlineMap.set(key, deadline);
        }
      }

      // Rollover each unique client + filing type
      for (const [key, deadline] of deadlineMap) {
        try {
          const client = deadline.clients as Client;

          const nextDeadline = rolloverDeadline(
            deadline.filing_type_id,
            client.year_end_date ? new Date(client.year_end_date) : null,
            client.vat_stagger_group,
            new Date(deadline.deadline_date)
          );

          // Note: year_end_date is NOT advanced here. calculateDeadline's
          // loop-forward logic independently finds the next upcoming deadline
          // for each filing type, preventing one filing's rollover from
          // skipping another's still-upcoming deadline.

          result.rolled_over++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`[${org.name}:${userId}] Failed to rollover deadline for ${key}: ${message}`);
        }
      }
    }

    return result;
  } finally {
    // Step 9: Release per-user per-org lock
    await supabase.from('locks').delete().eq('id', lockId);
  }
}

/**
 * @deprecated Use processRemindersForUser instead.
 * Kept for backwards compatibility — calls processRemindersForUser without user scoping
 * by iterating over all org members. Only use this if you genuinely need the old org-wide
 * (all-members) processing in a single call.
 */
export async function processReminders(
  supabase: SupabaseClient,
  org: Org
): Promise<ProcessResult> {
  // Fetch all org members and process each independently
  const { data: members } = await supabase
    .from('user_organisations')
    .select('user_id')
    .eq('org_id', org.id);

  const combined: ProcessResult = { queued: 0, rolled_over: 0, errors: [], skipped_wrong_hour: true };

  for (const member of members ?? []) {
    const userResult = await processRemindersForUser(supabase, org, member.user_id);
    combined.queued += userResult.queued;
    combined.rolled_over += userResult.rolled_over;
    combined.errors.push(...userResult.errors);
    if (!userResult.skipped_wrong_hour) combined.skipped_wrong_hour = false;
  }

  return combined;
}
