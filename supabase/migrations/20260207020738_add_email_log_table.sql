-- Add missing email_log table for delivery tracking and dashboard
-- This table should have been created by Phase 3 schema but was missing
-- Note: Foreign key constraints are conditional based on table existence

CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_queue_id UUID,
  client_id UUID NOT NULL,
  filing_type_id TEXT,
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_log_client_id ON email_log(client_id);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_delivery_status ON email_log(delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_log_postmark_message_id ON email_log(postmark_message_id);

-- Create trigger for updated_at (assuming update_updated_at function exists from Phase 1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'email_log_updated_at'
  ) THEN
    CREATE TRIGGER email_log_updated_at
      BEFORE UPDATE ON email_log
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END$$;

-- Enable RLS
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Authenticated users can read email_log" ON email_log;
DROP POLICY IF EXISTS "Authenticated users can modify email_log" ON email_log;
DROP POLICY IF EXISTS "Service role full access to email_log" ON email_log;

-- Create RLS policies
CREATE POLICY "Authenticated users can read email_log" ON email_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can modify email_log" ON email_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_log" ON email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add foreign key constraints if the referenced tables exist
DO $$
BEGIN
  -- Add reminder_queue foreign key if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reminder_queue') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'email_log_reminder_queue_id_fkey'
      AND table_name = 'email_log'
    ) THEN
      ALTER TABLE email_log
        ADD CONSTRAINT email_log_reminder_queue_id_fkey
        FOREIGN KEY (reminder_queue_id) REFERENCES reminder_queue(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- Add clients foreign key if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'email_log_client_id_fkey'
      AND table_name = 'email_log'
    ) THEN
      ALTER TABLE email_log
        ADD CONSTRAINT email_log_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Add filing_types foreign key if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'filing_types') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'email_log_filing_type_id_fkey'
      AND table_name = 'email_log'
    ) THEN
      ALTER TABLE email_log
        ADD CONSTRAINT email_log_filing_type_id_fkey
        FOREIGN KEY (filing_type_id) REFERENCES filing_types(id) ON DELETE SET NULL;
    END IF;
  END IF;
END$$;
