"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";
import { SendHourPicker } from "./send-hour-picker";
import { EmailSettingsCard } from "./email-settings-card";
import { InboundCheckerCard } from "./inbound-checker-card";
import { PostmarkSettingsCard } from "./postmark-settings-card";
import { TeamCard } from "./team-card";
import { SignOutCard } from "./sign-out-card";
import {
  AccountantOverviewCard,
  type AccountantStats,
} from "./accountant-overview-card";
import { BillingStatusCard } from "@/app/(dashboard)/billing/components/billing-status-card";
import { UsageBars } from "@/app/(dashboard)/billing/components/usage-bars";
import { ManageBillingButton } from "@/app/(dashboard)/billing/components/manage-billing-button";
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
}: SettingsTabsProps) {
  return (
    <div className="space-y-8">
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-8 mt-6">
          <SendHourPicker defaultHour={sendHour} />
          <TeamCard />
          <AccountantOverviewCard
            accountants={accountants}
            totalClients={totalClients}
            clientLimit={clientLimit}
          />
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
          />
          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>
                Current usage against your plan limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsageBars clientCount={totalClients} clientLimit={clientLimit} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Manage subscription</CardTitle>
              <CardDescription>
                {hasSubscription
                  ? "Update your payment method, change plan, or view invoices through the Stripe Customer Portal"
                  : "Get started by choosing a plan for your practice"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManageBillingButton
                orgId={orgId}
                hasSubscription={hasSubscription}
              />
            </CardContent>
          </Card>
          {!hasSubscription && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center space-y-3">
                  <p className="text-muted-foreground">
                    No active subscription found. Choose a plan to get started.
                  </p>
                  <Link
                    href="/pricing"
                    className="text-primary underline underline-offset-4 hover:text-primary/80"
                  >
                    View pricing plans
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <SignOutCard />
    </div>
  );
}
