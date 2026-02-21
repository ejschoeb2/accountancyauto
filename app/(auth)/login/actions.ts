"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Send a magic link to the provided email address.
 * In production, the emailRedirectTo URL uses the org's subdomain so the
 * auth session cookie is scoped to the correct origin.
 * In development, falls back to NEXT_PUBLIC_APP_URL (localhost).
 */
export async function sendMagicLink(email: string, orgSlug?: string) {
  const supabase = await createClient();

  // Determine callback URL based on environment and org context
  let callbackUrl: string;
  if (orgSlug && process.env.NODE_ENV === "production") {
    callbackUrl = `https://${orgSlug}.app.phasetwo.uk/auth/callback`;
  } else {
    callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  });

  if (error) {
    console.error("Magic link error:", error);
    return { error: "Failed to send login link. Please try again." };
  }

  return { success: true };
}

/**
 * Sign in as demo user with shared demo account
 * Redirects directly to dashboard (skips onboarding)
 */
export async function signInAsDemo() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: "demo@peninsula-internal.local",
    password: "demo-peninsula-2026-secure",
  });

  if (error) {
    console.error("Demo sign-in error:", error);
    return { error: "Demo mode is not available. Please contact support." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
