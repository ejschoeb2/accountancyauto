-- Add 'rescheduled' status to reminder_queue
-- This status is used when a reminder has been rescheduled via the reschedule feature

-- Drop the existing constraint
ALTER TABLE reminder_queue DROP CONSTRAINT IF EXISTS reminder_queue_status_check;

-- Add the new constraint with 'rescheduled' included
ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_status_check
  CHECK (status IN ('scheduled', 'pending', 'sent', 'cancelled', 'failed', 'records_received', 'rescheduled'));
