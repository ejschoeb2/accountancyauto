import Image from "next/image";
import { NavLinks } from "@/components/nav-links";
import { SettingsLink } from "@/components/settings-link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header / Navigation */}
      <header className="bg-white">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-4">
            <Image src="/logofini.png" alt="Logo" width={32} height={32} className="object-contain" />
            <div className="w-px h-10 bg-border" />
            <span className="font-sans font-bold tracking-tight text-xl text-foreground">
              Peninsula Accounting
            </span>
          </div>

          {/* Navigation Links & Settings */}
          <div className="flex items-center gap-4">
            <NavLinks />
            <SettingsLink />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
