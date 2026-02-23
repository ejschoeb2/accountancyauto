-- Phase 18: Document Collection Foundation - Seed Data
-- Part 1: INSERT 23 document_types rows (HMRC document catalog)
-- Part 2: INSERT 27 filing_document_requirements rows mapping documents to filing types
--
-- Retention years:
--   5 years: SA100-specific individual documents (P60, P45, P11D, SA302, RENTAL_INCOME,
--            SELF_EMPLOYMENT, PENSION_LETTER, GIFT_AID)
--   6 years: All company documents (CT600, VAT, Companies House) and shared documents
--            (BANK_STATEMENT, DIVIDEND_VOUCHER, SHARE_REGISTER)
--
-- expected_mime_types: BANK_STATEMENT also accepts text/csv; all others: pdf + jpeg + png

-- ============================================================================
-- Part 1: document_types (23 rows)
-- ============================================================================

INSERT INTO document_types (code, label, description, default_retention_years, expected_mime_types) VALUES

-- SA100 / Individual filing documents (5-year retention)
('P60',
 'P60 End-of-Year Certificate',
 'Your employer provides this after the tax year ends in April. It shows your total pay and tax deducted.',
 5,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('P45',
 'P45 Details of Employee Leaving Work',
 'Provided by your employer when you leave a job. Shows pay and tax to the date of leaving.',
 5,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('P11D',
 'P11D Expenses and Benefits',
 'Issued by your employer if you received benefits such as a company car, private medical insurance, or loans.',
 5,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('SA302',
 'SA302 Tax Calculation',
 'A summary of your income and tax liability produced by HMRC. Download from your HMRC online account or request by post.',
 5,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('RENTAL_INCOME',
 'Rental Income Records',
 'Records of all rental income received and allowable expenses paid during the tax year.',
 5,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('SELF_EMPLOYMENT',
 'Self-Employment Income and Expenses',
 'Sales records, expense receipts, and mileage logs if you are self-employed or a sole trader.',
 5,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('PENSION_LETTER',
 'Pension Award Letters',
 'Letters confirming pension income from any private or state pension received during the year.',
 5,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('GIFT_AID',
 'Gift Aid Records',
 'Records of charitable donations made under Gift Aid. Your charity should provide a receipt.',
 5,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

-- Shared documents used across multiple filing types (6-year retention)
('BANK_STATEMENT',
 'Bank Statements',
 'Bank statements for all accounts held in the tax year. Provide full year statements for all current and savings accounts.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/csv']),

('DIVIDEND_VOUCHER',
 'Dividend Vouchers',
 'Vouchers issued for dividends received during the tax year. Your company secretary or registrar provides these.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('SHARE_REGISTER',
 'Share Register and Shareholder Details',
 'Current share register showing all shareholders, share classes, and beneficial ownership.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

-- CT600 / Corporation Tax documents (6-year retention)
('CT600_ACCOUNTS',
 'Statutory Accounts',
 'Signed statutory accounts (profit and loss account and balance sheet) for the accounting period.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('CT600_TAX_COMPUTATION',
 'Tax Computation Workings',
 'Detailed tax computation showing the calculation of Corporation Tax liability.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('PAYROLL_SUMMARY',
 'Payroll Summary (P32/P11D)',
 'PAYE payroll records for the period, including employer and employee NICs paid.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('LOAN_STATEMENTS',
 'Loan and Director Loan Statements',
 'Statements for any company loans, including director''s loan account balances.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('FIXED_ASSET_REGISTER',
 'Fixed Asset Register',
 'Schedule of fixed assets held, additions, disposals, and depreciation for the period.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

-- VAT documents (6-year retention)
('VAT_RETURN_WORKINGS',
 'VAT Return Workings',
 'Working papers supporting the VAT figures: output tax schedules, input tax schedules, and reconciliation.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('PURCHASE_INVOICES',
 'Purchase Invoices',
 'All VAT-registered purchase invoices and receipts for the period.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('SALES_INVOICES',
 'Sales Invoices',
 'All sales invoices raised during the VAT period with VAT breakdown.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('FUEL_SCALE_CHARGE',
 'Fuel Scale Charge Record',
 'Evidence of the fuel scale charge applied if the company provides fuel for private use.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

-- Companies House documents (6-year retention)
('CH_ACCOUNTS',
 'Companies House Annual Accounts',
 'Filleted or abridged accounts filed at Companies House. Typically prepared from the full statutory accounts.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('CONFIRMATION_STATEMENT',
 'Confirmation Statement Information',
 'Current officer details, registered office address, share structure, and PSC register for the Confirmation Statement.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']),

('PSC_REGISTER',
 'Persons with Significant Control Register',
 'Register of all persons or entities with significant control over the company.',
 6,
 ARRAY['application/pdf', 'image/jpeg', 'image/png']);

-- ============================================================================
-- Part 2: filing_document_requirements (27 rows)
-- Uses subqueries to resolve document_type UUIDs by code (avoids hardcoding IDs)
-- ============================================================================

-- SA100 (self_assessment) — 10 rows
INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'P60';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'P45';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'P11D';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'SA302';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, true FROM document_types WHERE code = 'BANK_STATEMENT';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'DIVIDEND_VOUCHER';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'RENTAL_INCOME';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'SELF_EMPLOYMENT';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'PENSION_LETTER';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'self_assessment', id, false FROM document_types WHERE code = 'GIFT_AID';

-- CT600 (ct600_filing) — 8 rows
INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'ct600_filing', id, true FROM document_types WHERE code = 'CT600_ACCOUNTS';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'ct600_filing', id, true FROM document_types WHERE code = 'CT600_TAX_COMPUTATION';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'ct600_filing', id, true FROM document_types WHERE code = 'BANK_STATEMENT';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'ct600_filing', id, false FROM document_types WHERE code = 'PAYROLL_SUMMARY';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'ct600_filing', id, false FROM document_types WHERE code = 'DIVIDEND_VOUCHER';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'ct600_filing', id, false FROM document_types WHERE code = 'LOAN_STATEMENTS';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'ct600_filing', id, false FROM document_types WHERE code = 'FIXED_ASSET_REGISTER';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'ct600_filing', id, false FROM document_types WHERE code = 'SHARE_REGISTER';

-- VAT (vat_return) — 5 rows
INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'vat_return', id, true FROM document_types WHERE code = 'VAT_RETURN_WORKINGS';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'vat_return', id, true FROM document_types WHERE code = 'PURCHASE_INVOICES';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'vat_return', id, true FROM document_types WHERE code = 'SALES_INVOICES';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'vat_return', id, true FROM document_types WHERE code = 'BANK_STATEMENT';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'vat_return', id, false FROM document_types WHERE code = 'FUEL_SCALE_CHARGE';

-- Companies House (companies_house) — 4 rows
INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, true FROM document_types WHERE code = 'CH_ACCOUNTS';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, true FROM document_types WHERE code = 'CONFIRMATION_STATEMENT';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, true FROM document_types WHERE code = 'PSC_REGISTER';

INSERT INTO filing_document_requirements (filing_type_id, document_type_id, is_mandatory)
SELECT 'companies_house', id, false FROM document_types WHERE code = 'SHARE_REGISTER';

-- Note: corporation_tax_payment is payment deadline only — no client-submitted documents
-- mapped to it per RESEARCH.md open question resolution
