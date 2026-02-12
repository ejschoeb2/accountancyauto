-- Add onboarding_complete setting to app_settings
-- This tracks whether the user has completed the initial onboarding wizard
-- Default is 'false', set to 'true' after completing the 3-step onboarding flow

INSERT INTO app_settings (key, value)
VALUES ('onboarding_complete', 'false')
ON CONFLICT (key) DO NOTHING;
