import { getOrgContext } from "@/lib/auth/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSendHour,
  getEmailSettings,
  getOrgDomainDnsData,
  getUserSendHour,
  getUserEmailSettings,
} from "@/app/actions/settings";
import { SignOutCard } from "./components/sign-out-card";
import { MemberSettingsCard } from "./components/member-settings-card";
import { SettingsTabs } from "./components/settings-tabs";
import { getPlanByTier, type PlanTier } from "@/lib/stripe/plans";
import type { AccountantStats } from "./components/team-card";

export default async function SettingsPage() {
  const { orgId, orgRole } = await getOrgContext();

  // Member view: show only personal settings + sign out
  if (orgRole !== "admin") {
    const [userSendHour, userEmailSettings] = await Promise.all([
      getUserSendHour(),
      getUserEmailSettings(),
    ]);

    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <h1>Settings</h1>
          <p className="text-muted-foreground">Manage your email preferences</p>
        </div>
        <MemberSettingsCard
          defaultSendHour={userSendHour}
          defaultEmailSettings={userEmailSettings}
        />
        <SignOutCard />
      </div>
    );
  }

  // Admin view: full settings page
  const admin = createAdminClient();

  const [
    sendHour,
    emailSettings,
    domainDnsData,
    membershipsResult,
    clientCountsResult,
    orgResult,
  ] = await Promise.all([
    getSendHour(),
    getEmailSettings(),
    getOrgDomainDnsData(),
    admin
      .from("user_organisations")
      .select("user_id, role")
      .eq("org_id", orgId),
    admin
      .from("clients")
      .select("owner_id")
      .eq("org_id", orgId),
    admin
      .from("organisations")
      .select(
        "client_count_limit, plan_tier, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, storage_backend, storage_backend_status, google_drive_folder_id, ms_home_account_id, dropbox_refresh_token_enc, client_portal_enabled"
      )
      .eq("id", orgId)
      .single(),
  ]);

  // Build client count map: owner_id -> count
  const countMap = new Map<string, number>();
  for (const c of clientCountsResult.data ?? []) {
    countMap.set(c.owner_id, (countMap.get(c.owner_id) ?? 0) + 1);
  }

  // Resolve emails for each member via Auth Admin API
  const accountants: AccountantStats[] = [];
  for (const m of membershipsResult.data ?? []) {
    try {
      const {
        data: { user: authUser },
        error: userError,
      } = await admin.auth.admin.getUserById(m.user_id);

      if (userError || !authUser?.email) {
        continue;
      }

      accountants.push({
        userId: m.user_id,
        email: authUser.email,
        name: authUser.user_metadata?.full_name ?? null,
        role: m.role as string,
        clientCount: countMap.get(m.user_id) ?? 0,
      });
    } catch {
      // Skip members whose auth records can't be resolved
    }
  }

  // Sort: admins first, then by client count descending
  accountants.sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    return b.clientCount - a.clientCount;
  });

  const totalClients = clientCountsResult.data?.length ?? 0;
  const clientLimit = orgResult.data?.client_count_limit ?? null;
  const dropboxConnected = !!orgResult.data?.dropbox_refresh_token_enc;

  // Billing data derived from the same org query
  const planConfig = getPlanByTier(orgResult.data?.plan_tier as PlanTier);
  const hasSubscription = !!orgResult.data?.stripe_customer_id;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <SettingsTabs
        sendHour={sendHour}
        emailSettings={emailSettings}
        domainDnsData={domainDnsData}
        senderDomain={domainDnsData?.domain ?? process.env.POSTMARK_SENDER_DOMAIN ?? "prompt.accountants"}
        accountants={accountants}
        totalClients={totalClients}
        clientLimit={clientLimit}
        planName={planConfig.name}
        subscriptionStatus={
          orgResult.data?.subscription_status as
            | "trialing"
            | "active"
            | "past_due"
            | "cancelled"
            | "unpaid"
        }
        trialEndsAt={orgResult.data?.trial_ends_at ?? null}
        monthlyPrice={planConfig.monthlyPrice}
        orgId={orgId}
        hasSubscription={hasSubscription}
        storageBackend={orgResult.data?.storage_backend ?? null}
        googleDriveFolderId={orgResult.data?.google_drive_folder_id ?? null}
        storageBackendStatus={orgResult.data?.storage_backend_status ?? null}
        oneDriveConnected={!!orgResult.data?.ms_home_account_id}
        dropboxConnected={dropboxConnected}
        clientPortalEnabled={orgResult.data?.client_portal_enabled ?? true}
      />
    </div>
  );
}
