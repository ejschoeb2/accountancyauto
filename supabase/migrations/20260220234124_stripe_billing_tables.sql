-- Downtime risk: NONE — safe for zero-downtime deployment
-- Phase 11 Plan 01: Stripe Billing Foundation
-- Creates processed_webhook_events table for idempotent webhook processing
-- Adds stripe_price_id to organisations for plan-tier price tracking
-- Adds index on organisations.stripe_customer_id for webhook lookups

-- ============================================================================
-- TABLE: processed_webhook_events
-- ============================================================================
-- Tracks Stripe webhook events that have been processed to prevent
-- duplicate handling (idempotency). Only accessible via service_role
-- since the webhook handler uses the admin Supabase client.

CREATE TABLE processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,       -- Stripe event ID (e.g. evt_xxx)
  event_type TEXT NOT NULL,            -- e.g. checkout.session.completed
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on event_id for fast duplicate lookups
CREATE INDEX idx_processed_webhook_events_event_id
  ON processed_webhook_events(event_id);

-- RLS: only service_role can access (webhook handler uses admin client)
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to processed_webhook_events"
  ON processed_webhook_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- ALTER: organisations — add stripe_price_id
-- ============================================================================
-- Stores the Stripe Price ID for the org's current plan tier.
-- Used to look up the plan config and verify subscription alignment.

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- ============================================================================
-- INDEX: organisations.stripe_customer_id
-- ============================================================================
-- Speeds up webhook lookups that resolve org from stripe_customer_id.

CREATE INDEX IF NOT EXISTS idx_organisations_stripe_customer_id
  ON organisations(stripe_customer_id);
