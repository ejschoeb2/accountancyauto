-- Add missing INSERT policy for app_settings
-- Required for upsert operations in settings.ts

CREATE POLICY "Anon users can insert app_settings" ON app_settings
  FOR INSERT TO anon WITH CHECK (true);
