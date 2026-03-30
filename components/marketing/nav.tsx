"use client";

import { useState, useEffect } from "react";
import { UserPlus, LogIn, ArrowLeft, Menu, X } from "lucide-react";
import { PromptLogo } from "@/components/prompt-logo";

interface MarketingNavProps {
  hideLogin?: boolean;
  hideSignup?: boolean;
  signupLabel?: string;
  signupBlue?: boolean;
}

/**
 * Detect whether the current page is served under an org subdomain
 * (e.g. home-run.app.prompt.accountants).
 */
function useIsOrgSubdomain(): boolean {
  const [isOrg, setIsOrg] = useState(false);

  useEffect(() => {
    const parts = window.location.hostname.split(".");
    // {slug}.app.{domain}.{tld} = 4+ parts with "app" at index 1
    if (parts.length >= 4 && parts[1] === "app") {
      const reserved = ["www", "app", "api", "admin", "billing"];
      if (!reserved.includes(parts[0])) {
        setIsOrg(true);
      }
    }
  }, []);

  return isOrg;
}

export const MarketingNav = ({ hideLogin, hideSignup, signupLabel = "Sign up", signupBlue }: MarketingNavProps = {}) => {
  const isOrgSubdomain = useIsOrgSubdomain();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signupClassName = signupBlue
    ? "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 hover:from-blue-500 hover:to-blue-400 active:scale-95 transition-all duration-200"
    : "inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200";

  return (
    <header className="bg-background">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="relative flex items-center justify-between h-16">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 shrink-0">
            <PromptLogo size={24} className="text-violet-600" />
            <span className="font-bold text-lg text-foreground">Prompt</span>
          </a>

          {/* Nav links — desktop only, centered absolutely */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground absolute left-1/2 -translate-x-1/2">
            <a href="/about" className="hover:text-foreground transition-colors">About</a>
            <a href="/#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="/guides" className="hover:text-foreground transition-colors">Guides</a>
            <a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {isOrgSubdomain ? (
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/50 hover:from-blue-500 hover:to-blue-400 active:scale-95 transition-all duration-200"
              >
                <ArrowLeft size={15} />
                Take me back
              </a>
            ) : (
              <>
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
                  <a href="/signup" className={`hidden md:inline-flex ${signupClassName.replace("inline-flex", "").trim()}`}>
                    {signupLabel}
                    <UserPlus size={15} />
                  </a>
                )}
              </>
            )}
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

        </div>

        {/* Mobile menu dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/40 py-4 flex flex-col gap-1">
            <a
              href="/about"
              onClick={() => setMobileOpen(false)}
              className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
            >
              About
            </a>
            <a
              href="/#features"
              onClick={() => setMobileOpen(false)}
              className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
            >
              Features
            </a>
            <a
              href="/guides"
              onClick={() => setMobileOpen(false)}
              className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
            >
              Guides
            </a>
            <a
              href="/#pricing"
              onClick={() => setMobileOpen(false)}
              className="px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
            >
              Pricing
            </a>
            {!hideSignup && (
              <div className="mt-3 pt-3 border-t border-border/40">
                <a href="/signup" onClick={() => setMobileOpen(false)} className={signupClassName}>
                  {signupLabel}
                  <UserPlus size={15} />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
