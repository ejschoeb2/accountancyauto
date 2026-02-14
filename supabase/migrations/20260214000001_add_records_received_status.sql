-- Add 'records_received' status to reminder_queue
-- This status is used when a client marks records as received for a filing type,
-- cancelling all remaining reminders for that filing type

-- Drop the existing constraint
ALTER TABLE reminder_queue DROP CONSTRAINT IF EXISTS reminder_queue_status_check;

-- Add the new constraint with 'records_received' included
ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_status_check
  CHECK (status IN ('scheduled', 'pending', 'sent', 'cancelled', 'failed', 'records_received'));
