-- Downtime risk: MODERATE — requires backfill; may lock during constraint application
-- Part 2: Migrate existing rows to new tier names and update client limits.
-- New enum values from 20260225100000 must be committed first.

-- Rename sole_trader rows → starter
UPDATE organisations SET plan_tier = 'starter' WHERE plan_tier = 'sole_trader';

-- Update stored client_count_limit to match new tier limits
UPDATE organisations SET client_count_limit = 25  WHERE plan_tier = 'free';
UPDATE organisations SET client_count_limit = 100 WHERE plan_tier = 'starter';
UPDATE organisations SET client_count_limit = 300 WHERE plan_tier = 'practice';
UPDATE organisations SET client_count_limit = 500 WHERE plan_tier = 'firm';
-- enterprise stays NULL (unlimited)
