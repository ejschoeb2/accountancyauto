/**
 * Keyword Detector for Document Submission Emails
 *
 * Detects whether an inbound email likely contains document submissions
 * from clients by analyzing subject lines and body text for keywords.
 *
 * Based on research from .planning/research/document-detection-keywords.md
 */

// Keyword categories with confidence scores
export const DOCUMENT_KEYWORDS = {
  // High confidence - strong indicators of document sending (2 points each)
  highConfidence: [
    'attached', 'attachment', 'attachments',
    'enclosed', 'enclosure', 'enclosures',
    'please find attached', 'pfa', 'find attached',
    'see attached', 'attached please find',
    'kindly find attached', 'attached herewith',
    'file attached', 'files attached',
  ],

  // Medium confidence - likely document sending (1 point each)
  mediumConfidence: [
    'invoice', 'invoices', 'receipt', 'receipts',
    'spreadsheet', 'excel', 'xlsx', 'csv',
    "here's the", 'here is the', 'sending you',
    'sent you', "i've attached", 'i have attached',
    'sharing the', 'forwarding', 'forwarded',
    'sending over', 'sent over',
  ],

  // Document types - accounting specific (0.5 points each)
  documentTypes: [
    'document', 'documents', 'doc', 'docs',
    'file', 'files', 'paperwork', 'records',
    'vat receipt', 'vat receipts', 'purchase invoice',
    'sales invoice', 'credit note', 'debit note',
    'bank statement', 'payslip', 'payslips',
    'p60', 'p45', 'p11d', 'sa302',
    'tax calculation', 'tax return', 'accounts',
    'annual accounts', 'management accounts',
  ],

  // Action verbs - sending intent (0.5 points each)
  actionVerbs: [
    'sending', 'sent', 'submitting', 'submitted',
    'providing', 'provided', 'uploading', 'uploaded',
    'attaching', 'returning', 'returned',
    'completing', 'completed', 'sharing', 'shared',
  ],

  // Common typos to catch (1 point each - treat like medium confidence)
  typos: [
    'atached', 'attachd', 'attched', // attached variants
    'receit', 'recipt', 'recpt', // receipt variants
    'invioce', 'invoce', // invoice variants
    'spreedsheet', 'exel', // spreadsheet/excel variants
    'documnet', 'docuemnt', // document variants
  ],

  // Context phrases - UK accounting specific (0.5 points each)
  contextPhrases: [
    'vat return', 'year end', 'tax documents',
    'hmrc documents', 'companies house',
    'quarterly returns', 'self assessment',
    'corporation tax', 'as requested', 'as discussed',
    'for your review', 'for your records',
  ],

  // Negative indicators - NOT sending documents (-2 points each)
  negativeIndicators: [
    'can you send', 'could you send', 'please send',
    'need help', 'question about', 'when is',
    "what's the deadline", 'reminder about',
  ],
};

export interface KeywordDetectionResult {
  /** Overall confidence score */
  score: number;
  /** True if score meets threshold (>= 2.0) */
  documentsDetected: boolean;
  /** Breakdown of matches by category */
  breakdown: {
    highConfidence: number;
    mediumConfidence: number;
    documentTypes: number;
    actionVerbs: number;
    typos: number;
    contextPhrases: number;
    negativeIndicators: number;
    hasAttachments: number;
  };
  /** Matched keywords for debugging/display */
  matchedKeywords: string[];
}

/**
 * Detects document submission keywords in email text
 *
 * @param subject - Email subject line
 * @param body - Email body (plain text or HTML stripped)
 * @param hasAttachments - Whether email has attachments (adds +2 bonus)
 * @returns Detection result with score and breakdown
 */
