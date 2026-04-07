-- Downtime risk: MODERATE — requires backfill; may lock during constraint application
-- 2026-04-07: Beta tester wording improvements for document requirements
--
-- 1. Rename ADJUSTMENTS label 'Sole Trader Records' → 'Working Papers'
-- 2. Update Fixed Asset Register description (dates/amounts, not depreciation)
-- 3. Update Bank Statements description to emphasise all accounts
-- 4. VAT Return: update bank statement description_override
-- 5. CT600 Filing: add Client Approval document requirement
-- 6. Self Assessment: remove generic BANK_STATEMENT, add SOLE_TRADER_BANK_STATEMENTS at bottom
-- 7. MTD Quarterly Return: replace BANK_STATEMENT with SOLE_TRADER_BANK_STATEMENTS (quarterly),
--    add Rental Income Records

-- ============================================================================
-- 1. Rename ADJUSTMENTS label: 'Sole Trader Records' → 'Working Papers'
-- ============================================================================

UPDATE document_types
SET label = 'Working Papers',
    description = 'Working papers for the period — personal account transactions and adjustments to include in the accounts.'
WHERE code = 'ADJUSTMENTS';

-- ============================================================================
-- 2. Update Fixed Asset Register description
-- ============================================================================

UPDATE document_types
SET description = 'Asset additions and disposals, including dates and amounts — depreciation is calculated by the accountant.'
WHERE code = 'FIXED_ASSET_REGISTER';

-- ============================================================================
-- 3. Update Bank Statements description to emphasise all accounts
-- ============================================================================

UPDATE document_types
SET description = 'Full year bank transaction download for all bank accounts (CSV or Excel preferred)'
WHERE code = 'BANK_STATEMENT';

UPDATE document_types
SET client_description = 'Please provide bank statements for all bank accounts held during the period (current, savings, and any other accounts). A full transaction download in CSV or Excel format is preferred — most banks let you export this from online banking under "Statements" or "Download transactions".'
WHERE code = 'BANK_STATEMENT';

-- ============================================================================
-- 4. VAT Return: update BANK_STATEMENT description_override
-- ============================================================================

UPDATE filing_document_requirements
SET description_override = 'VAT quarter bank transaction download for all relevant accounts (CSV or Excel preferred)'
WHERE filing_type_id = 'vat_return'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'BANK_STATEMENT');

-- ============================================================================
-- 5. CT600 Filing: add Client Approval document type and requirement
-- ============================================================================

INSERT INTO document_types (code, label, description, client_description, default_retention_years, expected_mime_types)
VALUES (
  'CLIENT_APPROVAL',
  'Client Approval',
  'Approval of CT600 submission to HMRC',
  'Please review the CT600 corporation tax return and confirm your approval for us to submit it to HMRC.',
  6,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory, sort_order)
SELECT 'ct600_filing', id, true, 110 FROM document_types WHERE code = 'CLIENT_APPROVAL'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 6. New document type: Sole Trader Bank Statements
-- ============================================================================

INSERT INTO document_types (code, label, description, client_description, default_retention_years, expected_mime_types)
VALUES (
  'SOLE_TRADER_BANK_STATEMENTS',
  'Sole Trader Bank Statements',
  'Bank transaction download for the sole trader bank account (CSV or Excel preferred)',
  'Please provide a transaction download from your sole trader bank account. Most banks let you export transactions from online banking in CSV or Excel format.',
  6,
  ARRAY['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 7. Self Assessment: remove generic BANK_STATEMENT, add SOLE_TRADER_BANK_STATEMENTS
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'BANK_STATEMENT');

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory, sort_order, description_override)
SELECT 'self_assessment', id, false, 70,
       'Full year transaction download for sole trader bank account (CSV or Excel preferred)'
FROM document_types WHERE code = 'SOLE_TRADER_BANK_STATEMENTS'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 8. MTD Quarterly Return: replace BANK_STATEMENT with SOLE_TRADER_BANK_STATEMENTS,
--    add Rental Income Records
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'mtd_quarterly_update'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'BANK_STATEMENT');

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory, sort_order, description_override)
SELECT 'mtd_quarterly_update', id, false, 20,
       'Quarterly download for sole trader bank account (CSV or Excel preferred)'
FROM document_types WHERE code = 'SOLE_TRADER_BANK_STATEMENTS'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory, sort_order)
SELECT 'mtd_quarterly_update', id, false, 30
FROM document_types WHERE code = 'RENTAL_INCOME'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;
