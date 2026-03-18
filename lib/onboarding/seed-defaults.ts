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
              type: "placeholder",
              attrs: { id: "filing_type", label: "Filing Type" },
            },
            { text: " deadline is on ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
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
              type: "placeholder",
              attrs: { id: "filing_type", label: "Filing Type" },
            },
            { text: " which is due on ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
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
              type: "placeholder",
              attrs: { id: "filing_type", label: "Filing Type" },
            },
            { text: " deadline is on ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
            },
            { text: " — only ", type: "text" },
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
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
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
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
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
    name: "MTD Quarterly Update Reminder",
    subject:
      "MTD Quarterly Update due {{deadline_short}} — {{client_name}}",
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
            {
              text: "MTD Quarterly Update",
              type: "text",
              marks: [{ type: "bold" }],
            },
            {
              text: " is due for digital submission to HMRC by ",
              type: "text",
            },
            {
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
            },
            { text: " (", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days remaining).", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Under Making Tax Digital, quarterly updates must be submitted digitally through compatible software. To prepare your submission, please ensure we have:",
              type: "text",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- All income received during the quarter", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- All business expenses and receipts", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              text: "- Bank statements covering the quarter period",
              type: "text",
            },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "If your bookkeeping software is up to date, please let us know and we can submit on your behalf.",
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
    name: "Confirmation Statement Reminder",
    subject:
      "Confirmation Statement due {{deadline_short}} — {{client_name}}",
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
            {
              text: "Confirmation Statement",
              type: "text",
              marks: [{ type: "bold" }],
            },
            {
              text: " is due to be filed with Companies House by ",
              type: "text",
            },
            {
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
            },
            { text: " (", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days remaining).", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "The Confirmation Statement confirms that the information Companies House holds about your company is correct and up to date. Please let us know if there have been any changes to:",
              type: "text",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Registered office address", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Directors or company secretary", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Shareholders or share capital", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- SIC codes (nature of business)", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "If nothing has changed, we can file this on your behalf. Late filing may result in your company being struck off the register.",
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
    name: "Payroll & P11D Reminder",
    subject:
      "{{filing_type}} due {{deadline_short}} — {{client_name}}",
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
            {
              type: "placeholder",
              attrs: { id: "filing_type", label: "Filing Type" },
            },
            { text: " deadline is ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
            },
            { text: " (", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days remaining).", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Please ensure all payroll records are up to date and any employee benefits or expenses have been reported. If you have any queries about what needs to be included, please get in touch.",
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
    name: "CIS Monthly Return Reminder",
    subject:
      "CIS Monthly Return due {{deadline_short}} — {{client_name}}",
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
            {
              text: "CIS Monthly Return",
              type: "text",
              marks: [{ type: "bold" }],
            },
            { text: " is due by ", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
            },
            { text: " (", type: "text" },
            {
              type: "placeholder",
              attrs: { id: "days_until_deadline", label: "Days Until Deadline" },
            },
            { text: " days remaining).", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Please provide details of all payments made to subcontractors during this period, including:",
              type: "text",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Subcontractor names and UTR numbers", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- Gross payment amounts", type: "text" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { text: "- CIS deductions made", type: "text" },
          ],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            {
              text: "Late filing incurs a £100 penalty from HMRC, increasing with further delays. Please send this information through promptly.",
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
              type: "placeholder",
              attrs: { id: "deadline", label: "Deadline" },
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
    name: "MTD Quarterly Update Reminders",
    description: "Automated reminders for MTD for Income Tax quarterly submissions.",
    filing_type_id: "mtd_quarterly_update",
    steps: [
      ["MTD Quarterly Update Reminder", 14],
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

    // 3. Activate default filing types for this org
    const { data: defaultFilingTypes, error: ftErr } = await adminClient
      .from("filing_types")
      .select("id")
      .eq("is_seeded_default", true);

    if (ftErr) {
      console.error("[seedOrgDefaults] Failed to fetch default filing types:", ftErr);
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
        console.error("[seedOrgDefaults] Failed to activate default filing types:", selErr);
      }
    }
  } catch (err) {
    // Non-fatal — org creation succeeded even if seeding fails
    console.error("[seedOrgDefaults] Unexpected error:", err);
  }
}
