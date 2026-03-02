"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


export async function signIn(email: string, password: string, inviteToken?: string) {
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

  // If the user came from an invite link, send them back to accept it
  if (inviteToken) {
    redirect(`/invite/accept?token=${encodeURIComponent(inviteToken)}`);
  }

  // Derive base domain from NEXT_PUBLIC_APP_URL (e.g. prompt.accountants)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prompt.accountants";
  const baseDomain = appUrl.replace(/^https?:\/\/(www\.)?/, "");
  const isDev = process.env.NODE_ENV === "development";

  // Read org_id from the session JWT — signInWithPassword's returned user object has
  // app_metadata from the database (raw_app_meta_data), which does NOT include values
  // injected by the Custom Access Token Hook. getSession() decodes the JWT directly,
  // so org_id is present when the hook has run.
  const { data: { session } } = await supabase.auth.getSession();
  let orgId = session?.user?.app_metadata?.org_id as string | undefined;

  // Fallback: if the Custom Access Token Hook didn't inject org_id into the JWT
  // (e.g. hook misconfigured or not yet run), query user_organisations directly.
  if (!orgId && session?.user?.id) {
    const { data: userOrg } = await supabase
      .from("user_organisations")
      .select("org_id")
      .eq("user_id", session.user.id)
      .limit(1)
      .single();
    orgId = userOrg?.org_id;
  }

  if (orgId) {
    const { data: org } = await supabase
      .from("organisations")
      .select("slug")
      .eq("id", orgId)
      .single();

    if (org?.slug) {
      if (isDev) {
        redirect(`/dashboard?org=${org.slug}`);
      } else {
        redirect(`https://${org.slug}.app.${baseDomain}/dashboard`);
      }
    }
  }

  // No org yet — new user, send to setup wizard
  redirect("/setup/wizard");
}

export async function signUp(email: string, password: string, inviteToken?: string) {
  const supabase = await createClient();

  // ── Invite signup: skip email confirmation ──────────────────────────────
  // The invite itself validates the email (org admin chose it), so requiring
  // a second confirmation email is redundant. Use the admin client to create
  // the user as pre-confirmed, then sign them in immediately.
  if (inviteToken) {
    const admin = createAdminClient();

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.toLowerCase().includes("already been registered") ||
          createError.message.toLowerCase().includes("already exists")) {
        return {
          error: "An account with this email already exists. Please sign in.",
        };
      }
      return { error: "Failed to create account. Please try again." };
    }

    // Sign the user in immediately so they have a session
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { error: "Account created but sign-in failed. Please sign in manually." };
    }

    // Redirect straight to invite accept — no email round-trip needed
    redirect(`/invite/accept?token=${encodeURIComponent(inviteToken)}`);
  }

  // ── Normal signup: send confirmation email ──────────────────────────────
  const h = await headers();
  const host = h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  // Use the request's own origin as the callback base — NEXT_PUBLIC_APP_URL may
  // point to the marketing apex domain (e.g. prompt.accountants) rather than the app
  // subdomain (e.g. app.prompt.accountants), which would send the email link to a page
  // with no callback handler. The signup request always originates from the app.
  const appUrl =
    h.get("origin") ||
    `${proto}://${host}` ||
    process.env.NEXT_PUBLIC_APP_URL;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Use the root origin (not /auth/callback) so the URL is always allowed by
      // Supabase — Supabase only allows the exact Site URL or explicitly listed paths.
      // The middleware intercepts /?code=... and forwards it to /auth/callback.
      emailRedirectTo: appUrl,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered")) {
      return {
        error: "An account with this email already exists. Please sign in.",
      };
    }
    if (msg.includes("rate limit") || error.status === 429) {
      return {
        error: "Too many sign-up attempts. Please wait a few minutes and try again.",
      };
    }
    return { error: "Failed to create account. Please try again." };
  }

  // Email confirmation disabled — user is immediately signed in
  if (data.session) {
    redirect("/setup/wizard");
  }

  return { success: true };
}

export async function forgotPassword(email: string) {
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const appUrl =
    h.get("origin") ||
    `${proto}://${host}` ||
    process.env.NEXT_PUBLIC_APP_URL;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Use root + redirect param so Supabase treats this as the Site URL (always allowed).
    // The middleware forwards /?code=&redirect=... to /auth/callback?code=&redirect=...
    redirectTo: `${appUrl}?redirect=/auth/reset-password`,
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
