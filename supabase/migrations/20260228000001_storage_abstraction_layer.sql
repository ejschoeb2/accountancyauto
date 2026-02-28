-- Phase 24: Storage Abstraction Layer — schema foundation
--
-- Creates the storage_backend_enum type and adds all storage-related columns to
-- organisations and client_documents in a single migration. The enum type MUST be
-- created in the same migration as the columns that reference it to avoid ordering issues.
--
-- Decisions (from STATE.md v5.0):
-- - Per-document storage_backend column — set at insert time, never derived from org config
-- - storage_backend_status uses TEXT + CHECK (not enum) — values can be added without ALTER TYPE
-- - All _enc columns are TEXT and nullable — written only by lib/crypto/tokens.ts
-- - DEFAULT 'supabase' on both storage_backend columns backfills all existing rows

-- ── Step 1: Create the storage backend enum type ──────────────────────────────
CREATE TYPE storage_backend_enum AS ENUM ('supabase', 'google_drive', 'onedrive', 'dropbox');

-- ── Step 2: organisations — backend selection and status ──────────────────────
ALTER TABLE organisations
  ADD COLUMN storage_backend storage_backend_enum NOT NULL DEFAULT 'supabase',
  ADD COLUMN storage_backend_status TEXT DEFAULT NULL
    CONSTRAINT organisations_storage_backend_status_check
    CHECK (storage_backend_status IN ('active', 'error', 'reauth_required'));

-- ── Step 3: organisations — encrypted OAuth token columns per provider ────────
-- All columns use _enc suffix to signal encryption at all times.
-- Only lib/crypto/tokens.ts may write plaintext to these columns (via encryptToken()).
ALTER TABLE organisations
  ADD COLUMN google_refresh_token_enc TEXT DEFAULT NULL,
  ADD COLUMN google_access_token_enc  TEXT DEFAULT NULL,
  ADD COLUMN ms_token_cache_enc       TEXT DEFAULT NULL,
  ADD COLUMN dropbox_refresh_token_enc TEXT DEFAULT NULL,
  ADD COLUMN dropbox_access_token_enc TEXT DEFAULT NULL;

-- ── Step 4: client_documents — record backend at upload time ──────────────────
-- DEFAULT 'supabase' backfills all existing rows — all historical documents are on Supabase.
-- This column is set once at INSERT and never updated. Routing at download time uses
-- doc.storage_backend, never org.storage_backend, to handle orgs that have switched backends.
ALTER TABLE client_documents
  ADD COLUMN storage_backend storage_backend_enum NOT NULL DEFAULT 'supabase';

-- ── Verification query (informational — not part of migration execution) ──────
-- Run manually to confirm backfill:
-- SELECT COUNT(*) FROM client_documents WHERE storage_backend IS NULL; -- expect: 0
-- SELECT COUNT(*) FROM client_documents WHERE storage_backend != 'supabase'; -- expect: 0
