import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const match = appUrl.match(/^https?:\/\/([^/]+)/);
  if (!match) return undefined;
  const parts = match[1].split(".");
  return parts.length >= 2 ? "." + parts.slice(-2).join(".") : undefined;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const cookieDomain = getCookieDomain();

    // Capture cookies with their full options so we can replay them onto the redirect
    // response. We cannot use createClient() here because that uses Next.js's cookies()
    // API, which only applies cookies to Next.js's internal response — not to a custom
    // NextResponse.redirect() object. Without this, exchangeCodeForSession sets the
    // session cookies on an unreturned internal response, the redirect carries no cookies,
    // and the wizard page finds no session and bounces the user back to /signup.
    type CookieEntry = {
      name: string;
      value: string;
      options?: Record<string, unknown>;
    };
    const pendingCookies: CookieEntry[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({
                name,
                value,
                options: cookieDomain
                  ? { ...options, domain: cookieDomain }
                  : options,
              });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error.message, error);
      // If the PKCE code verifier is missing (e.g. cookies cleared between
      // signup and email click), the user's email is still confirmed on
      // Supabase's side — they just need to log in with their credentials.
      return NextResponse.redirect(
        `${origin}/login?message=${encodeURIComponent(
          "Email confirmed! Please sign in."
        )}`
      );
    }

    // Get the authenticated user to resolve their org for subdomain redirect
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let redirectTarget = `${origin}/setup/wizard`;

    if (user) {
      // Use org_id from JWT app_metadata (set by Custom Access Token Hook)
      const orgId = user.app_metadata?.org_id as string | undefined;

      if (orgId) {
        const { data: org } = await supabase
          .from("organisations")
          .select("slug")
          .eq("id", orgId)
          .single();

        if (org?.slug) {
          const hostname = request.headers.get("host") || "";
          const isLocalhost =
            hostname.includes("localhost") || hostname.includes("127.0.0.1");

          // Preserve any redirect path that middleware set before sending to /login
          const redirectPath =
            requestUrl.searchParams.get("redirect") || "/dashboard";

          if (isLocalhost) {
            // Development: redirect to localhost with ?org= query param
            const devUrl = new URL(redirectPath, origin);
            devUrl.searchParams.set("org", org.slug);
            redirectTarget = devUrl.toString();
          } else {
            // Production: derive base domain from current host
            // e.g. app.prompt.accountants → prompt.accountants
            const baseDomain =
              hostname.replace(/^([^.]+\.)*app\./, "") || hostname;
            redirectTarget = new URL(
              redirectPath,
              `https://${org.slug}.app.${baseDomain}`
            ).toString();
          }
        }
      }
    }

    // If the user came from an invite signup, the invite token was embedded in
    // the emailRedirectTo URL and survived the Supabase email round-trip.
    const inviteToken = requestUrl.searchParams.get("invite");
    if (inviteToken && !user?.app_metadata?.org_id) {
      redirectTarget = `${origin}/invite/accept?token=${encodeURIComponent(
        inviteToken
      )}`;
    }

    // Build the redirect response and apply all session cookies to it
    const redirect = NextResponse.redirect(redirectTarget);
    pendingCookies.forEach(({ name, value, options }) => {
      redirect.cookies.set(
        name,
        value,
        options as Parameters<typeof redirect.cookies.set>[2]
      );
    });
    return redirect;
  }

  // If the user came from an invite signup, the invite token was embedded in
  // the emailRedirectTo URL and survived the Supabase email round-trip.
  // Redirect them back to the invite accept page to complete joining.
  const inviteToken = requestUrl.searchParams.get("invite");
  if (inviteToken) {
    return NextResponse.redirect(
      `${origin}/invite/accept?token=${encodeURIComponent(inviteToken)}`
    );
  }

  // No code and no invite — send to setup wizard
  return NextResponse.redirect(`${origin}/setup/wizard`);
}
