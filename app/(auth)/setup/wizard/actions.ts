"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedOrgDefaults } from "@/lib/onboarding/seed-defaults";
import { type PlanTier, getPlanByTier } from "@/lib/stripe/plans";
import { buildReminderQueue, buildCustomScheduleQueue } from "@/lib/reminders/queue-builder";
import {
  createOrgServer,
  createOrgDomain,
  checkDomainVerification,
} from "@/lib/postmark/management";
import type { EditableRow } from "./components/csv-import-step";

// ─── Setup draft persistence ─────────────────────────────────────────────────

export interface SetupDraft {
  step: string;
  firmName?: string;
  firmSlug?: string;
  selectedTier?: string;
  emailSubStep?: string;
  portalEnabled?: boolean;
  uploadCheckMode?: string;
  autoReceiveVerified?: boolean;
  rejectMismatchedUploads?: boolean;
  sendHour?: number;
  deadlineSelections?: string[];
  updatedAt: string;
  /** Injected by getSetupDraft() from user_organisations — not stored in DB */
  orgId?: string;
}

/**
 * Read the current setup draft from the organisation row.
 *
 * Returns null if no draft exists or the user has no organisation yet.
 * Follows the same auth pattern as markOrgSetupComplete.
 */
export async function getSetupDraft(): Promise<SetupDraft | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return null;

  const { data } = await admin
    .from("organisations")
    .select("setup_draft")
    .eq("id", membership.org_id)
    .single();

  const draft = (data?.setup_draft as SetupDraft) ?? null;
  if (draft) {
    draft.orgId = membership.org_id;
  }
  return draft;
}

/**
 * Save (overwrite) the setup draft on the organisation row.
 *
 * Always stamps `updatedAt` before persisting.
 * Follows the same auth pattern as markOrgSetupComplete.
 */
