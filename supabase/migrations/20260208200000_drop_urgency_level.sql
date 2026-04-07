-- Downtime risk: LOW — brief table lock expected (<1s for small tables)
-- Remove unused urgency_level column from schedule_steps
ALTER TABLE schedule_steps DROP COLUMN IF EXISTS urgency_level;
