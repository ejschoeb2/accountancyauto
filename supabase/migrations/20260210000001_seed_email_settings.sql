-- Seed email configuration defaults (INSERT policy already in 20260209230000)
INSERT INTO app_settings (key, value) VALUES
  ('email_sender_name', 'Peninsula Accounting'),
  ('email_sender_address', 'reminders@peninsulaaccounting.co.uk'),
  ('email_reply_to', 'info@peninsulaaccounting.co.uk');
