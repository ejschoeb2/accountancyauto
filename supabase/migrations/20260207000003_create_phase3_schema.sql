-- Phase 3: Delivery & Dashboard Schema
-- Email logging and delivery tracking

-- ============================================================================
-- EMAIL LOG: Track all sent emails and delivery status
-- ============================================================================

CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reminder_queue_id UUID REFERENCES reminder_queue(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  filing_type_id TEXT REFERENCES filing_types(id) ON DELETE SET NULL,
  postmark_message_id TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'failed')),
  bounce_type TEXT,
  bounce_description TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES: Query optimization
-- ============================================================================

CREATE INDEX idx_email_log_client_id ON email_log(client_id);
CREATE INDEX idx_email_log_sent_at ON email_log(sent_at DESC);
CREATE INDEX idx_email_log_delivery_status ON email_log(delivery_status);
CREATE INDEX idx_email_log_postmark_message_id ON email_log(postmark_message_id);

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE TRIGGER email_log_updated_at
  BEFORE UPDATE ON email_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- RLS POLICIES: Row-level security for email_log
-- ============================================================================

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full CRUD
CREATE POLICY "Authenticated users can read email_log" ON email_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can modify email_log" ON email_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role: full access for background jobs
CREATE POLICY "Service role full access to email_log" ON email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