export async function saveSetupDraft(
  draft: SetupDraft
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  draft.updatedAt = new Date().toISOString();

  const { error } = await admin
    .from("organisations")
    .update({ setup_draft: draft })
    .eq("id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

// ─── Draft clients staging table (large CSV imports) ─────────────────────────

/**
 * Save CSV import rows to the setup_draft_clients staging table.
 *
 * Replaces all existing rows for this org (DELETE + INSERT).
 * Uses admin client; all access via service_role, no authenticated RLS needed.
 */
export async function saveDraftClients(
  rows: EditableRow[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  // Clear existing rows
  await admin
    .from("setup_draft_clients")
    .delete()
    .eq("org_id", membership.org_id);

  // Bulk insert new rows
  if (rows.length > 0) {
    const { error } = await admin.from("setup_draft_clients").insert(
      rows.map((row, i) => ({
        org_id: membership.org_id,
        row_index: i,
        data: row,
      }))
    );

    if (error) return { error: error.message };
  }

  return {};
}

/**
 * Retrieve CSV import rows from the setup_draft_clients staging table.
 *
 * Returns null (not empty array) when no rows exist. Null means
 * "no draft import data", distinguishing from "imported zero rows".
 */
export async function getDraftClients(): Promise<EditableRow[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return null;

  const { data } = await admin
    .from("setup_draft_clients")
    .select("row_index, data")
    .eq("org_id", membership.org_id)
    .order("row_index");

  if (!data || data.length === 0) return null;

  return data.map((r) => r.data as EditableRow);
}

/**
 * Delete all staging rows for the current org.
 *
 * Called when the user clears their import data.
 */
export async function clearDraftClients(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const { error } = await admin
    .from("setup_draft_clients")
    .delete()
    .eq("org_id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

/**
 * Mark the current user's organisation as having completed the setup wizard.
 *
 * Called when the admin clicks "Go to Dashboard" on the final wizard step.
 * Until this is set, sign-in redirects the user back to the wizard.
 */
export async function migrateDraftClients(): Promise<{ error?: string; created: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated.", created: 0 };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found.", created: 0 };

  // Read draft clients
  const { data: draftRows } = await admin
    .from("setup_draft_clients")
    .select("data")
    .eq("org_id", membership.org_id)
    .order("row_index", { ascending: true });

  if (!draftRows || draftRows.length === 0) return { created: 0 };

  // Check plan client limit
  const { data: org } = await admin
    .from("organisations")
    .select("client_count_limit")
    .eq("id", membership.org_id)
    .single();

  const limit = org?.client_count_limit ?? null;

  let importableRows = draftRows;

  if (limit !== null) {
    const { count } = await admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("org_id", membership.org_id);

    const currentCount = count ?? 0;
    const remainingCapacity = Math.max(0, limit - currentCount);

    if (remainingCapacity <= 0) return { created: 0 };

    // Only import up to remaining capacity (rows are already ordered by row_index)
    if (draftRows.length > remainingCapacity) {
      importableRows = draftRows.slice(0, remainingCapacity);
    }
  }

  // Map draft rows to client inserts
  const newClients = importableRows.map((row) => {
    const d = row.data as EditableRow;
    return {
      company_name: d.company_name,
      org_id: membership.org_id,
      owner_id: user.id,
      active: true,
      reminders_paused: false,
      primary_email: d.primary_email || null,
      client_type: d.client_type || null,
      year_end_date: d.year_end_date || null,
      vat_registered: d.vat_registered ?? false,
      vat_stagger_group: d.vat_stagger_group ?? null,
      vat_scheme: d.vat_scheme || null,
    };
  });

  const { data: createdClients, error: insertError } = await admin
    .from("clients")
    .insert(newClients)
    .select("id, client_type, vat_registered");

  if (insertError) return { error: insertError.message, created: 0 };

  // Auto-create filing assignments based on client_type
  if (createdClients && createdClients.length > 0) {
    const { data: filingTypes } = await admin
      .from("filing_types")
      .select("id, applicable_client_types");

    if (filingTypes && filingTypes.length > 0) {
      const assignments: Array<{
        org_id: string;
        client_id: string;
        filing_type_id: string;
        is_active: boolean;
      }> = [];

      for (const client of createdClients) {
        if (!client.client_type) continue;

        const applicable = filingTypes.filter((ft) => {
          if (!ft.applicable_client_types.includes(client.client_type)) return false;
          if (ft.id === "vat_return") return client.vat_registered === true;
          return true;
        });

        for (const ft of applicable) {
          assignments.push({
            org_id: membership.org_id,
            client_id: client.id,
            filing_type_id: ft.id,
            is_active: true,
          });
        }
      }

      if (assignments.length > 0) {
        await admin
          .from("client_filing_assignments")
          .insert(assignments);
      }
    }
  }

  return { created: createdClients?.length ?? 0 };
}

export async function markOrgSetupComplete(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const { error } = await admin
    .from("organisations")
    .update({ setup_complete: true, setup_draft: null })
    .eq("id", membership.org_id);

  if (error) return { error: error.message };

  // Belt-and-suspenders cleanup of staging rows (ON DELETE CASCADE also covers this)
  await admin
    .from("setup_draft_clients")
    .delete()
    .eq("org_id", membership.org_id);

  return {};
}

/**
 * Update the organisation's plan_tier and client_count_limit to match
 * the selected tier.
 *
 * Called during the wizard plan step so the import step sees the correct
 * client limit immediately, without waiting for the async Stripe webhook.
 * Idempotent: safe to call multiple times with the same or different tier.
 */
export async function updateOrgPlanTier(
  planTier: PlanTier
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const plan = getPlanByTier(planTier);
  const { error } = await admin
    .from("organisations")
    .update({
      plan_tier: planTier,
      client_count_limit: plan.clientLimit,
    })
    .eq("id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

/**
 * Delete all clients belonging to the current user's organisation.
 *
 * Used during the wizard when the user switches to a plan with a lower
 * client limit after already importing clients. Uses the admin client
 * because the org may not have an active subscription yet (bypasses
 * requireWriteAccess billing check).
 */
export async function deleteAllWizardClients(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const { error } = await admin
    .from("clients")
    .delete()
    .eq("org_id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

/**
 * Seeds default email templates and reminder schedules at the end of the
 * wizard, once the portal choice is known.
 *
 * Idempotent: safe to call multiple times (seedOrgDefaults checks for
 * existing templates before inserting).
 */
export async function seedOrgDefaultsForWizard(
  portalEnabled: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  await seedOrgDefaults(membership.org_id, user.id, admin, portalEnabled);
  return {};
}

/**
 * Wizard-safe version of getStorageInfo that uses admin client (bypasses RLS/JWT).
 * During wizard setup the JWT may not have org_id, so getOrgContext() fails.
 */
export async function getStorageInfoForWizard(): Promise<{
  storageBackend: string | null;
  googleDriveFolderId: string | null;
  storageBackendStatus: string | null;
  dropboxConnected: boolean;
  googleConnected: boolean;
  onedriveConnected: boolean;
}> {
  const empty = { storageBackend: null, googleDriveFolderId: null, storageBackendStatus: null, dropboxConnected: false, googleConnected: false, onedriveConnected: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return empty;

  const { data } = await admin
    .from("organisations")
    .select("storage_backend, storage_backend_status, google_drive_folder_id, google_refresh_token_enc, dropbox_refresh_token_enc, ms_token_cache_enc")
    .eq("id", membership.org_id)
    .single();

  // Validate that connections actually have tokens — storage_backend alone
  // can be stale from a previous incomplete setup or revoked access.
  const hasGoogleTokens = !!data?.google_refresh_token_enc;
  const hasDropboxTokens = !!data?.dropbox_refresh_token_enc;
  const hasOnedriveTokens = !!data?.ms_token_cache_enc;

  const backend = data?.storage_backend ?? null;

  return {
    storageBackend: backend,
    googleDriveFolderId: data?.google_drive_folder_id ?? null,
    storageBackendStatus: data?.storage_backend_status ?? null,
    dropboxConnected: backend === "dropbox" && hasDropboxTokens,
    googleConnected: backend === "google_drive" && hasGoogleTokens,
    onedriveConnected: backend === "onedrive" && hasOnedriveTokens,
  };
}

/**
 * Reset storage backend to supabase during wizard.
 *
 * Used when a previous connection is stale (storage_backend set but tokens
 * missing/expired) and the user wants to reconnect or switch providers.
 * Uses admin client to bypass RLS during wizard setup.
 */
export async function resetStorageForWizard(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const { error } = await admin.from("organisations").update({
    storage_backend: "supabase",
    storage_backend_status: null,
    google_access_token_enc: null,
    google_refresh_token_enc: null,
    google_token_expires_at: null,
    google_drive_folder_id: null,
    dropbox_refresh_token_enc: null,
    dropbox_access_token_enc: null,
    dropbox_token_expires_at: null,
    ms_token_cache_enc: null,
    ms_home_account_id: null,
  }).eq("id", membership.org_id);

  if (error) return { error: error.message };
  return {};
}

/**
 * Return the current user's org_id from user_organisations.
 * Used as a fallback when the setup draft is missing (e.g. save cancelled before OAuth).
 */
export async function getWizardOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return membership?.org_id ?? null;
}

/**
 * Force a server-side session refresh so the `.prompt.accountants` cross-subdomain
 * cookie is updated with a JWT that includes org_id in app_metadata.
 */
export async function refreshWizardSession(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.refreshSession();
}

/**
 * Resolve the dashboard URL for the current user after wizard completion.
 *
 * Uses the admin client to bypass RLS. Safe because we verify the user's
 * identity via supabase.auth.getUser() first, then only expose their own org.
 */
export async function getWizardDashboardUrl(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/dashboard";

  const admin = createAdminClient();

  const { data: userOrg } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!userOrg?.org_id) return "/dashboard";

  const { data: org } = await admin
    .from("organisations")
    .select("slug")
    .eq("id", userOrg.org_id)
    .single();

  if (!org?.slug) return "/dashboard";

  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return `/dashboard?org=${org.slug}`;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://prompt.accountants";
  const baseDomain = appUrl.replace(/^https?:\/\/(www\.)?/, "");
  return `https://${org.slug}.app.${baseDomain}/dashboard`;
}

/** Reserved slugs that cannot be used as org slugs */
const RESERVED_SLUGS = [
  "www",
  "app",
  "api",
  "admin",
  "billing",
  "onboarding",
  "invite",
  "pricing",
  "login",
  "dashboard",
  "clients",
  "settings",
  "templates",
  "schedules",
  "activity",
  "rollover",
];

/**
 * Check whether an org slug is available and valid.
 *
 * Returns { available: true } or { available: false, reason: "..." }
 */
export async function checkSlugAvailable(
  slug: string
): Promise<{ available: boolean; reason?: string }> {
  const multiCharPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  const singleCharPattern = /^[a-z0-9]$/;

  if (slug.length === 0) {
    return { available: false, reason: "Slug cannot be empty." };
  }

  if (slug.length === 1) {
    if (!singleCharPattern.test(slug)) {
      return {
        available: false,
        reason: "Slug must contain only lowercase letters and numbers.",
      };
    }
  } else if (slug.length === 2) {
    return {
      available: false,
      reason: "Slug must be at least 3 characters long.",
    };
  } else {
    if (!multiCharPattern.test(slug)) {
      return {
        available: false,
        reason:
          "Slug must start and end with a letter or number, and may only contain lowercase letters, numbers, and hyphens.",
      };
    }
  }

  if (RESERVED_SLUGS.includes(slug)) {
    return {
      available: false,
      reason: "This slug is reserved. Please choose a different one.",
    };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("organisations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (data) {
    return {
      available: false,
      reason: "This slug is already taken. Please choose a different one.",
    };
  }

  return { available: true };
}

/**
 * Create an organisation and join it as an admin.
 *
 * Uses the admin (service-role) client for all DB writes because the user
 * has no org_id in their JWT yet. After this action succeeds, the client must
 * call supabase.auth.refreshSession() to get a new JWT with org_id.
 */
export async function createOrgAndJoinAsAdmin(
  firmName: string,
  slug: string,
  planTier: PlanTier
): Promise<{ orgId: string; slug: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated. Please sign in and try again.");
  }

  const admin = createAdminClient();

  const { data: existingMembership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMembership?.org_id) {
    const { data: existingOrg } = await admin
      .from("organisations")
      .select("id, slug")
      .eq("id", existingMembership.org_id)
      .single();

    if (existingOrg) {
      return { orgId: existingOrg.id, slug: existingOrg.slug };
    }
    throw new Error("You already belong to an organisation.");
  }

  const { data: org, error: orgError } = await admin
    .from("organisations")
    .insert({
      name: firmName,
      slug,
      plan_tier: "free",
      subscription_status: "active",
      client_count_limit: 10,
      postmark_server_token: process.env.POSTMARK_SERVER_TOKEN ?? null,
      postmark_sender_domain: process.env.POSTMARK_SENDER_DOMAIN ?? null,
    })
    .select()
    .single();

  if (orgError) {
    if (orgError.code === "23505") {
      throw new Error(
        "This slug is already taken. Please go back and choose a different one."
      );
    }
    throw new Error(`Failed to create organisation: ${orgError.message}`);
  }

  const { error: memberError } = await admin
    .from("user_organisations")
    .insert({
      user_id: user.id,
      org_id: org.id,
      role: "admin",
    });

  if (memberError) {
    throw new Error(`Failed to join organisation: ${memberError.message}`);
  }

  await admin.from("app_settings").upsert(
    {
      org_id: org.id,
      user_id: null,
      key: "onboarding_complete",
      value: "true",
    },
    { onConflict: "org_id,user_id,key" }
  );

  return { orgId: org.id, slug: org.slug };
}

// ─── Postmark email setup actions ─────────────────────────────────────────────

export interface SetupPostmarkResult {
  success: boolean;
  error?: string;
  dkimPendingHost?: string;
  dkimPendingValue?: string;
  returnPathHost?: string;
  returnPathCnameValue?: string;
}

/**
 * Provision a Postmark Server and Domain for the current org.
 *
 * Idempotent: if server/domain already created (non-null IDs), skips creation
 * and returns stored DNS record values from the DB.
 */
export async function setupPostmarkForOrg(
  domain: string
): Promise<SetupPostmarkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) {
    return { success: false, error: "No organisation found for this user." };
  }

  const orgId = membership.org_id;

  const { data: org } = await admin
    .from("organisations")
    .select(
      "name, slug, postmark_server_id, postmark_domain_id, postmark_server_token, postmark_sender_domain"
    )
    .eq("id", orgId)
    .single();

  if (!org) {
    return { success: false, error: "Organisation not found." };
  }

  try {
    let serverToken: string;

    if (!org.postmark_server_id) {
      const serverResult = await createOrgServer(org.name, org.slug);
      serverToken = serverResult.serverToken;

      await admin
        .from("organisations")
        .update({
          postmark_server_token: serverToken,
          postmark_server_id: serverResult.serverId,
        })
        .eq("id", orgId);
    } else {
      serverToken = org.postmark_server_token ?? "";
    }

    let dkimPendingHost: string;
    let dkimPendingValue: string;
    let returnPathHost: string;
    let returnPathCnameValue: string;

    if (!org.postmark_domain_id) {
      const domainResult = await createOrgDomain(domain);
      dkimPendingHost = domainResult.dkimPendingHost;
      dkimPendingValue = domainResult.dkimPendingValue;
      returnPathHost = domainResult.returnPathHost;
      returnPathCnameValue = domainResult.returnPathCnameValue;

      await admin
        .from("organisations")
        .update({
          postmark_sender_domain: domain,
          postmark_domain_id: domainResult.domainId,
        })
        .eq("id", orgId);
    } else {
      await checkDomainVerification(org.postmark_domain_id);
      const res = await fetch(
        `https://api.postmarkapp.com/domains/${org.postmark_domain_id}`,
        {
          headers: {
            Accept: "application/json",
            "X-Postmark-Account-Token":
              process.env.POSTMARK_ACCOUNT_TOKEN ?? "",
          },
        }
      );
      const domainData = await res.json();
      dkimPendingHost =
        domainData.DKIMPendingHost || domainData.DKIMTextHost || "";
      dkimPendingValue =
        domainData.DKIMPendingTextValue ||
        domainData.DKIMPendingValue ||
        domainData.DKIMTextValue ||
        "";
      returnPathHost = `pm-bounces.${org.postmark_sender_domain ?? domain}`;
      returnPathCnameValue =
        domainData.ReturnPathDomainCNAMEValue ?? "pm.mtasv.net";

      const verifyResult = await checkDomainVerification(
        org.postmark_domain_id
      );
      if (verifyResult.dkimVerified && verifyResult.returnPathVerified) {
        await admin
          .from("organisations")
          .update({ email_domain_verified: true })
          .eq("id", orgId);
      }
    }

    return {
      success: true,
      dkimPendingHost,
      dkimPendingValue,
      returnPathHost,
      returnPathCnameValue,
    };
  } catch (err) {
    console.error("setupPostmarkForOrg error:", err);
    const raw = err instanceof Error ? err.message : "";
    let friendly = "Failed to configure email. Please try again.";
    if (raw.includes("createDomain failed")) {
      friendly =
        "We couldn't register that domain. Please check it's spelled correctly and try again.";
    } else if (raw.includes("createServer failed")) {
      friendly =
        "Something went wrong setting up your email server. Please try again or contact support.";
    } else if (raw.includes("getDomain failed")) {
      friendly =
        "We couldn't verify your domain right now. Please try again in a few moments.";
    } else if (raw.includes("POSTMARK_ACCOUNT_TOKEN")) {
      friendly = "Email service is not configured. Please contact support.";
    }
    return {
      success: false,
      error: friendly,
    };
  }
}

/**
 * Check DNS verification status for the org's Postmark domain.
 *
 * If both DKIM and Return-Path are verified, marks the org as verified in DB.
 */
export async function checkOrgDomainVerification(): Promise<{
  dkimVerified: boolean;
  returnPathVerified: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { dkimVerified: false, returnPathVerified: false };
  }

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) {
    return { dkimVerified: false, returnPathVerified: false };
  }

  const orgId = membership.org_id;

  const { data: org } = await admin
    .from("organisations")
    .select("postmark_domain_id")
    .eq("id", orgId)
    .single();

  if (!org?.postmark_domain_id) {
    return { dkimVerified: false, returnPathVerified: false };
  }

  const result = await checkDomainVerification(org.postmark_domain_id);

  if (result.dkimVerified && result.returnPathVerified) {
    await admin
      .from("organisations")
      .update({ email_domain_verified: true })
      .eq("id", orgId);
  }

  return result;
}

// ─── In-wizard signup / OTP verification ──────────────────────────────────────

/**
 * Create an unconfirmed account and trigger a 6-digit OTP verification email.
 */
export async function startSignup(
  email: string,
  password: string
): Promise<{ error?: string; alreadyConfirmed?: boolean }> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists")) {
      return {
        error: "An account with this email already exists. Please sign in.",
      };
    }
    if (msg.includes("rate limit") || error.status === 429) {
      return {
        error: "Too many attempts. Please wait a few minutes and try again.",
      };
    }
    return { error: "Failed to create account. Please try again." };
  }

  if (data.session) {
    return { alreadyConfirmed: true };
  }

  return {};
}

