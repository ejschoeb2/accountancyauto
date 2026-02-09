-- Replace vat_quarter enum column with vat_stagger_group integer column
-- HMRC assigns VAT-registered businesses to one of three stagger groups:
--   Stagger 1: Mar/Jun/Sep/Dec quarters
--   Stagger 2: Jan/Apr/Jul/Oct quarters
--   Stagger 3: Feb/May/Aug/Nov quarters

-- Step 1: Add the new column
ALTER TABLE clients ADD COLUMN vat_stagger_group INTEGER;

-- Step 2: Add constraint
ALTER TABLE clients ADD CONSTRAINT check_vat_stagger_group
  CHECK (vat_stagger_group IN (1, 2, 3));

-- Step 3: Migrate existing data (all current values are Stagger 1)
UPDATE clients SET vat_stagger_group = 1 WHERE vat_quarter IS NOT NULL;

-- Step 4: Drop the old column
ALTER TABLE clients DROP COLUMN vat_quarter;

-- Step 5: Drop the old enum type
DROP TYPE IF EXISTS vat_quarter_enum;

-- Step 6: Recreate bulk_update_client_metadata RPC with vat_stagger_group
CREATE OR REPLACE FUNCTION bulk_update_client_metadata(
  updates jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  update_record jsonb;
BEGIN
  FOR update_record IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE clients
    SET
      client_type = COALESCE((update_record->'metadata'->>'client_type')::client_type_enum, client_type),
      year_end_date = COALESCE((update_record->'metadata'->>'year_end_date')::date, year_end_date),
      vat_registered = COALESCE((update_record->'metadata'->>'vat_registered')::boolean, vat_registered),
      vat_stagger_group = COALESCE((update_record->'metadata'->>'vat_stagger_group')::integer, vat_stagger_group),
      vat_scheme = COALESCE((update_record->'metadata'->>'vat_scheme')::vat_scheme_enum, vat_scheme),
      updated_at = now()
    WHERE id = (update_record->>'id')::uuid;
  END LOOP;
END;
$$;
