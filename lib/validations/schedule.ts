import { z } from "zod";

/**
 * Schema for a single schedule step
 */
export const scheduleStepSchema = z.object({
  email_template_id: z.string().refine(
    (val) => val === "" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
    "Email template is required and must be a valid ID"
  ),
  delay_days: z.number().int().min(0).max(365),
});

/**
 * Base fields shared between filing and custom schedule schemas
 */
const baseFields = {
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().optional(),
  steps: z.array(scheduleStepSchema),
  is_active: z.boolean(),
};

/**
 * Schema for filing type schedules (linked to an HMRC filing type)
 */
export const filingScheduleSchema = z.object({
  ...baseFields,
  schedule_type: z.literal('filing'),
  filing_type_id: z.enum([
    'corporation_tax_payment',
    'ct600_filing',
    'companies_house',
    'vat_return',
    'self_assessment'
  ] as const),
  custom_date: z.null().optional(),
  recurrence_rule: z.null().optional(),
  recurrence_anchor: z.null().optional(),
});

/**
 * Schema for custom schedules (user-defined dates, not linked to filing types)
 */
export const customScheduleSchema = z.object({
  ...baseFields,
  schedule_type: z.literal('custom'),
  filing_type_id: z.null().optional(),
  custom_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format").nullable().optional(),
  recurrence_rule: z.enum(['monthly', 'quarterly', 'annually']).nullable().optional(),
  recurrence_anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format").nullable().optional(),
  send_hour: z.number().int().min(0).max(23).nullable().optional(),
}).refine(
  (data) => data.custom_date || (data.recurrence_rule && data.recurrence_anchor),
  { message: "Custom schedules require either a target date or a recurrence rule with anchor date" }
);

/**
 * Discriminated union schema for schedule creation/update
 * Replaces the old single schema - validates both filing and custom schedules
 */
export const scheduleSchema = z.discriminatedUnion('schedule_type', [
  filingScheduleSchema,
  customScheduleSchema,
]);

export type ScheduleStepInput = z.infer<typeof scheduleStepSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type FilingScheduleInput = z.infer<typeof filingScheduleSchema>;
export type CustomScheduleInput = z.infer<typeof customScheduleSchema>;
