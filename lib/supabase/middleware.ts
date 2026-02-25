import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getOrgSlug, resolveOrgFromSlug } from "@/lib/middleware/subdomain";
import { enforceSubscription } from "@/lib/middleware/access-gating";

// Routes that don't require org context or authentication
const PUBLIC_ROUTES = ["/login", "/auth/callback", "/auth/signout", "/pricing", "/onboarding", "/invite/accept", "/portal"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

/**
 * Derives the marketing site URL from the current request's host.
 * Strips {slug}.app. or app. prefix to get the apex/marketing domain.
 * e.g. acme.app.phasetwo.uk → https://phasetwo.uk
 *      localhost:3000        → http://localhost:3000
 */
function getMarketingUrl(request: NextRequest): URL {
  const host = request.headers.get("host") || "";
  const baseDomain = host.replace(/^([^.]+\.)*app\./, "");
  const scheme = process.env.NODE_ENV === "development" ? "http" : "https";
  return new URL(`${scheme}://${baseDomain}`);
}

/**
 * Copies cookies from one response to another.
 * Required when creating redirect responses so the refreshed auth token is preserved.
 */
function copyCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

export async function updateSession(request: NextRequest) {
  // Step 1: Create Supabase client with cookie handling
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Step 2: Refresh auth token — IMPORTANT: do not remove, required for session refresh
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  // Step 3: Always allow public routes and API routes through (after session refresh)
  if (isPublicRoute(pathname) || isApiRoute(pathname)) {
    // For authenticated users hitting /login, redirect to home
    if (user && pathname === "/login") {
      const slug = getOrgSlug(request);
      if (slug) {
        const homeUrl = new URL("/", request.url);
        const redirect = NextResponse.redirect(homeUrl, 307);
        copyCookies(supabaseResponse, redirect);
        return redirect;
      }
    }
    return supabaseResponse;
  }

  // Step 3.5: Admin route bypass — skip org membership and subscription enforcement
  if (isAdminRoute(pathname)) {
    // Unauthenticated users navigating to /admin are redirected to /login
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const redirect = NextResponse.redirect(loginUrl, 307);
      copyCookies(supabaseResponse, redirect);
      return redirect;
    }
    // Authenticated users pass through — page-level guard enforces is_super_admin check
    return supabaseResponse;
  }

  // Step 4: Extract org slug from request
  const slug = getOrgSlug(request);

  // Step 5: Handle no-slug cases
  if (!slug) {
    // Allow the root marketing page through (dev preview + production root)
    if (pathname === "/") {
      return supabaseResponse;
    }

    if (user) {
      // Authenticated user with no org context — find their org and redirect
      const { data: userOrg } = await supabase
        .from("user_organisations")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (userOrg?.org_id) {
        const { data: org } = await supabase
          .from("organisations")
          .select("slug")
          .eq("id", userOrg.org_id)
          .single();

        if (org?.slug) {
          let redirectUrl: URL;
          if (isDev) {
            // Add ?org= param in development
            redirectUrl = new URL(request.url);
            redirectUrl.searchParams.set("org", org.slug);
          } else {
            // Redirect to subdomain in production
            const host = request.headers.get("host") || "";
            const baseDomain = host.replace(/^app\./, "");
            redirectUrl = new URL(
              `https://${org.slug}.app.${baseDomain}${pathname}`
            );
          }
          const redirect = NextResponse.redirect(redirectUrl, 307);
          copyCookies(supabaseResponse, redirect);
          return redirect;
        }
      }

      // Fallback: no org found — redirect to onboarding so user can create an org
      const onboardingUrl = new URL("/onboarding", request.url);
      const onboardingRedirect = NextResponse.redirect(onboardingUrl, 307);
      copyCookies(supabaseResponse, onboardingRedirect);
      return onboardingRedirect;
    } else {
      // Not authenticated, no slug:
      // In dev with no ?org=, redirect to /login
      // In production, bare app.phasetwo.uk → redirect to marketing site
      if (isDev) {
        const loginUrl = new URL("/login", request.url);
        const redirect = NextResponse.redirect(loginUrl, 307);
        copyCookies(supabaseResponse, redirect);
        return redirect;
      } else {
        return NextResponse.redirect(getMarketingUrl(request), 307);
      }
    }
  }

  // Step 6: Slug present — resolve org from slug
  const org = await resolveOrgFromSlug(supabase, slug);

  if (!org) {
    // Invalid slug — redirect to marketing site
    return NextResponse.redirect(getMarketingUrl(request), 307);
  }

  // Step 7: Unauthenticated user on valid org subdomain → redirect to login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const redirect = NextResponse.redirect(loginUrl, 307);
    copyCookies(supabaseResponse, redirect);
    return redirect;
  }

  // Step 8: Authenticated user — validate org membership
  const jwtOrgId = user.app_metadata?.org_id as string | undefined;

  if (jwtOrgId) {
    // Fast path: compare JWT org_id to resolved org
    if (jwtOrgId !== org.id) {
      // Wrong org subdomain — find user's actual org slug and redirect
      const { data: userOrg } = await supabase
        .from("organisations")
        .select("slug")
        .eq("id", jwtOrgId)
        .single();

      if (userOrg?.slug) {
        let redirectUrl: URL;
        if (isDev) {
          redirectUrl = new URL(request.url);
          redirectUrl.searchParams.set("org", userOrg.slug);
        } else {
          const host = request.headers.get("host") || "";
          // Replace current slug subdomain with user's actual slug
          const hostWithoutSlug = host.replace(/^[^.]+\./, "");
          redirectUrl = new URL(
            `https://${userOrg.slug}.${hostWithoutSlug}${pathname}`
          );
        }
        const redirect = NextResponse.redirect(redirectUrl, 307);
        copyCookies(supabaseResponse, redirect);
        return redirect;
      }

      // Fallback: can't find user's org — redirect to marketing
      return NextResponse.redirect(getMarketingUrl(request), 307);
    }
  } else {
    // Fallback path: no org_id in JWT — query user_organisations directly
    const { data: userOrg } = await supabase
      .from("user_organisations")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!userOrg?.org_id) {
      // User has no org — redirect to marketing
      return NextResponse.redirect(getMarketingUrl(request), 307);
    }

    if (userOrg.org_id !== org.id) {
      // User belongs to different org — redirect to their org
      const { data: actualOrg } = await supabase
        .from("organisations")
        .select("slug")
        .eq("id", userOrg.org_id)
        .single();

      if (actualOrg?.slug) {
        let redirectUrl: URL;
        if (isDev) {
          redirectUrl = new URL(request.url);
          redirectUrl.searchParams.set("org", actualOrg.slug);
        } else {
          const host = request.headers.get("host") || "";
          const hostWithoutSlug = host.replace(/^[^.]+\./, "");
          redirectUrl = new URL(
            `https://${actualOrg.slug}.${hostWithoutSlug}${pathname}`
          );
        }
        const redirect = NextResponse.redirect(redirectUrl, 307);
        copyCookies(supabaseResponse, redirect);
        return redirect;
      }

      return NextResponse.redirect(getMarketingUrl(request), 307);
    }
  }

  // Step 9: Correct org — enforce subscription status
  const subEnforcement = enforceSubscription(request, org);
  if (subEnforcement) {
    copyCookies(supabaseResponse, subEnforcement);
    return subEnforcement;
  }

  // Step 10: All checks pass — set x-org-slug header and continue
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-org-slug", slug);

  // Create a new response with updated request headers
  const finalResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Copy refreshed auth cookies from supabaseResponse to finalResponse
  copyCookies(supabaseResponse, finalResponse);

  return finalResponse;
}
