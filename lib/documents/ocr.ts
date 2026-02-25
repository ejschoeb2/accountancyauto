import pdfParse from 'pdf-parse-debugging-disabled';

/**
 * Result of extracting text from a PDF buffer via pdf-parse.
 */
export interface OcrResult {
  /** Raw extracted text from the PDF. */
  text: string;
  /** Number of pages in the PDF. */
  numpages: number;
  /**
   * True when the extracted text is near-empty relative to page count.
   * Indicates a scanned/image-only PDF that cannot be read by pdf-parse alone.
   *
   * Threshold: text.trim().length < 50 characters per page.
   */
  isImageOnly: boolean;
}

/**
 * Extracted field values from a document's text content.
 */
export interface ExtractedFields {
  taxYear: string | null;
  employer: string | null;
  payeRef: string | null;
}

/**
 * Extract text content from a PDF buffer.
 *
 * @throws Re-throws any error from pdf-parse (corrupt or password-protected PDF).
 *         The caller is responsible for treating a thrown error as a corrupt PDF signal.
 */
export async function extractPdfText(buffer: Buffer): Promise<OcrResult> {
  // May throw for corrupt/encrypted PDFs — intentionally not caught here
  const parsed = await pdfParse(buffer);

  const text = parsed.text as string;
  const numpages = parsed.numpages as number;

  // Image-only detection: fewer than 50 meaningful chars per page suggests
  // the PDF contains scanned images rather than selectable text
  const isImageOnly = text.trim().length < 50 * Math.max(numpages, 1);

  return { text, numpages, isImageOnly };
}

/**
 * Extract structured fields from raw PDF text for a given HMRC document type.
 *
 * Normalises whitespace before applying regex patterns so multi-line labels
 * are matched reliably after pdf-parse flattens line breaks.
 *
 * Supported codes: P60, P45, SA302, P11D.
 * Unknown codes return all-null fields.
 */
export function extractFieldsForType(code: string, rawText: string): ExtractedFields {
  // Normalise: collapse all whitespace runs to a single space for multi-line label matching
  const text = rawText.replace(/\s+/g, ' ');

  switch (code.toUpperCase()) {
    case 'P60': {
      const taxYear = text.match(/Tax year to 5 April (\d{4})/i)?.[1] ?? null;
      // Lazy match stops at a known field label that follows employer name on HMRC forms
      const employerRaw =
        text.match(/Employer'?s? name[:\s]*([A-Za-z0-9 &.,'-]{2,60}?)\s+(?:PAYE|NI |National|Works|\d{3}\/)/i)?.[1] ??
        null;
      const employer = employerRaw ? employerRaw.trim() : null;
      const payeRef =
        text.match(/(?:PAYE reference|Employer'?s? PAYE ref)[:\s]*(\d{3}\/[A-Z0-9]{1,10})/i)?.[1] ?? null;
      return { taxYear, employer, payeRef };
    }

    case 'P45': {
      const taxYear = text.match(/(?:Year|year) to 5 April (\d{4})/i)?.[1] ?? null;
      const employerRaw =
        text.match(/Employer'?s? name[:\s]*([A-Za-z0-9 &.,'-]{2,60}?)\s+(?:PAYE|NI |National|Works|\d{3}\/)/i)?.[1] ??
        null;
      const employer = employerRaw ? employerRaw.trim() : null;
      const payeRef =
        text.match(/(?:Employer PAYE reference|PAYE reference)[:\s]*(\d{3}\/[A-Z0-9]{1,10})/i)?.[1] ?? null;
      return { taxYear, employer, payeRef };
    }

    case 'SA302': {
      // SA302 is individual — no employer or PAYE reference (UTR-based)
      const taxYear = text.match(/Year ended 5 April (\d{4})/i)?.[1] ?? null;
      return { taxYear, employer: null, payeRef: null };
    }

    case 'P11D': {
      const taxYear = text.match(/(?:for the )?[Yy]ear ended 5 April (\d{4})/i)?.[1] ?? null;
      const employerRaw =
        text.match(/Employer'?s? name[:\s]*([A-Za-z0-9 &.,'-]{2,60}?)\s+(?:PAYE|NI |National|Works|\d{3}\/)/i)?.[1] ??
        null;
      const employer = employerRaw ? employerRaw.trim() : null;
      const payeRef =
        text.match(/(?:PAYE reference)[:\s]*(\d{3}\/[A-Z0-9]{1,10})/i)?.[1] ?? null;
      return { taxYear, employer, payeRef };
    }

    default:
      return { taxYear: null, employer: null, payeRef: null };
  }
}
