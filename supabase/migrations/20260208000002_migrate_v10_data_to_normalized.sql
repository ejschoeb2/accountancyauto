-- Phase 4 Plan 02: Migrate v1.0 Data to Normalized Tables
-- Copies data from reminder_templates (JSONB steps) into the new normalized
-- email_templates, schedules, schedule_steps tables, and splits
-- client_template_overrides into client_email_overrides + client_schedule_overrides.
--
-- IDEMPOTENT: Skips if email_templates already has data.
-- SAFE: Does NOT modify or drop reminder_templates or client_template_overrides.

DO $$
DECLARE
  v_existing_count INT;
  v_template RECORD;
  v_step RECORD;
  v_override RECORD;
  v_new_schedule_id UUID;
  v_new_email_template_id UUID;
  v_new_schedule_step_id UUID;
  v_step_number INT;
  v_body TEXT;
  v_body_json JSONB;
  v_urgency TEXT;
  v_mapped_email_template_id UUID;
  v_mapped_schedule_step_id UUID;
BEGIN
  -- ========================================================================
  -- IDEMPOTENCY CHECK: Skip if email_templates already has data
  -- ========================================================================
  SELECT COUNT(*) INTO v_existing_count FROM email_templates;
  IF v_existing_count > 0 THEN
    RAISE NOTICE 'email_templates already has % rows. Skipping migration.', v_existing_count;
    RETURN;
  END IF;

  -- ========================================================================
  -- CREATE TEMPORARY MAPPING TABLE
  -- Tracks old_template_id + step_index -> new IDs for override migration
  -- ========================================================================
  CREATE TEMP TABLE _migration_step_map (
    old_template_id UUID NOT NULL,
    old_step_index INT NOT NULL,
    new_email_template_id UUID NOT NULL,
    new_schedule_step_id UUID NOT NULL,
    new_schedule_id UUID NOT NULL
  );

  -- ========================================================================
  -- STEP 1: Migrate reminder_templates -> schedules + email_templates + schedule_steps
  -- ========================================================================
  FOR v_template IN
    SELECT id, filing_type_id, name, description, steps, is_active
    FROM reminder_templates
    ORDER BY created_at
  LOOP
    -- 1a. Create a schedules row for this reminder_template
    v_new_schedule_id := gen_random_uuid();

    INSERT INTO schedules (id, filing_type_id, name, description, is_active)
    VALUES (
      v_new_schedule_id,
      v_template.filing_type_id,
      v_template.name,
      v_template.description,
      v_template.is_active
    );

    -- 1b. Iterate each step in the JSONB steps array
    FOR v_step IN
      SELECT
        value->>'step_number' AS step_number,
        value->>'delay_days' AS delay_days,
        value->>'subject' AS subject,
        value->>'body' AS body,
        ordinality - 1 AS step_index
      FROM jsonb_array_elements(v_template.steps) WITH ORDINALITY
      ORDER BY ordinality
    LOOP
      v_step_number := COALESCE(v_step.step_number::INT, v_step.step_index + 1);

      -- Convert plain text body to TipTap JSON
      v_body := v_step.body;
      IF v_body IS NOT NULL AND v_body <> '' THEN
        v_body_json := jsonb_build_object(
          'type', 'doc',
          'content', jsonb_build_array(
            jsonb_build_object(
              'type', 'paragraph',
              'content', jsonb_build_array(
                jsonb_build_object(
                  'type', 'text',
                  'text', v_body
                )
              )
            )
          )
        );
      ELSE
        -- Empty or null body -> valid empty TipTap document
        v_body_json := jsonb_build_object(
          'type', 'doc',
          'content', jsonb_build_array(
            jsonb_build_object(
              'type', 'paragraph'
            )
          )
        );
      END IF;

      -- Derive urgency_level from step_number
      IF v_step_number <= 2 THEN
        v_urgency := 'normal';
      ELSIF v_step_number = 3 THEN
        v_urgency := 'high';
      ELSE
        v_urgency := 'urgent';
      END IF;

      -- 1b-i. Create email_templates row
      v_new_email_template_id := gen_random_uuid();

      INSERT INTO email_templates (id, name, subject, body_json, body_plain, is_active)
      VALUES (
        v_new_email_template_id,
        v_template.name || ' - Step ' || v_step_number,
        COALESCE(v_step.subject, ''),
        v_body_json,
        v_body,
        true
      );

      -- 1b-ii. Create schedule_steps row
      v_new_schedule_step_id := gen_random_uuid();

      INSERT INTO schedule_steps (id, schedule_id, email_template_id, step_number, delay_days, urgency_level)
      VALUES (
        v_new_schedule_step_id,
        v_new_schedule_id,
        v_new_email_template_id,
        v_step_number,
        COALESCE(v_step.delay_days::INT, 0),
        v_urgency
      );

      -- 1b-iii. Record mapping for override migration
      INSERT INTO _migration_step_map (old_template_id, old_step_index, new_email_template_id, new_schedule_step_id, new_schedule_id)
      VALUES (
        v_template.id,
        v_step.step_index,
        v_new_email_template_id,
        v_new_schedule_step_id,
        v_new_schedule_id
      );

    END LOOP;
  END LOOP;

  RAISE NOTICE 'Step 1 complete: Templates and schedules migrated.';

  -- ========================================================================
  -- STEP 2: Migrate client_template_overrides -> client_email_overrides + client_schedule_overrides
  -- ========================================================================
  FOR v_override IN
    SELECT
      id,
      client_id,
      template_id,
      step_index,
      overridden_fields
    FROM client_template_overrides
    ORDER BY created_at
  LOOP
    -- Find the mapped new IDs
    SELECT new_email_template_id, new_schedule_step_id
    INTO v_mapped_email_template_id, v_mapped_schedule_step_id
    FROM _migration_step_map
    WHERE old_template_id = v_override.template_id
      AND old_step_index = v_override.step_index;

    IF v_mapped_email_template_id IS NULL THEN
      RAISE NOTICE 'Warning: No mapping found for template_id=%, step_index=%. Skipping override %.',
        v_override.template_id, v_override.step_index, v_override.id;
      CONTINUE;
    END IF;

    -- 2a. If overridden_fields contains subject or body -> client_email_overrides
    IF v_override.overridden_fields ? 'subject' OR v_override.overridden_fields ? 'body' THEN
      INSERT INTO client_email_overrides (client_id, email_template_id, subject_override, body_json_override)
      VALUES (
        v_override.client_id,
        v_mapped_email_template_id,
        v_override.overridden_fields->>'subject',
        CASE
          WHEN v_override.overridden_fields ? 'body' AND (v_override.overridden_fields->>'body') IS NOT NULL AND (v_override.overridden_fields->>'body') <> ''
          THEN jsonb_build_object(
            'type', 'doc',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'paragraph',
                'content', jsonb_build_array(
                  jsonb_build_object(
                    'type', 'text',
                    'text', v_override.overridden_fields->>'body'
                  )
                )
              )
            )
          )
          WHEN v_override.overridden_fields ? 'body'
          THEN jsonb_build_object(
            'type', 'doc',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'paragraph'
              )
            )
          )
          ELSE NULL
        END
      )
      ON CONFLICT (client_id, email_template_id) DO UPDATE SET
        subject_override = EXCLUDED.subject_override,
        body_json_override = EXCLUDED.body_json_override;
    END IF;

    -- 2b. If overridden_fields contains delay_days -> client_schedule_overrides
    IF v_override.overridden_fields ? 'delay_days' THEN
      INSERT INTO client_schedule_overrides (client_id, schedule_step_id, delay_days_override)
      VALUES (
        v_override.client_id,
        v_mapped_schedule_step_id,
        (v_override.overridden_fields->>'delay_days')::INT
      )
      ON CONFLICT (client_id, schedule_step_id) DO UPDATE SET
        delay_days_override = EXCLUDED.delay_days_override;
    END IF;

  END LOOP;

  RAISE NOTICE 'Step 2 complete: Overrides migrated.';

  -- ========================================================================
  -- CLEANUP: Drop temporary mapping table
  -- ========================================================================
  DROP TABLE IF EXISTS _migration_step_map;

  RAISE NOTICE 'Migration complete. Old tables remain untouched.';
END $$;
