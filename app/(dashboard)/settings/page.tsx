import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSendHour, getEmailSettings, getInboundCheckerMode, getPostmarkSettings } from "@/app/actions/settings";
import { SendHourPicker } from "./components/send-hour-picker";
import { EmailSettingsCard } from "./components/email-settings-card";
import { InboundCheckerCard } from "./components/inbound-checker-card";
import { PostmarkSettingsCard } from "./components/postmark-settings-card";
import { TeamCard } from "./components/team-card";
import { SignOutCard } from "./components/sign-out-card";
import {
  AccountantOverviewCard,
  type AccountantStats,
} from "./components/accountant-overview-card";

export default async function SettingsPage() {
  // Admin-only access: members are silently redirected to dashboard
  const { orgId, orgRole } = await getOrgContext();
  if (orgRole !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Fetch data needed for AccountantOverviewCard in parallel with settings
  const [
    sendHour,
    emailSettings,
    inboundCheckerMode,
    postmarkSettings,
    membershipsResult,
    clientCountsResult,
    orgResult,
  ] = await Promise.all([
    getSendHour(),
    getEmailSettings(),
    getInboundCheckerMode(),
    getPostmarkSettings(),
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
      .select("client_count_limit")
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

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1>Settings</h1>
        <p className="text-muted-foreground">Manage your preferences</p>
      </div>

      {/* Reminder Schedule Card */}
      <SendHourPicker defaultHour={sendHour} />

      {/* Email Settings Card */}
      <EmailSettingsCard
        defaultSettings={emailSettings}
        senderDomain={process.env.POSTMARK_SENDER_DOMAIN ?? "phasetwo.uk"}
      />

      {/* Postmark Configuration Card */}
      <PostmarkSettingsCard
        defaultToken={postmarkSettings.token}
        defaultSenderDomain={postmarkSettings.senderDomain}
      />

      {/* Team Management Card */}
      <TeamCard />

      {/* Accountant Overview Card — admin sees per-accountant client breakdown */}
      <AccountantOverviewCard
        accountants={accountants}
        totalClients={totalClients}
        clientLimit={clientLimit}
      />

      {/* Inbound Email Checker Card */}
      <InboundCheckerCard defaultMode={inboundCheckerMode} />

      {/* Sign Out */}
      <SignOutCard />
    </div>
  );
}
