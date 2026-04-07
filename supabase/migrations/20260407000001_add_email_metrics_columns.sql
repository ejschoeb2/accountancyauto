-- AUDIT-048: Add delivery metrics columns to email_log
-- first_attempted_at: timestamp of the first send attempt for this reminder (not the current row)
-- attempt_count:      how many total attempts have been made (including this one)
-- These columns enable time-to-delivery and retry distribution analytics.

ALTER TABLE email_log ADD COLUMN IF NOT EXISTS first_attempted_at TIMESTAMPTZ;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 1;
