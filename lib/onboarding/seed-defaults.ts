import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from '@/lib/logger';
import type { TipTapDocument } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Template body JSON — extracted to separate files to keep this file concise
// ---------------------------------------------------------------------------

import friendlyFirstReminderBody from './templates/friendly-first-reminder.json';
import followUpReminderBody from './templates/follow-up-reminder.json';
import urgentFinalNoticeBody from './templates/urgent-final-notice.json';
import companiesHouseReminderBody from './templates/companies-house-reminder.json';
import vatReturnReminderBody from './templates/vat-return-reminder.json';
import mtdQuarterlyReminderBody from './templates/mtd-quarterly-reminder.json';
import confirmationStatementReminderBody from './templates/confirmation-statement-reminder.json';
import payrollP11dReminderBody from './templates/payroll-p11d-reminder.json';
import cisMonthlyReturnReminderBody from './templates/cis-monthly-return-reminder.json';
import selfAssessmentReminderBody from './templates/self-assessment-reminder.json';

// ---------------------------------------------------------------------------
// Default email template content
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    name: "Friendly First Reminder",
    subject: "{{filing_type}} — deadline approaching for {{client_name}}",
    body_json: friendlyFirstReminderBody as TipTapDocument,
  },
  {
    name: "Follow-Up Reminder",
    subject: "Action needed: {{filing_type}} due {{deadline_short}} — {{client_name}}",
    body_json: followUpReminderBody as TipTapDocument,
  },
  {
    name: "Urgent Final Notice",
    subject: "URGENT: {{filing_type}} deadline in {{days_until_deadline}} days — {{client_name}}",
    body_json: urgentFinalNoticeBody as TipTapDocument,
  },
  {
    name: "Companies House Reminder",
    subject: "Companies House accounts due {{deadline_short}} — {{client_name}}",
    body_json: companiesHouseReminderBody as TipTapDocument,
  },
  {
    name: "VAT Return Reminder",
    subject: "VAT Return due {{deadline_short}} — records needed for {{client_name}}",
    body_json: vatReturnReminderBody as TipTapDocument,
  },
  {
    name: "MTD Quarterly Return Reminder",
    subject: "MTD Quarterly Return due {{deadline_short}} — {{client_name}}",
    body_json: mtdQuarterlyReminderBody as TipTapDocument,
  },
  {
    name: "Confirmation Statement Reminder",
    subject: "Confirmation Statement due {{deadline_short}} — {{client_name}}",
    body_json: confirmationStatementReminderBody as TipTapDocument,
  },
  {
    name: "Payroll & P11D Reminder",
    subject: "{{filing_type}} due {{deadline_short}} — {{client_name}}",
    body_json: payrollP11dReminderBody as TipTapDocument,
  },
  {
    name: "CIS Monthly Return Reminder",
    subject: "CIS Monthly Return due {{deadline_short}} — {{client_name}}",
    body_json: cisMonthlyReturnReminderBody as TipTapDocument,
  },
  {
    name: "Self Assessment Reminder",
    subject: "Self Assessment tax return — {{days_until_deadline}} days left for {{client_name}}",
    body_json: selfAssessmentReminderBody as TipTapDocument,
  },
];

// ---------------------------------------------------------------------------
// Portal link section — inserted into templates when portal is enabled
// ---------------------------------------------------------------------------

/**
 * Deep-clones a template body and inserts a "upload via your client portal"
 * section before the sign-off (last 3 nodes: blank + sign-off text + accountant name).
 */
function addPortalLinkSection(bodyJson: object): object {
  const doc = JSON.parse(JSON.stringify(bodyJson)) as TipTapDocument;
  const portalNodes = [
    { type: "paragraph" },
    {
      type: "paragraph",
      content: [
        {
          text: "To upload the required documents securely, please use your client portal:",
          type: "text",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "placeholder",
          attrs: { id: "portal_link", label: "Portal Link" },
        },
      ],
    },
  ];
  // Last 3 nodes are always: blank paragraph + sign-off text + accountant_name placeholder
  doc.content.splice(doc.content.length - 3, 0, ...portalNodes);
  return doc;
}

