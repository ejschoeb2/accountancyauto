-- Add rejected_at column to client_documents for soft-rejection of portal uploads.
-- When an accountant rejects a document, this timestamp is set instead of deleting the row,
-- so the client portal can display the rejection status.
ALTER TABLE client_documents
  ADD COLUMN rejected_at timestamptz;

-- Index for portal queries that filter on rejection status
CREATE INDEX idx_client_documents_rejected_at ON client_documents (rejected_at) WHERE rejected_at IS NOT NULL;
