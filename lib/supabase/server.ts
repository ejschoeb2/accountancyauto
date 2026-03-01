import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Returns a dot-prefixed root domain for cross-subdomain cookie sharing in production.
 * e.g. NEXT_PUBLIC_APP_URL=https://prompt.accountants → ".prompt.accountants"
 * Returns undefined in development so cookies use default host-only behaviour.
 */
function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const match = appUrl.match(/^https?:\/\/([^/]+)/);
  if (!match) return undefined;
  const parts = match[1].split(".");
  return parts.length >= 2 ? "." + parts.slice(-2).join(".") : undefined;
}

export async function createClient() {
  const cookieStore = await cookies();
  const cookieDomain = getCookieDomain();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                cookieDomain ? { ...options, domain: cookieDomain } : options
              )
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
