"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSendHour(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "reminder_send_hour")
    .single();

  return data ? parseInt(data.value, 10) : 9;
}

export async function updateSendHour(hour: number): Promise<{ error?: string }> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: "Hour must be an integer between 0 and 23" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ value: String(hour) })
    .eq("key", "reminder_send_hour");

  if (error) {
    return { error: error.message };
  }

  return {};
}

// --- Setup Mode ---

export type SetupMode = "demo" | "real";

export async function getSetupMode(): Promise<SetupMode | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "setup_mode")
    .single();

  if (!data) return null;
  return data.value as SetupMode;
}

export async function updateSetupMode(mode: SetupMode): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "setup_mode", value: mode }, { onConflict: "key" });

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
  senderName: "Peninsula Accounting",
  senderAddress: "reminders@peninsulaaccounting.co.uk",
  replyTo: "info@peninsulaaccounting.co.uk",
};

const EMAIL_KEYS = {
  senderName: "email_sender_name",
  senderAddress: "email_sender_address",
  replyTo: "email_reply_to",
} as const;

export async function getEmailSettings(): Promise<EmailSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
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

  const entries: { key: string; value: string }[] = [
    { key: EMAIL_KEYS.senderName, value: settings.senderName.trim() },
    { key: EMAIL_KEYS.senderAddress, value: settings.senderAddress.trim() },
    { key: EMAIL_KEYS.replyTo, value: settings.replyTo.trim() },
  ];

  for (const entry of entries) {
    const { error } = await supabase
      .from("app_settings")
      .upsert(entry, { onConflict: "key" });

    if (error) {
      return { error: error.message };
    }
  }

  return {};
}
