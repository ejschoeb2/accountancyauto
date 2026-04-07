"use server";

/**
 * Error convention:
 * - Server actions throw on failure (Next.js catches via error boundaries)
 * - Return { success, message } for operations where the caller needs to display a specific message
 * - Never return { error } — either throw or return a success result
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId, getOrgContext } from "@/lib/auth/org-context";

// --- Email Settings type (shared) ---

export interface EmailSettings {
  senderName: string;
  senderAddress: string;
  replyTo: string;
}

export const EMAIL_DEFAULTS: EmailSettings = {
  senderName: "Prompt",
  senderAddress: "hello@prompt.accountants",
  replyTo: "hello@prompt.accountants",
};

/**
 * Get the org's verified custom domain from the organisations table.
 * Returns null if no custom domain is configured or not verified.
 */
export async function getOrgCustomDomain(orgId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organisations")
    .select("postmark_sender_domain, email_domain_verified")
    .eq("id", orgId)
    .single();
  if (data?.postmark_sender_domain && data?.email_domain_verified) {
    return data.postmark_sender_domain;
  }
  return null;
}

export function getDefaultsForDomain(domain: string | null): EmailSettings {
  if (domain) {
    return {
      senderName: "Prompt",
      senderAddress: `hello@${domain}`,
      replyTo: `hello@${domain}`,
    };
  }
  return EMAIL_DEFAULTS;
}

export const EMAIL_KEYS = {
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

// --- Org-level Email Settings (admin) ---

export async function getEmailSettings(): Promise<EmailSettings> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const [{ data }, customDomain] = await Promise.all([
    supabase
      .from("app_settings")
      .select("key, value")
      .eq("org_id", orgId)
      .is("user_id", null)
      .in("key", Object.values(EMAIL_KEYS)),
    getOrgCustomDomain(orgId),
  ]);

  const defaults = getDefaultsForDomain(customDomain);
  const map = new Map(data?.map((r) => [r.key, r.value]) ?? []);

  return {
    senderName: map.get(EMAIL_KEYS.senderName) ?? defaults.senderName,
    senderAddress: map.get(EMAIL_KEYS.senderAddress) ?? defaults.senderAddress,
    replyTo: map.get(EMAIL_KEYS.replyTo) ?? defaults.replyTo,
  };
}

// --- Per-user Email Settings (member/user-aware) ---

export async function getUserEmailSettings(): Promise<EmailSettings> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMAIL_DEFAULTS;

  // Fetch user-specific rows and custom domain in parallel
  const [{ data: userRows }, customDomain] = await Promise.all([
    supabase
      .from("app_settings")
      .select("key, value")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .in("key", Object.values(EMAIL_KEYS)),
    getOrgCustomDomain(orgId),
  ]);

  const defaults = getDefaultsForDomain(customDomain);
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
    senderName: get(EMAIL_KEYS.senderName, defaults.senderName),
    senderAddress: get(EMAIL_KEYS.senderAddress, defaults.senderAddress),
    replyTo: get(EMAIL_KEYS.replyTo, defaults.replyTo),
  };
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
