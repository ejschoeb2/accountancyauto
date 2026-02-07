-- The app has no Supabase Auth login — server client uses the anon role.
-- Add anon policies so the dashboard can read and edit clients.

CREATE POLICY "Anon users can read clients" ON clients
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can insert clients" ON clients
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon users can update clients" ON clients
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
