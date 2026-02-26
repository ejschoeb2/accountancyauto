"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function signIn(email: string, password: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : "Failed to sign in. Please try again.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(email: string, password: string) {
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = h.get("origin") || `${proto}://${host}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
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

  // Email confirmation disabled — user is immediately signed in
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  return { success: true };
}

export async function forgotPassword(email: string) {
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = h.get("origin") || `${proto}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect=/auth/reset-password`,
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