/**
 * Verify the 6-digit OTP code sent to the user's email during signup.
 * On success the session is established and the user is signed in.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) {
    return {
      error: "Invalid or expired code. Please check your email and try again.",
    };
  }

  return {};
}

/**
 * Resend the signup OTP verification email.
 */
export async function resendEmailOtp(
  email: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return { error: "Failed to resend. Please try again in a moment." };
  }

  return {};
}

/**
 * Fetch all filing types ordered by sort_order for the deadline selection wizard step.
 *
 * Returns global filing types — no org context needed since filing_types is a global reference table.
 */
export async function getFilingTypesForWizard(): Promise<Array<{
  id: string;
  name: string;
  description: string | null;
  is_seeded_default: boolean;
  calculator_type: string;
  applicable_client_types: string[];
}>> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("filing_types")
    .select("id, name, description, is_seeded_default, calculator_type, applicable_client_types")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getFilingTypesForWizard] Failed to fetch filing types:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Persist the org's active filing type selections from the wizard deadline step.
 *
 * Upserts all filing types: sets is_active=true for selected IDs, is_active=false for others.
 * Uses admin client (service_role) — no authenticated INSERT/UPDATE RLS policies on this table.
 */
export async function saveOrgFilingTypeSelections(
  activeTypeIds: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  // Fetch all filing types to build a complete upsert (active + inactive)
  const { data: allFilingTypes, error: ftError } = await admin
    .from("filing_types")
    .select("id");

  if (ftError || !allFilingTypes) {
    return { error: "Failed to fetch filing types." };
  }

  const now = new Date().toISOString();
  const activeSet = new Set(activeTypeIds);

  const selections = allFilingTypes.map((ft) => ({
    org_id: membership.org_id,
    filing_type_id: ft.id,
    is_active: activeSet.has(ft.id),
    activated_at: now,
  }));

  const { error } = await admin
    .from("org_filing_type_selections")
    .upsert(selections, { onConflict: "org_id,filing_type_id" });

  if (error) return { error: error.message };
  return {};
}

