-- Add send_type column to email_log to distinguish scheduled vs ad-hoc sends
-- This is a non-breaking additive change - all existing rows get 'scheduled' via DEFAULT

ALTER TABLE email_log ADD COLUMN IF NOT EXISTS send_type TEXT NOT NULL DEFAULT 'scheduled'
  CHECK (send_type IN ('scheduled', 'ad-hoc'));
