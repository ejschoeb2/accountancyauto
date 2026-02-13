-- Add is_custom column to email_templates to track user-created templates
-- All existing templates are marked as NOT custom (system/migrated templates)
-- New templates created via UI will be marked as custom

ALTER TABLE email_templates
ADD COLUMN is_custom BOOLEAN NOT NULL DEFAULT false;

-- All existing templates are system templates (not custom)
UPDATE email_templates SET is_custom = false;

-- Add comment
COMMENT ON COLUMN email_templates.is_custom IS 'True if template was created by user via UI, false if system/migrated template';
