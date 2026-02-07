import Link from "next/link";
import { getConnectionStatus } from "@/app/actions/quickbooks";
import { QboStatusBanner } from "@/components/qbo-status-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const connectionStatus = await getConnectionStatus();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header / Navigation */}
      <header className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-16">
            <Link href="/" className="font-semibold text-lg text-primary">
              Peninsula Accounting
            </Link>

            {/* Navigation Links */}
            <nav className="flex items-center gap-8">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-accent transition-colors duration-200"
              >
                Dashboard
              </Link>
              <Link
                href="/clients"
                className="text-sm font-medium text-muted-foreground hover:text-accent transition-colors duration-200"
              >
                Clients
              </Link>
              <Link
                href="/templates"
                className="text-sm font-medium text-muted-foreground hover:text-accent transition-colors duration-200"
              >
                Templates
              </Link>
              <Link
                href="/calendar"
                className="text-sm font-medium text-muted-foreground hover:text-accent transition-colors duration-200"
              >
                Calendar
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* QBO Status Banner */}
      <QboStatusBanner connected={connectionStatus.connected} />

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
