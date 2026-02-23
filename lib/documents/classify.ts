import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Result of classifying a document by filename and MIME type against the
 * document_types catalog.
 *
 * Confidence levels:
 *   high          — filename keyword matched AND MIME type is in expected_mime_types
 *   medium        — filename keyword matched but MIME type did not match
 *   low           — no keyword match, but file is a PDF (generic PDF, accountant can classify)
 *   unclassified  — no keyword match and MIME type is unrecognised
 */
export interface ClassificationResult {
  documentTypeId: string | null;
  documentTypeCode: string | null;
  filingTypeId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unclassified';
}

/**
 * Keyword map covering all 23 seeded document_types codes.
 * Each entry maps regex patterns against the document filename to a code and
 * an optional default filing type (best-effort; accountant can correct).
 */
interface KeywordEntry {
  patterns: RegExp[];
  code: string;
  filingType: string | null;
}

const KEYWORD_MAP: KeywordEntry[] = [
  // ── SA100 / Self Assessment individual documents ──────────────────────────
  {
    code: 'P60',
    patterns: [/\bp60\b/i, /end[\s._-]*of[\s._-]*year[\s._-]*cert/i],
    filingType: 'self_assessment',
  },
  {
    code: 'P45',
    patterns: [/\bp45\b/i, /leaving[\s._-]*cert/i, /details[\s._-]*of[\s._-]*employee[\s._-]*leaving/i],
    filingType: 'self_assessment',
  },
  {
    code: 'P11D',
    patterns: [/\bp11d\b/i, /expenses[\s._-]*and[\s._-]*benefits/i, /benefit[\s._-]*in[\s._-]*kind/i],
    filingType: 'self_assessment',
  },
  {
    code: 'SA302',
    patterns: [/\bsa302\b/i, /tax[\s._-]*calculation/i, /hmrc[\s._-]*tax[\s._-]*calc/i],
    filingType: 'self_assessment',
  },
  {
    code: 'RENTAL_INCOME',
    patterns: [/rental[\s._-]*income/i, /rent[\s._-]*records/i, /landlord[\s._-]*records/i],
    filingType: 'self_assessment',
  },
  {
    code: 'SELF_EMPLOYMENT',
    patterns: [/self[\s._-]*employ/i, /sole[\s._-]*trader/i, /self[\s._-]*employed[\s._-]*income/i],
    filingType: 'self_assessment',
  },
  {
    code: 'PENSION_LETTER',
    patterns: [/pension[\s._-]*award/i, /pension[\s._-]*letter/i, /pension[\s._-]*income/i],
    filingType: 'self_assessment',
  },
  {
    code: 'GIFT_AID',
    patterns: [/gift[\s._-]*aid/i, /charitable[\s._-]*donation/i],
    filingType: 'self_assessment',
  },

  // ── Shared documents (used across multiple filing types) ──────────────────
  {
    code: 'BANK_STATEMENT',
    // 'statement' alone is broad — require 'bank' prefix or explicit 'bank statement' phrase
    patterns: [/bank[\s._-]*statement/i, /\bbank\b.*\bstatement\b/i],
    filingType: null,
  },
  {
    code: 'DIVIDEND_VOUCHER',
    patterns: [/dividend[\s._-]*voucher/i, /div[\s._-]*voucher/i, /dividend[\s._-]*cert/i],
    filingType: null,
  },
  {
    code: 'SHARE_REGISTER',
    patterns: [/share[\s._-]*register/i, /shareholder[\s._-]*register/i, /share[\s._-]*register[\s._-]*details/i],
    filingType: null,
  },

  // ── CT600 / Corporation Tax documents ─────────────────────────────────────
  {
    code: 'CT600_ACCOUNTS',
    // Note: 'CT600' in a filename is more likely to be the return itself; statutory/annual accounts
    // are the backing documents — match on 'statutory accounts', 'annual accounts', 'company accounts'
    patterns: [
      /statutory[\s._-]*accounts/i,
      /annual[\s._-]*accounts/i,
      /company[\s._-]*accounts/i,
      /ct600[\s._-]*accounts/i,
    ],
    filingType: 'ct600_filing',
  },
  {
    code: 'CT600_TAX_COMPUTATION',
    patterns: [/tax[\s._-]*computation/i, /corporation[\s._-]*tax[\s._-]*workings/i, /ct[\s._-]*computation/i],
    filingType: 'ct600_filing',
  },
  {
    code: 'PAYROLL_SUMMARY',
    patterns: [/payroll[\s._-]*summary/i, /\bp32\b/i, /payroll[\s._-]*records/i, /paye[\s._-]*records/i],
    filingType: 'ct600_filing',
  },
  {
    code: 'LOAN_STATEMENTS',
    patterns: [/director[\s._-]*loan/i, /loan[\s._-]*account/i, /loan[\s._-]*statement/i],
    filingType: 'ct600_filing',
  },
  {
    code: 'FIXED_ASSET_REGISTER',
    patterns: [/fixed[\s._-]*asset[\s._-]*register/i, /fixed[\s._-]*assets/i, /asset[\s._-]*register/i],
    filingType: 'ct600_filing',
  },

  // ── VAT documents ─────────────────────────────────────────────────────────
  {
    code: 'VAT_RETURN_WORKINGS',
    patterns: [/vat[\s._-]*return/i, /vat[\s._-]*workings/i, /vat[\s._-]*reconciliation/i],
    filingType: 'vat_return',
  },
  {
    code: 'PURCHASE_INVOICES',
    patterns: [/purchase[\s._-]*invoice/i, /supplier[\s._-]*invoice/i, /purchase[\s._-]*receipts/i],
    filingType: 'vat_return',
  },
  {
    code: 'SALES_INVOICES',
    patterns: [/sales[\s._-]*invoice/i, /customer[\s._-]*invoice/i, /sales[\s._-]*receipts/i],
    filingType: 'vat_return',
  },
  {
    code: 'FUEL_SCALE_CHARGE',
    patterns: [/fuel[\s._-]*scale/i, /fuel[\s._-]*scale[\s._-]*charge/i],
    filingType: 'vat_return',
  },

  // ── Companies House documents ─────────────────────────────────────────────
  {
    code: 'CH_ACCOUNTS',
    patterns: [
      /companies[\s._-]*house[\s._-]*accounts/i,
      /\bch[\s._-]*accounts\b/i,
      /filleted[\s._-]*accounts/i,
      /abridged[\s._-]*accounts/i,
    ],
    filingType: 'companies_house',
  },
  {
    code: 'CONFIRMATION_STATEMENT',
    patterns: [/confirmation[\s._-]*statement/i, /\bcs01\b/i],
    filingType: 'companies_house',
  },
  {
    code: 'PSC_REGISTER',
    patterns: [/\bpsc[\s._-]*register/i, /persons[\s._-]*with[\s._-]*significant[\s._-]*control/i, /\bpsc\b/i],
    filingType: 'companies_house',
  },
];

