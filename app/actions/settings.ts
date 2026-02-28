"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId, getOrgContext } from "@/lib/auth/org-context";
import { requireWriteAccess } from "@/lib/billing/read-only-mode";

// --- Email Settings type (shared) ---

export interface EmailSettings {
  senderName: string;
  senderAddress: string;
  replyTo: string;
}

const EMAIL_DEFAULTS: EmailSettings = {
  senderName: "PhaseTwo",
  senderAddress: "hello@phasetwo.uk",
  replyTo: "hello@phasetwo.uk",
};

const EMAIL_KEYS = {
  senderName: "email_sender_name",
  senderAddress: "email_sender_address",
  replyTo: "email_reply_to",
} as const;

// --- Org-level Send Hour (admin) ---

export async function getSendHour(): Promise<number> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .is("user_id", null)
    .eq("key", "reminder_send_hour")
    .maybeSingle();

  return data ? parseInt(data.value, 10) : 9;
}

export async function updateSendHour(hour: number): Promise<{ error?: string }> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: "Hour must be an integer between 0 and 23" };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "reminder_send_hour", value: String(hour) },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) {
    return { error: error.message };
  }

  return {};
}

// --- Per-user Send Hour (member/user-aware) ---

export async function getUserSendHour(): Promise<number> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 9;

  // Try user-specific row first
  const { data: userRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("key", "reminder_send_hour")
    .maybeSingle();
  if (userRow) return parseInt(userRow.value, 10);

  // Fallback to org-level default (user_id IS NULL)
  const { data: orgRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .is("user_id", null)
    .eq("key", "reminder_send_hour")
    .maybeSingle();

  return orgRow ? parseInt(orgRow.value, 10) : 9;
}

export async function updateUserSendHour(hour: number): Promise<{ error?: string }> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: "Hour must be an integer between 0 and 23" };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await requireWriteAccess(orgId);
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: user.id, key: "reminder_send_hour", value: String(hour) },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) {
    return { error: error.message };
  }

  return {};
}

// --- Setup Mode ---

export type SetupMode = "demo" | "real";

export async function getSetupMode(): Promise<SetupMode | null> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .is("user_id", null)
    .eq("key", "setup_mode")
    .maybeSingle();

  if (!data) return null;
  return data.value as SetupMode;
}

export async function updateSetupMode(mode: SetupMode): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "setup_mode", value: mode },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}

// --- Org-level Email Settings (admin) ---

export async function getEmailSettings(): Promise<EmailSettings> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("org_id", orgId)
    .is("user_id", null)
    .in("key", Object.values(EMAIL_KEYS));

  const map = new Map(data?.map((r) => [r.key, r.value]) ?? []);

  return {
    senderName: map.get(EMAIL_KEYS.senderName) ?? EMAIL_DEFAULTS.senderName,
    senderAddress: map.get(EMAIL_KEYS.senderAddress) ?? EMAIL_DEFAULTS.senderAddress,
    replyTo: map.get(EMAIL_KEYS.replyTo) ?? EMAIL_DEFAULTS.replyTo,
  };
}

export async function updateEmailSettings(
  settings: EmailSettings
): Promise<{ error?: string }> {
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(settings.senderAddress)) {
    return { error: "Invalid sender email address" };
  }
  if (!emailRegex.test(settings.replyTo)) {
    return { error: "Invalid reply-to email address" };
  }
  if (!settings.senderName.trim()) {
    return { error: "Sender name is required" };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);

  const entries: { org_id: string; user_id: null; key: string; value: string }[] = [
    { org_id: orgId, user_id: null, key: EMAIL_KEYS.senderName, value: settings.senderName.trim() },
    { org_id: orgId, user_id: null, key: EMAIL_KEYS.senderAddress, value: settings.senderAddress.trim() },
    { org_id: orgId, user_id: null, key: EMAIL_KEYS.replyTo, value: settings.replyTo.trim() },
  ];

  for (const entry of entries) {
    const { error } = await supabase
      .from("app_settings")
      .upsert(entry, { onConflict: "org_id,user_id,key" });

    if (error) {
      return { error: error.message };
    }
  }

  return {};
}

// --- Per-user Email Settings (member/user-aware) ---

