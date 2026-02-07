import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  QUICKBOOKS_CLIENT_ID: z.string().min(1),
  QUICKBOOKS_CLIENT_SECRET: z.string().min(1),
  QUICKBOOKS_REDIRECT_URI: z.string().url(),
  QUICKBOOKS_ENVIRONMENT: z.enum(["sandbox", "production"]),
  NEXT_PUBLIC_APP_URL: z.string().url(),
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
