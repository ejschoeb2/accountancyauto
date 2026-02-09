-- Add INSERT policy on app_settings (needed for upsert from anon role)
CREATE POLICY "Anon users can insert app_settings" ON app_settings
  FOR INSERT TO anon WITH CHECK (true);

-- Seed email configuration defaults
INSERT INTO app_settings (key, value) VALUES
  ('email_sender_name', 'Peninsula Accounting'),
  ('email_sender_address', 'reminders@peninsulaaccounting.co.uk'),
  ('email_reply_to', 'info@peninsulaaccounting.co.uk');
