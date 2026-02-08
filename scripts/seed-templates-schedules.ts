import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to build TipTap JSON
function doc(...content: any[]) {
  return { type: 'doc', content };
}

function paragraph(...content: any[]) {
  return { type: 'paragraph', content };
}

function text(value: string, marks?: any[]) {
  const node: any = { type: 'text', text: value };
  if (marks) node.marks = marks;
  return node;
}

function bold(value: string) {
  return text(value, [{ type: 'bold' }]);
}

function placeholder(id: string, label: string) {
  return { type: 'placeholder', attrs: { id, label } };
}

function emptyParagraph() {
  return { type: 'paragraph' };
}

// ── Templates ───────────────────────────────────────────────────────────────

const templates = [
  {
    name: 'Friendly First Reminder',
    subject: '{{filing_type}} — deadline approaching for {{client_name}}',
    is_active: true,
    body_json: doc(
      paragraph(text('Dear '), placeholder('client_name', 'Client Name'), text(',')),
      emptyParagraph(),
      paragraph(
        text('I hope this email finds you well. This is a friendly reminder that your '),
        bold('{{filing_type}}'),
        text(' deadline is on '),
        bold('{{deadline}}'),
        text(' ('),
        placeholder('days_until_deadline', 'Days Until Deadline'),
        text(' days from now).'),
      ),
      emptyParagraph(),
      paragraph(
        text('To ensure everything is submitted on time, please send across any outstanding records or documents at your earliest convenience. If you have already done so, please disregard this message.'),
      ),
      emptyParagraph(),
      paragraph(text('If you have any questions, please don\'t hesitate to get in touch.')),
      emptyParagraph(),
      paragraph(text('Kind regards,')),
      paragraph(placeholder('accountant_name', 'Accountant Name')),
    ),
  },
  {
    name: 'Follow-Up Reminder',
    subject: 'Action needed: {{filing_type}} due {{deadline_short}} — {{client_name}}',
    is_active: true,
    body_json: doc(
      paragraph(text('Dear '), placeholder('client_name', 'Client Name'), text(',')),
      emptyParagraph(),
      paragraph(
        text('Further to our previous correspondence, I wanted to follow up regarding your '),
        bold('{{filing_type}}'),
        text(' which is due on '),
        bold('{{deadline}}'),
        text('. This is now just '),
        placeholder('days_until_deadline', 'Days Until Deadline'),
        text(' days away.'),
      ),
      emptyParagraph(),
      paragraph(
        text('We still require the following to complete your filing on time:'),
      ),
      paragraph(text('- Any outstanding invoices and receipts')),
      paragraph(text('- Bank statements for the relevant period')),
      paragraph(text('- Details of any significant transactions')),
      emptyParagraph(),
      paragraph(
        bold('Please send these through as soon as possible'),
        text(' to allow us adequate time to prepare and submit your return before the deadline.'),
      ),
      emptyParagraph(),
      paragraph(text('Many thanks,')),
      paragraph(placeholder('accountant_name', 'Accountant Name')),
    ),
  },
  {
    name: 'Urgent Final Notice',
    subject: 'URGENT: {{filing_type}} deadline in {{days_until_deadline}} days — {{client_name}}',
    is_active: true,
    body_json: doc(
      paragraph(text('Dear '), placeholder('client_name', 'Client Name'), text(',')),
      emptyParagraph(),
      paragraph(
        bold('This is an urgent reminder'),
        text(' that your '),
        bold('{{filing_type}}'),
        text(' deadline is on '),
        bold('{{deadline}}'),
        text(' — only '),
        bold('{{days_until_deadline}} days away'),
        text('.'),
      ),
      emptyParagraph(),
      paragraph(
        text('Late filing or payment may result in penalties and interest charges from HMRC. To avoid this, we need to receive any outstanding information '),
        bold('immediately'),
        text('.'),
      ),
      emptyParagraph(),
      paragraph(
        text('If there are any circumstances preventing you from providing the required documents, please contact us today so we can discuss your options.'),
      ),
      emptyParagraph(),
      paragraph(text('Regards,')),
      paragraph(placeholder('accountant_name', 'Accountant Name')),
    ),
  },
  {
    name: 'VAT Return Prompt',
    subject: 'VAT Return due {{deadline_short}} — records needed for {{client_name}}',
    is_active: true,
    body_json: doc(
      paragraph(text('Dear '), placeholder('client_name', 'Client Name'), text(',')),
      emptyParagraph(),
      paragraph(
        text('Your '),
        bold('VAT Return'),
        text(' is due for submission and payment by '),
        bold('{{deadline}}'),
        text('. We have '),
        placeholder('days_until_deadline', 'Days Until Deadline'),
        text(' days to get this filed.'),
      ),
      emptyParagraph(),
      paragraph(text('Please ensure we have the following for the quarter:')),
      paragraph(text('- All sales invoices issued')),
      paragraph(text('- All purchase invoices and receipts')),
      paragraph(text('- Bank statements covering the VAT period')),
      paragraph(text('- Any EU/import transactions')),
      emptyParagraph(),
      paragraph(
        text('If you use bookkeeping software, please ensure your records are up to date and grant us access if you haven\'t already.'),
      ),
      emptyParagraph(),
      paragraph(text('Best regards,')),
      paragraph(placeholder('accountant_name', 'Accountant Name')),
    ),
  },
  {
    name: 'Self Assessment Nudge',
    subject: 'Self Assessment tax return — {{days_until_deadline}} days left for {{client_name}}',
    is_active: true,
    body_json: doc(
      paragraph(text('Dear '), placeholder('client_name', 'Client Name'), text(',')),
      emptyParagraph(),
      paragraph(
        text('The '),
        bold('Self Assessment'),
        text(' deadline of '),
        bold('{{deadline}}'),
        text(' is approaching. You have '),
        placeholder('days_until_deadline', 'Days Until Deadline'),
        text(' days remaining.'),
      ),
      emptyParagraph(),
      paragraph(text('To prepare your tax return, we\'ll need:')),
      paragraph(text('- P60 / P45 from any employment')),
      paragraph(text('- Self-employment income and expenses')),
      paragraph(text('- Rental income details (if applicable)')),
      paragraph(text('- Dividend vouchers and investment income')),
      paragraph(text('- Gift Aid donations and pension contributions')),
      emptyParagraph(),
      paragraph(
        text('Please gather these documents and send them through at your earliest convenience. Early submission helps avoid the last-minute rush and ensures any tax owed is calculated in good time.'),
      ),
      emptyParagraph(),
      paragraph(text('Warm regards,')),
      paragraph(placeholder('accountant_name', 'Accountant Name')),
    ),
  },
  {
    name: 'Companies House Reminder',
    subject: 'Companies House accounts due {{deadline_short}} — {{client_name}}',
    is_active: true,
    body_json: doc(
      paragraph(text('Dear '), placeholder('client_name', 'Client Name'), text(',')),
      emptyParagraph(),
      paragraph(
        text('This is a reminder that your '),
        bold('Companies House annual accounts'),
        text(' are due for filing by '),
        bold('{{deadline}}'),
        text('. There are '),
        placeholder('days_until_deadline', 'Days Until Deadline'),
        text(' days remaining.'),
      ),
      emptyParagraph(),
      paragraph(
        text('Late filing with Companies House incurs automatic penalties starting at '),
        bold('\u00a3150'),
        text(' and increasing over time. Please ensure all year-end information has been provided so we can prepare and file your accounts promptly.'),
      ),
      emptyParagraph(),
      paragraph(text('If you believe your accounts have already been submitted, or if you have any queries, please let us know.')),
      emptyParagraph(),
      paragraph(text('Kind regards,')),
      paragraph(placeholder('accountant_name', 'Accountant Name')),
    ),
  },
];

