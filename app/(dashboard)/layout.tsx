import { redirect } from "next/navigation";
import Image from "next/image";
import { NavLinks } from "@/components/nav-links";
import { SettingsLink } from "@/components/settings-link";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/auth/org-context";
import { isOrgReadOnly } from "@/lib/billing/read-only-mode";

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

  // Check if org is in read-only mode (lapsed subscription)
  let readOnly = false;
  try {
    const orgId = await getOrgId();
    readOnly = await isOrgReadOnly(orgId);
  } catch {
    // If org context fails, don't block the layout — just skip the banner
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header / Navigation */}
      <header className="bg-background">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-4">
            <Image src="/logofini.png" alt="Logo" width={32} height={32} className="object-contain" />
          </div>

          {/* Navigation Links & Settings */}
          <div className="flex items-center gap-4">
            <NavLinks />
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

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 w-full">
        {children}
      </main>
    </div>
  );
}
