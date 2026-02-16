import { getSendHour, getEmailSettings, getInboundCheckerMode } from "@/app/actions/settings";
import { LogOut, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SendHourPicker } from "./components/send-hour-picker";
import { EmailSettingsCard } from "./components/email-settings-card";
import { InboundCheckerCard } from "./components/inbound-checker-card";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDemoUser = user?.email === "demo@peninsula-internal.local";

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

      {/* Demo Mode / Sign Out Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`size-12 rounded-lg flex items-center justify-center shrink-0 ${
              isDemoUser
                ? "bg-violet-500/10"
                : "bg-status-neutral/10"
            }`}>
              {isDemoUser ? (
                <Sparkles className="size-6 text-violet-500" />
              ) : (
                <LogOut className="size-6 text-status-neutral" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {isDemoUser ? "Demo Mode" : "Account"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isDemoUser
                  ? "You're currently exploring the demo with sample data"
                  : "Sign out of your account"}
              </p>
            </div>
          </div>
          <SignOutButton isDemoMode={isDemoUser} />
        </div>
      </Card>

      {/* Reminder Schedule Card */}
      <SendHourPicker defaultHour={sendHour} />

      {/* Email Settings Card */}
      <EmailSettingsCard defaultSettings={emailSettings} />

      {/* Inbound Email Checker Card */}
      <InboundCheckerCard defaultMode={inboundCheckerMode} />
    </div>
  );
}
