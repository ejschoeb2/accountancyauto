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
  senderName: "Prompt",
  senderAddress: "hello@prompt.accountants",
  replyTo: "hello@prompt.accountants",
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

export async function updateUserSendHour(
  hour: number,
  { skipBillingCheck = false }: { skipBillingCheck?: boolean } = {}
): Promise<{ error?: string }> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: "Hour must be an integer between 0 and 23" };
  }

  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!skipBillingCheck) await requireWriteAccess(orgId);

  // During wizard setup the JWT may not have org_id yet, so RLS on
  // app_settings would block the upsert. Use admin client to bypass.
  const db = skipBillingCheck ? createAdminClient() : supabase;
  const { error } = await db
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
  settings: EmailSettings,
  { skipBillingCheck = false }: { skipBillingCheck?: boolean } = {}
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

  if (!skipBillingCheck) await requireWriteAccess(orgId);

  // During wizard setup the JWT may not have org_id yet, so RLS on
  // app_settings would block the upsert. Use admin client to bypass.
  const db = skipBillingCheck ? createAdminClient() : supabase;
  const entries: { org_id: string; user_id: string; key: string; value: string }[] = [
    { org_id: orgId, user_id: user.id, key: EMAIL_KEYS.senderName, value: settings.senderName.trim() },
    { org_id: orgId, user_id: user.id, key: EMAIL_KEYS.senderAddress, value: settings.senderAddress.trim() },
    { org_id: orgId, user_id: user.id, key: EMAIL_KEYS.replyTo, value: settings.replyTo.trim() },
  ];

  for (const entry of entries) {
    const { error } = await db
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

// --- Domain DNS Data ---

export interface OrgDomainDnsData {
  domain: string;
  dkimPendingHost: string;
  dkimPendingValue: string;
  returnPathHost: string;
  returnPathCnameValue: string;
  dkimVerified: boolean;
  returnPathVerified: boolean;
}

export async function getOrgDomainDnsData(): Promise<OrgDomainDnsData | null> {
  const orgId = await getOrgId();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from('organisations')
    .select('postmark_domain_id, postmark_sender_domain')
    .eq('id', orgId)
    .single();

  if (!org?.postmark_domain_id || !org?.postmark_sender_domain) {
    return null;
  }

  try {
    const res = await fetch(`https://api.postmarkapp.com/domains/${org.postmark_domain_id}`, {
      headers: {
        Accept: 'application/json',
        'X-Postmark-Account-Token': process.env.POSTMARK_ACCOUNT_TOKEN ?? '',
      },
    });
    if (!res.ok) return null;

    const data = await res.json();

    return {
      domain: org.postmark_sender_domain,
      dkimPendingHost: data.DKIMPendingHost || data.DKIMTextHost || '',
      dkimPendingValue: data.DKIMPendingTextValue || data.DKIMPendingValue || data.DKIMTextValue || '',
      returnPathHost: `pm-bounces.${org.postmark_sender_domain}`,
      returnPathCnameValue: data.ReturnPathDomainCNAMEValue ?? 'pm.mtasv.net',
      dkimVerified: Boolean(data.DKIMVerified),
      returnPathVerified: Boolean(data.ReturnPathDomainVerified),
    };
  } catch {
    return null;
  }
}

// --- Postmark Settings ---

export async function getPostmarkSettings(): Promise<{ token: string; senderDomain: string }> {
  const orgId = await getOrgId();
  const admin = createAdminClient();
  const { data: org } = await admin
    .from('organisations')
    .select('postmark_server_token, postmark_sender_domain')
    .eq('id', orgId)
    .single();
  return {
    token: org?.postmark_server_token || '',
    senderDomain: org?.postmark_sender_domain || '',
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

/**
 * Parses a Google Drive folder ID from a full URL or raw ID string.
 * Accepts: https://drive.google.com/drive[/u/N]/folders/{id}
 *          https://drive.google.com/drive/folders/{id}?...
 *          Raw folder ID (alphanumeric + dash/underscore, 10+ chars)
 */
function parseDriveFolderId(input: string): string | null {
  const urlMatch = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;
  return null;
}

export async function updateGoogleDriveFolderId(input: string): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Admin only' };

  const folderId = parseDriveFolderId(input.trim());
  if (!folderId) return { error: 'Paste a Google Drive folder URL or a folder ID' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('organisations')
    .update({ google_drive_folder_id: folderId })
    .eq('id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {};
}

export async function disconnectGoogleDrive(): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Admin only' };

  const admin = createAdminClient();
  const { error } = await admin.from('organisations').update({
    storage_backend: 'supabase',
    storage_backend_status: null,
    google_access_token_enc: null,
    google_refresh_token_enc: null,
    google_token_expires_at: null,
    google_drive_folder_id: null,
  }).eq('id', orgId);
  if (error) return { error: `Disconnect failed: ${error.message}` };
  revalidatePath('/settings');
  return {};
}

// --- OneDrive Storage ---

export async function disconnectOneDrive(): Promise<{ error?: string }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Admin only' };

  const admin = createAdminClient();
  const { error } = await admin.from('organisations').update({
    storage_backend: 'supabase',
    storage_backend_status: null,
    ms_token_cache_enc: null,
    ms_home_account_id: null,
  }).eq('id', orgId);
  if (error) return { error: `Disconnect failed: ${error.message}` };
  revalidatePath('/settings');
  return {};
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

// --- Storage: Full info for wizard step ---

export interface StorageInfo {
  storageBackend: string | null;
  googleDriveFolderId: string | null;
  storageBackendStatus: string | null;
  dropboxConnected: boolean;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const { orgId } = await getOrgContext();
  const admin = createAdminClient();
  const { data } = await admin
    .from('organisations')
    .select('storage_backend, storage_backend_status, google_drive_folder_id, dropbox_refresh_token_enc')
    .eq('id', orgId)
    .single();
  return {
    storageBackend: data?.storage_backend ?? null,
    googleDriveFolderId: data?.google_drive_folder_id ?? null,
    storageBackendStatus: data?.storage_backend_status ?? null,
    dropboxConnected: !!data?.dropbox_refresh_token_enc,
  };
}

// --- Storage: Current Backend ---

export async function getOrgStorageBackend(): Promise<string | null> {
  const admin = createAdminClient();
  const { orgId } = await getOrgContext();
  const { data } = await admin
    .from('organisations')
    .select('storage_backend')
    .eq('id', orgId)
    .single();
  return data?.storage_backend ?? null;
}

// --- Upload Check Mode ---

export type UploadCheckMode = 'none' | 'verify' | 'extract' | 'both';

export async function getUploadCheckMode(): Promise<UploadCheckMode> {
  const admin = createAdminClient();
  const { orgId } = await getOrgContext();
  const { data } = await admin
    .from('organisations')
    .select('upload_check_mode')
    .eq('id', orgId)
    .single();
  return (data?.upload_check_mode as UploadCheckMode) ?? 'both';
}

export async function setUploadCheckMode(
  mode: UploadCheckMode
): Promise<{ error: string | null }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Only admins can change this setting.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('organisations')
    .update({ upload_check_mode: mode })
    .eq('id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { error: null };
}

// --- Auto-Receive Verified ---

export async function getAutoReceiveVerified(): Promise<boolean> {
  const admin = createAdminClient();
  const { orgId } = await getOrgContext();
  const { data } = await admin
    .from('organisations')
    .select('auto_receive_verified')
    .eq('id', orgId)
    .single();
  return data?.auto_receive_verified ?? false;
}

export async function setAutoReceiveVerified(
  enabled: boolean
): Promise<{ error: string | null }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Only admins can change this setting.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('organisations')
    .update({ auto_receive_verified: enabled })
    .eq('id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { error: null };
}

// --- Reject Mismatched Uploads ---

export async function getRejectMismatchedUploads(): Promise<boolean> {
  const admin = createAdminClient();
  const { orgId } = await getOrgContext();
  const { data } = await admin
    .from('organisations')
    .select('reject_mismatched_uploads')
    .eq('id', orgId)
    .single();
  return data?.reject_mismatched_uploads ?? false;
}

export async function setRejectMismatchedUploads(
  enabled: boolean
): Promise<{ error: string | null }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Only admins can change this setting.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('organisations')
    .update({ reject_mismatched_uploads: enabled })
    .eq('id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { error: null };
}

// --- Client Portal ---

export async function getClientPortalEnabled(): Promise<boolean> {
  const admin = createAdminClient();
  const { orgId } = await getOrgContext();
  const { data } = await admin
    .from('organisations')
    .select('client_portal_enabled')
    .eq('id', orgId)
    .single();
  return data?.client_portal_enabled ?? true;
}

export async function setClientPortalEnabled(
  enabled: boolean
): Promise<{ error: string | null }> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return { error: 'Only admins can change this setting.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('organisations')
    .update({ client_portal_enabled: enabled })
    .eq('id', orgId);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { error: null };
}

// --- Storage: Document Count by Backend ---

export async function getDocumentCountByBackend(
  backend: 'google_drive' | 'onedrive' | 'dropbox'
): Promise<number> {
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== 'admin') return 0;
  const admin = createAdminClient();
  const { count } = await admin
    .from('client_documents')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('storage_backend', backend);
  return count ?? 0;
}
