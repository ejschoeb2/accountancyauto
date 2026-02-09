-- Add custom schedules support to the schedules table
-- Custom schedules allow reminders for non-HMRC filing types (e.g., payroll, year-end packs)

-- 1. Add schedule_type column (filing or custom)
ALTER TABLE schedules ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'filing'
  CHECK (schedule_type IN ('filing', 'custom'));

-- 2. Fix unique constraint on filing_type_id to allow multiple custom schedules with NULL
--    Drop the existing unique constraint
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_filing_type_id_key;
--    Add a partial unique index: only enforce uniqueness for filing schedules
CREATE UNIQUE INDEX schedules_filing_type_id_unique ON schedules (filing_type_id) WHERE filing_type_id IS NOT NULL;

-- 3. Add custom schedule columns
ALTER TABLE schedules ADD COLUMN custom_date DATE;
ALTER TABLE schedules ADD COLUMN recurrence_rule TEXT CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('monthly', 'quarterly', 'annually'));
ALTER TABLE schedules ADD COLUMN recurrence_anchor DATE;

-- 4. Add CHECK constraint for schedule type consistency
ALTER TABLE schedules ADD CONSTRAINT schedules_type_check CHECK (
  (schedule_type = 'filing' AND filing_type_id IS NOT NULL)
  OR
  (schedule_type = 'custom' AND filing_type_id IS NULL AND (custom_date IS NOT NULL OR (recurrence_rule IS NOT NULL AND recurrence_anchor IS NOT NULL)))
);