// ── Schedules ───────────────────────────────────────────────────────────────

// Template name -> schedule assignments (will map to IDs after insert)
const schedules = [
  {
    filing_type_id: 'corporation_tax_payment',
    name: 'Corporation Tax Payment Reminders',
    description: 'Standard 3-step reminder sequence for Corporation Tax payment deadlines',
    is_active: true,
    steps: [
      { template_name: 'Friendly First Reminder', delay_days: 30 },
      { template_name: 'Follow-Up Reminder', delay_days: 14 },
      { template_name: 'Urgent Final Notice', delay_days: 7 },
    ],
  },
  {
    filing_type_id: 'ct600_filing',
    name: 'CT600 Filing Reminders',
    description: 'Reminder sequence for CT600 Corporation Tax return filing',
    is_active: true,
    steps: [
      { template_name: 'Friendly First Reminder', delay_days: 30 },
      { template_name: 'Follow-Up Reminder', delay_days: 14 },
      { template_name: 'Urgent Final Notice', delay_days: 7 },
    ],
  },
  {
    filing_type_id: 'companies_house',
    name: 'Companies House Accounts Reminders',
    description: 'Reminder sequence for annual accounts filing at Companies House',
    is_active: true,
    steps: [
      { template_name: 'Companies House Reminder', delay_days: 30 },
      { template_name: 'Follow-Up Reminder', delay_days: 14 },
      { template_name: 'Urgent Final Notice', delay_days: 7 },
    ],
  },
  {
    filing_type_id: 'vat_return',
    name: 'VAT Return Quarterly Reminders',
    description: 'Two-step reminder for quarterly VAT return submissions',
    is_active: true,
    steps: [
      { template_name: 'VAT Return Prompt', delay_days: 14 },
      { template_name: 'Urgent Final Notice', delay_days: 5 },
    ],
  },
  {
    filing_type_id: 'self_assessment',
    name: 'Self Assessment Annual Reminders',
    description: 'Three-step reminder for annual Self Assessment tax returns',
    is_active: true,
    steps: [
      { template_name: 'Self Assessment Nudge', delay_days: 60 },
      { template_name: 'Follow-Up Reminder', delay_days: 21 },
      { template_name: 'Urgent Final Notice', delay_days: 7 },
    ],
  },
];

