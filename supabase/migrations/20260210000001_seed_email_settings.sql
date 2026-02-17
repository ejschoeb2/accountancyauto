-- Seed email configuration defaults (INSERT policy already in 20260209230000)
INSERT INTO app_settings (key, value) VALUES
  ('email_sender_name', 'PhaseTwo'),
  ('email_sender_address', 'hello@phasetwo.uk'),
  ('email_reply_to', 'hello@phasetwo.uk');
