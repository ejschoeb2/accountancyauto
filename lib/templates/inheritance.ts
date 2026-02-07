import { TemplateStep } from '@/lib/types/database';

/**
 * Override entry for a specific step in a template
 */
export interface OverrideEntry {
  step_index: number;
  overridden_fields: Partial<Pick<TemplateStep, 'subject' | 'body' | 'delay_days'>>;
}

/**
 * Resolves a template for a specific client by merging base template steps with client-specific overrides.
 *
 * Key behavior: Only overridden fields are replaced. Non-overridden fields always come from the base template.
 * This ensures that when a base template is updated, those changes propagate to clients who haven't overridden
 * those specific fields.
 *
 * @param baseSteps - Steps from the base reminder template
 * @param overrides - Client-specific field overrides
 * @returns Resolved template steps with overrides applied
 *
 * @example
 * const baseSteps = [
 *   { step_number: 1, delay_days: 60, subject: 'Reminder', body: 'Please submit...' }
 * ];
 * const overrides = [
 *   { step_index: 0, overridden_fields: { subject: 'Custom subject' } }
 * ];
 * const resolved = resolveTemplateForClient(baseSteps, overrides);
 * // Result: step 1 has custom subject but delay_days and body from base
 */
export function resolveTemplateForClient(
  baseSteps: TemplateStep[],
  overrides: OverrideEntry[]
): TemplateStep[] {
  return baseSteps.map((baseStep, index) => {
    // Find override for this step index
    const override = overrides.find((o) => o.step_index === index);

    if (!override) {
      // No override for this step, return base step unchanged
      return baseStep;
    }

    // Merge: start with base step, then apply overridden fields
    return {
      ...baseStep,
      ...override.overridden_fields,
    };
  });
}

/**
 * Returns which fields are overridden per step index (for UI display of customizations).
 *
 * @param baseSteps - Steps from the base reminder template
 * @param overrides - Client-specific field overrides
 * @returns Map of step_index -> array of overridden field names
 *
 * @example
 * const overrides = [
 *   { step_index: 0, overridden_fields: { subject: 'Custom', body: 'Custom body' } }
 * ];
 * const fieldNames = getOverriddenFieldNames(baseSteps, overrides);
 * // Returns: Map { 0 => ['subject', 'body'] }
 */
export function getOverriddenFieldNames(
  baseSteps: TemplateStep[],
  overrides: OverrideEntry[]
): Map<number, string[]> {
  const result = new Map<number, string[]>();

  for (const override of overrides) {
    // Skip overrides for non-existent step indices
    if (override.step_index < 0 || override.step_index >= baseSteps.length) {
      continue;
    }

    const fieldNames = Object.keys(override.overridden_fields);
    if (fieldNames.length > 0) {
      result.set(override.step_index, fieldNames);
    }
  }

  return result;
}
