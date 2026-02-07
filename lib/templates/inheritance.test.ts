import { describe, it, expect } from 'vitest';
import { resolveTemplateForClient, getOverriddenFieldNames } from './inheritance';
import { TemplateStep } from '@/lib/types/database';

describe('resolveTemplateForClient', () => {
  const baseSteps: TemplateStep[] = [
    {
      step_number: 1,
      delay_days: 60,
      subject: 'Gentle reminder',
      body: 'Please submit your records...',
    },
    {
      step_number: 2,
      delay_days: 30,
      subject: 'Follow-up',
      body: 'We notice you haven\'t submitted...',
    },
    {
      step_number: 3,
      delay_days: 14,
      subject: 'Urgent',
      body: 'Final notice...',
    },
  ];

  it('returns base steps unchanged when no overrides', () => {
    const result = resolveTemplateForClient(baseSteps, []);
    expect(result).toEqual(baseSteps);
  });

  it('returns base steps unchanged when overrides array is empty', () => {
    const result = resolveTemplateForClient(baseSteps, []);
    expect(result).toEqual(baseSteps);
  });

  it('overrides step 1 subject only, preserves other fields from base', () => {
    const overrides = [
      {
        step_index: 0,
        overridden_fields: { subject: 'Custom subject' },
      },
    ];

    const result = resolveTemplateForClient(baseSteps, overrides);

    expect(result[0]).toEqual({
      step_number: 1,
      delay_days: 60,
      subject: 'Custom subject',
      body: 'Please submit your records...',
    });

    // Other steps unchanged
    expect(result[1]).toEqual(baseSteps[1]);
    expect(result[2]).toEqual(baseSteps[2]);
  });

  it('overrides step 2 delay_days and body, preserves subject from base', () => {
    const overrides = [
      {
        step_index: 1,
        overridden_fields: {
          delay_days: 21,
          body: 'Custom body text',
        },
      },
    ];

    const result = resolveTemplateForClient(baseSteps, overrides);

    expect(result[1]).toEqual({
      step_number: 2,
      delay_days: 21,
      subject: 'Follow-up',
      body: 'Custom body text',
    });

    // Other steps unchanged
    expect(result[0]).toEqual(baseSteps[0]);
    expect(result[2]).toEqual(baseSteps[2]);
  });

  it('handles multiple step overrides correctly', () => {
    const overrides = [
      {
        step_index: 0,
        overridden_fields: { subject: 'Custom step 1 subject' },
      },
      {
        step_index: 2,
        overridden_fields: { body: 'Custom step 3 body' },
      },
    ];

    const result = resolveTemplateForClient(baseSteps, overrides);

    expect(result[0].subject).toBe('Custom step 1 subject');
    expect(result[0].delay_days).toBe(60); // from base
    expect(result[0].body).toBe('Please submit your records...'); // from base

    expect(result[1]).toEqual(baseSteps[1]); // no override

    expect(result[2].body).toBe('Custom step 3 body');
    expect(result[2].subject).toBe('Urgent'); // from base
    expect(result[2].delay_days).toBe(14); // from base
  });

  it('ignores override for non-existent step index without crashing', () => {
    const overrides = [
      {
        step_index: 5, // doesn't exist
        overridden_fields: { subject: 'This should be ignored' },
      },
    ];

    const result = resolveTemplateForClient(baseSteps, overrides);
    expect(result).toEqual(baseSteps);
  });

  it('preserves updated base template fields when override is only on body', () => {
    // Simulate base template being updated (subject changed)
    const updatedBaseSteps: TemplateStep[] = [
      {
        step_number: 1,
        delay_days: 60,
        subject: 'UPDATED Gentle reminder', // changed from original
        body: 'Please submit your records...',
      },
      ...baseSteps.slice(1),
    ];

    const overrides = [
      {
        step_index: 0,
        overridden_fields: { body: 'Custom body for this client' },
      },
    ];

    const result = resolveTemplateForClient(updatedBaseSteps, overrides);

    // Should have NEW subject from base + overridden body
    expect(result[0]).toEqual({
      step_number: 1,
      delay_days: 60,
      subject: 'UPDATED Gentle reminder', // from updated base
      body: 'Custom body for this client', // from override
    });
  });

  it('overrides all fields for a step', () => {
    const overrides = [
      {
        step_index: 0,
        overridden_fields: {
          subject: 'Custom subject',
          body: 'Custom body',
          delay_days: 45,
        },
      },
    ];

    const result = resolveTemplateForClient(baseSteps, overrides);

    expect(result[0]).toEqual({
      step_number: 1, // preserved from base
      delay_days: 45,
      subject: 'Custom subject',
      body: 'Custom body',
    });
  });

  it('handles empty base steps array', () => {
    const result = resolveTemplateForClient([], []);
    expect(result).toEqual([]);
  });
});

describe('getOverriddenFieldNames', () => {
  const baseSteps: TemplateStep[] = [
    {
      step_number: 1,
      delay_days: 60,
      subject: 'Gentle reminder',
      body: 'Please submit...',
    },
    {
      step_number: 2,
      delay_days: 30,
      subject: 'Follow-up',
      body: 'We notice...',
    },
  ];

  it('returns empty map when no overrides', () => {
    const result = getOverriddenFieldNames(baseSteps, []);
    expect(result.size).toBe(0);
  });

  it('returns field names for single override', () => {
    const overrides = [
      {
        step_index: 0,
        overridden_fields: { subject: 'Custom', body: 'Custom body' },
      },
    ];

    const result = getOverriddenFieldNames(baseSteps, overrides);

    expect(result.size).toBe(1);
    expect(result.get(0)).toEqual(['subject', 'body']);
  });

  it('returns field names for multiple step overrides', () => {
    const overrides = [
      {
        step_index: 0,
        overridden_fields: { subject: 'Custom' },
      },
      {
        step_index: 1,
        overridden_fields: { delay_days: 21, body: 'Custom' },
      },
    ];

    const result = getOverriddenFieldNames(baseSteps, overrides);

    expect(result.size).toBe(2);
    expect(result.get(0)).toEqual(['subject']);
    expect(result.get(1)).toEqual(['delay_days', 'body']);
  });

  it('ignores non-existent step indices', () => {
    const overrides = [
      {
        step_index: 5,
        overridden_fields: { subject: 'Should be ignored' },
      },
    ];

    const result = getOverriddenFieldNames(baseSteps, overrides);
    expect(result.size).toBe(0);
  });
});
