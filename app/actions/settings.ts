"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth/org-context";

export async function getSendHour(): Promise<number> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "reminder_send_hour")
    .single();

  return data ? parseInt(data.value, 10) : 9;
}

export async function updateSendHour(hour: number): Promise<{ error?: string }> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: "Hour must be an integer between 0 and 23" };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, key: "reminder_send_hour", value: String(hour) },
      { onConflict: "org_id,key" }
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
    .eq("key", "setup_mode")
    .single();

  if (!data) return null;
  return data.value as SetupMode;
}

export async function updateSetupMode(mode: SetupMode): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, key: "setup_mode", value: mode },
      { onConflict: "org_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}

// --- Email Settings ---

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

export async function getEmailSettings(): Promise<EmailSettings> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("org_id", orgId)
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

  const entries: { org_id: string; key: string; value: string }[] = [
    { org_id: orgId, key: EMAIL_KEYS.senderName, value: settings.senderName.trim() },
    { org_id: orgId, key: EMAIL_KEYS.senderAddress, value: settings.senderAddress.trim() },
    { org_id: orgId, key: EMAIL_KEYS.replyTo, value: settings.replyTo.trim() },
  ];

  for (const entry of entries) {
    const { error } = await supabase
      .from("app_settings")
      .upsert(entry, { onConflict: "org_id,key" });

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
    .eq("key", "onboarding_complete")
    .single();

  return data ? data.value === "true" : false;
}

export async function markOnboardingComplete(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, key: "onboarding_complete", value: "true" },
      { onConflict: "org_id,key" }
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
    .eq("key", "inbound_checker_mode")
    .single();

  return data?.value === "recommend" ? "recommend" : "auto";
}

export async function updateInboundCheckerMode(
  mode: InboundCheckerMode
): Promise<{ error?: string }> {
  if (mode !== "auto" && mode !== "recommend") {
    return { error: "Mode must be 'auto' or 'recommend'" };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, key: "inbound_checker_mode", value: mode },
      { onConflict: "org_id,key" }
    );

  if (error) return { error: error.message };
  return {};
}
