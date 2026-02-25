/**
 * Type declarations for pdf-parse-debugging-disabled.
 *
 * This package is a fork of pdf-parse that suppresses debug output
 * to avoid test noise. The API is identical to pdf-parse.
 */
declare module 'pdf-parse-debugging-disabled' {
  interface PDFInfo {
    PDFFormatVersion?: string;
    IsAcroFormPresent?: boolean;
    IsXFAPresent?: boolean;
    [key: string]: unknown;
  }

  interface PDFMetadata {
    [key: string]: unknown;
  }

  interface PDFData {
    /** Number of pages in the PDF. */
    numpages: number;
    /** Number of rendered pages (may differ from numpages for partial parses). */
    numrender: number;
    /** PDF info dictionary. */
    info: PDFInfo;
    /** PDF XMP metadata. */
    metadata: PDFMetadata | null;
    /** Extracted text content. */
    text: string;
    /** pdf-parse library version. */
    version: string;
  }

  interface PDFParseOptions {
    /** Maximum number of pages to parse (0 = all). */
    max?: number;
    /** Custom page rendering function. */
    pagerender?: (pageData: unknown) => Promise<string>;
  }

  /**
   * Parse a PDF buffer and extract text content and metadata.
   *
   * @throws Error when the PDF is encrypted, corrupt, or otherwise unparseable.
   */
  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: PDFParseOptions
  ): Promise<PDFData>;

  export = pdfParse;
}
