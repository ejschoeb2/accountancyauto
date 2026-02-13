import Image from "next/image";
import Link from "next/link";
import { getConnectionStatus } from "@/app/actions/quickbooks";
import { getSendHour, getEmailSettings } from "@/app/actions/settings";
import { Clock, Mail, LogOut, Sparkles } from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { SendHourPicker } from "./components/send-hour-picker";
import { EmailSettingsCard } from "./components/email-settings-card";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDemoUser = user?.email === "demo@peninsula-internal.local";

  const [connectionStatus, sendHour, emailSettings] = await Promise.all([
    getConnectionStatus(),
    getSendHour(),
    getEmailSettings(),
  ]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1>Settings</h1>
        <p className="text-muted-foreground">Manage your integrations and preferences</p>
      </div>

      {/* QuickBooks Integration Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Image
                src="/quickbooks-2.png"
                alt="QuickBooks"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>

            <div className="space-y-2">
              <div>
                <h2 className="text-lg font-semibold">QuickBooks Online</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {connectionStatus.lastSyncTime
                    ? "Sync client data from your QuickBooks account"
                    : "Connect to import client data from QuickBooks"}
                </p>
              </div>

              {connectionStatus.lastSyncTime ? (
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-status-success rounded-full" />
                  <span className="text-sm text-muted-foreground">
                    Last synced: {formatDistanceToNow(new Date(connectionStatus.lastSyncTime), { addSuffix: true })}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-status-warning rounded-full" />
                  <span className="text-sm text-status-warning font-medium">Not synced yet</span>
                </div>
              )}
            </div>
          </div>

          <Link href="/onboarding">
            <ButtonBase buttonType="text-only" variant="blue">
              {connectionStatus.lastSyncTime ? "Re-sync from QuickBooks" : "Sync from QuickBooks"}
            </ButtonBase>
          </Link>
        </div>
      </Card>

      {/* Reminder Schedule Card */}
      <SendHourPicker defaultHour={sendHour} />

      {/* Email Settings Card */}
      <EmailSettingsCard defaultSettings={emailSettings} />

      {/* Sign Out Card */}
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
    </div>
  );
}
