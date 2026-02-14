"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Send a magic link to the provided email address
 */
export async function sendMagicLink(email: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
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
