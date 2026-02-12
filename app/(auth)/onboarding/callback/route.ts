import { NextRequest, NextResponse } from "next/server";
import {
  handleQuickBooksCallback,
  syncClientsAction,
} from "@/app/actions/quickbooks";
import { getOAuthClient } from "@/lib/quickbooks/oauth-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const realmId = searchParams.get("realmId");

    // Validate required parameters
    if (!code || !realmId) {
      console.error("OAuth callback missing required parameters:", {
        hasCode: !!code,
        hasRealmId: !!realmId,
      });
      return NextResponse.redirect(
        new URL("/login?error=oauth_failed", request.url)
      );
    }

    // Exchange authorization code for tokens
    await handleQuickBooksCallback(request.nextUrl.href, realmId);

    // Create a unique email for this QuickBooks company
    // This is used solely for Supabase Auth - the realmId is the true identifier
    const email = `qb-${realmId}@peninsula-internal.local`;

    // Create or get Supabase user using admin client
    const adminSupabase = createAdminClient();

    // Try to get existing user by email
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u) => u.email === email);

    let userId: string;

    if (existingUser) {
      // User exists
      userId = existingUser.id;
    } else {
      // Create new user with a random password (they'll use QuickBooks OAuth to log in)
      const randomPassword = crypto.randomUUID();
      const { data: newUser, error: createError } =
        await adminSupabase.auth.admin.createUser({
          email,
          password: randomPassword,
          email_confirm: true, // Auto-confirm since QuickBooks verified them
        });

      if (createError || !newUser?.user) {
        console.error("Failed to create Supabase user:", createError);
        return NextResponse.redirect(
          new URL("/login?error=auth_failed", request.url)
        );
      }

      userId = newUser.user.id;
    }

    // Create a session for this user by setting auth cookies
    const cookieStore = await cookies();
    const response = NextResponse.redirect(new URL("/onboarding", request.url));

    // Create a server client with cookie access to set the session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Sign in the user using admin-generated session
    const { data: sessionData, error: sessionError } =
      await adminSupabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (sessionError || !sessionData) {
      console.error("Failed to generate session link:", sessionError);
      return NextResponse.redirect(
        new URL("/login?error=session_failed", request.url)
      );
    }

    // Auto-sync clients immediately after connection
    const syncResult = await syncClientsAction();

    if (!syncResult.success) {
      console.error("Client sync failed after OAuth:", syncResult.error);
      return NextResponse.redirect(
        new URL("/onboarding?error=sync_failed", request.url)
      );
    }

    // Extract hash from action link and set up redirect with session
    const actionLink = sessionData.properties.action_link;
    const hashMatch = actionLink.match(/#(.+)$/);

    if (hashMatch) {
      const params = new URLSearchParams(hashMatch[1]);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        // Set session using the tokens
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    }

    // Redirect to onboarding page with success state
    const finalResponse = NextResponse.redirect(
      new URL(
        `/onboarding?syncing=true&count=${syncResult.count}`,
        request.url
      )
    );

    // Copy cookies from the supabase client to the response
    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return finalResponse;
  } catch (error) {
    console.error("OAuth callback error:", error);

    // Determine error type for user feedback
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Log detailed error server-side but show generic message to user
    console.error("Detailed error:", errorMessage);

    return NextResponse.redirect(
      new URL("/login?error=auth_failed", request.url)
    );
  }
}
