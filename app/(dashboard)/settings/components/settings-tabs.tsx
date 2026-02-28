"use client";

import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { SendHourPicker } from "./send-hour-picker";
import { EmailSettingsCard } from "./email-settings-card";
import { InboundCheckerCard } from "./inbound-checker-card";
import { PostmarkSettingsCard } from "./postmark-settings-card";
import { TeamCard, type AccountantStats } from "./team-card";
import { SignOutCard } from "./sign-out-card";
import { StorageCard } from "./storage-card";
import { BillingStatusCard } from "@/app/(dashboard)/billing/components/billing-status-card";
import { UsageBars } from "@/app/(dashboard)/billing/components/usage-bars";
import type { EmailSettings, InboundCheckerMode } from "@/app/actions/settings";

interface SettingsTabsProps {
  sendHour: number;
  emailSettings: EmailSettings;
  inboundCheckerMode: InboundCheckerMode;
  postmarkSettings: { token: string | null; senderDomain: string | null };
  senderDomain: string;
  accountants: AccountantStats[];
  totalClients: number;
  clientLimit: number | null;
  planName: string;
  subscriptionStatus:
    | "trialing"
    | "active"
    | "past_due"
    | "cancelled"
    | "unpaid";
  trialEndsAt: string | null;
  monthlyPrice: number;
  orgId: string;
  hasSubscription: boolean;
  storageBackend: string | null;
  googleDriveFolderExists: boolean;
  storageBackendStatus: string | null;
  oneDriveConnected: boolean;
  dropboxConnected: boolean;
}

export function SettingsTabs({
  sendHour,
  emailSettings,
  inboundCheckerMode,
  postmarkSettings,
  senderDomain,
  accountants,
  totalClients,
  clientLimit,
  planName,
  subscriptionStatus,
  trialEndsAt,
  monthlyPrice,
  orgId,
  hasSubscription,
  storageBackend,
  googleDriveFolderExists,
  storageBackendStatus,
  oneDriveConnected,
  dropboxConnected,
}: SettingsTabsProps) {
  return (
    <div className="space-y-8">
      <Tabs defaultValue="general">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1>Settings</h1>
            <p className="text-muted-foreground">Manage your preferences</p>
          </div>
          <TabsList className="!h-11">
            <TabsTrigger value="general" className="px-4">General</TabsTrigger>
            <TabsTrigger value="email" className="px-4">Email</TabsTrigger>
            <TabsTrigger value="billing" className="px-4">Billing</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="space-y-8 mt-6">
          <StorageCard
            storageBackend={storageBackend}
            googleDriveFolderExists={googleDriveFolderExists}
            storageBackendStatus={storageBackendStatus}
            oneDriveConnected={oneDriveConnected}
            dropboxConnected={dropboxConnected}
          />
          <SendHourPicker defaultHour={sendHour} />
          <TeamCard
            accountants={accountants}
            totalClients={totalClients}
            clientLimit={clientLimit}
          />
          <SignOutCard />
        </TabsContent>

        <TabsContent value="email" className="space-y-8 mt-6">
          <EmailSettingsCard
            defaultSettings={emailSettings}
            senderDomain={senderDomain}
          />
          <PostmarkSettingsCard
            defaultToken={postmarkSettings.token ?? ''}
            defaultSenderDomain={postmarkSettings.senderDomain ?? ''}
          />
          <InboundCheckerCard defaultMode={inboundCheckerMode} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-8 mt-6">
          <BillingStatusCard
            planName={planName}
            subscriptionStatus={subscriptionStatus}
            trialEndsAt={trialEndsAt}
            monthlyPrice={monthlyPrice}
            orgId={orgId}
            hasSubscription={hasSubscription}
          />
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center size-12 rounded-lg bg-blue-500/10 shrink-0">
                <BarChart3 className="size-6 text-blue-500" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Client Usage</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Current client count against your plan limit
                  </p>
                </div>
                <UsageBars clientCount={totalClients} clientLimit={clientLimit} />
              </div>
            </div>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
