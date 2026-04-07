-- Downtime risk: MODERATE — requires backfill; may lock during constraint application
-- Remove CONFIRMATION_STATEMENT and PSC_REGISTER from companies_house filing type.
-- These documents now belong exclusively to the dedicated confirmation_statement filing type
-- added in Phase 32. The companies_house filing type is for Annual Accounts only.

DELETE FROM filing_document_requirements
WHERE filing_type_id = 'companies_house'
  AND document_type_id IN (
    SELECT id FROM document_types WHERE code IN ('CONFIRMATION_STATEMENT', 'PSC_REGISTER')
  );