/**
 * Build the initial reminder queue after wizard completion.
 *
 * Called once after clients, filing assignments, schedules, and templates
 * have been created so the activity page shows queued emails immediately
 * instead of waiting for the next cron run.
 */
export async function buildInitialQueue(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const { data: org } = await admin
    .from("organisations")
    .select("id, name")
    .eq("id", membership.org_id)
    .single();

  if (!org) return { error: "Organisation not found." };

  try {
    await buildReminderQueue(admin, org);
    await buildCustomScheduleQueue(admin, org);
  } catch (err) {
    console.error("buildInitialQueue error:", err);
    // Non-fatal: queue will be built on next cron run
  }

  return {};
}

/**
 * Single server action that finalises the wizard in one HTTP round-trip.
 *
 * Combines migrateDraftClients + seedOrgDefaultsForWizard + buildInitialQueue
 * + markOrgSetupComplete + refreshWizardSession into one call, eliminating 5
 * sequential round-trips (which were slow and prone to Next.js server-action
 * serialisation queuing behind pending fire-and-forget saveSetupDraft calls).
 */
export async function finaliseWizardSetup(
  portalEnabled: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("user_organisations")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.org_id) return { error: "No organisation found." };

  const orgId = membership.org_id;

  // 1. Migrate draft clients → real clients table
  try {
    const { data: draftRows } = await admin
      .from("setup_draft_clients")
      .select("data")
      .eq("org_id", orgId)
      .order("row_index", { ascending: true });

    if (draftRows && draftRows.length > 0) {
      const { data: orgData } = await admin
        .from("organisations")
        .select("client_count_limit")
        .eq("id", orgId)
        .single();

      const limit = orgData?.client_count_limit ?? null;
      let importableRows = draftRows;

      if (limit !== null) {
        const { count } = await admin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);

        const currentCount = count ?? 0;
        const remainingCapacity = Math.max(0, limit - currentCount);
        if (remainingCapacity > 0) {
          if (draftRows.length > remainingCapacity) {
            importableRows = draftRows.slice(0, remainingCapacity);
          }
        } else {
          importableRows = [];
        }
      }

      if (importableRows.length > 0) {
        const newClients = importableRows.map((row) => {
          const d = row.data as EditableRow;
          return {
            company_name: d.company_name,
            org_id: orgId,
            owner_id: user.id,
            active: true,
            reminders_paused: false,
            primary_email: d.primary_email || null,
            client_type: d.client_type || null,
            year_end_date: d.year_end_date || null,
            vat_registered: d.vat_registered ?? false,
            vat_stagger_group: d.vat_stagger_group ?? null,
            vat_scheme: d.vat_scheme || null,
          };
        });

        const { data: createdClients, error: insertError } = await admin
          .from("clients")
          .insert(newClients)
          .select("id, client_type, vat_registered");

        if (!insertError && createdClients && createdClients.length > 0) {
          const { data: filingTypes } = await admin
            .from("filing_types")
            .select("id, applicable_client_types");

          if (filingTypes && filingTypes.length > 0) {
            const assignments: Array<{
              org_id: string;
              client_id: string;
              filing_type_id: string;
              is_active: boolean;
            }> = [];

            for (const client of createdClients) {
              if (!client.client_type) continue;
              const applicable = filingTypes.filter((ft) => {
                if (!ft.applicable_client_types.includes(client.client_type)) return false;
                if (ft.id === "vat_return") return client.vat_registered === true;
                return true;
              });
              for (const ft of applicable) {
                assignments.push({
                  org_id: orgId,
                  client_id: client.id,
                  filing_type_id: ft.id,
                  is_active: true,
                });
              }
            }

            if (assignments.length > 0) {
              await admin.from("client_filing_assignments").insert(assignments);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[finaliseWizardSetup] migrate draft clients error:", err);
    // Non-fatal: continue with remaining steps
  }

  // 2. Seed org defaults (templates, schedules)
  try {
    await seedOrgDefaults(orgId, user.id, admin, portalEnabled);
  } catch (err) {
    console.error("[finaliseWizardSetup] seed defaults error:", err);
  }

  // 3. Build reminder queue (batch insert — single DB call, no timeout risk)
  try {
    const org = { id: orgId, name: "" };
    await buildReminderQueue(admin, org, user.id);
    await buildCustomScheduleQueue(admin, org, user.id);
  } catch (err) {
    console.error("[finaliseWizardSetup] queue building error:", err);
    // Non-fatal: cron will pick up any missed entries on next run
  }

  // 4. Mark org setup complete + clean up draft
  const { error: markError } = await admin
    .from("organisations")
    .update({ setup_complete: true, setup_draft: null })
    .eq("id", orgId);

  if (markError) return { error: markError.message };

  await admin
    .from("setup_draft_clients")
    .delete()
    .eq("org_id", orgId);

  // 5. Refresh session so JWT contains org_id
  await supabase.auth.refreshSession();

  return {};
}
