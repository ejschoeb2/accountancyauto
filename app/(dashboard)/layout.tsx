import Link from "next/link";
import { redirect } from "next/navigation";
import { XCircle, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { NavLinks } from "@/components/nav-links";
import { MobileNav } from "@/components/mobile-nav";
import { HelpLink } from "@/components/help-link";
import { SettingsLink } from "@/components/settings-link";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { DocumentNotificationMount } from "@/app/(dashboard)/components/document-notification-mount";


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check (middleware handles redirect, but belt-and-suspenders)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isSuperAdmin = user?.app_metadata?.is_super_admin === true;

  // Fetch org data for banners and name
  let subscriptionStatus: string | null = null;
  let needsReauth = false;
  let orgName = '';
  let orgRole = 'member';
  let providerName = 'your storage provider';
  try {
    const { orgId, orgRole: role } = await getOrgContext();
    orgRole = role;

    // Gate: members must complete the wizard before accessing the dashboard
    if (role === "member") {
      const { getMemberSetupComplete } = await import("@/app/actions/settings");
      const setupComplete = await getMemberSetupComplete();
      if (!setupComplete) {
        redirect("/setup/wizard");
      }
    }

    const { data: org } = await supabase
      .from('organisations')
      .select('name, storage_backend_status, storage_backend, subscription_status, trial_ends_at')
      .eq('id', orgId)
      .single();
    orgName = org?.name || '';
    needsReauth = org?.storage_backend_status === 'reauth_required';

    // Determine if subscription is inactive
    const status = org?.subscription_status;
    const trialEnd = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const trialExpired = status === 'trialing' && trialEnd && trialEnd <= new Date();
    if (status === 'unpaid' || status === 'cancelled' || status === 'past_due' || trialExpired) {
      subscriptionStatus = status;
    }
    providerName =
      org?.storage_backend === 'google_drive' ? 'Google Drive'
      : org?.storage_backend === 'onedrive' ? 'Microsoft OneDrive'
      : org?.storage_backend === 'dropbox' ? 'Dropbox'
      : 'your storage provider';
  } catch {
    // If org context fails, don't block the layout — just skip the banner and org name
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Realtime document notifications — client-side side-effect component, renders nothing */}
      <DocumentNotificationMount />

      {/* Header / Navigation */}
      <header className="bg-background">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between px-4 md:px-0">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/promptlogov1.svg" alt="Prompt" width={22} height={22} />
              <span className="text-lg font-bold tracking-tight">Prompt</span>
            </Link>
            {orgName && (
              <>
                <span className="w-px h-4 bg-border" />
                <span className="text-lg font-bold tracking-tight">{orgName}</span>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <MobileNav isSuperAdmin={isSuperAdmin} orgRole={orgRole} />
          </div>

          {/* Navigation Links & Settings (desktop) */}
          <div className="hidden md:flex items-center gap-4">
            <NavLinks isSuperAdmin={isSuperAdmin} orgRole={orgRole} />
            <HelpLink />
            <SettingsLink />
          </div>
        </div>
      </header>

      {/* Inactive subscription alert */}
      {(subscriptionStatus === 'unpaid' || subscriptionStatus === 'cancelled') && (
        <div className="border-b px-8 py-3 bg-red-500/10">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <XCircle className="size-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-500 flex-1">
              Your subscription is inactive. Your account is in read-only mode.{' '}
              <a href="/settings?tab=billing" className="font-medium underline hover:text-red-400">
                Update your plan
              </a>{' '}
              to restore full access.
            </p>
          </div>
        </div>
      )}
      {subscriptionStatus === 'past_due' && (
        <div className="border-b px-8 py-3 bg-amber-500/10">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-600 flex-1">
              Your payment is overdue.{' '}
              <a href="/settings?tab=billing" className="font-medium underline hover:text-amber-500">
                Update your billing details
              </a>{' '}
              to avoid losing access.
            </p>
          </div>
        </div>
      )}

      {/* Storage re-auth banner */}
      {needsReauth && (
        <div className="bg-red-50 border-b border-red-200 px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-800">
              Your {providerName} connection has expired. Re-connect to continue storing documents in {providerName}.
            </p>
            <a href="/settings?tab=storage" className="text-sm font-medium text-red-900 hover:text-red-700 underline">
              Reconnect {providerName}
            </a>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 w-full">
        {children}
      </main>
    </div>
  );
}
