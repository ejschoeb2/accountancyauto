-- Downtime risk: NONE — safe for zero-downtime deployment
-- Add attempt_count to reminder_queue for retry capping.
-- Entries that reach MAX_SEND_ATTEMPTS (5) are marked 'failed' automatically
-- by the send-emails cron rather than retrying forever.

ALTER TABLE reminder_queue
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