// ---------------------------------------------------------------------------
// Default schedule structure (filing_type_id → steps)
// Each step: [templateName, delayDays]
// ---------------------------------------------------------------------------

export const DEFAULT_SCHEDULES: Array<{
  name: string;
  description: string;
  filing_type_id: string;
  steps: Array<[string, number]>;
}> = [
  {
    name: "Companies House Accounts Reminders",
    description: "Automated reminders for annual accounts filing deadline.",
    filing_type_id: "companies_house",
    steps: [
      ["Companies House Reminder", 30],
      ["Follow-Up Reminder", 14],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "Corporation Tax Payment Reminders",
    description: "Automated reminders for corporation tax payment deadline.",
    filing_type_id: "corporation_tax_payment",
    steps: [
      ["Friendly First Reminder", 30],
      ["Follow-Up Reminder", 14],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "CT600 Filing Reminders",
    description: "Automated reminders for CT600 corporation tax return.",
    filing_type_id: "ct600_filing",
    steps: [
      ["Friendly First Reminder", 30],
      ["Follow-Up Reminder", 14],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "Self Assessment Annual Reminders",
    description: "Automated reminders for Self Assessment tax return.",
    filing_type_id: "self_assessment",
    steps: [
      ["Self Assessment Reminder", 60],
      ["Follow-Up Reminder", 21],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "VAT Return Quarterly Reminders",
    description: "Automated reminders for quarterly VAT return submission.",
    filing_type_id: "vat_return",
    steps: [
      ["VAT Return Reminder", 14],
      ["Urgent Final Notice", 5],
    ],
  },
  {
    name: "MTD Quarterly Return Reminders",
    description: "Automated reminders for MTD for Income Tax quarterly submissions.",
    filing_type_id: "mtd_quarterly_update",
    steps: [
      ["MTD Quarterly Return Reminder", 14],
      ["Urgent Final Notice", 5],
    ],
  },
  {
    name: "Confirmation Statement Reminders",
    description: "Automated reminders for Companies House confirmation statement.",
    filing_type_id: "confirmation_statement",
    steps: [
      ["Confirmation Statement Reminder", 21],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "P11D Filing Reminders",
    description: "Automated reminders for P11D employee benefits return.",
    filing_type_id: "p11d_filing",
    steps: [
      ["Payroll & P11D Reminder", 30],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "PAYE Monthly Reminders",
    description: "Automated reminders for monthly PAYE payment.",
    filing_type_id: "paye_monthly",
    steps: [
      ["Payroll & P11D Reminder", 7],
    ],
  },
  {
    name: "CIS Monthly Return Reminders",
    description: "Automated reminders for CIS monthly contractor return.",
    filing_type_id: "cis_monthly_return",
    steps: [
      ["CIS Monthly Return Reminder", 7],
    ],
  },
  {
    name: "Payroll Year-End Reminders",
    description: "Automated reminders for final payroll submission.",
    filing_type_id: "payroll_year_end",
    steps: [
      ["Payroll & P11D Reminder", 21],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "Partnership Tax Return Reminders",
    description: "Automated reminders for annual partnership tax return.",
    filing_type_id: "partnership_tax_return",
    steps: [
      ["Friendly First Reminder", 60],
      ["Follow-Up Reminder", 21],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "Trust Tax Return Reminders",
    description: "Automated reminders for annual trust and estate tax return.",
    filing_type_id: "trust_tax_return",
    steps: [
      ["Friendly First Reminder", 60],
      ["Follow-Up Reminder", 21],
      ["Urgent Final Notice", 7],
    ],
  },
  {
    name: "SA Payment on Account Reminders",
    description: "Automated reminders for Self Assessment payment on account.",
    filing_type_id: "sa_payment_on_account",
    steps: [
      ["Friendly First Reminder", 21],
      ["Urgent Final Notice", 7],
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed function — called after new org creation
// ---------------------------------------------------------------------------

/**
 * Seeds default email templates and reminder schedules for a newly created org.
 * Must be called with an admin (service-role) client to bypass RLS.
 * Idempotent — skips silently if templates already exist for this org.
 * Failures are non-fatal — logged but do not throw.
 */
export async function seedOrgDefaults(
  orgId: string,
  ownerId: string,
  adminClient: SupabaseClient,
  portalEnabled: boolean = false
): Promise<void> {
  try {
    // Idempotency guard: skip if templates already exist for this org
    const { count } = await adminClient
      .from("email_templates")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);

    if (count && count > 0) {
      logger.info(`[seedOrgDefaults] Templates already exist for org ${orgId}, skipping.`);
      return;
    }

    // 1. Insert all templates (with portal link section if enabled)
    const { data: templates, error: tErr } = await adminClient
      .from("email_templates")
      .insert(
        TEMPLATES.map((t) => ({
          org_id: orgId,
          owner_id: ownerId,
          name: t.name,
          subject: t.subject,
          body_json: portalEnabled ? addPortalLinkSection(t.body_json) : t.body_json,
          is_active: true,
        }))
      )
      .select("id, name");

    if (tErr || !templates) {
      logger.error("[seedOrgDefaults] Failed to insert templates:", { error: (tErr as Error)?.message ?? String(tErr) });
      return;
    }

    const byName = Object.fromEntries(templates.map((t) => [t.name, t.id]));

    // 2. Insert schedules + steps
    for (const sched of DEFAULT_SCHEDULES) {
      const { data: schedule, error: sErr } = await adminClient
        .from("schedules")
        .insert({
          org_id: orgId,
          owner_id: ownerId,
          name: sched.name,
          description: sched.description,
          filing_type_id: sched.filing_type_id,
          schedule_type: "filing",
          is_active: true,
        })
        .select("id")
        .single();

      if (sErr || !schedule) {
        logger.error(`[seedOrgDefaults] Failed to insert schedule "${sched.name}":`, { error: (sErr as Error)?.message ?? String(sErr) });
        continue;
      }

      const steps = sched.steps
        .map(([templateName, delayDays], i) => {
          const templateId = byName[templateName];
          if (!templateId) {
            logger.warn(
              `[seedOrgDefaults] Template "${templateName}" not found for schedule "${sched.name}"`
            );
            return null;
          }
          return {
            schedule_id: schedule.id,
            email_template_id: templateId,
            step_number: i + 1,
            delay_days: delayDays,
            org_id: orgId,
            owner_id: ownerId,
          };
        })
        .filter(Boolean);

      if (steps.length > 0) {
        const { error: stErr } = await adminClient
          .from("schedule_steps")
          .insert(steps);

        if (stErr) {
          logger.error(`[seedOrgDefaults] Failed to insert steps for "${sched.name}":`, { error: (stErr as Error)?.message ?? String(stErr) });
        }
      }
    }

    // 3. Activate default filing types for this org
    const { data: defaultFilingTypes, error: ftErr } = await adminClient
      .from("filing_types")
      .select("id")
      .eq("is_seeded_default", true);

    if (ftErr) {
      logger.error("[seedOrgDefaults] Failed to fetch default filing types:", { error: (ftErr as Error)?.message ?? String(ftErr) });
    } else if (defaultFilingTypes && defaultFilingTypes.length > 0) {
      const selections = defaultFilingTypes.map((ft) => ({
        org_id: orgId,
        filing_type_id: ft.id,
        is_active: true,
        activated_at: new Date().toISOString(),
      }));

      const { error: selErr } = await adminClient
        .from("org_filing_type_selections")
        .upsert(selections, { onConflict: "org_id,filing_type_id" });

      if (selErr) {
        logger.error("[seedOrgDefaults] Failed to activate default filing types:", { error: (selErr as Error)?.message ?? String(selErr) });
      }
    }
  } catch (err) {
    // Non-fatal — org creation succeeded even if seeding fails
    logger.error("[seedOrgDefaults] Unexpected error:", { error: (err as Error)?.message ?? String(err) });
  }
}
