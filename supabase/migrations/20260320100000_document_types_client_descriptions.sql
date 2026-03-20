-- 20 March 2026: Add client_description column and rewrite description for accountant audience
--
-- description       → short, accountant-appropriate (shown in wizard / settings)
-- client_description → detailed, client-facing (shown in portal checklist and help page)

-- ============================================================================
-- 1. Add client_description column
-- ============================================================================

ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS client_description TEXT;

-- ============================================================================
-- 2. Copy current descriptions into client_description (they're already client-facing)
-- ============================================================================

UPDATE document_types SET client_description = description;

-- ============================================================================
-- 3. Rewrite description to be accountant-appropriate
-- ============================================================================

-- SA100 / Individual
UPDATE document_types SET description = 'End-of-year pay and tax certificate from employer'
WHERE code = 'P60';

UPDATE document_types SET description = 'Leaving certificate — pay and tax to date of departure'
WHERE code = 'P45';

UPDATE document_types SET description = 'Benefits and expenses statement (company car, medical, loans)'
WHERE code = 'P11D';

UPDATE document_types SET description = 'HMRC tax calculation summary — downloadable from client''s HMRC account'
WHERE code = 'SA302';

UPDATE document_types SET description = 'Rental property income, expenses, and allowable deductions'
WHERE code = 'RENTAL_INCOME';

UPDATE document_types SET description = 'Sales, expenses, receipts, and mileage for sole trader activity'
WHERE code = 'SELF_EMPLOYMENT';

UPDATE document_types SET description = 'Private and state pension award letters for the tax year'
WHERE code = 'PENSION_LETTER';

UPDATE document_types SET description = 'Charitable donation receipts made under Gift Aid'
WHERE code = 'GIFT_AID';

UPDATE document_types SET description = 'Full year bank transaction download (CSV or Excel preferred)'
WHERE code = 'BANK_STATEMENT';

UPDATE document_types SET description = 'Dividend vouchers for the tax year'
WHERE code = 'DIVIDEND_VOUCHER';

UPDATE document_types SET description = 'Share register — all shareholders, classes, and beneficial ownership'
WHERE code = 'SHARE_REGISTER';

-- CT600 / Corporation Tax
UPDATE document_types SET description = 'Signed P&L and balance sheet for the accounting period'
WHERE code = 'CT600_ACCOUNTS';

UPDATE document_types SET description = 'Corporation Tax computation workings'
WHERE code = 'CT600_TAX_COMPUTATION';

UPDATE document_types SET description = 'PAYE payroll records and employer/employee NIC summary'
WHERE code = 'PAYROLL_SUMMARY';

UPDATE document_types SET description = 'Company loans and director''s loan account balances'
WHERE code = 'LOAN_STATEMENTS';

UPDATE document_types SET description = 'Asset additions, disposals, and depreciation schedule'
WHERE code = 'FIXED_ASSET_REGISTER';

-- VAT
UPDATE document_types SET description = 'Output/input tax schedules and reconciliation'
WHERE code = 'VAT_RETURN_WORKINGS';

UPDATE document_types SET description = 'VAT purchase invoices and receipts for the period'
WHERE code = 'PURCHASE_INVOICES';

UPDATE document_types SET description = 'Sales invoices with VAT breakdown for the period'
WHERE code = 'SALES_INVOICES';

UPDATE document_types SET description = 'Fuel scale charge evidence (private fuel use)'
WHERE code = 'FUEL_SCALE_CHARGE';

-- Companies House
UPDATE document_types SET description = 'Companies House filleted or abridged accounts'
WHERE code = 'CH_ACCOUNTS';

UPDATE document_types SET description = 'Officer details, registered office, share structure, and PSC register'
WHERE code = 'CONFIRMATION_STATEMENT';

UPDATE document_types SET description = 'Persons with Significant Control register'
WHERE code = 'PSC_REGISTER';

-- Phase 32 types
UPDATE document_types SET description = 'Subcontractor payment and deduction statements for CIS period'
WHERE code = 'CIS_SUBCONTRACTOR_STATEMENTS';

UPDATE document_types SET description = 'Business mileage log — dates, destinations, and journey purpose'
WHERE code = 'MILEAGE_LOG';

UPDATE document_types SET description = 'Standard SA questionnaire — donations, pensions, other income'
WHERE code = 'SA_QUESTIONNAIRE';

UPDATE document_types SET description = 'Sole trader working papers — personal account transactions and adjustments'
WHERE code = 'ADJUSTMENTS';

UPDATE document_types SET description = 'Changes to share register, PSC, directors, or registered office'
WHERE code = 'COMPANY_CHANGES';

UPDATE document_types SET description = 'Partnership income, costs, and profit allocation between partners'
WHERE code = 'PARTNERSHIP_INCOME';

-- ============================================================================
-- 4. Improve client_description where the current text is too technical or terse
-- ============================================================================

UPDATE document_types SET client_description = 'Your employer provides this certificate after the tax year ends in April. It shows your total pay and the tax deducted during the year. You can usually find it on your payroll portal or request it from your employer''s HR department.'
WHERE code = 'P60';

UPDATE document_types SET client_description = 'If you left a job during the tax year, your former employer should have given you a P45. It shows your pay and tax up to the date you left. If you can''t find it, contact your previous employer''s payroll department.'
WHERE code = 'P45';

UPDATE document_types SET client_description = 'If your employer provided benefits such as a company car, private medical insurance, or interest-free loans, they will have issued a P11D form. Check with your employer if you''re unsure whether you received one.'
WHERE code = 'P11D';

UPDATE document_types SET client_description = 'This is a summary of your income and tax produced by HMRC. You can download it from your HMRC online account under "Self Assessment" → "More Self Assessment details" → "Get your SA302 tax calculation". Alternatively, call HMRC to request a copy by post.'
WHERE code = 'SA302';

UPDATE document_types SET client_description = 'Please provide details of all rental income received and expenses paid during the tax year for each property you let out. Include mortgage interest, repairs, insurance, letting agent fees, and any other allowable costs.'
WHERE code = 'RENTAL_INCOME';

UPDATE document_types SET client_description = 'If you are self-employed or run a business as a sole trader, please provide your sales records, business expense receipts, and any mileage logs for the tax year.'
WHERE code = 'SELF_EMPLOYMENT';

UPDATE document_types SET client_description = 'If you received income from any private or state pension during the tax year, please provide the pension award letters or annual statements showing the amounts paid.'
WHERE code = 'PENSION_LETTER';

UPDATE document_types SET client_description = 'If you made charitable donations under Gift Aid during the tax year, please provide receipts or statements from the charities confirming the amounts and dates.'
WHERE code = 'GIFT_AID';

UPDATE document_types SET client_description = 'Please provide bank statements for all accounts held during the period. A full transaction download in CSV or Excel format is preferred — most banks let you export this from online banking under "Statements" or "Download transactions".'
WHERE code = 'BANK_STATEMENT';

UPDATE document_types SET client_description = 'If dividends were paid during the period, please provide the dividend vouchers showing the date, amount, and shareholder details. Your company secretary or accountant should have copies.'
WHERE code = 'DIVIDEND_VOUCHER';

UPDATE document_types SET client_description = 'Please provide the current share register showing all shareholders, the number and class of shares held, and any changes made during the period.'
WHERE code = 'SHARE_REGISTER';

UPDATE document_types SET client_description = 'Please provide a log of all business miles driven during the period, including the date, start and end location, purpose of the journey, and miles travelled.'
WHERE code = 'MILEAGE_LOG';

UPDATE document_types SET client_description = 'Please complete the Self-Assessment questionnaire we have provided. It covers standard sections such as charitable donations, pension contributions, savings interest, and other income sources.'
WHERE code = 'SA_QUESTIONNAIRE';

UPDATE document_types SET client_description = 'If you paid for any business expenses from personal accounts, or received business income into personal accounts, please provide a schedule of those transactions so we can include them in the accounts.'
WHERE code = 'ADJUSTMENTS';

UPDATE document_types SET client_description = 'Please confirm whether there have been any changes to the company''s share register, shareholder details, PSC (Persons with Significant Control) register, directors, or registered office address since the last filing.'
WHERE code = 'COMPANY_CHANGES';

UPDATE document_types SET client_description = 'Please provide records of all income received and expenses paid by the partnership during the period, along with details of how profits are allocated between the partners.'
WHERE code = 'PARTNERSHIP_INCOME';

UPDATE document_types SET client_description = 'Please provide the subcontractor payment and deduction statements for each subcontractor paid during the period, showing gross payments, CIS deductions made, and net amounts paid.'
WHERE code = 'CIS_SUBCONTRACTOR_STATEMENTS';
