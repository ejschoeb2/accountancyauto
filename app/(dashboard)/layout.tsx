import Link from "next/link";
import { Waves } from "lucide-react";
import { getConnectionStatus } from "@/app/actions/quickbooks";
import { QboStatusBanner } from "@/components/qbo-status-banner";
import { NavLinks } from "@/components/nav-links";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const connectionStatus = await getConnectionStatus();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header / Navigation */}
      <header className="bg-white">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Branding */}
          <Link
            href="/"
            className="flex items-center gap-2.5 bg-primary rounded-xl px-4 py-2.5 hover:opacity-90 transition-opacity"
          >
            <Waves className="h-5 w-5 text-white" />
            <span className="font-display font-medium text-lg text-white tracking-tight">
              Peninsula Accounting
            </span>
          </Link>

          {/* Navigation Links */}
          <NavLinks />
        </div>
      </header>

      {/* QBO Status Banner */}
      <QboStatusBanner connected={connectionStatus.connected} lastSyncTime={connectionStatus.lastSyncTime} />

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
