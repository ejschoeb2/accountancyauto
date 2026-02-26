"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";


export async function signIn(email: string, password: string) {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : "Failed to sign in. Please try again.",
    };
  }

  // Derive base domain from NEXT_PUBLIC_APP_URL (e.g. prompt.qpon)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prompt.qpon";
  const baseDomain = appUrl.replace(/^https?:\/\/(www\.)?/, "");

  // Use org_id injected by the JWT Custom Access Token Hook
  const orgId = user?.app_metadata?.org_id as string | undefined;

  if (orgId) {
    const { data: org } = await supabase
      .from("organisations")
      .select("slug")
      .eq("id", orgId)
      .single();

    if (org?.slug) {
      redirect(`https://${org.slug}.app.${baseDomain}/`);
    }
  }

  // No org yet — new user, send to onboarding
  redirect("/onboarding");
}

export async function signUp(email: string, password: string) {
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  // NEXT_PUBLIC_APP_URL is the most reliable source (set in Vercel env vars).
  // Falls back to deriving from request headers if not set.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    h.get("origin") ||
    `${proto}://${host}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return {
        error: "An account with this email already exists. Please sign in.",
      };
    }
    return { error: "Failed to create account. Please try again." };
  }

  // Email confirmation disabled — user is immediately signed in, send to onboarding
  if (data.session) {
    redirect("/onboarding");
  }

  return { success: true };
}

export async function forgotPassword(email: string) {
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    h.get("origin") ||
    `${proto}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?redirect=/auth/reset-password`,
  });

  if (error) {
    return { error: "Failed to send reset email. Please try again." };
  }

  return { success: true };
}

export async function resetPassword(password: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Failed to update password. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
