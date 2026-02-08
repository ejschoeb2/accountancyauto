/**
 * Migration Verification Script
 *
 * Verifies that the v1.0 -> v1.1 data migration was successful by comparing
 * row counts between old and new tables and validating data integrity.
 *
 * Usage: npx tsx scripts/verify-migration.ts
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nEnsure .env.local exists with these values.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// Types
// ============================================================================

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

// ============================================================================
// Helper: count rows in a table
// ============================================================================

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(`Error counting ${table}:`, error.message);
    return -1;
  }

  return count ?? 0;
}

// ============================================================================
// Helper: count total steps across all reminder_templates JSONB arrays
// ============================================================================

async function countTotalSteps(): Promise<number> {
  const { data, error } = await supabase
    .from('reminder_templates')
    .select('steps');

  if (error) {
    console.error('Error fetching reminder_templates steps:', error.message);
    return -1;
  }

  if (!data) return 0;

  let total = 0;
  for (const row of data) {
    if (Array.isArray(row.steps)) {
      total += row.steps.length;
    }
  }
  return total;
}

// ============================================================================
// Check: Filing type consistency
// ============================================================================

async function checkFilingTypeConsistency(): Promise<CheckResult> {
  const { data: templates, error: tErr } = await supabase
    .from('reminder_templates')
    .select('id, filing_type_id');

  if (tErr || !templates) {
    return { name: 'Filing type consistency', passed: false, details: `Error: ${tErr?.message}` };
  }

  const { data: schedules, error: sErr } = await supabase
    .from('schedules')
    .select('id, filing_type_id');

  if (sErr || !schedules) {
    return { name: 'Filing type consistency', passed: false, details: `Error: ${sErr?.message}` };
  }

  // Each template's filing_type_id should appear in exactly one schedule
  const scheduleFilingTypes = new Set(schedules.map((s) => s.filing_type_id));
  const templateFilingTypes = new Set(templates.map((t) => t.filing_type_id));

  // Every template filing type should have a corresponding schedule
  const missing = [...templateFilingTypes].filter((ft) => !scheduleFilingTypes.has(ft));

  if (missing.length > 0) {
    return {
      name: 'Filing type consistency',
      passed: false,
      details: `Missing schedules for filing types: ${missing.join(', ')}`,
    };
  }

  return { name: 'Filing type consistency', passed: true, details: 'All filing types matched' };
}

// ============================================================================
// Check: TipTap JSON validity
// ============================================================================

async function checkTipTapValidity(): Promise<CheckResult> {
  const { data: emailTemplates, error } = await supabase
    .from('email_templates')
    .select('id, name, body_json');

  if (error || !emailTemplates) {
    return { name: 'TipTap JSON validity', passed: false, details: `Error: ${error?.message}` };
  }

  let invalidCount = 0;
  const invalidNames: string[] = [];

  for (const et of emailTemplates) {
    const bodyJson = et.body_json;

    if (!bodyJson) {
      invalidCount++;
      invalidNames.push(`${et.name} (null body_json)`);
      continue;
    }

    // Validate TipTap structure: must have type: 'doc' and content array
    if (bodyJson.type !== 'doc') {
      invalidCount++;
      invalidNames.push(`${et.name} (type is '${bodyJson.type}', expected 'doc')`);
      continue;
    }

    if (!Array.isArray(bodyJson.content)) {
      invalidCount++;
      invalidNames.push(`${et.name} (content is not an array)`);
      continue;
    }
  }

  if (invalidCount > 0) {
    return {
      name: 'TipTap JSON validity',
      passed: false,
      details: `${invalidCount} invalid: ${invalidNames.slice(0, 5).join('; ')}${invalidCount > 5 ? '...' : ''}`,
    };
  }

  return {
    name: 'TipTap JSON validity',
    passed: true,
    details: `All ${emailTemplates.length} templates have valid TipTap JSON`,
  };
}

// ============================================================================
// Check: Delay days consistency
// ============================================================================

async function checkDelayDaysConsistency(): Promise<CheckResult> {
  // Get all original steps from reminder_templates
  const { data: templates, error: tErr } = await supabase
    .from('reminder_templates')
    .select('id, steps');

  if (tErr || !templates) {
    return { name: 'Delay days consistency', passed: false, details: `Error: ${tErr?.message}` };
  }

  // Build a map of expected delay_days per filing_type
  // We need to match via schedule -> schedule_steps
  const { data: schedules, error: sErr } = await supabase
    .from('schedules')
    .select('id, filing_type_id');

  if (sErr || !schedules) {
    return { name: 'Delay days consistency', passed: false, details: `Error: ${sErr?.message}` };
  }

  const { data: scheduleSteps, error: ssErr } = await supabase
    .from('schedule_steps')
    .select('id, schedule_id, step_number, delay_days');

  if (ssErr || !scheduleSteps) {
    return { name: 'Delay days consistency', passed: false, details: `Error: ${ssErr?.message}` };
  }

  // Build schedule_id -> filing_type_id map
  const scheduleToFiling = new Map<string, string>();
  for (const s of schedules) {
    scheduleToFiling.set(s.id, s.filing_type_id);
  }

  // Build template filing_type_id -> steps map
  const templateStepsByFiling = new Map<string, Array<{ step_number: number; delay_days: number }>>();
  for (const t of templates) {
    if (Array.isArray(t.steps)) {
      templateStepsByFiling.set(
        t.id,
        t.steps.map((s: { step_number: number; delay_days: number }) => ({
          step_number: s.step_number,
          delay_days: s.delay_days,
        }))
      );
    }
  }

  // For each template, find its schedule and compare delay_days
  let mismatches = 0;
  const mismatchDetails: string[] = [];

  // Build a map from filing_type_id -> template id for lookup
  const filingToTemplate = new Map<string, string>();
  for (const t of templates) {
    filingToTemplate.set((t as { id: string; filing_type_id?: string }).id, t.id);
  }

  // For each schedule, compare its steps' delay_days against original template
  for (const schedule of schedules) {
    // Find the original template for this filing_type_id
    const originalTemplate = templates.find(
      (t: { id: string; filing_type_id?: string; steps: unknown }) =>
        (t as { filing_type_id: string }).filing_type_id === schedule.filing_type_id
    );

    if (!originalTemplate) continue;

    const originalSteps = Array.isArray(originalTemplate.steps) ? originalTemplate.steps : [];
    const newSteps = scheduleSteps.filter((ss) => ss.schedule_id === schedule.id);

    for (const origStep of originalSteps) {
      const newStep = newSteps.find((ns) => ns.step_number === origStep.step_number);
      if (!newStep) {
        mismatches++;
        mismatchDetails.push(`Missing step ${origStep.step_number} in schedule for ${schedule.filing_type_id}`);
        continue;
      }
      if (newStep.delay_days !== origStep.delay_days) {
        mismatches++;
        mismatchDetails.push(
          `Step ${origStep.step_number} for ${schedule.filing_type_id}: expected ${origStep.delay_days}, got ${newStep.delay_days}`
        );
      }
    }
  }

  if (mismatches > 0) {
    return {
      name: 'Delay days consistency',
      passed: false,
      details: `${mismatches} mismatches: ${mismatchDetails.slice(0, 5).join('; ')}${mismatches > 5 ? '...' : ''}`,
    };
  }

  return { name: 'Delay days consistency', passed: true, details: 'All delay_days values match' };
}

// ============================================================================
// Main verification
// ============================================================================

async function verify() {
  console.log('=== Migration Verification ===\n');

  // Row counts
  const reminderTemplatesCount = await countRows('reminder_templates');
  const schedulesCount = await countRows('schedules');
  const totalSteps = await countTotalSteps();
  const scheduleStepsCount = await countRows('schedule_steps');
  const emailTemplatesCount = await countRows('email_templates');
  const clientTemplateOverridesCount = await countRows('client_template_overrides');
  const clientEmailOverridesCount = await countRows('client_email_overrides');
  const clientScheduleOverridesCount = await countRows('client_schedule_overrides');

  // Check if migration has been run
  if (emailTemplatesCount === 0 && schedulesCount === 0 && scheduleStepsCount === 0) {
    console.log('Migration has not been run yet (new tables are empty).');
    console.log(`\nOld table counts for reference:`);
    console.log(`  reminder_templates:        ${reminderTemplatesCount}`);
    console.log(`  client_template_overrides: ${clientTemplateOverridesCount}`);
    console.log(`  total steps (JSONB):       ${totalSteps}`);
    console.log('\nRun the migration first, then re-run this script.');
    process.exit(0);
  }

  const checks: CheckResult[] = [];

  // Row count checks
  const schedulesPass = schedulesCount === reminderTemplatesCount;
  checks.push({
    name: 'Schedules count',
    passed: schedulesPass,
    details: `${schedulesCount} (expected: ${reminderTemplatesCount})`,
  });

  const stepsPass = scheduleStepsCount === totalSteps;
  checks.push({
    name: 'Schedule steps count',
    passed: stepsPass,
    details: `${scheduleStepsCount} (expected: ${totalSteps})`,
  });

  const emailTemplatesPass = emailTemplatesCount === totalSteps;
  checks.push({
    name: 'Email templates count',
    passed: emailTemplatesPass,
    details: `${emailTemplatesCount} (expected: ${totalSteps})`,
  });

  const totalNewOverrides = clientEmailOverridesCount + clientScheduleOverridesCount;
  const overridesPass = totalNewOverrides >= clientTemplateOverridesCount;
  checks.push({
    name: 'Total new overrides',
    passed: overridesPass,
    details: `${totalNewOverrides} (expected: >= ${clientTemplateOverridesCount})`,
  });

  // Print row counts
  console.log('Row Counts:');
  console.log(`  reminder_templates:        ${reminderTemplatesCount}`);
  console.log(`  schedules:                 ${schedulesCount}  (expected: ${reminderTemplatesCount}) [${schedulesPass ? 'PASS' : 'FAIL'}]`);
  console.log(`  total steps (JSONB):       ${totalSteps}`);
  console.log(`  schedule_steps:            ${scheduleStepsCount}  (expected: ${totalSteps}) [${stepsPass ? 'PASS' : 'FAIL'}]`);
  console.log(`  email_templates:           ${emailTemplatesCount}  (expected: ${totalSteps}) [${emailTemplatesPass ? 'PASS' : 'FAIL'}]`);
  console.log(`  client_template_overrides: ${clientTemplateOverridesCount}`);
  console.log(`  client_email_overrides:    ${clientEmailOverridesCount}`);
  console.log(`  client_schedule_overrides: ${clientScheduleOverridesCount}`);
  console.log(`  total new overrides:       ${totalNewOverrides}  (expected: >= ${clientTemplateOverridesCount}) [${overridesPass ? 'PASS' : 'FAIL'}]`);

  // Data integrity checks
  console.log('\nData Integrity:');

  const filingTypeCheck = await checkFilingTypeConsistency();
  checks.push(filingTypeCheck);
  console.log(`  Filing type consistency:   [${filingTypeCheck.passed ? 'PASS' : 'FAIL'}] ${filingTypeCheck.passed ? '' : filingTypeCheck.details}`);

  const tipTapCheck = await checkTipTapValidity();
  checks.push(tipTapCheck);
  console.log(`  TipTap JSON validity:      [${tipTapCheck.passed ? 'PASS' : 'FAIL'}] ${tipTapCheck.passed ? '' : tipTapCheck.details}`);

  const delayDaysCheck = await checkDelayDaysConsistency();
  checks.push(delayDaysCheck);
  console.log(`  Delay days consistency:    [${delayDaysCheck.passed ? 'PASS' : 'FAIL'}] ${delayDaysCheck.passed ? '' : delayDaysCheck.details}`);

  // Overall result
  const allPassed = checks.every((c) => c.passed);
  console.log(`\nOverall: [${allPassed ? 'PASS' : 'FAIL'}]`);

  if (!allPassed) {
    console.log('\nFailed checks:');
    for (const check of checks.filter((c) => !c.passed)) {
      console.log(`  - ${check.name}: ${check.details}`);
    }
  }

  process.exit(allPassed ? 0 : 1);
}

verify().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
