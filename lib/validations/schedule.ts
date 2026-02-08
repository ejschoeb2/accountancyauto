import { z } from "zod";

/**
 * Schema for a single schedule step
 */
export const scheduleStepSchema = z.object({
  email_template_id: z.string().uuid("Invalid email template ID"),
  delay_days: z.number().int().min(1).max(365),
  urgency_level: z.enum(['normal', 'high', 'urgent'] as const),
});

/**
 * Schema for schedule creation/update
 */
export const scheduleSchema = z.object({
  filing_type_id: z.enum([
    'corporation_tax_payment',
    'ct600_filing',
    'companies_house',
    'vat_return',
    'self_assessment'
  ] as const),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().optional(),
  steps: z.array(scheduleStepSchema),
  is_active: z.boolean(),
});

export type ScheduleStepInput = z.infer<typeof scheduleStepSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
