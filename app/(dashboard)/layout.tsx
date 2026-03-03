import { redirect } from "next/navigation";
import { Brain } from "lucide-react";
import { NavLinks } from "@/components/nav-links";
import { MobileNav } from "@/components/mobile-nav";
import { HelpLink } from "@/components/help-link";
import { SettingsLink } from "@/components/settings-link";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { isOrgReadOnly } from "@/lib/billing/read-only-mode";
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

  // Check if org is in read-only mode (lapsed subscription) and fetch org name
  let readOnly = false;
  let needsReauth = false;
  let orgName = '';
  let orgRole = 'member';
  let providerName = 'your storage provider';
  try {
    const { orgId, orgRole: role } = await getOrgContext();
    orgRole = role;
    readOnly = await isOrgReadOnly(orgId);

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
      .select('name, storage_backend_status, storage_backend')
      .eq('id', orgId)
      .single();
    orgName = org?.name || '';
    needsReauth = org?.storage_backend_status === 'reauth_required';
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
            <Brain className="text-violet-600" size={22} />
            <span className="text-lg font-bold tracking-tight">Prompt</span>
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

      {/* Read-only mode banner */}
      {readOnly && (
        <div className="bg-amber-50 border-b border-amber-200 px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-amber-800">
              Your subscription is inactive. Your data is safe but you cannot make changes until your billing is updated.
            </p>
            <a href="/billing" className="text-sm font-medium text-amber-900 hover:text-amber-700 underline">
              Update billing
            </a>
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