/**
 * Classify a document by filename and MIME type against the document_types catalog.
 *
 * The function fetches all document_types rows once at the start (cheap — ~23 rows)
 * and caches them in a Map for the remainder of the call. It then iterates the
 * KEYWORD_MAP against the filename and cross-checks the MIME type for confidence
 * scoring.
 *
 * @param filename  - Original filename from the attachment (e.g. "P60_John_Smith_2024.pdf")
 * @param mimeType  - MIME type from the attachment (e.g. "application/pdf")
 * @param supabase  - Supabase client to query the document_types catalog
 * @returns         ClassificationResult with documentTypeId, documentTypeCode,
 *                  filingTypeId, and confidence
 */
export async function classifyDocument(
  filename: string,
  mimeType: string,
  supabase: SupabaseClient
): Promise<ClassificationResult> {
  // Fetch and cache all document_types (global reference table; ~23 rows)
  const { data: allTypes, error } = await supabase
    .from('document_types')
    .select('id, code, expected_mime_types');

  if (error) {
    console.error('[classifyDocument] Failed to fetch document_types:', error.message);
    // Degrade gracefully — cannot classify without catalog
    return { documentTypeId: null, documentTypeCode: null, filingTypeId: null, confidence: 'unclassified' };
  }

  const typeMap = new Map(
    (allTypes ?? []).map(t => [t.code as string, t as { id: string; code: string; expected_mime_types: string[] | null }])
  );

  // Step 1: Iterate KEYWORD_MAP and match against the filename
  for (const entry of KEYWORD_MAP) {
    const matchesFilename = entry.patterns.some(pattern => pattern.test(filename));

    if (matchesFilename) {
      const catalogEntry = typeMap.get(entry.code);

      if (!catalogEntry) {
        // Code in KEYWORD_MAP but missing from DB — degrade to low
        console.warn('[classifyDocument] Code not found in document_types catalog:', entry.code);
        continue;
      }

      // Step 1b: Check MIME type against expected_mime_types
      const expectedMimes = catalogEntry.expected_mime_types ?? [];
      const mimeMatches = expectedMimes.length === 0 || expectedMimes.includes(mimeType);

      return {
        documentTypeId: catalogEntry.id,
        documentTypeCode: entry.code,
        filingTypeId: entry.filingType,
        confidence: mimeMatches ? 'high' : 'medium',
      };
    }
  }

  // Step 2: No keyword match — check MIME type for generic PDF
  if (mimeType === 'application/pdf') {
    return { documentTypeId: null, documentTypeCode: null, filingTypeId: null, confidence: 'low' };
  }

  // Step 3: Unknown file — unclassified
  return { documentTypeId: null, documentTypeCode: null, filingTypeId: null, confidence: 'unclassified' };
}
