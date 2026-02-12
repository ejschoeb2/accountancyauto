import { redirect } from "next/navigation";
import Image from "next/image";
import { NavLinks } from "@/components/nav-links";
import { SettingsLink } from "@/components/settings-link";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header / Navigation */}
      <header className="bg-background">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-4">
            <Image src="/logofini.png" alt="Logo" width={32} height={32} className="object-contain" />
            <div className="w-px h-10 bg-border" />
            <Image src="/peninsulaccountinglogo.jpg" alt="Peninsula Accounting" width={120} height={40} className="object-contain" />
          </div>

          {/* Navigation Links & Settings */}
          <div className="flex items-center gap-4">
            <NavLinks />
            <SettingsLink />
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 w-full">
        {children}
      </main>
    </div>
  );
}
