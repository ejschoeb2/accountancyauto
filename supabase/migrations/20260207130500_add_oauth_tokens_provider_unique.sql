-- Add unique constraint on provider so upsert ON CONFLICT (provider) works.
ALTER TABLE oauth_tokens
  ADD CONSTRAINT oauth_tokens_provider_unique UNIQUE (provider);
