-- The app has no Supabase Auth login — server client uses the anon role.
-- Add anon policies to Phase 2 tables so the dashboard can manage
-- filing types, assignments, and deadline overrides.

-- filing_types: read-only for anon (reference data)
CREATE POLICY "Anon users can read filing_types" ON filing_types
  FOR SELECT TO anon USING (true);

-- client_filing_assignments: full CRUD for anon
CREATE POLICY "Anon users can read client_filing_assignments" ON client_filing_assignments
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can modify client_filing_assignments" ON client_filing_assignments
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- client_deadline_overrides: full CRUD for anon
CREATE POLICY "Anon users can read client_deadline_overrides" ON client_deadline_overrides
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can modify client_deadline_overrides" ON client_deadline_overrides
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- reminder_templates: read-only for anon (needed for template display)
CREATE POLICY "Anon users can read reminder_templates" ON reminder_templates
  FOR SELECT TO anon USING (true);

-- client_template_overrides: full CRUD for anon
CREATE POLICY "Anon users can read client_template_overrides" ON client_template_overrides
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can modify client_template_overrides" ON client_template_overrides
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- reminder_queue: full CRUD for anon
CREATE POLICY "Anon users can read reminder_queue" ON reminder_queue
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can modify reminder_queue" ON reminder_queue
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- bank_holidays_cache: read/write for anon
CREATE POLICY "Anon users can read bank_holidays_cache" ON bank_holidays_cache
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can modify bank_holidays_cache" ON bank_holidays_cache
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- email_log: full CRUD for anon (dashboard reads delivery history)
CREATE POLICY "Anon users can read email_log" ON email_log
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can modify email_log" ON email_log
  FOR ALL TO anon USING (true) WITH CHECK (true);
