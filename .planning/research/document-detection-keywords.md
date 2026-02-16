# Document Detection Keywords

Comprehensive list of keywords and phrases indicating clients are sending documents/records via email.

## Research Sources
- [How to write an email sending documents](https://www.maestrolabs.com/how-to/email-for-sending-documents)
- [Email Templates for Sending Documents](https://blaze.today/blog/sample-email-sending-documents/)
- [Professional Ways to say 'Please Find Attached'](https://blaze.today/blog/please-find-attached/)
- [Accounting Email Templates](https://www.acecloudhosting.com/blog/email-templates-for-accounting-business/)
- [Must-Have Accounting Email Templates](https://getuku.com/articles/11-must-have-email-templates-for-accounting-practices)

## Core Attachment Keywords

### Direct References
- attached
- attachment
- attachments
- file attached
- files attached
- enclosed
- enclosure
- enclosures
- see attached
- pfa (please find attached)
- find attached
- please find attached
- attached please find
- kindly find attached
- attached herewith
- herewith attached

### Modern Casual Variants
- here's the
- here is the
- i've attached
- ive attached
- i have attached
- sending you
- sent you
- sharing the
- shared the
- forwarding
- forwarded

## Document Type Keywords

### General Documents
- document
- documents
- documentation
- doc
- docs
- file
- files
- paperwork
- records

### Accounting-Specific Documents (UK Context)
- invoice
- invoices
- receipt
- receipts
- vat receipt
- vat receipts
- purchase invoice
- sales invoice
- credit note
- debit note
- pro forma
- statement
- bank statement
- payslip
- payslips
- p60
- p45
- p11d
- sa302
- tax calculation
- tax return
- accounts
- annual accounts
- management accounts

### Spreadsheet/Data Files
- spreadsheet
- excel
- xlsx
- csv
- workbook
- xls
- pdf

### UK Spelling Variants
- organisation (vs organization)
- summarise (vs summarize)
- analyse (vs analyze)

## Action Keywords (Sending Intent)

### Present/Past Actions
- sending
- sent
- submitting
- submitted
- providing
- provided
- uploading
- uploaded
- attaching
- returning
- returned
- completing
- completed
- emailing
- forwarding
- forwarded
- sharing
- shared

### Instructions/Requests
- here's
- here is
- herewith
- enclosed is
- enclosed are
- as requested
- as discussed
- as promised
- per your request
- following up with
- attached is
- attached are

## Context Phrases (Multi-word)

### Formal Business Phrases
- please find attached
- attached please find
- kindly find attached
- i have attached
- i've attached
- please see attached
- see attached
- attached herewith
- enclosed herewith
- for your review
- for your attention
- for your records
- for your information

### Casual/Direct Phrases
- here's the file
- here is the file
- sending over
- sent over
- attached the
- attaching the
- enclosed the
- files attached
- documents attached
- spreadsheet attached

### UK-Specific Accounting Phrases
- vat return attached
- year end accounts
- tax documents
- hmrc documents
- companies house
- quarterly returns
- self assessment
- corporation tax

## Common Typos & Variations

### Spelling Mistakes
- atached (missing t)
- attachd (missing e)
- attched (missing a)
- receit (missing p)
- recipt (wrong order)
- recpt (missing ei)
- invioce (wrong order)
- invoce (missing i)
- spreedsheet (extra e)
- exel (missing c)
- documnet (wrong order)
- docuemnt (wrong order)

### Abbreviations
- pfa (please find attached)
- fyi (for your information)
- fya (for your attention)
- fyr (for your review)
- doc/docs
- inv (invoice)
- rcpt (receipt)

## Subject Line Patterns

### Common Subject Lines
- documents for [period]
- [company name] records
- vat quarter [x]
- invoices and receipts
- monthly returns
- year end [year]
- accounts submission
- tax documents [year]
- quarterly records
- expenses for [month/period]

## Casual/Client Language

### Informal Variants (common in client emails)
- got the
- have the
- sending
- here you go
- as discussed
- like you asked
- what you needed
- the stuff
- everything from

## Negatives (Absence of these suggests NOT sending documents)

### Question/Request Indicators (NOT sending)
- can you send
- could you send
- please send
- need help with
- question about
- when is
- what's the deadline
- reminder about
- thanks for
- got your email
- received your

## Recommended Detection Strategy

1. **High confidence** (2+ points):
   - Explicit attachment words (attached, attachment, enclosed) + document type
   - "Please find attached" + specific document name
   - File extension mentions (.pdf, .xlsx, .csv)

2. **Medium confidence** (1 point):
   - Document type keywords without attachment language
   - Action verbs (sending, submitting) + context
   - "Here's the" or "sending you" phrases

3. **Low confidence** (0.5 points):
   - Generic phrases that could indicate documents
   - Subject line matches without body confirmation

4. **Context boosters** (+0.5 points):
   - Email has attachments (detected by email service)
   - Reply to previous reminder email
   - Date/period references matching client's obligations

## Notes

- **UK spelling matters**: Organisation not organization, summarise not summarize
- **Case insensitive**: All matching should be case-insensitive
- **Partial matching**: Consider partial word matches (e.g., "attach" catches "attached", "attachment", "attaching")
- **Client behavior**: Accountants report clients usually ONLY reply when sending documents (not for general questions)
- **Common pattern**: Clients often send very brief emails ("Here's the Q3 invoices") with documents attached
- **Typos are common**: Include common misspellings especially for "attached" and "receipt"

## Implementation Considerations

```typescript
// Suggested scoring system
const KEYWORD_SCORES = {
  HIGH_CONFIDENCE: ['attached', 'attachment', 'enclosed', 'please find attached'],
  MEDIUM_CONFIDENCE: ['invoice', 'receipt', 'spreadsheet', 'sending', 'here\'s the'],
  LOW_CONFIDENCE: ['documents', 'records', 'files', 'paperwork'],
  CONTEXT_BOOSTERS: ['vat', 'tax', 'year end', 'quarterly', 'hmrc']
};

// Threshold: 2+ points = likely document submission
// Check: hasAttachments (email metadata) adds +2 points
```

## Hardcoded TypeScript Array for Implementation

```typescript
// Use for keyword detection in email body and subject lines
export const DOCUMENT_KEYWORDS = {
  // High confidence - strong indicators of document sending
  highConfidence: [
    'attached', 'attachment', 'attachments',
    'enclosed', 'enclosure', 'enclosures',
    'please find attached', 'pfa', 'find attached',
    'see attached', 'attached please find',
    'kindly find attached', 'attached herewith',
    'file attached', 'files attached',
  ],

  // Medium confidence - likely document sending
  mediumConfidence: [
    'invoice', 'invoices', 'receipt', 'receipts',
    'spreadsheet', 'excel', 'xlsx', 'csv',
    "here's the", 'here is the', 'sending you',
    'sent you', "i've attached", 'i have attached',
    'sharing the', 'forwarding', 'forwarded',
    'sending over', 'sent over',
  ],

  // Document types - accounting specific
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

  // Action verbs - sending intent
  actionVerbs: [
    'sending', 'sent', 'submitting', 'submitted',
    'providing', 'provided', 'uploading', 'uploaded',
    'attaching', 'returning', 'returned',
    'completing', 'completed', 'sharing', 'shared',
  ],

  // Common typos to catch
  typos: [
    'atached', 'attachd', 'attched', // attached variants
    'receit', 'recipt', 'recpt', // receipt variants
    'invioce', 'invoce', // invoice variants
    'spreedsheet', 'exel', // spreadsheet/excel variants
    'documnet', 'docuemnt', // document variants
  ],

  // Context phrases - UK accounting specific
  contextPhrases: [
    'vat return', 'year end', 'tax documents',
    'hmrc documents', 'companies house',
    'quarterly returns', 'self assessment',
    'corporation tax', 'as requested', 'as discussed',
    'for your review', 'for your records',
  ],

  // Negative indicators - NOT sending documents
  negativeIndicators: [
    'can you send', 'could you send', 'please send',
    'need help', 'question about', 'when is',
    "what's the deadline", 'reminder about',
  ],
};
```
