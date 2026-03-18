-- Add 'paused' status to reminder_queue
-- Used when a client's reminders are paused; restored to 'scheduled' when unpaused

ALTER TABLE reminder_queue DROP CONSTRAINT IF EXISTS reminder_queue_status_check;

ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_status_check
  CHECK (status IN ('scheduled', 'pending', 'sent', 'cancelled', 'failed', 'records_received', 'rescheduled', 'paused'));
