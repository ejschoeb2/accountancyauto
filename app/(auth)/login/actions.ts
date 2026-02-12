"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign in as demo user with shared demo account
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
  redirect("/");
}