export function detectDocumentKeywords(
  subject: string | null,
  body: string | null,
  hasAttachments: boolean = false
): KeywordDetectionResult {
  // Normalize text: lowercase, combine subject + body
  const normalizedText = [subject, body]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const breakdown = {
    highConfidence: 0,
    mediumConfidence: 0,
    documentTypes: 0,
    actionVerbs: 0,
    typos: 0,
    contextPhrases: 0,
    negativeIndicators: 0,
    hasAttachments: 0,
  };

  const matchedKeywords: string[] = [];

  // Check high confidence keywords (2 points each)
  for (const keyword of DOCUMENT_KEYWORDS.highConfidence) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      breakdown.highConfidence += 2;
      matchedKeywords.push(keyword);
    }
  }

  // Check medium confidence keywords (1 point each)
  for (const keyword of DOCUMENT_KEYWORDS.mediumConfidence) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      breakdown.mediumConfidence += 1;
      matchedKeywords.push(keyword);
    }
  }

  // Check document types (0.5 points each)
  for (const keyword of DOCUMENT_KEYWORDS.documentTypes) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      breakdown.documentTypes += 0.5;
      matchedKeywords.push(keyword);
    }
  }

  // Check action verbs (0.5 points each)
  for (const keyword of DOCUMENT_KEYWORDS.actionVerbs) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      breakdown.actionVerbs += 0.5;
      matchedKeywords.push(keyword);
    }
  }

  // Check typos (1 point each - common mistakes)
  for (const keyword of DOCUMENT_KEYWORDS.typos) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      breakdown.typos += 1;
      matchedKeywords.push(keyword);
    }
  }

  // Check context phrases (0.5 points each)
  for (const keyword of DOCUMENT_KEYWORDS.contextPhrases) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      breakdown.contextPhrases += 0.5;
      matchedKeywords.push(keyword);
    }
  }

  // Check negative indicators (-2 points each)
  for (const keyword of DOCUMENT_KEYWORDS.negativeIndicators) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      breakdown.negativeIndicators -= 2;
      matchedKeywords.push(`[NEGATIVE] ${keyword}`);
    }
  }

  // Attachment bonus (+2 points if email has attachments)
  if (hasAttachments) {
    breakdown.hasAttachments = 2;
    matchedKeywords.push('[HAS ATTACHMENTS]');
  }

  // Calculate total score
  const score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  // Threshold: 2+ points = documents detected
  const documentsDetected = score >= 2.0;

  return {
    score,
    documentsDetected,
    breakdown,
    matchedKeywords,
  };
}

/**
 * Helper: Extract filing type from email text using UK accounting keywords
 *
 * Returns the most likely filing_type_id based on keywords in subject/body.
 * Returns null if no clear filing type is detected.
 */
export function detectFilingType(
  subject: string | null,
  body: string | null
): string | null {
  const normalizedText = [subject, body]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Priority order: check most specific keywords first

  // VAT Return
  if (
    normalizedText.includes('vat') &&
    (normalizedText.includes('return') ||
     normalizedText.includes('quarter') ||
     normalizedText.includes('quarterly'))
  ) {
    return 'vat_return';
  }

  // Corporation Tax
  if (
    normalizedText.includes('corporation tax') ||
    normalizedText.includes('corp tax') ||
    normalizedText.includes('ct600')
  ) {
    // Distinguish between payment and filing
    if (normalizedText.includes('payment') || normalizedText.includes('pay')) {
      return 'corporation_tax_payment';
    }
    if (normalizedText.includes('return') || normalizedText.includes('filing') || normalizedText.includes('ct600')) {
      return 'ct600_filing';
    }
    // Default to payment if ambiguous
    return 'corporation_tax_payment';
  }

  // Companies House
  if (
    normalizedText.includes('companies house') ||
    normalizedText.includes('annual accounts') ||
    normalizedText.includes('confirmation statement')
  ) {
    return 'companies_house';
  }

  // Self Assessment
  if (
    normalizedText.includes('self assessment') ||
    normalizedText.includes('sa302') ||
    (normalizedText.includes('tax return') &&
     (normalizedText.includes('personal') || normalizedText.includes('individual')))
  ) {
    return 'self_assessment';
  }

  // No clear filing type detected
  return null;
}
