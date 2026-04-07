-- Downtime risk: MODERATE — requires backfill; may lock during constraint application
-- 19 March 2026: Feedback-driven deadline and document requirement updates
-- Partnership: only Partnership Tax Return + VAT Return
-- Individual: only Self Assessment, MTD Quarterly Return, SA Payment on Account, Trust Tax Return
-- Rename MTD Quarterly Update → MTD Quarterly Return
-- Restructure document requirements for CT600, Companies House, Confirmation Statement,
-- Partnership Tax Return, and Self Assessment

-- ============================================================================
-- 1. Rename MTD Quarterly Update → MTD Quarterly Return
-- ============================================================================

UPDATE filing_types
SET name = 'MTD Quarterly Return',
    description = 'HMRC Making Tax Digital quarterly submission'
WHERE id = 'mtd_quarterly_update';

-- ============================================================================
-- 2. Partnership: only partnership_tax_return + vat_return
--    Remove 'Partnership' from all other filing types
-- ============================================================================

UPDATE filing_types
SET applicable_client_types = array_remove(applicable_client_types, 'Partnership')
WHERE id IN (
  'self_assessment', 'mtd_quarterly_update', 'p11d_filing',
  'paye_monthly', 'cis_monthly_return', 'payroll_year_end', 'sa_payment_on_account'
)
AND 'Partnership' = ANY(applicable_client_types);

-- ============================================================================
-- 3. Individual: only self_assessment, mtd_quarterly_update, sa_payment_on_account, trust_tax_return
--    Remove 'Individual' from: vat_return, paye_monthly, cis_monthly_return, payroll_year_end
-- ============================================================================

UPDATE filing_types
SET applicable_client_types = array_remove(applicable_client_types, 'Individual')
WHERE id IN ('vat_return', 'paye_monthly', 'cis_monthly_return', 'payroll_year_end')
AND 'Individual' = ANY(applicable_client_types);

-- ============================================================================
-- 4. Swap sort_order: Companies House (2) above CT600 (3)
-- ============================================================================

UPDATE filing_types SET sort_order = 2 WHERE id = 'companies_house';
UPDATE filing_types SET sort_order = 3 WHERE id = 'ct600_filing';

-- ============================================================================
-- 5. Update Bank Statements description to mention CSV/Excel
-- ============================================================================

UPDATE document_types
SET description = 'Bank statements for all accounts held in the tax year. Provide full year transaction download in Excel or CSV format.'
WHERE code = 'BANK_STATEMENT';

-- ============================================================================
-- 6. Update Rental Income description to questionnaire style
-- ============================================================================

UPDATE document_types
SET description = 'Complete our rental income questionnaire covering all rental properties, income received, and allowable expenses.'
WHERE code = 'RENTAL_INCOME';

-- ============================================================================
-- 7. New document types
-- ============================================================================

INSERT INTO document_types (code, label, description, default_retention_years, expected_mime_types)
VALUES
  ('MILEAGE_LOG',
   'Mileage Log',
   'Log of business miles driven during the period, including dates, destinations, and purpose of each journey.',
   5,
   ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/csv']),

  ('SA_QUESTIONNAIRE',
   'Self-Assessment Questionnaire',
   'Complete our questionnaire on standard sections such as donations, pension contributions, etc.',
   5,
   ARRAY['application/pdf', 'image/jpeg', 'image/png']),

  ('ADJUSTMENTS',
   'Adjustments',
   'Schedule of business transactions paid/received from personal accounts which need including in the accounts.',
   6,
   ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/csv']),

  ('COMPANY_CHANGES',
   'Company Changes',
   'Confirmation of any changes to the share register and shareholder details, PSC register, directors, or registered office address.',
   6,
   ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 8. CT600 Filing: Remove Statutory Accounts and Bank Statements
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'ct600_filing'
  AND document_type_id IN (
    SELECT id FROM document_types WHERE code IN ('CT600_ACCOUNTS', 'BANK_STATEMENT')
  );

-- ============================================================================
-- 9. Companies House Accounts: Restructure
--    Remove: CH_ACCOUNTS, CONFIRMATION_STATEMENT, PSC_REGISTER
--    Add: BANK_STATEMENT, DIVIDEND_VOUCHER, LOAN_STATEMENTS, FIXED_ASSET_REGISTER, ADJUSTMENTS
--    Keep: SHARE_REGISTER (already there)
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'companies_house'
  AND document_type_id IN (
    SELECT id FROM document_types WHERE code IN ('CH_ACCOUNTS', 'CONFIRMATION_STATEMENT', 'PSC_REGISTER')
  );

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, true FROM document_types WHERE code = 'BANK_STATEMENT'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, false FROM document_types WHERE code = 'DIVIDEND_VOUCHER'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, false FROM document_types WHERE code = 'LOAN_STATEMENTS'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, false FROM document_types WHERE code = 'FIXED_ASSET_REGISTER'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, false FROM document_types WHERE code = 'ADJUSTMENTS'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 10. Confirmation Statement: Replace with single Company Changes item
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'confirmation_statement';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'confirmation_statement', id, true FROM document_types WHERE code = 'COMPANY_CHANGES'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 11. Partnership Tax Return: Remove Rental Income, Add Mileage Log
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'partnership_tax_return'
  AND document_type_id IN (
    SELECT id FROM document_types WHERE code = 'RENTAL_INCOME'
  );

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'partnership_tax_return', id, false FROM document_types WHERE code = 'MILEAGE_LOG'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 12. Self Assessment: Restructure
--     Remove: SA302, DIVIDEND_VOUCHER, SELF_EMPLOYMENT, PENSION_LETTER, GIFT_AID
--     Add: SA_QUESTIONNAIRE, ADJUSTMENTS
--     Keep: P60, P45, P11D, BANK_STATEMENT, RENTAL_INCOME
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'self_assessment'
  AND document_type_id IN (
    SELECT id FROM document_types
    WHERE code IN ('SA302', 'DIVIDEND_VOUCHER', 'SELF_EMPLOYMENT', 'PENSION_LETTER', 'GIFT_AID')
  );

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'SA_QUESTIONNAIRE'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'ADJUSTMENTS'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- Re-ensure P45, P11D, RENTAL_INCOME remain mapped (guard against prior migration gaps)
INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'P45'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'P11D'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'RENTAL_INCOME'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 13. VAT Return: Remove Purchase Invoices and Sales Invoices
-- ============================================================================

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'vat_return'
  AND document_type_id IN (
    SELECT id FROM document_types WHERE code IN ('PURCHASE_INVOICES', 'SALES_INVOICES')
  );
