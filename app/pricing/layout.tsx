import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - PhaseTwo",
  description: "Choose the right plan for your accounting practice",
};

/**
 * Pricing layout sits outside the dashboard layout group.
 * It inherits the root layout (fonts, globals.css, Toaster) and
 * adds a minimal page shell without the dashboard navigation.
 */
export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-tight">
              PhaseTwo
            </a>
            <a
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </a>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
