-- Part 1: Add new enum values
-- NOTE: ADD VALUE must run in its own transaction before values can be used in DML.
-- Part 2 (migrate rows) is in 20260225100001_update_plan_tier_enum_migrate_rows.sql

ALTER TYPE plan_tier_enum ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE plan_tier_enum ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE plan_tier_enum ADD VALUE IF NOT EXISTS 'enterprise';
