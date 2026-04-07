import { describe, it, expect } from 'vitest';
import {
  clientTypeSchema,
  updateClientMetadataSchema,
  createClientSchema,
  statusOverrideSchema,
  bulkStatusUpdateSchema,
  bulkUpdateSchema,
} from './client';
import {
  scheduleStepSchema,
  filingScheduleSchema,
  customScheduleSchema,
  scheduleSchema,
} from './schedule';
import { emailTemplateSchema, tipTapDocumentSchema } from './email-template';
import { csvRowSchema } from './csv';

// ---------------------------------------------------------------------------
// client.ts schemas
// ---------------------------------------------------------------------------

describe('clientTypeSchema (AUDIT-045)', () => {
  it('accepts all valid client types', () => {
    for (const type of ['Limited Company', 'Partnership', 'LLP', 'Individual'] as const) {
      expect(clientTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects an unknown client type', () => {
    expect(() => clientTypeSchema.parse('Sole Trader')).toThrow();
  });
});

describe('createClientSchema', () => {
  const validClient = {
    company_name: 'Acme Ltd',
    primary_email: 'contact@acme.co.uk',
    client_type: 'Limited Company' as const,
  };

  it('accepts a minimal valid client', () => {
    const result = createClientSchema.parse(validClient);
    expect(result.company_name).toBe('Acme Ltd');
  });

  it('accepts a fully-populated client', () => {
    const result = createClientSchema.parse({
      ...validClient,
      year_end_date: '2025-03-31',
      vat_registered: true,
      vat_stagger_group: 1,
      vat_scheme: 'Standard',
      display_name: 'Acme',
      filing_type_ids: ['vat_return'],
    });
    expect(result.vat_stagger_group).toBe(1);
  });

  it('rejects missing company_name', () => {
    expect(() => createClientSchema.parse({ ...validClient, company_name: '' })).toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() => createClientSchema.parse({ ...validClient, primary_email: 'not-an-email' })).toThrow();
  });

  it('rejects a company_name exceeding 200 characters', () => {
    expect(() => createClientSchema.parse({ ...validClient, company_name: 'A'.repeat(201) })).toThrow();
  });

  it('rejects an invalid date format for year_end_date', () => {
    expect(() => createClientSchema.parse({ ...validClient, year_end_date: '31-03-2025' })).toThrow();
  });

  it('rejects a vat_stagger_group outside 1/2/3', () => {
    expect(() => createClientSchema.parse({ ...validClient, vat_stagger_group: 4 as any })).toThrow();
  });
});

describe('updateClientMetadataSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(() => updateClientMetadataSchema.parse({})).not.toThrow();
  });

  it('rejects an invalid email when provided', () => {
    expect(() => updateClientMetadataSchema.parse({ primary_email: 'bad' })).toThrow();
  });

  it('accepts null for nullable fields', () => {
    const result = updateClientMetadataSchema.parse({ primary_email: null, year_end_date: null });
    expect(result.primary_email).toBeNull();
  });
});

describe('statusOverrideSchema', () => {
  it('accepts valid green/red overrides', () => {
    expect(() => statusOverrideSchema.parse({ filing_type_id: 'vat_return', override_status: 'green' })).not.toThrow();
    expect(() => statusOverrideSchema.parse({ filing_type_id: 'vat_return', override_status: 'red' })).not.toThrow();
  });

  it('rejects an unknown status', () => {
    expect(() => statusOverrideSchema.parse({ filing_type_id: 'vat_return', override_status: 'amber' })).toThrow();
  });
});

