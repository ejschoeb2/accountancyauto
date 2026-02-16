-- Inbound Emails Table
-- Stores incoming emails from Postmark inbound webhook
-- Used to automatically detect when clients send records for processing

CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE SET NULL,

  -- Email metadata
  received_at TIMESTAMPTZ NOT NULL,
  email_from TEXT NOT NULL,
  email_subject TEXT,
  email_body TEXT,

  -- Processing flags
  read BOOLEAN NOT NULL DEFAULT false,
  records_received_detected BOOLEAN NOT NULL DEFAULT false,

  -- Raw data for debugging/reprocessing
  raw_postmark_data JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_inbound_emails_client_id ON inbound_emails(client_id);
CREATE INDEX idx_inbound_emails_filing_type_id ON inbound_emails(filing_type_id);
CREATE INDEX idx_inbound_emails_received_at ON inbound_emails(received_at DESC);
CREATE INDEX idx_inbound_emails_read ON inbound_emails(read) WHERE read = false;
CREATE INDEX idx_inbound_emails_records_received_detected ON inbound_emails(records_received_detected) WHERE records_received_detected = true;

-- Enable RLS
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can read inbound_emails" ON inbound_emails
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert inbound_emails" ON inbound_emails
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update inbound_emails" ON inbound_emails
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete inbound_emails" ON inbound_emails
  FOR DELETE USING (auth.role() = 'authenticated');

-- Service role full access
CREATE POLICY "Service role full access to inbound_emails" ON inbound_emails
  FOR ALL USING (auth.role() = 'service_role');
