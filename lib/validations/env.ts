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

  // Stripe (optional - billing feature)
  STRIPE_SECRET_KEY: z.string().optional(),
});

function warnOnProductionSecretsInDev(data: z.infer<typeof envSchema>) {
  if (process.env.NODE_ENV !== "development") return;

  if (data.STRIPE_SECRET_KEY && !data.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    console.warn(
      "WARNING: Using production Stripe key in development. Set STRIPE_SECRET_KEY to a sk_test_ key to avoid accidental charges."
    );
  }

  if (
    data.POSTMARK_SERVER_TOKEN &&
    !data.POSTMARK_SERVER_TOKEN.toLowerCase().includes("test")
  ) {
    console.warn(
      "WARNING: Using what appears to be a production Postmark token in development. Emails sent will reach real recipients."
    );
  }
}

export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  warnOnProductionSecretsInDev(result.data);

  return result.data;
}

export const env = validateEnv();