describe('bulkUpdateSchema', () => {
  it('accepts an array of valid update objects', () => {
    // Must be a valid UUID v1-8 (Zod's uuid() rejects all-zero UUIDs except the nil UUID exactly)
    const result = bulkUpdateSchema.parse([
      { id: '550e8400-e29b-41d4-a716-446655440000', metadata: { vat_registered: true } },
    ]);
    expect(result).toHaveLength(1);
  });

  it('rejects a non-UUID id', () => {
    expect(() =>
      bulkUpdateSchema.parse([{ id: 'not-a-uuid', metadata: {} }])
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// schedule.ts schemas
// ---------------------------------------------------------------------------

describe('scheduleStepSchema', () => {
  it('accepts a valid step with a UUID template ID', () => {
    const result = scheduleStepSchema.parse({
      email_template_id: '550e8400-e29b-41d4-a716-446655440000',
      delay_days: 7,
    });
    expect(result.delay_days).toBe(7);
  });

  it('accepts delay_days of 0 (same day)', () => {
    expect(() => scheduleStepSchema.parse({ email_template_id: '550e8400-e29b-41d4-a716-446655440000', delay_days: 0 })).not.toThrow();
  });

  it('rejects delay_days above 365', () => {
    expect(() => scheduleStepSchema.parse({ email_template_id: '550e8400-e29b-41d4-a716-446655440000', delay_days: 366 })).toThrow();
  });

  it('rejects a negative delay_days', () => {
    expect(() => scheduleStepSchema.parse({ email_template_id: '550e8400-e29b-41d4-a716-446655440000', delay_days: -1 })).toThrow();
  });
});

describe('filingScheduleSchema', () => {
  const validFilingSchedule = {
    schedule_type: 'filing' as const,
    name: 'VAT Reminder',
    is_active: true,
    steps: [{ email_template_id: '550e8400-e29b-41d4-a716-446655440000', delay_days: 14 }],
    filing_type_id: 'vat_return' as const,
  };

  it('accepts a valid filing schedule', () => {
    expect(() => filingScheduleSchema.parse(validFilingSchedule)).not.toThrow();
  });

  it('rejects an invalid filing_type_id', () => {
    expect(() => filingScheduleSchema.parse({ ...validFilingSchedule, filing_type_id: 'unknown_type' })).toThrow();
  });

  it('rejects a name exceeding 100 characters', () => {
    expect(() => filingScheduleSchema.parse({ ...validFilingSchedule, name: 'A'.repeat(101) })).toThrow();
  });
});

describe('customScheduleSchema', () => {
  it('accepts a custom schedule with a target date', () => {
    expect(() =>
      customScheduleSchema.parse({
        schedule_type: 'custom',
        name: 'Year End',
        is_active: true,
        steps: [],
        custom_date: '2026-01-31',
      })
    ).not.toThrow();
  });

  it('accepts a custom schedule with recurrence rule and anchor', () => {
    expect(() =>
      customScheduleSchema.parse({
        schedule_type: 'custom',
        name: 'Monthly',
        is_active: true,
        steps: [],
        recurrence_rule: 'monthly',
        recurrence_anchor: '2026-01-01',
      })
    ).not.toThrow();
  });

  it('rejects a custom schedule with neither date nor recurrence', () => {
    expect(() =>
      customScheduleSchema.parse({
        schedule_type: 'custom',
        name: 'Empty',
        is_active: true,
        steps: [],
      })
    ).toThrow();
  });

  it('rejects an invalid recurrence_rule value', () => {
    expect(() =>
      customScheduleSchema.parse({
        schedule_type: 'custom',
        name: 'Bad',
        is_active: true,
        steps: [],
        recurrence_rule: 'weekly',
        recurrence_anchor: '2026-01-01',
      })
    ).toThrow();
  });
});

describe('scheduleSchema discriminated union', () => {
  it('routes to filingScheduleSchema when schedule_type is filing', () => {
    const result = scheduleSchema.parse({
      schedule_type: 'filing',
      name: 'Corp Tax',
      is_active: false,
      steps: [],
      filing_type_id: 'corporation_tax_payment',
    });
    expect(result.schedule_type).toBe('filing');
  });

  it('routes to customScheduleSchema when schedule_type is custom', () => {
    const result = scheduleSchema.parse({
      schedule_type: 'custom',
      name: 'Custom',
      is_active: true,
      steps: [],
      custom_date: '2026-06-30',
    });
    expect(result.schedule_type).toBe('custom');
  });

  it('rejects an unknown schedule_type', () => {
    expect(() => scheduleSchema.parse({ schedule_type: 'adhoc', name: 'X', is_active: true, steps: [] })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// email-template.ts schemas
// ---------------------------------------------------------------------------

describe('emailTemplateSchema', () => {
  const validBody = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
  };

  it('accepts a valid email template', () => {
    expect(() =>
      emailTemplateSchema.parse({ name: 'Welcome', subject: 'Hello there', body_json: validBody })
    ).not.toThrow();
  });

  it('rejects empty name', () => {
    expect(() =>
      emailTemplateSchema.parse({ name: '', subject: 'Subject', body_json: validBody })
    ).toThrow();
  });

  it('rejects empty subject', () => {
    expect(() =>
      emailTemplateSchema.parse({ name: 'Name', subject: '', body_json: validBody })
    ).toThrow();
  });

  it('rejects a subject exceeding 200 characters', () => {
    expect(() =>
      emailTemplateSchema.parse({ name: 'Name', subject: 'S'.repeat(201), body_json: validBody })
    ).toThrow();
  });

  it('rejects body_json that is not a doc node', () => {
    expect(() =>
      emailTemplateSchema.parse({ name: 'Name', subject: 'Subject', body_json: { type: 'paragraph', content: [] } })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// csv.ts schema
// ---------------------------------------------------------------------------

describe('csvRowSchema', () => {
  it('accepts a minimal valid CSV row', () => {
    const result = csvRowSchema.parse({ company_name: 'Smith Ltd' });
    expect(result.company_name).toBe('Smith Ltd');
  });

  it('rejects an empty company_name', () => {
    expect(() => csvRowSchema.parse({ company_name: '' })).toThrow();
  });

  it('transforms DD/MM/YYYY date to YYYY-MM-DD', () => {
    const result = csvRowSchema.parse({ company_name: 'Test', year_end_date: '31/03/2026' });
    expect(result.year_end_date).toBe('2026-03-31');
  });

  it('passes through an already-ISO-formatted date unchanged', () => {
    const result = csvRowSchema.parse({ company_name: 'Test', year_end_date: '2026-03-31' });
    expect(result.year_end_date).toBe('2026-03-31');
  });

  it('transforms vat_registered "Yes" to true', () => {
    const result = csvRowSchema.parse({ company_name: 'Test', vat_registered: 'Yes' });
    expect(result.vat_registered).toBe(true);
  });

  it('transforms vat_registered "No" to false', () => {
    const result = csvRowSchema.parse({ company_name: 'Test', vat_registered: 'No' });
    expect(result.vat_registered).toBe(false);
  });

  it('transforms vat_stagger_group "2" to integer 2', () => {
    const result = csvRowSchema.parse({ company_name: 'Test', vat_stagger_group: '2' });
    expect(result.vat_stagger_group).toBe(2);
  });

  it('rejects an invalid vat_stagger_group value', () => {
    expect(() => csvRowSchema.parse({ company_name: 'Test', vat_stagger_group: '4' })).toThrow();
  });
});
