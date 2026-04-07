import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes excluded from CSRF checks — these use their own signature/token-based auth
const CSRF_EXCLUDED_PREFIXES = [
  "/api/stripe/webhook",
  "/api/webhooks/postmark",
  "/api/cron/",
  "/api/portal/",
  "/api/unsubscribe",
];

function isCsrfExcluded(pathname: string): boolean {
  return CSRF_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function csrfCheck(request: NextRequest): NextResponse | null {
  const { method, nextUrl } = request;

  // Only check mutation requests to /api/* routes
  if (!nextUrl.pathname.startsWith("/api/")) return null;
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;
  if (isCsrfExcluded(nextUrl.pathname)) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const appHost = appUrl ? new URL(appUrl).host : nextUrl.host;

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Derive host from Origin header first, then fall back to Referer
  let requestHost: string | null = null;
  if (origin) {
    try {
      requestHost = new URL(origin).host;
    } catch {
      // malformed origin — deny
    }
  } else if (referer) {
    try {
      requestHost = new URL(referer).host;
    } catch {
      // malformed referer — deny
    }
  }

  if (requestHost !== appHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function middleware(request: NextRequest) {
  // AUDIT-013: Generate correlation ID for request tracing
  const correlationId = crypto.randomUUID();

  // CSRF check first (before modifying headers)
  const csrfResponse = csrfCheck(request);
  if (csrfResponse) {
    csrfResponse.headers.set("x-correlation-id", correlationId);
    return csrfResponse;
  }

  // Add correlation ID to request headers for downstream handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-correlation-id", correlationId);

  // Pass through to session handler with modified headers
  const response = await updateSession(
    new NextRequest(request.url, {
      headers: requestHeaders,
      method: request.method,
      body: request.body,
      redirect: request.redirect,
      signal: request.signal,
    })
  );

  // Add correlation ID to response headers
  response.headers.set("x-correlation-id", correlationId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|api/postmark|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
