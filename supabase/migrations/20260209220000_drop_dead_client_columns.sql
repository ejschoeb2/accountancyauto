-- Drop dead columns from clients table
--
-- vat_frequency: Never used in any logic or UI. Deadline calculations use vat_stagger_group.
-- has_overrides: Denormalized flag that was never written to (always false). Can be computed from override tables if needed.

ALTER TABLE clients DROP COLUMN IF EXISTS vat_frequency;
ALTER TABLE clients DROP COLUMN IF EXISTS has_overrides;
