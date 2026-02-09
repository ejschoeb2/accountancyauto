-- App-wide settings stored as key-value pairs (single-row per setting).

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Anon role can read and update settings (no auth in this app)
CREATE POLICY "Anon users can read app_settings" ON app_settings
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can update app_settings" ON app_settings
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Seed default send hour
INSERT INTO app_settings (key, value) VALUES ('reminder_send_hour', '9');
