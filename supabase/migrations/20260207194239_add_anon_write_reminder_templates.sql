-- Allow anon role to insert/update/delete reminder_templates.
-- The previous migration only granted SELECT.
CREATE POLICY "Anon users can modify reminder_templates" ON reminder_templates
  FOR ALL TO anon USING (true) WITH CHECK (true);
