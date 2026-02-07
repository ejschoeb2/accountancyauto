import { z } from "zod";

export const clientTypeSchema = z.enum([
  "Limited Company",
  "Sole Trader",
  "Partnership",
  "LLP",
]);

// ISO date validation (YYYY-MM-DD)
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Date must be in YYYY-MM-DD format",
});

export const updateClientMetadataSchema = z.object({
  client_type: clientTypeSchema.optional(),
  year_end_date: isoDateSchema.optional().nullable(),
  vat_registered: z.boolean().optional(),
  vat_quarter: z.enum(["Jan-Mar", "Apr-Jun", "Jul-Sep", "Oct-Dec"]).optional().nullable(),
  vat_scheme: z.enum(["Standard", "Flat Rate", "Cash Accounting", "Annual Accounting"]).optional().nullable(),
  reminders_paused: z.boolean().optional(),
  records_received_for: z.array(z.string()).optional(),
}).partial();

export const bulkUpdateSchema = z.array(
  z.object({
    id: z.string().uuid(),
    metadata: updateClientMetadataSchema,
  })
);

export type ClientType = z.infer<typeof clientTypeSchema>;
export type UpdateClientMetadataInput = z.infer<typeof updateClientMetadataSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
