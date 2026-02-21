import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth/org-context";
import { getSendHour, getEmailSettings, getInboundCheckerMode, getPostmarkSettings } from "@/app/actions/settings";
import { SendHourPicker } from "./components/send-hour-picker";
import { EmailSettingsCard } from "./components/email-settings-card";
import { InboundCheckerCard } from "./components/inbound-checker-card";
import { PostmarkSettingsCard } from "./components/postmark-settings-card";
import { TeamCard } from "./components/team-card";
import { SignOutCard } from "./components/sign-out-card";

export default async function SettingsPage() {
  // Admin-only access: members are silently redirected to dashboard
  const { orgRole } = await getOrgContext();
  if (orgRole !== "admin") {
    redirect("/dashboard");
  }

  const [sendHour, emailSettings, inboundCheckerMode, postmarkSettings] = await Promise.all([
    getSendHour(),
    getEmailSettings(),
    getInboundCheckerMode(),
    getPostmarkSettings(),
  ]);

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

      {/* Inbound Email Checker Card */}
      <InboundCheckerCard defaultMode={inboundCheckerMode} />

      {/* Sign Out */}
      <SignOutCard />
    </div>
  );
}
