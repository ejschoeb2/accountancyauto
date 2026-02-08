-- Remove unused urgency_level column from schedule_steps
ALTER TABLE schedule_steps DROP COLUMN IF EXISTS urgency_level;
