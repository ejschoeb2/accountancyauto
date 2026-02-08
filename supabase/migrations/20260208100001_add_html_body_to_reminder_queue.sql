-- Add html_body column to reminder_queue for v1.1 rich HTML content
-- This column stores the fully rendered HTML from renderTipTapEmail()
-- resolved_body remains as plain text fallback

ALTER TABLE reminder_queue ADD COLUMN IF NOT EXISTS html_body TEXT;

COMMENT ON COLUMN reminder_queue.html_body IS 'v1.1 rich HTML content rendered by TipTap pipeline';
