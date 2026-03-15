-- Phase 32: Expandable Deadline System & MTD Quarterly Updates
-- Expand filing_types from 5 to 14 entries + org-level activation tracking

-- ============================================================================
-- 1. Add new columns to filing_types
-- ============================================================================

ALTER TABLE filing_types
  ADD COLUMN IF NOT EXISTS is_seeded_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calculator_type TEXT NOT NULL DEFAULT 'fixed_annual',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 99;

-- ============================================================================
-- 2. Update existing 5 rows
-- ============================================================================

UPDATE filing_types SET is_seeded_default = true, calculator_type = 'year_end_annual', sort_order = 1
  WHERE id = 'corporation_tax_payment';

UPDATE filing_types SET is_seeded_default = true, calculator_type = 'year_end_annual', sort_order = 2
  WHERE id = 'ct600_filing';

UPDATE filing_types SET is_seeded_default = true, calculator_type = 'year_end_annual', sort_order = 3
  WHERE id = 'companies_house';

UPDATE filing_types SET is_seeded_default = true, calculator_type = 'vat_quarterly', sort_order = 4
  WHERE id = 'vat_return';

UPDATE filing_types SET is_seeded_default = true, calculator_type = 'fixed_annual', sort_order = 5
  WHERE id = 'self_assessment';

-- ============================================================================
-- 3. Insert 9 new filing types
-- ============================================================================

INSERT INTO filing_types (id, name, description, applicable_client_types, is_seeded_default, calculator_type, sort_order)
VALUES
  (
    'mtd_quarterly_update',
    'MTD Quarterly Update',
    'HMRC Making Tax Digital quarterly submission',
    ARRAY['Sole Trader', 'Partnership']::client_type_enum[],
    false,
    'mtd_quarterly',
    6
  ),
  (
    'confirmation_statement',
    'Confirmation Statement',
    'Companies House annual confirmation',
    ARRAY['Limited Company', 'LLP']::client_type_enum[],
    false,
    'confirmation_statement',
    7
  ),
  (
    'p11d_filing',
    'P11D Filing',
    'Employee benefits and expenses return',
    ARRAY['Limited Company', 'LLP', 'Partnership']::client_type_enum[],
    false,
    'fixed_annual',
    8
  ),
  (
    'paye_monthly',
    'PAYE Monthly',
    'Monthly PAYE payment to HMRC',
    ARRAY['Limited Company', 'LLP', 'Partnership', 'Sole Trader']::client_type_enum[],
    false,
    'monthly_22nd',
    9
  ),
  (
    'cis_monthly_return',
    'CIS Monthly Return',
    'Construction Industry Scheme monthly return',
    ARRAY['Limited Company', 'LLP', 'Partnership', 'Sole Trader']::client_type_enum[],
    false,
    'monthly_19th',
    10
  ),
  (
    'payroll_year_end',
    'Payroll Year-End',
    'Final payroll submission for the tax year',
    ARRAY['Limited Company', 'LLP', 'Partnership', 'Sole Trader']::client_type_enum[],
    false,
    'fixed_annual',
    11
  ),
  (
    'sa_payment_on_account',
    'SA Payment on Account',
    'Self Assessment second payment on account',
    ARRAY['Sole Trader', 'Partnership', 'Individual']::client_type_enum[],
    false,
    'fixed_annual',
    12
  ),
  (
    'partnership_tax_return',
    'Partnership Tax Return',
    'Annual partnership tax return filing',
    ARRAY['Partnership']::client_type_enum[],
    false,
    'fixed_annual',
    13
  ),
  (
    'trust_tax_return',
    'Trust Tax Return',
    'Annual trust and estate tax return',
    ARRAY['Individual']::client_type_enum[],
    false,
    'fixed_annual',
    14
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. Create org_filing_type_selections table
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_filing_type_selections (
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  filing_type_id TEXT NOT NULL REFERENCES filing_types(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, filing_type_id)
);

-- ============================================================================
-- 5. Enable RLS on org_filing_type_selections
-- ============================================================================

ALTER TABLE org_filing_type_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_filing_type_selections"
  ON org_filing_type_selections
  FOR SELECT
  TO authenticated
  USING (org_id = auth_org_id());

-- ============================================================================
-- 6. Backfill existing orgs with the 5 default filing types
-- ============================================================================

INSERT INTO org_filing_type_selections (org_id, filing_type_id, is_active)
SELECT o.id, ft.id, true
FROM organisations o
CROSS JOIN filing_types ft
WHERE ft.is_seeded_default = true
ON CONFLICT (org_id, filing_type_id) DO NOTHING;
