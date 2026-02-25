"use client";

import { Brain, LogIn } from "lucide-react";

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
          <a
            href="/login"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 hover:from-blue-500 hover:to-blue-400 active:scale-95 transition-all duration-200"
          >
            <LogIn size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            Login
          </a>

        </div>
      </div>
    </header>
  );
};
