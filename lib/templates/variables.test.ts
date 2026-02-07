import { describe, it, expect } from 'vitest';
import { substituteVariables, AVAILABLE_PLACEHOLDERS } from './variables';

describe('substituteVariables', () => {
  const baseContext = {
    client_name: 'ABC Ltd',
    deadline: new Date(2026, 0, 31), // January 31, 2026
    filing_type: 'Corporation Tax Payment',
  };

  it('replaces {{client_name}} with actual client name', () => {
    const result = substituteVariables('Dear {{client_name}}', baseContext);
    expect(result).toBe('Dear ABC Ltd');
  });

  it('replaces {{deadline}} with long format date', () => {
    const result = substituteVariables('Due on {{deadline}}', baseContext);
    expect(result).toBe('Due on 31 January 2026');
  });

  it('replaces {{deadline_short}} with short format date', () => {
    const result = substituteVariables('Due on {{deadline_short}}', baseContext);
    expect(result).toBe('Due on 31/01/2026');
  });

  it('replaces {{filing_type}} with filing type display name', () => {
    const result = substituteVariables('Your {{filing_type}} is due', baseContext);
    expect(result).toBe('Your Corporation Tax Payment is due');
  });

  it('replaces {{days_until_deadline}} with days remaining', () => {
    // Create a deadline 30 days from now
    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + 30);

    const result = substituteVariables('{{days_until_deadline}} days left', {
      ...baseContext,
      deadline,
    });
    expect(result).toBe('30 days left');
  });

  it('uses default "Peninsula Accounting" for {{accountant_name}} when not provided', () => {
    const result = substituteVariables('From {{accountant_name}}', baseContext);
    expect(result).toBe('From Peninsula Accounting');
  });

  it('uses custom accountant_name when provided', () => {
    const result = substituteVariables('From {{accountant_name}}', {
      ...baseContext,
      accountant_name: 'Custom Accounting Ltd',
    });
    expect(result).toBe('From Custom Accounting Ltd');
  });

  it('preserves unknown variables (does not remove them)', () => {
    const result = substituteVariables('Unknown {{foo}} variable', baseContext);
    expect(result).toBe('Unknown {{foo}} variable');
  });

  it('replaces multiple variables in one string', () => {
    const result = substituteVariables(
      'Dear {{client_name}}, your {{filing_type}} is due {{deadline}}',
      baseContext
    );
    expect(result).toBe('Dear ABC Ltd, your Corporation Tax Payment is due 31 January 2026');
  });

  it('returns empty string for empty template', () => {
    const result = substituteVariables('', baseContext);
    expect(result).toBe('');
  });

  it('returns template unchanged when no variables present', () => {
    const result = substituteVariables('No variables here', baseContext);
    expect(result).toBe('No variables here');
  });

  it('handles multiple occurrences of the same variable', () => {
    const result = substituteVariables(
      '{{client_name}} and {{client_name}} again',
      baseContext
    );
    expect(result).toBe('ABC Ltd and ABC Ltd again');
  });
});

describe('AVAILABLE_PLACEHOLDERS', () => {
  it('exports array of available placeholder metadata', () => {
    expect(AVAILABLE_PLACEHOLDERS).toBeDefined();
    expect(Array.isArray(AVAILABLE_PLACEHOLDERS)).toBe(true);
    expect(AVAILABLE_PLACEHOLDERS.length).toBeGreaterThan(0);
  });

  it('each placeholder has name and description', () => {
    AVAILABLE_PLACEHOLDERS.forEach((placeholder) => {
      expect(placeholder).toHaveProperty('name');
      expect(placeholder).toHaveProperty('description');
      expect(typeof placeholder.name).toBe('string');
      expect(typeof placeholder.description).toBe('string');
    });
  });

  it('includes all expected placeholders', () => {
    const names = AVAILABLE_PLACEHOLDERS.map((p) => p.name);
    expect(names).toContain('client_name');
    expect(names).toContain('deadline');
    expect(names).toContain('deadline_short');
    expect(names).toContain('filing_type');
    expect(names).toContain('days_until_deadline');
    expect(names).toContain('accountant_name');
  });
});
