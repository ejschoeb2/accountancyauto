-- Change all org_id foreign keys from NO ACTION to CASCADE
-- so that deleting an organisation cascades to all child tables

ALTER TABLE app_settings DROP CONSTRAINT app_settings_org_id_fkey,
  ADD CONSTRAINT app_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE client_deadline_overrides DROP CONSTRAINT client_deadline_overrides_org_id_fkey,
  ADD CONSTRAINT client_deadline_overrides_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE client_documents DROP CONSTRAINT client_documents_org_id_fkey,
  ADD CONSTRAINT client_documents_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE client_email_overrides DROP CONSTRAINT client_email_overrides_org_id_fkey,
  ADD CONSTRAINT client_email_overrides_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE client_filing_assignments DROP CONSTRAINT client_filing_assignments_org_id_fkey,
  ADD CONSTRAINT client_filing_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE client_filing_status_overrides DROP CONSTRAINT client_filing_status_overrides_org_id_fkey,
  ADD CONSTRAINT client_filing_status_overrides_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE client_schedule_overrides DROP CONSTRAINT client_schedule_overrides_org_id_fkey,
  ADD CONSTRAINT client_schedule_overrides_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE clients DROP CONSTRAINT clients_org_id_fkey,
  ADD CONSTRAINT clients_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE document_access_log DROP CONSTRAINT document_access_log_org_id_fkey,
  ADD CONSTRAINT document_access_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE email_log DROP CONSTRAINT email_log_org_id_fkey,
  ADD CONSTRAINT email_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE email_templates DROP CONSTRAINT email_templates_org_id_fkey,
  ADD CONSTRAINT email_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE locks DROP CONSTRAINT locks_org_id_fkey,
  ADD CONSTRAINT locks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE reminder_queue DROP CONSTRAINT reminder_queue_org_id_fkey,
  ADD CONSTRAINT reminder_queue_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE schedule_client_exclusions DROP CONSTRAINT schedule_client_exclusions_org_id_fkey,
  ADD CONSTRAINT schedule_client_exclusions_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE schedule_steps DROP CONSTRAINT schedule_steps_org_id_fkey,
  ADD CONSTRAINT schedule_steps_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE schedules DROP CONSTRAINT schedules_org_id_fkey,
  ADD CONSTRAINT schedules_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE upload_portal_tokens DROP CONSTRAINT upload_portal_tokens_org_id_fkey,
  ADD CONSTRAINT upload_portal_tokens_org_id_fkey FOREIGN KEY (org_id) REFERENCES organisations(id) ON DELETE CASCADE;
