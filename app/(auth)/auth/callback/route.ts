import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Get the authenticated user to resolve their org for subdomain redirect
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
          const redirectPath = requestUrl.searchParams.get("redirect") || "/";

          if (isLocalhost) {
            // Development: redirect to localhost with ?org= query param
            const devUrl = new URL(redirectPath, origin);
            devUrl.searchParams.set("org", org.slug);
            return NextResponse.redirect(devUrl);
          } else {
            // Production: redirect to org's subdomain
            return NextResponse.redirect(
              new URL(redirectPath, `https://${org.slug}.app.phasetwo.uk`)
            );
          }
        }
      }
    }
  }

  // Fallback: redirect to origin root (middleware will handle org resolution)
  return NextResponse.redirect(`${origin}/`);
}
