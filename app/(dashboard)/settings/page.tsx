import { getSendHour, getEmailSettings, getInboundCheckerMode } from "@/app/actions/settings";
import { SendHourPicker } from "./components/send-hour-picker";
import { EmailSettingsCard } from "./components/email-settings-card";
import { InboundCheckerCard } from "./components/inbound-checker-card";

export default async function SettingsPage() {
  const [sendHour, emailSettings, inboundCheckerMode] = await Promise.all([
    getSendHour(),
    getEmailSettings(),
    getInboundCheckerMode(),
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
      <EmailSettingsCard defaultSettings={emailSettings} />

      {/* Inbound Email Checker Card */}
      <InboundCheckerCard defaultMode={inboundCheckerMode} />
    </div>
  );
}
