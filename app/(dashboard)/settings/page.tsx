import Image from "next/image";
import Link from "next/link";
import { getConnectionStatus } from "@/app/actions/quickbooks";
import { Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default async function SettingsPage() {
  const connectionStatus = await getConnectionStatus();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your integrations and preferences</p>
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
              <div className="absolute -bottom-1 -right-1">
                {connectionStatus.connected ? (
                  <div className="flex items-center gap-1">
                    <Check className="size-5 text-status-success" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="size-5 text-status-danger" />
                  </div>
                )}
              </div>
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
            <Button variant={connectionStatus.connected ? "outline" : "default"}>
              {connectionStatus.connected ? "Reconnect" : "Connect"}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
