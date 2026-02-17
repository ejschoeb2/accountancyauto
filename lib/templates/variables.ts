import { format, differenceInDays } from 'date-fns';

/**
 * Context object for template variable substitution
 */
export interface TemplateContext {
  client_name: string;
  deadline: Date;
  filing_type: string;
  accountant_name?: string;
}

/**
 * Available placeholder variables for template editor
 */
export const AVAILABLE_PLACEHOLDERS = [
  { name: 'client_name', description: "Client's company or trading name" },
  { name: 'deadline', description: 'Deadline date in long format (e.g., 31 January 2026)' },
  { name: 'deadline_short', description: 'Deadline date in short format (e.g., 31/01/2026)' },
  { name: 'filing_type', description: 'Type of filing (e.g., Corporation Tax Payment)' },
  { name: 'days_until_deadline', description: 'Number of days remaining until deadline' },
  { name: 'accountant_name', description: 'Practice name (Peninsula Accounting)' },
] as const;

/**
 * Substitutes template variables like {{client_name}} with actual values from context
 *
 * @param template - Template string with {{variable}} placeholders
 * @param context - Context object with variable values
 * @returns Template with variables replaced. Unknown variables are preserved.
 *
 * @example
 * substituteVariables('Dear {{client_name}}, your {{filing_type}} is due {{deadline}}', {
 *   client_name: 'ABC Ltd',
 *   deadline: new Date(2026, 0, 31),
 *   filing_type: 'Corporation Tax Payment'
 * })
 * // Returns: "Dear ABC Ltd, your Corporation Tax Payment is due 31 January 2026"
 */
export function substituteVariables(template: string, context: TemplateContext): string {
  // Build variables record from context
  const variables: Record<string, string> = {
    client_name: context.client_name,
    deadline: format(context.deadline, 'dd MMMM yyyy'),
    deadline_short: format(context.deadline, 'dd/MM/yyyy'),
    filing_type: context.filing_type,
    days_until_deadline: differenceInDays(context.deadline, new Date()).toString(),
    accountant_name: context.accountant_name || 'PhaseTwo',
  };

  // Replace all {{variable}} patterns
  // If variable exists in the record, use it; otherwise preserve the original {{variable}}
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
}
