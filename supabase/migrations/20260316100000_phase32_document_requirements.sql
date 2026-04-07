-- Downtime risk: NONE — safe for zero-downtime deployment
-- Phase 32: Document requirements for the 9 new filing types
-- 2 filing types are payment-only (paye_monthly, sa_payment_on_account) — no documents needed.
-- 1 new document_type added for CIS (no existing type covers subcontractor statements).

-- ============================================================================
-- 1. New document type: CIS Subcontractor Payment Statements
-- ============================================================================

INSERT INTO document_types (code, label, description, default_retention_years, expected_mime_types)
VALUES (
  'CIS_SUBCONTRACTOR_STATEMENTS',
  'CIS Subcontractor Payment Statements',
  'Payment and deduction statements for each subcontractor paid during the CIS period, showing gross payments, CIS deductions made, and net amounts.',
  6,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. filing_document_requirements for mtd_quarterly_update
--    Sole Trader / Partnership quarterly income & expense records for MTD
-- ============================================================================

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'mtd_quarterly_update', id, true  FROM document_types WHERE code = 'SELF_EMPLOYMENT'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'mtd_quarterly_update', id, false FROM document_types WHERE code = 'BANK_STATEMENT'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 3. filing_document_requirements for confirmation_statement
--    Companies House Confirmation Statement — officer details, PSC, shares
-- ============================================================================

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'confirmation_statement', id, true  FROM document_types WHERE code = 'CONFIRMATION_STATEMENT'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'confirmation_statement', id, true  FROM document_types WHERE code = 'PSC_REGISTER'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'confirmation_statement', id, false FROM document_types WHERE code = 'SHARE_REGISTER'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 4. filing_document_requirements for p11d_filing
--    Benefits & expenses return — P11D form records + payroll summary
-- ============================================================================

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'p11d_filing', id, true  FROM document_types WHERE code = 'P11D'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'p11d_filing', id, false FROM document_types WHERE code = 'PAYROLL_SUMMARY'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 5. filing_document_requirements for cis_monthly_return
--    CIS monthly return — subcontractor payment & deduction records
-- ============================================================================

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'cis_monthly_return', id, true FROM document_types WHERE code = 'CIS_SUBCONTRACTOR_STATEMENTS'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 6. filing_document_requirements for payroll_year_end
--    Final FPS/EPS submission — full payroll summary + optional P11D if benefits exist
-- ============================================================================

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'payroll_year_end', id, true  FROM document_types WHERE code = 'PAYROLL_SUMMARY'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'payroll_year_end', id, false FROM document_types WHERE code = 'P11D'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 7. filing_document_requirements for partnership_tax_return (SA800)
--    Partnership income/expenses + bank statements; rental income if applicable
-- ============================================================================

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'partnership_tax_return', id, true  FROM document_types WHERE code = 'SELF_EMPLOYMENT'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'partnership_tax_return', id, true  FROM document_types WHERE code = 'BANK_STATEMENT'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'partnership_tax_return', id, false FROM document_types WHERE code = 'RENTAL_INCOME'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- ============================================================================
-- 8. filing_document_requirements for trust_tax_return (SA900)
--    Trust bank statements mandatory; dividends/rental income if applicable
-- ============================================================================

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'trust_tax_return', id, true  FROM document_types WHERE code = 'BANK_STATEMENT'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'trust_tax_return', id, false FROM document_types WHERE code = 'DIVIDEND_VOUCHER'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'trust_tax_return', id, false FROM document_types WHERE code = 'RENTAL_INCOME'
ON CONFLICT (filing_type_id, document_type_id) DO NOTHING;

-- Note: paye_monthly and sa_payment_on_account are payment-only deadlines —
-- no client-submitted documents are collected for either.
