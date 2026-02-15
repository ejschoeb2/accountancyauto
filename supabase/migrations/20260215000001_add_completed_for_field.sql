-- Add 'completed_for' field to clients table
-- This tracks when the accountant has completed processing (separate from records received)
-- Only when BOTH records_received_for AND completed_for contain a filing type can rollover occur

ALTER TABLE clients ADD COLUMN IF NOT EXISTS completed_for JSONB DEFAULT '[]';

COMMENT ON COLUMN clients.completed_for IS 'Array of filing_type_id strings for which the accountant has completed processing. Both records_received_for and completed_for must be true for a filing to be fully complete.';
