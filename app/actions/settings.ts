"use server";

/**
 * Error convention:
 * - Server actions throw on failure (Next.js catches via error boundaries)
 * - Return { success, message } for operations where the caller needs to display a specific message
 * - Never return { error } — either throw or return a success result
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId, getOrgContext } from "@/lib/auth/org-context";
import { requireWriteAccess } from "@/lib/billing/read-only-mode";
import { writeAuditLog } from '@/lib/audit/log';
import {
  EMAIL_KEYS,
  type EmailSettings,
  type SetupMode,
  type UploadCheckMode,
} from './settings-queries';

// Re-export everything from settings-queries so existing imports continue to work
export * from './settings-queries';

// --- Org-level Send Hour (admin) ---

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

  const { data: { user } } = await supabase.auth.getUser();
  await writeAuditLog({
    org_id: orgId,
    user_id: user?.id,
    action: 'update',
    table_name: 'app_settings',
    new_values: { sender_name: settings.senderName, sender_address: settings.senderAddress, reply_to: settings.replyTo },
  });

  return {};
}

// --- Per-user Email Settings (member/user-aware) ---

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

// --- Onboarding Step Tracking ---

export async function markTemplatesVisited(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "templates_visited", value: "true" },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function markActivityVisited(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "activity_visited", value: "true" },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function markGuidesVisited(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "guides_visited", value: "true" },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function markGettingStartedRead(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "getting_started_read", value: "true" },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

// --- Progress Review ---

export async function markProgressReviewed(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { org_id: orgId, user_id: null, key: "progress_reviewed", value: "true" },
      { onConflict: "org_id,user_id,key" }
    );

  if (error) return { error: error.message };
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return {};
}

// --- Member Setup Wizard Completion ---

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await writeAuditLog({
    org_id: orgId,
    user_id: user?.id,
    action: 'update',
    table_name: 'organisations',
    row_id: orgId,
    new_values: { postmark_sender_domain: senderDomain.trim() || null },
  });

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await writeAuditLog({
    org_id: orgId,
    user_id: user?.id,
    action: 'update',
    table_name: 'organisations',
    row_id: orgId,
    new_values: { google_drive_folder_id: folderId },
  });

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await writeAuditLog({
    org_id: orgId,
    user_id: user?.id,
    action: 'update',
    table_name: 'organisations',
    row_id: orgId,
    metadata: { disconnected_backend: 'google_drive' },
  });

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await writeAuditLog({
    org_id: orgId,
    user_id: user?.id,
    action: 'update',
    table_name: 'organisations',
    row_id: orgId,
    metadata: { disconnected_backend: 'onedrive' },
  });

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await writeAuditLog({
    org_id: orgId,
    user_id: user?.id,
    action: 'update',
    table_name: 'organisations',
    row_id: orgId,
    metadata: { disconnected_backend: 'dropbox' },
  });

  revalidatePath('/settings');
  return {};
}

// --- Upload Check Mode ---

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
