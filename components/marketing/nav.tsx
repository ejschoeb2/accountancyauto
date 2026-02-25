"use client";

import { Brain, LogIn, Rocket } from "lucide-react";

export const MarketingNav = () => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80">
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
            >
              <LogIn size={15} />
              Login
            </a>
            <a
              href="/onboarding"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              <Rocket size={15} />
              Start Free Trial
            </a>
          </div>

        </div>
      </div>
    </header>
  );
};
