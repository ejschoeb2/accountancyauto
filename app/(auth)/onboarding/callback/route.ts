import { NextRequest, NextResponse } from "next/server";
import {
  handleQuickBooksCallback,
  syncClientsAction,
} from "@/app/actions/quickbooks";

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
        new URL("/onboarding?error=oauth_failed", request.url)
      );
    }

    // Exchange authorization code for tokens
    await handleQuickBooksCallback(request.nextUrl.href, realmId);

    // Auto-sync clients immediately after connection
    const syncResult = await syncClientsAction();

    if (!syncResult.success) {
      console.error("Client sync failed after OAuth:", syncResult.error);
      return NextResponse.redirect(
        new URL("/onboarding?error=sync_failed", request.url)
      );
    }

    // Redirect to onboarding page with success state
    return NextResponse.redirect(
      new URL(
        `/onboarding?syncing=true&count=${syncResult.count}`,
        request.url
      )
    );
  } catch (error) {
    console.error("OAuth callback error:", error);

    // Determine error type for user feedback
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Log detailed error server-side but show generic message to user
    console.error("Detailed error:", errorMessage);

    return NextResponse.redirect(
      new URL("/onboarding?error=sync_failed", request.url)
    );
  }
}
