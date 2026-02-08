-- Set all clients to VAT quarter Apr-Jun (Stagger 2)
-- This assumes all clients follow the Apr/Jul/Oct/Jan quarter pattern

-- Update all clients to use Apr-Jun VAT quarter
UPDATE clients
SET
  vat_quarter = 'Apr-Jun',
  vat_registered = true,
  updated_at = now()
WHERE vat_quarter IS NULL OR vat_quarter != 'Apr-Jun';

-- Log the change
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % clients to VAT quarter Apr-Jun', updated_count;
END $$;
