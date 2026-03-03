import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Default email template content
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    name: "Friendly First Reminder",
    subject: "{{filing_type}} — deadline approaching for {{client_name}}",
    body_json: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { text: "Dear ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "client_name", label: "Client Name" },
            },
            { text: ",", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "I hope this email finds you well. This is a friendly reminder that your ",
              type: "text",
            },
            {
              text: "{{filing_type}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " deadline is on ", type: "text" },
            {
              text: "{{deadline}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " (", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days from now).", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "To ensure everything is submitted on time, please send across any outstanding records or documents at your earliest convenience. If you have already done so, please disregard this message.",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "If you have any questions, please don't hesitate to get in touch.",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [{ text: "Kind regards,", type: "text" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "placeholder",
              attrs: { id: "accountant_name", label: "Accountant Name" },
            },
          ],
        },
      ],
    },
  },

  {
    name: "Follow-Up Reminder",
    subject:
      "Action needed: {{filing_type}} due {{deadline_short}} — {{client_name}}",
    body_json: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { text: "Dear ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "client_name", label: "Client Name" },
            },
            { text: ",", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Further to our previous correspondence, I wanted to follow up regarding your ",
              type: "text",
            },
            {
              text: "{{filing_type}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " which is due on ", type: "text" },
            {
              text: "{{deadline}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: ". This is now just ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days away.", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "We still require the following to complete your filing on time:",
              type: "text",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Any outstanding invoices and receipts", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Bank statements for the relevant period", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              text: "- Details of any significant transactions",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Please send these through as soon as possible",
              type: "text",
              marks: [{ type: "bold" }],
            },
            {
              text: " to allow us adequate time to prepare and submit your return before the deadline.",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [{ text: "Many thanks,", type: "text" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "placeholder",
              attrs: { id: "accountant_name", label: "Accountant Name" },
            },
          ],
        },
      ],
    },
  },

  {
    name: "Urgent Final Notice",
    subject:
      "URGENT: {{filing_type}} deadline in {{days_until_deadline}} days — {{client_name}}",
    body_json: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { text: "Dear ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "client_name", label: "Client Name" },
            },
            { text: ",", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "This is an urgent reminder",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " that your ", type: "text" },
            {
              text: "{{filing_type}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " deadline is on ", type: "text" },
            {
              text: "{{deadline}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " — only ", type: "text" },
            {
              text: "{{days_until_deadline}} days away",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: ".", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Late filing or payment may result in penalties and interest charges from HMRC. To avoid this, we need to receive any outstanding information ",
              type: "text",
            },
            {
              text: "immediately",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: ".", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "If there are any circumstances preventing you from providing the required documents, please contact us today so we can discuss your options.",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [{ text: "Regards,", type: "text" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "placeholder",
              attrs: { id: "accountant_name", label: "Accountant Name" },
            },
          ],
        },
      ],
    },
  },

  {
    name: "Companies House Reminder",
    subject:
      "Companies House accounts due {{deadline_short}} — {{client_name}}",
    body_json: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { text: "Dear ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "client_name", label: "Client Name" },
            },
            { text: ",", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "This is a reminder that your ",
              type: "text",
            },
            {
              text: "Companies House annual accounts",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " are due for filing by ", type: "text" },
            {
              text: "{{deadline}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: ". There are ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days remaining.", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Late filing with Companies House incurs automatic penalties starting at ",
              type: "text",
            },
            { text: "£150", type: "text", marks: [{ type: "bold" }] },
            {
              text: " and increasing over time. Please ensure all year-end information has been provided so we can prepare and file your accounts promptly.",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "If you believe your accounts have already been submitted, or if you have any queries, please let us know.",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [{ text: "Kind regards,", type: "text" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "placeholder",
              attrs: { id: "accountant_name", label: "Accountant Name" },
            },
          ],
        },
      ],
    },
  },

  {
    name: "VAT Return Reminder",
    subject:
      "VAT Return due {{deadline_short}} — records needed for {{client_name}}",
    body_json: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { text: "Dear ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "client_name", label: "Client Name" },
            },
            { text: ",", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            { text: "Your ", type: "text" },
            { text: "VAT Return", type: "text", marks: [{ type: "bold" }] },
            {
              text: " is due for submission and payment by ",
              type: "text",
            },
            {
              text: "{{deadline}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: ". We have ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days to get this filed.", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Please ensure we have the following for the quarter:",
              type: "text",
            },
          ],
        },
        {
          type: "paragraph",
          content: [{ text: "- All sales invoices issued", type: "text" }],
        },
        {
          type: "paragraph",
          content: [
            { text: "- All purchase invoices and receipts", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              text: "- Bank statements covering the VAT period",
              type: "text",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Any import/EU transactions", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "If you use bookkeeping software, please ensure your records are up to date and grant us access if you haven't already.",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [{ text: "Best regards,", type: "text" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "placeholder",
              attrs: { id: "accountant_name", label: "Accountant Name" },
            },
          ],
        },
      ],
    },
  },

  {
    name: "Self Assessment Reminder",
    subject:
      "Self Assessment tax return — {{days_until_deadline}} days left for {{client_name}}",
    body_json: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { text: "Dear ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "client_name", label: "Client Name" },
            },
            { text: ",", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            { text: "The ", type: "text" },
            {
              text: "Self Assessment",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " deadline of ", type: "text" },
            {
              text: "{{deadline}}",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " is approaching. You have ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days remaining.", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "To prepare your tax return, we will need:",
              type: "text",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- P60 / P45 from any employment", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Self-employment income and expenses", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              text: "- Rental income details (if applicable)",
              type: "text",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Dividend vouchers and investment income", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              text: "- Gift Aid donations and pension contributions",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Please gather these documents and send them through at your earliest convenience. Early submission helps avoid the last-minute rush and ensures any tax owed is calculated in good time.",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [{ text: "Warm regards,", type: "text" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "placeholder",
              attrs: { id: "accountant_name", label: "Accountant Name" },
            },
          ],
        },
      ],
    },
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
  const doc: any = JSON.parse(JSON.stringify(bodyJson));
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

const SCHEDULES: Array<{
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
      console.log(`[seedOrgDefaults] Templates already exist for org ${orgId}, skipping.`);
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
      console.error("[seedOrgDefaults] Failed to insert templates:", tErr);
      return;
    }

    const byName = Object.fromEntries(templates.map((t) => [t.name, t.id]));

    // 2. Insert schedules + steps
    for (const sched of SCHEDULES) {
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
        console.error(
          `[seedOrgDefaults] Failed to insert schedule "${sched.name}":`,
          sErr
        );
        continue;
      }

      const steps = sched.steps
        .map(([templateName, delayDays], i) => {
          const templateId = byName[templateName];
          if (!templateId) {
            console.warn(
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
          console.error(
            `[seedOrgDefaults] Failed to insert steps for "${sched.name}":`,
            stErr
          );
        }
      }
    }
  } catch (err) {
    // Non-fatal — org creation succeeded even if seeding fails
    console.error("[seedOrgDefaults] Unexpected error:", err);
  }
}
