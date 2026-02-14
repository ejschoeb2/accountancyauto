-- Add per-schedule send hour for custom schedules
-- NULL = use global reminder_send_hour from app_settings
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS send_hour INT DEFAULT NULL;
DO $$ BEGIN
  ALTER TABLE schedules ADD CONSTRAINT schedules_send_hour_check CHECK (send_hour IS NULL OR (send_hour >= 0 AND send_hour <= 23));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
