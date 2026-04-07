-- Downtime risk: MODERATE — requires backfill; may lock during constraint application
-- Merge "Sole Trader" business type into "Individual"
-- Sole trader is not a separate legal entity — it's an individual who is self-employed.

-- 1. Update existing clients from Sole Trader to Individual
UPDATE clients SET client_type = 'Individual' WHERE client_type = 'Sole Trader';

-- 2. Update all filing_types: replace 'Sole Trader' with 'Individual' in applicable_client_types
UPDATE filing_types
SET applicable_client_types = array_remove(applicable_client_types, 'Sole Trader')
WHERE 'Sole Trader' = ANY(applicable_client_types)
  AND 'Individual' = ANY(applicable_client_types);

UPDATE filing_types
SET applicable_client_types = array_replace(applicable_client_types, 'Sole Trader', 'Individual')
WHERE 'Sole Trader' = ANY(applicable_client_types)
  AND NOT 'Individual' = ANY(applicable_client_types);

-- 3. Recreate the enum without 'Sole Trader'
-- Must convert both columns that use it to text first
ALTER TABLE clients ALTER COLUMN client_type TYPE text USING client_type::text;
ALTER TABLE filing_types ALTER COLUMN applicable_client_types TYPE text[] USING applicable_client_types::text[];

DROP TYPE client_type_enum;
CREATE TYPE client_type_enum AS ENUM ('Limited Company', 'Partnership', 'LLP', 'Individual');

ALTER TABLE clients ALTER COLUMN client_type TYPE client_type_enum USING client_type::client_type_enum;
ALTER TABLE filing_types ALTER COLUMN applicable_client_types TYPE client_type_enum[] USING applicable_client_types::client_type_enum[];
