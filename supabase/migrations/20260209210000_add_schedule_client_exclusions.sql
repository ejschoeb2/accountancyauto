-- Schedule Client Exclusions
-- Allows excluding specific clients from a schedule.
-- By default, schedules apply to all eligible clients.
-- Adding a row here opts a client OUT of a schedule.

CREATE TABLE IF NOT EXISTS schedule_client_exclusions (
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (schedule_id, client_id)
);

-- Index for fast lookup by schedule
CREATE INDEX IF NOT EXISTS idx_schedule_client_exclusions_schedule
  ON schedule_client_exclusions(schedule_id);

-- Index for fast lookup by client (used when rebuilding queue for a specific client)
CREATE INDEX IF NOT EXISTS idx_schedule_client_exclusions_client
  ON schedule_client_exclusions(client_id);

-- RLS: allow anon access (matches existing table patterns)
ALTER TABLE schedule_client_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access to schedule_client_exclusions"
  ON schedule_client_exclusions FOR ALL TO anon USING (true) WITH CHECK (true);
