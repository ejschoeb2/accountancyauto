import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPdfText, extractFieldsForType } from './ocr';

/**
 * Result of classifying a document by filename and MIME type against the
 * document_types catalog.
 *
 * Confidence levels:
 *   high          — filename keyword matched AND MIME type is in expected_mime_types
 *                   (also: OCR ran successfully and extracted a tax year)
 *   medium        — filename keyword matched but MIME type did not match
 *                   (also: OCR ran but no tax year found)
 *   low           — no keyword match, but file is a PDF (generic PDF, accountant can classify)
 *   unclassified  — no keyword match and MIME type is unrecognised,
 *                   or image-only PDF, or corrupt/encrypted PDF
 *
 * Phase 21 additions (all backward-compatible — safe defaults when buffer is not provided):
 *   extractedTaxYear   — tax year found in document text via OCR, or null
 *   extractedEmployer  — employer name found in document text via OCR, or null
 *   extractedPayeRef   — PAYE reference found in document text via OCR, or null
 *   extractionSource   — 'ocr' | 'keyword' | 'rules' — records which method produced the result
 *   isCorruptPdf       — true when pdf-parse threw (encrypted or damaged file)
 *   isImageOnly        — true when PDF text is near-empty (scanned/image-only document)
 */
export interface ClassificationResult {
  documentTypeId: string | null;
  documentTypeCode: string | null;
  filingTypeId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unclassified';
  // Phase 21 additions (backward-compatible defaults: null / 'keyword' / false)
  extractedTaxYear: string | null;
  extractedEmployer: string | null;
  extractedPayeRef: string | null;
  extractionSource: 'ocr' | 'keyword' | 'rules';
  isCorruptPdf: boolean;
  isImageOnly: boolean;
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
 * The 4 HMRC fixed-format document types that receive content-aware OCR classification.
 * All other types fall back to keyword-only classification.
 */
const HMRC_OCR_TYPES = new Set(['P60', 'P45', 'SA302', 'P11D']);

/**
 * Phase 21 defaults — returned for all non-OCR paths to ensure backward compatibility.
 * Existing callers that don't provide a buffer continue to receive a valid ClassificationResult.
 */
const KEYWORD_DEFAULTS = {
  extractedTaxYear: null,
  extractedEmployer: null,
  extractedPayeRef: null,
  extractionSource: 'keyword' as const,
  isCorruptPdf: false,
  isImageOnly: false,
} satisfies Pick<
  ClassificationResult,
  | 'extractedTaxYear'
  | 'extractedEmployer'
  | 'extractedPayeRef'
  | 'extractionSource'
  | 'isCorruptPdf'
  | 'isImageOnly'
>;

/**
 * Classify a document by filename and MIME type against the document_types catalog.
 *
 * When a buffer is provided and the matched code is one of the 4 HMRC OCR types
 * (P60, P45, SA302, P11D), the function also runs pdf-parse + regex extraction
 * to populate structured metadata fields (tax year, employer, PAYE reference).
 *
 * Callers that do NOT provide a buffer receive the same keyword-only result as
 * before Phase 21 — the buffer parameter is fully optional.
 *
 * @param filename  - Original filename from the attachment (e.g. "P60_John_Smith_2024.pdf")
 * @param mimeType  - MIME type from the attachment (e.g. "application/pdf")
 * @param supabase  - Supabase client to query the document_types catalog
 * @param buffer    - (Optional) File buffer; enables OCR classification for HMRC types
 * @returns         ClassificationResult with documentTypeId, documentTypeCode,
 *                  filingTypeId, confidence, and Phase 21 extraction fields
 */
export async function classifyDocument(
  filename: string,
  mimeType: string,
  supabase: SupabaseClient,
  buffer?: Buffer
): Promise<ClassificationResult> {
  // Fetch and cache all document_types (global reference table; ~23 rows)
  const { data: allTypes, error } = await supabase
    .from('document_types')
    .select('id, code, expected_mime_types');

  if (error) {
    console.error('[classifyDocument] Failed to fetch document_types:', error.message);
    // Degrade gracefully — cannot classify without catalog
    return {
      documentTypeId: null,
      documentTypeCode: null,
      filingTypeId: null,
      confidence: 'unclassified',
      ...KEYWORD_DEFAULTS,
      extractionSource: 'rules',
    };
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
      const baseConfidence: ClassificationResult['confidence'] = mimeMatches ? 'high' : 'medium';

      // Step 2: OCR path for HMRC fixed-format types when buffer is available
      if (buffer !== undefined && mimeType === 'application/pdf' && HMRC_OCR_TYPES.has(entry.code)) {
        try {
          const ocr = await extractPdfText(buffer);

          // Image-only PDF: scanned document, cannot extract text
          if (ocr.isImageOnly) {
            return {
              documentTypeId: catalogEntry.id,
              documentTypeCode: entry.code,
              filingTypeId: entry.filingType,
              confidence: 'unclassified',
              extractedTaxYear: null,
              extractedEmployer: null,
              extractedPayeRef: null,
              extractionSource: 'rules',
              isCorruptPdf: false,
              isImageOnly: true,
            };
          }

          // Text PDF: run field extraction
          const extracted = extractFieldsForType(entry.code, ocr.text);
          return {
            documentTypeId: catalogEntry.id,
            documentTypeCode: entry.code,
            filingTypeId: entry.filingType,
            // Confidence: high when we confirmed tax year; medium when keyword matched but no year found
            confidence: extracted.taxYear ? 'high' : 'medium',
            extractedTaxYear: extracted.taxYear,
            extractedEmployer: extracted.employer,
            extractedPayeRef: extracted.payeRef,
            extractionSource: 'ocr',
            isCorruptPdf: false,
            isImageOnly: false,
          };
        } catch {
          // pdf-parse threw — corrupt or password-protected PDF
          return {
            documentTypeId: catalogEntry.id,
            documentTypeCode: entry.code,
            filingTypeId: entry.filingType,
            confidence: 'unclassified',
            extractedTaxYear: null,
            extractedEmployer: null,
            extractedPayeRef: null,
            extractionSource: 'rules',
            isCorruptPdf: true,
            isImageOnly: false,
          };
        }
      }

      // Non-OCR keyword match (no buffer, non-HMRC type, or non-PDF)
      return {
        documentTypeId: catalogEntry.id,
        documentTypeCode: entry.code,
        filingTypeId: entry.filingType,
        confidence: baseConfidence,
        ...KEYWORD_DEFAULTS,
      };
    }
  }

  // Step 3: No keyword match — check MIME type for generic PDF
  if (mimeType === 'application/pdf') {
    return {
      documentTypeId: null,
      documentTypeCode: null,
      filingTypeId: null,
      confidence: 'low',
      ...KEYWORD_DEFAULTS,
    };
  }

  // Step 4: Unknown file — unclassified
  return {
    documentTypeId: null,
    documentTypeCode: null,
    filingTypeId: null,
    confidence: 'unclassified',
    ...KEYWORD_DEFAULTS,
    extractionSource: 'rules',
  };
}
