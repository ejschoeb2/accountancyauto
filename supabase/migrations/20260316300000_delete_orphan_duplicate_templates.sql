-- Downtime risk: MODERATE — requires backfill; may lock during constraint application
-- Delete orphaned duplicate email templates
--
-- When a new user joins an org, seedNewUserDefaults clones the admin's
-- templates. Admins then see both sets (their originals + the cloned copies).
-- The clones are unused (no schedule_steps reference them) and have a
-- different owner_id. This migration removes the duplicates by keeping only
-- the template with the most schedule_step references for each (org_id, name)
-- pair and deleting the rest that have zero schedule_step references.
--
-- Safety: only deletes templates that are NOT referenced by any schedule_step.

DELETE FROM email_templates
WHERE id IN (
  SELECT et.id
  FROM email_templates et
  -- Only target templates that have a duplicate (same org + name)
  WHERE EXISTS (
    SELECT 1 FROM email_templates et2
    WHERE et2.org_id = et.org_id
      AND et2.name = et.name
      AND et2.id <> et.id
  )
  -- Only delete if this template has zero schedule_step references
  AND NOT EXISTS (
    SELECT 1 FROM schedule_steps ss
    WHERE ss.email_template_id = et.id
  )
);
