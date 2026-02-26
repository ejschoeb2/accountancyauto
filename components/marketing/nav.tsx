"use client";

import { Brain } from "lucide-react";

export const MarketingNav = () => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 shrink-0">
            <Brain className="text-violet-600" size={24} />
            <span className="font-bold text-lg text-foreground">Prompt</span>
          </a>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <a
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              Login
            </a>
            <a
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 hover:from-blue-500 hover:to-blue-400 active:scale-95 transition-all duration-200"
            >
              Get started
            </a>
          </div>

        </div>
      </div>
    </header>
  );
};
