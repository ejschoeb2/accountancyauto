import { z } from "zod";

const envSchema = z.object({
  // Supabase (required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // App (required)
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_IS_DEMO: z.string().optional(),

  // Email (optional - not needed for demo mode)
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  ACCOUNTANT_EMAIL: z.string().email().optional(),

  // Cron (optional - not needed for demo mode)
  CRON_SECRET: z.string().optional(),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
