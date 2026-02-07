import { z } from "zod";
import { FilingTypeId } from "@/lib/types/database";

/**
 * Schema for a single template step
 */
export const templateStepSchema = z.object({
  step_number: z.number().int().min(1).max(5),
  delay_days: z.number().int().min(1).max(365),
  subject: z.string().min(1, "Subject is required").max(200, "Subject must be 200 characters or less"),
  body: z.string().min(1, "Body is required").max(5000, "Body must be 5000 characters or less"),
});

/**
 * Schema for reminder template creation/update
 */
export const templateSchema = z.object({
  filing_type_id: z.enum([
    'corporation_tax_payment',
    'ct600_filing',
    'companies_house',
    'vat_return',
    'self_assessment'
  ] as const),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().optional(),
  steps: z.array(templateStepSchema)
    .min(1, "At least 1 step is required")
    .max(5, "Maximum 5 steps allowed"),
  is_active: z.boolean(),
});

export type TemplateStepInput = z.infer<typeof templateStepSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
