-- Phase 29 HRDN-02: Add postmark_message_id column and idempotency unique constraint
-- Prevents duplicate inbound_emails rows on Postmark delivery retries.
--
-- postmark_message_id is nullable (TEXT) for backwards compatibility — existing rows have no
-- MessageID (they were inserted before this column existed).
--
-- Standard UNIQUE constraint with implicit NULLS DISTINCT (Postgres default): multiple rows
-- with postmark_message_id = NULL are each treated as distinct, so existing historical rows
-- (all NULL) do not conflict with each other. Only rows where two non-NULL postmark_message_id
-- values match within the same org_id will violate the constraint.
--
-- The unique constraint scope is (org_id, postmark_message_id) — MessageID is globally unique
-- per Postmark, but scoping to org_id provides defence-in-depth and matches the table's
-- existing per-org data model.

ALTER TABLE inbound_emails
  ADD COLUMN IF NOT EXISTS postmark_message_id TEXT;

-- Add unique constraint (standard NULLS DISTINCT — NULLs are each unique, preserving existing rows)
ALTER TABLE inbound_emails
  DROP CONSTRAINT IF EXISTS uq_inbound_emails_org_message_id;

ALTER TABLE inbound_emails
  ADD CONSTRAINT uq_inbound_emails_org_message_id
  UNIQUE (org_id, postmark_message_id);
