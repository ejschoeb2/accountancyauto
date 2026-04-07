-- Downtime risk: MODERATE — requires backfill; may lock during constraint application
-- 20 March 2026: Document requirement refinements from user feedback
--
-- 1. Add sort_order + description_override columns to filing_document_requirements
-- 2. Remove SHARE_REGISTER from companies_house
-- 3. Strip CT600 down to Tax Computation Workings only
-- 4. Rename ADJUSTMENTS → "Sole Trader Records"
-- 5. Move SA_QUESTIONNAIRE to top of self_assessment list
-- 6. Create PARTNERSHIP_INCOME doc type, replace SELF_EMPLOYMENT on partnership_tax_return
-- 7. Fix MTD bank statement description to say "quarter" not "tax year"

-- ============================================================================
-- 1. Schema additions
-- ============================================================================

ALTER TABLE filing_document_requirements
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;

ALTER TABLE filing_document_requirements
  ADD COLUMN IF NOT EXISTS description_override TEXT;

-- ============================================================================
-- 2. Remove SHARE_REGISTER from companies_house
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'companies_house'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'SHARE_REGISTER');

-- ============================================================================
-- 3. Strip CT600 down to Tax Computation Workings only
--    Remove: PAYROLL_SUMMARY, DIVIDEND_VOUCHER, LOAN_STATEMENTS,
--            FIXED_ASSET_REGISTER, SHARE_REGISTER
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'ct600_filing'
  AND document_type_id IN (
    SELECT id FROM document_types
    WHERE code IN ('PAYROLL_SUMMARY', 'DIVIDEND_VOUCHER', 'LOAN_STATEMENTS',
                   'FIXED_ASSET_REGISTER', 'SHARE_REGISTER')
  );

-- ============================================================================
-- 4. Rename ADJUSTMENTS → "Sole Trader Records"
-- ============================================================================

UPDATE document_types
SET label = 'Sole Trader Records',
    description = 'Working papers for sole trader business — personal account transactions, cash expenses, and adjustments to include in the accounts.'
WHERE code = 'ADJUSTMENTS';

-- ============================================================================
-- 5. SA_QUESTIONNAIRE to top of self_assessment list
-- ============================================================================

UPDATE filing_document_requirements
SET sort_order = 1
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'SA_QUESTIONNAIRE');

-- Set remaining self_assessment docs to preserve rough logical order
UPDATE filing_document_requirements
SET sort_order = 10
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'BANK_STATEMENT');

UPDATE filing_document_requirements
SET sort_order = 20
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'P60');

UPDATE filing_document_requirements
SET sort_order = 30
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'P45');

UPDATE filing_document_requirements
SET sort_order = 40
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'P11D');

UPDATE filing_document_requirements
SET sort_order = 50
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'RENTAL_INCOME');

UPDATE filing_document_requirements
SET sort_order = 60
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'ADJUSTMENTS');

-- ============================================================================
-- 6. Partnership Tax Return: replace SELF_EMPLOYMENT with new PARTNERSHIP_INCOME
-- ============================================================================

INSERT INTO document_types (code, label, description, default_retention_years, expected_mime_types)
VALUES (
  'PARTNERSHIP_INCOME',
  'Partnership Income and Expenses',
  'Income and expense records for the partnership — revenue, costs, and profit allocation between partners.',
  5,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/csv']
)
ON CONFLICT (code) DO NOTHING;

-- Remove SELF_EMPLOYMENT from partnership_tax_return
DELETE FROM filing_document_requirements
WHERE filing_type_id = 'partnership_tax_return'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'SELF_EMPLOYMENT');

-- Add PARTNERSHIP_INCOME to partnership_tax_return
INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory, sort_order)
SELECT 'partnership_tax_return', id, true, 1 FROM document_types WHERE code = 'PARTNERSHIP_INCOME'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 7. MTD Quarterly: bank statements "for the quarter" override
-- ============================================================================

UPDATE filing_document_requirements
SET description_override = 'Bank statements for the quarter — full transaction download covering the submission period.'
WHERE filing_type_id = 'mtd_quarterly_update'
  AND document_type_id IN (SELECT id FROM document_types WHERE code = 'BANK_STATEMENT');
