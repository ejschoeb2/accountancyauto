-- Downtime risk: NONE — safe for zero-downtime deployment
-- Add columns for Postmark platform-managed setup (Email Setup wizard step).
-- These are populated automatically when an admin completes the Email Setup
-- step in the onboarding wizard via the Postmark Management API.

ALTER TABLE organisations
  ADD COLUMN postmark_server_id    INTEGER,          -- Postmark's numeric server ID
  ADD COLUMN inbound_address       TEXT,             -- e.g. abc123@inbound.postmarkapp.com
  ADD COLUMN postmark_domain_id    INTEGER,          -- Postmark's numeric domain ID
  ADD COLUMN email_domain_verified BOOLEAN NOT NULL DEFAULT false;
