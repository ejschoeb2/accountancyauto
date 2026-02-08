-- Drop v1.0 reminder_templates table
-- Data has been migrated to v1.1 normalized tables (schedules, schedule_steps, email_templates)
-- Migration 20260208000002 performed the data migration
-- All application code now reads from v1.1 tables exclusively

-- First drop the client_template_overrides table (references reminder_templates via template_id FK)
DROP TABLE IF EXISTS client_template_overrides;

-- Drop the reminder_templates table
DROP TABLE IF EXISTS reminder_templates;
