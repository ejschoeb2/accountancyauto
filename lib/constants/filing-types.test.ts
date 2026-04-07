import { describe, it, expect } from 'vitest';
import {
  FILING_TYPE_LABELS,
  ALL_FILING_TYPE_IDS,
  FILING_TYPES_BY_CLIENT_TYPE,
  getFilingTypeLabel,
} from './filing-types';
import { DEADLINE_DESCRIPTIONS } from '@/lib/deadlines/descriptions';

describe('Filing Type Constants (AUDIT-053)', () => {
  describe('FILING_TYPE_LABELS', () => {
    it('contains no duplicate filing type IDs', () => {
      const ids = Object.keys(FILING_TYPE_LABELS);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('every label is a non-empty string', () => {
      for (const [id, label] of Object.entries(FILING_TYPE_LABELS)) {
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('includes all expected core filing types', () => {
      const expected = [
        'corporation_tax_payment',
        'ct600_filing',
        'companies_house',
        'vat_return',
        'self_assessment',
        'confirmation_statement',
        'p11d_filing',
        'paye_monthly',
        'cis_monthly_return',
        'payroll_year_end',
        'sa_payment_on_account',
        'partnership_tax_return',
        'trust_tax_return',
        'mtd_quarterly_update',
      ];
      for (const id of expected) {
        expect(FILING_TYPE_LABELS).toHaveProperty(id);
      }
    });
  });

  describe('ALL_FILING_TYPE_IDS', () => {
    it('is an array with at least one entry', () => {
      expect(Array.isArray(ALL_FILING_TYPE_IDS)).toBe(true);
      expect(ALL_FILING_TYPE_IDS.length).toBeGreaterThan(0);
    });

    it('matches the keys of FILING_TYPE_LABELS exactly', () => {
      expect(ALL_FILING_TYPE_IDS.sort()).toEqual(Object.keys(FILING_TYPE_LABELS).sort());
    });
  });

  describe('FILING_TYPES_BY_CLIENT_TYPE', () => {
    it('defines filing types for all four client types', () => {
      const expectedClientTypes = ['Limited Company', 'LLP', 'Partnership', 'Individual'];
      for (const type of expectedClientTypes) {
        expect(FILING_TYPES_BY_CLIENT_TYPE).toHaveProperty(type);
        expect(Array.isArray(FILING_TYPES_BY_CLIENT_TYPE[type])).toBe(true);
      }
    });

    it('every referenced filing type ID exists in FILING_TYPE_LABELS', () => {
      for (const [clientType, filingIds] of Object.entries(FILING_TYPES_BY_CLIENT_TYPE)) {
        for (const id of filingIds) {
          expect(FILING_TYPE_LABELS).toHaveProperty(id);
        }
      }
    });

    it('Limited Company includes corporation_tax_payment and confirmation_statement', () => {
      const limited = FILING_TYPES_BY_CLIENT_TYPE['Limited Company'];
      expect(limited).toContain('corporation_tax_payment');
      expect(limited).toContain('confirmation_statement');
    });

    it('Individual includes self_assessment but not corporation_tax_payment', () => {
      const individual = FILING_TYPES_BY_CLIENT_TYPE['Individual'];
      expect(individual).toContain('self_assessment');
      expect(individual).not.toContain('corporation_tax_payment');
    });
  });

  describe('getFilingTypeLabel', () => {
    it('returns the human-readable label for a known filing type', () => {
      expect(getFilingTypeLabel('vat_return')).toBe('VAT Return');
      expect(getFilingTypeLabel('corporation_tax_payment')).toBe('Corp Tax');
    });

    it('returns the ID itself for an unknown filing type', () => {
      expect(getFilingTypeLabel('some_unknown_type')).toBe('some_unknown_type');
    });

    it('returns an em dash for null input', () => {
      expect(getFilingTypeLabel(null)).toBe('—');
    });

    it('returns an em dash for undefined input', () => {
      expect(getFilingTypeLabel(undefined)).toBe('—');
    });
  });

  describe('DEADLINE_DESCRIPTIONS', () => {
    it('has a description for every entry in FILING_TYPE_LABELS', () => {
      for (const id of ALL_FILING_TYPE_IDS) {
        expect(DEADLINE_DESCRIPTIONS).toHaveProperty(id);
        const description = (DEADLINE_DESCRIPTIONS as Record<string, string>)[id];
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      }
    });

    it('self_assessment, partnership_tax_return, and trust_tax_return share the same January deadline description', () => {
      // Three types intentionally share "31 January following the tax year"
      const jan31Types: Array<keyof typeof DEADLINE_DESCRIPTIONS> = [
        'self_assessment',
        'partnership_tax_return',
        'trust_tax_return',
      ];
      const descriptions = jan31Types.map((id) => DEADLINE_DESCRIPTIONS[id]);
      expect(new Set(descriptions).size).toBe(1);
    });
  });
});
