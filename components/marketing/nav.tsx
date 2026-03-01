"use client";

import { Brain, UserPlus, LogIn } from "lucide-react";

interface MarketingNavProps {
  hideLogin?: boolean;
  hideSignup?: boolean;
  signupLabel?: string;
  signupBlue?: boolean;
}

export const MarketingNav = ({ hideLogin, hideSignup, signupLabel = "Sign up", signupBlue }: MarketingNavProps = {}) => {
  return (
    <header className="bg-background">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 shrink-0">
            <Brain className="text-violet-600" size={24} />
            <span className="font-bold text-lg text-foreground">Prompt</span>
          </a>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/news" className="hover:text-foreground transition-colors">News</a>
            <a href="/changelog" className="hover:text-foreground transition-colors">Changelog</a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {!hideLogin && (
              <a
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 hover:from-blue-500 hover:to-blue-400 active:scale-95 transition-all duration-200"
              >
                Login
                <LogIn size={15} />
              </a>
            )}
            {!hideSignup && (
              <a
                href="/signup"
                className={
                  signupBlue
                    ? "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 hover:from-blue-500 hover:to-blue-400 active:scale-95 transition-all duration-200"
                    : "inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
                }
              >
                {signupLabel}
                <UserPlus size={15} />
              </a>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
