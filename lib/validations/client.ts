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
  primary_email: z.string().trim().email("Invalid email address").optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  client_type: clientTypeSchema.optional(),
  year_end_date: isoDateSchema.optional().nullable(),
  vat_registered: z.boolean().optional(),
  vat_stagger_group: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().nullable(),
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

// Schema for creating a new client (demo client creation dialog)
export const createClientSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(200, "Company name must be 200 characters or fewer"),
  primary_email: z.string().trim().email("Invalid email address"),
  client_type: clientTypeSchema,
  year_end_date: isoDateSchema.optional().nullable(),
  vat_registered: z.boolean().default(false),
  display_name: z.string().trim().max(200, "Display name must be 200 characters or fewer").optional().nullable(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export type ClientType = z.infer<typeof clientTypeSchema>;
export type UpdateClientMetadataInput = z.infer<typeof updateClientMetadataSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
