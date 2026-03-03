"use client";

import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { SendHourPicker } from "./send-hour-picker";
import { EmailSettingsCard } from "./email-settings-card";
import { DomainSetupCard } from "./domain-setup-card";
import { TeamCard, type AccountantStats } from "./team-card";
import { SignOutCard } from "./sign-out-card";
import { StorageCard } from "./storage-card";
import { ClientPortalCard } from "./client-portal-card";
import { BillingStatusCard } from "@/app/(dashboard)/billing/components/billing-status-card";
import { UsageBars } from "@/app/(dashboard)/billing/components/usage-bars";
import type { EmailSettings, OrgDomainDnsData } from "@/app/actions/settings";

interface SettingsTabsProps {
  sendHour: number;
  emailSettings: EmailSettings;
  domainDnsData: OrgDomainDnsData | null;
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
  googleDriveFolderId: string | null;
  storageBackendStatus: string | null;
  oneDriveConnected: boolean;
  dropboxConnected: boolean;
  clientPortalEnabled: boolean;
}

export function SettingsTabs({
  sendHour,
  emailSettings,
  domainDnsData,
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
  googleDriveFolderId,
  storageBackendStatus,
  oneDriveConnected,
  dropboxConnected,
  clientPortalEnabled,
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
          <ClientPortalCard clientPortalEnabled={clientPortalEnabled} />
          {clientPortalEnabled && (
            <StorageCard
              storageBackend={storageBackend}
              googleDriveFolderId={googleDriveFolderId}
              storageBackendStatus={storageBackendStatus}
              oneDriveConnected={oneDriveConnected}
              dropboxConnected={dropboxConnected}
            />
          )}
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
          <DomainSetupCard initialDnsData={domainDnsData} />
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
