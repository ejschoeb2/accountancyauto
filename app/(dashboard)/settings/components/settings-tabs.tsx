"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SendHourPicker } from "./send-hour-picker";
import { EmailSettingsCard } from "./email-settings-card";
import { DomainSetupCard } from "./domain-setup-card";
import { TeamCard, type AccountantStats } from "./team-card";
import { SignOutCard } from "./sign-out-card";
import { StorageCard } from "./storage-card";
import { ClientPortalCard } from "./client-portal-card";
import { UploadChecksCard } from "./upload-checks-card";
import { BillingStatusCard } from "@/app/(dashboard)/billing/components/billing-status-card";
import type { EmailSettings, OrgDomainDnsData, UploadCheckMode } from "@/app/actions/settings";
import type { PlanTier } from "@/lib/stripe/plans";

interface SettingsTabsProps {
  sendHour: number;
  emailSettings: EmailSettings;
  domainDnsData: OrgDomainDnsData | null;
  senderDomain: string;
  accountants: AccountantStats[];
  totalClients: number;
  clientLimit: number | null;
  planName: string;
  currentTier: PlanTier;
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
  uploadCheckMode: UploadCheckMode;
  autoReceiveVerified: boolean;
  rejectMismatchedUploads: boolean;
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
  currentTier,
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
  uploadCheckMode,
  autoReceiveVerified,
  rejectMismatchedUploads,
}: SettingsTabsProps) {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "billing" ? "billing" : "general";

  return (
    <div className="space-y-8">
      <Tabs defaultValue={defaultTab}>
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
            <UploadChecksCard uploadCheckMode={uploadCheckMode} autoReceiveVerified={autoReceiveVerified} rejectMismatchedUploads={rejectMismatchedUploads} />
          )}
          {clientPortalEnabled && (
            <StorageCard
              storageBackend={storageBackend}
              googleDriveFolderId={googleDriveFolderId}
              storageBackendStatus={storageBackendStatus}
              oneDriveConnected={oneDriveConnected}
              dropboxConnected={dropboxConnected}
            />
          )}
          <TeamCard
            accountants={accountants}
            totalClients={totalClients}
            clientLimit={clientLimit}
          />
          <SignOutCard />
        </TabsContent>

        <TabsContent value="email" className="space-y-8 mt-6">
          <DomainSetupCard initialDnsData={domainDnsData} />
          <EmailSettingsCard
            defaultSettings={emailSettings}
            senderDomain={senderDomain}
          />
          <SendHourPicker defaultHour={sendHour} />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingStatusCard
            planName={planName}
            planTier={currentTier}
            subscriptionStatus={subscriptionStatus}
            trialEndsAt={trialEndsAt}
            monthlyPrice={monthlyPrice}
            orgId={orgId}
            hasSubscription={hasSubscription}
            clientCount={totalClients}
            clientLimit={clientLimit}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
}
