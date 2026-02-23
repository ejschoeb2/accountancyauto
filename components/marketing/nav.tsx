"use client";

import { Brain } from "lucide-react";

export const MarketingNav = () => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 shrink-0">
            <Brain className="text-violet-600" size={24} />
            <span className="font-bold text-lg text-foreground">Prompt</span>
          </a>

          {/* Nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <a
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </a>
            <a
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              Start Free Trial
            </a>
          </div>

        </div>
      </div>
    </header>
  );
};