async function seed() {
  console.log('Seeding templates and schedules...\n');

  // ── Insert templates ──────────────────────────────────────────────────────
  console.log(`Creating ${templates.length} email templates...`);

  const templateMap = new Map<string, string>();

  for (const tmpl of templates) {
    // Check if template with this name already exists
    const { data: existing } = await supabase
      .from('email_templates')
      .select('id')
      .eq('name', tmpl.name)
      .maybeSingle();

    if (existing) {
      templateMap.set(tmpl.name, existing.id);
      console.log(`  ~ ${tmpl.name} (already exists, skipping)`);
      continue;
    }

    const { data: inserted, error: templateError } = await supabase
      .from('email_templates')
      .insert(tmpl)
      .select('id, name')
      .single();

    if (templateError) {
      console.error(`  Error creating "${tmpl.name}":`, templateError);
      continue;
    }

    templateMap.set(inserted.name, inserted.id);
    console.log(`  + ${inserted.name} (${inserted.id})`);
  }

  // ── Insert schedules ──────────────────────────────────────────────────────
  console.log(`\nCreating ${schedules.length} schedules...`);

  for (const schedule of schedules) {
    // Check if schedule already exists
    const { data: existing } = await supabase
      .from('schedules')
      .select('id')
      .eq('name', schedule.name)
      .maybeSingle();

    if (existing) {
      console.log(`  ~ ${schedule.name} (already exists, skipping)`);
      continue;
    }

    // Insert schedule
    const { data: insertedSchedule, error: scheduleError } = await supabase
      .from('schedules')
      .insert({
        filing_type_id: schedule.filing_type_id,
        name: schedule.name,
        description: schedule.description,
        is_active: schedule.is_active,
      })
      .select('id')
      .single();

    if (scheduleError) {
      console.error(`  Error creating "${schedule.name}":`, scheduleError);
      continue;
    }

    // Insert steps
    const stepsToInsert = schedule.steps.map((step, index) => ({
      schedule_id: insertedSchedule.id,
      email_template_id: templateMap.get(step.template_name)!,
      step_number: index + 1,
      delay_days: step.delay_days,
    }));

    const { error: stepsError } = await supabase
      .from('schedule_steps')
      .insert(stepsToInsert);

    if (stepsError) {
      console.error(`  Error creating steps for "${schedule.name}":`, stepsError);
      continue;
    }

    console.log(`  + ${schedule.name} (${schedule.steps.length} steps)`);
  }

  console.log('\nDone!');
}

seed().catch(console.error);
