-- Update client count limits to match new pricing tiers:
-- Free: 10 (was 20/25), Solo: 40 (was 50), Starter: 80 (was 100)
-- Practice: 200 (unchanged), Firm: 400 (unchanged)

UPDATE organisations SET client_count_limit = 10  WHERE plan_tier = 'free';
UPDATE organisations SET client_count_limit = 40  WHERE plan_tier = 'solo';
UPDATE organisations SET client_count_limit = 80  WHERE plan_tier = 'starter';
