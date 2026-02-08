import { z } from "zod";

/**
 * Recursive TipTap node schema for validating editor JSON structure
 */
export const tipTapNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.string(),
    content: z.array(tipTapNodeSchema).optional(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .optional(),
  })
);

/**
 * TipTap document root schema
 */
export const tipTapDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tipTapNodeSchema),
});

/**
 * Email template validation schema for v1.1
 * Validates name, subject, TipTap JSON body, and active status
 */
export const emailTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must be 200 characters or less"),
  body_json: tipTapDocumentSchema,
  is_active: z.boolean().default(true),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;
