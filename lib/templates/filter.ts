/**
 * Shared template filtering logic.
 *
 * "Default" templates are the three generic ones every org starts with.
 * "Custom" templates are user-created (is_custom = true).
 * "Dedicated" templates are everything else — created for a specific filing type's schedule.
 *
 * When a filing type is selected, dedicated templates for OTHER filing types are hidden
 * so the dropdown stays focused and relevant.
 */

const GENERIC_TEMPLATE_NAMES = new Set([
  'Friendly First Reminder',
  'Follow-Up Reminder',
  'Urgent Final Notice',
])

export interface FilterableTemplate {
  id: string
  name: string
  is_custom?: boolean
  filing_type_id?: string | null
}

/**
 * Filter templates based on a selected filing type.
 * - If no filing type is selected, all templates are returned.
 * - Custom and default (generic) templates are always shown.
 * - Dedicated templates are only shown if they match the selected filing type
 *   or have no filing type association.
 */
export function filterTemplatesByFilingType<T extends FilterableTemplate>(
  templates: T[],
  selectedFilingTypeId: string | null | undefined,
): T[] {
  if (!selectedFilingTypeId) return templates

  return templates.filter((t) => {
    // Custom templates: always show
    if (t.is_custom) return true
    // Default/generic templates: always show
    if (GENERIC_TEMPLATE_NAMES.has(t.name)) return true
    // Dedicated templates with no filing type association: show (can't determine relevance)
    if (!t.filing_type_id) return true
    // Dedicated templates: only show if matching the selected filing type
    return t.filing_type_id === selectedFilingTypeId
  })
}