export async function getUserEmailSettings(): Promise<EmailSettings> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMAIL_DEFAULTS;

  // Fetch user-specific rows
  const { data: userRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .in("key", Object.values(EMAIL_KEYS));

  const userMap = new Map(userRows?.map((r) => [r.key, r.value]) ?? []);

  // Fetch org-level defaults for any keys not found in user rows
  const missingKeys = Object.values(EMAIL_KEYS).filter((k) => !userMap.has(k));
  const orgMap = new Map<string, string>();

  if (missingKeys.length > 0) {
    const { data: orgRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("org_id", orgId)
      .is("user_id", null)
      .in("key", missingKeys);

    for (const r of orgRows ?? []) {
      orgMap.set(r.key, r.value);
    }
  }

  const get = (key: string, def: string) => userMap.get(key) ?? orgMap.get(key) ?? def;

  return {
    senderName: get(EMAIL_KEYS.senderName, EMAIL_DEFAULTS.senderName),
    senderAddress: get(EMAIL_KEYS.senderAddress, EMAIL_DEFAULTS.senderAddress),
    replyTo: get(EMAIL_KEYS.replyTo, EMAIL_DEFAULTS.replyTo),
  };
}

export async function updateUserEmailSettings(
  settings: EmailSettings
): Promise<{ error?: string }> {
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(settings.senderAddress)) {
    return { error: "Invalid sender email address" };
  }
  if (!emailRegex.test(settings.replyTo)) {
    return { error: "Invalid reply-to email address" };
  }
  if (!settings.senderName.trim()) {
    return { error: "Sender name is required" };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await requireWriteAccess(orgId);

  const entries: { org_id: string; user_id: string; key: string; value: string }[] = [
    { org_id: orgId, user_id: user.id, key: EMAIL_KEYS.senderName, value: settings.senderName.trim() },
    { org_id: orgId, user_id: user.id, key: EMAIL_KEYS.senderAddress, value: settings.senderAddress.trim() },
    { org_id: orgId, user_id: user.id, key: EMAIL_KEYS.replyTo, value: settings.replyTo.trim() },
  ];

  for (const entry of entries) {
    const { error } = await supabase
      .from("app_settings")
      .upsert(entry, { onConflict: "org_id,user_id,key" });

    if (error) {
      return { error: error.message };
    }
  }

  return {};
}

// --- Onboarding Completion ---

export async function getOnboardingComplete(): Promise<boolean> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .is("user_id", null)
    .eq("key", "onboarding_complete")
    .maybeSingle();

  return data ? data.value === "true" : false;
}

export async function markOnboardingComplete(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "onboarding_complete", value: "true" },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}

// --- Inbound Email Checker Mode ---

export type InboundCheckerMode = "auto" | "recommend";

export async function getInboundCheckerMode(): Promise<InboundCheckerMode> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .is("user_id", null)
    .eq("key", "inbound_checker_mode")
    .maybeSingle();

  return data?.value === "auto" ? "auto" : "recommend";
}

export async function updateInboundCheckerMode(
  mode: InboundCheckerMode
): Promise<{ error?: string }> {
  if (mode !== "auto" && mode !== "recommend") {
    return { error: "Mode must be 'auto' or 'recommend'" };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "inbound_checker_mode", value: mode },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}

// --- Member Setup Wizard Completion ---

export async function getMemberSetupComplete(): Promise<boolean> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("key", "member_setup_complete")
    .maybeSingle();

  return data?.value === "true";
}

export async function markMemberSetupComplete(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: user.id, key: "member_setup_complete", value: "true" },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}

// --- Postmark Settings ---

export async function getPostmarkSettings(): Promise<{ token: string; senderDomain: string; inboundAddress: string }> {
  const orgId = await getOrgId();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from('organisations')
    .select('postmark_server_token, postmark_sender_domain, inbound_address')
    .eq('id', orgId)
    .single();
  return {
    token: org?.postmark_server_token || '',
    senderDomain: org?.postmark_sender_domain || '',
    inboundAddress: org?.inbound_address || '',
  };
}

export async function updatePostmarkSettings(token: string, senderDomain: string): Promise<{ error?: string }> {
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);
  const admin = createAdminClient();
  const { error } = await admin
    .from('organisations')
    .update({
      postmark_server_token: token.trim() || null,
      postmark_sender_domain: senderDomain.trim() || null
    })
    .eq('id', orgId);
  if (error) return { error: error.message };
  return {};
}

// --- Google Drive Storage ---

export async function disconnectGoogleDrive(): Promise<void> {
  const orgId = await getOrgId();
  const admin = createAdminClient();
  const { error } = await admin.from('organisations').update({
    storage_backend: 'supabase',
    storage_backend_status: null,
    google_access_token_enc: null,
    google_refresh_token_enc: null,
    google_token_expires_at: null,
    google_drive_folder_id: null,
  }).eq('id', orgId);
  if (error) throw new Error(`Disconnect failed: ${error.message}`);
  revalidatePath('/settings');
}

// --- Dropbox Storage ---

export async function disconnectDropbox(): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Admin only' };

  const admin = createAdminClient();
  const { error } = await admin.from('organisations').update({
    dropbox_refresh_token_enc: null,
    dropbox_access_token_enc: null,
    dropbox_token_expires_at: null,
    storage_backend: 'supabase',
    storage_backend_status: null,
  }).eq('id', orgId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {};
}
