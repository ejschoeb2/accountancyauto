"use client";

import { useEffect, useRef, useState } from "react";
import { Brain } from "lucide-react";
import { FooterParticles } from "@/components/marketing/footer-particles";

export const FooterSection = () => {
  const [shouldExplode, setShouldExplode] = useState(false);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.4) setShouldExplode(true);
      },
      { threshold: 0.4 }
    );
    const el = footerRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <footer
      ref={footerRef}
      className="relative bg-[#1a1a1a] text-white py-20 lg:py-32 min-h-[500px]"
    >
      {/* Particle overlay */}
      <FooterParticles isTriggered={shouldExplode} />

      {/* Main content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 flex flex-col items-center gap-8">

        {/* CTA headline */}
        <div className="text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl lg:text-5xl font-bold text-white text-center">
            Ready to stop chasing?
          </h2>
          <a
            href="/onboarding"
            className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-3 text-lg font-semibold text-violet-600 hover:bg-gray-100 transition-colors"
          >
            Start Free Trial
          </a>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-white/10 my-4" />

        {/* Footer nav */}
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-8">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <Brain className="text-violet-400" size={22} />
            <span className="font-bold text-white">Prompt</span>
          </a>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="/login" className="hover:text-white transition-colors">Login</a>
            <a href="/onboarding" className="hover:text-white transition-colors">Sign Up</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </nav>

        </div>

        {/* Copyright */}
        <p className="text-sm text-white/40 text-center">
          &copy; 2026 Prompt. All rights reserved.
        </p>

      </div>
    </footer>
  );
};
