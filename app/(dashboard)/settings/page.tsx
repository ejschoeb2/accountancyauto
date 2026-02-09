import Image from "next/image";
import Link from "next/link";
import { getConnectionStatus } from "@/app/actions/quickbooks";
import { getSendHour, getEmailSettings } from "@/app/actions/settings";
import { AlertTriangle } from "lucide-react";
import { ButtonBase } from "@/components/ui/button-base";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { SendHourPicker } from "./components/send-hour-picker";
import { EmailSettingsCard } from "./components/email-settings-card";

export default async function SettingsPage() {
  const [connectionStatus, sendHour, emailSettings] = await Promise.all([
    getConnectionStatus(),
    getSendHour(),
    getEmailSettings(),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1>Settings</h1>
        <p className="text-muted-foreground">Manage your integrations and preferences</p>
      </div>

      {/* QuickBooks Integration Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex items-center">
              <Image
                src="/quickbooks-2.png"
                alt="QuickBooks"
                width={48}
                height={48}
                className="object-contain"
              />
              {/* Status Indicator */}
              {!connectionStatus.connected && (
                <div className="absolute -bottom-1 -right-1">
                  <AlertTriangle className="size-5 text-status-danger" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <h2 className="text-lg font-semibold">QuickBooks Online</h2>
                <div className="flex items-center gap-2 mt-1">
                  {connectionStatus.connected ? (
                    <>
                      <span className="inline-block w-2 h-2 bg-status-success rounded-full" />
                      <span className="text-sm text-status-success font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-block w-2 h-2 bg-status-danger rounded-full" />
                      <span className="text-sm text-status-danger font-medium">Disconnected</span>
                    </>
                  )}
                </div>
              </div>

              {connectionStatus.lastSyncTime && (
                <p className="text-sm text-muted-foreground">
                  Last synced: {formatDistanceToNow(new Date(connectionStatus.lastSyncTime), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>

          <Link href="/onboarding">
            <ButtonBase buttonType="text-only">
              {connectionStatus.connected ? "Reconnect" : "Connect"}
            </ButtonBase>
          </Link>
        </div>
      </Card>

      {/* Reminder Schedule Card */}
      <SendHourPicker defaultHour={sendHour} />

      {/* Email Settings Card */}
      <EmailSettingsCard defaultSettings={emailSettings} />
    </div>
  );
}
