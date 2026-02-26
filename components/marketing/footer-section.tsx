"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ArrowRight } from "lucide-react";
import { FooterParticles } from "@/components/marketing/footer-particles";
import { motion, useScroll, useTransform } from "framer-motion";

export const FooterSection = () => {
  const [shouldExplode, setShouldExplode] = useState(false);
  const footerRef = useRef<HTMLElement>(null);

  // Scroll-linked dark background wipe — rises from bottom as footer enters viewport
  const { scrollYProgress } = useScroll({
    target: footerRef,
    offset: ["start end", "start 0.35"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["100%", "0%"]);

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
      className="relative text-white min-h-screen flex flex-col overflow-hidden"
    >
      {/* Rising dark background wipe */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 bg-[#1a1a1a] z-0"
      />

      {/* Particle overlay */}
      <FooterParticles isTriggered={shouldExplode} />

      {/* CTA — vertically centered */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-32">
        <div className="flex flex-col items-center gap-8 text-center">
          <h2 className="max-w-4xl text-7xl lg:text-9xl font-bold text-white">
            Ready to stop chasing?
          </h2>
          <a
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
          >
            Get started
            <ArrowRight size={18} />
          </a>
        </div>
      </div>

      {/* Footer nav — pinned to the bottom of the section */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 pb-8 flex flex-col items-center gap-6">

          {/* Logo + nav links */}
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
            <a href="/" className="flex items-center gap-2">
              <Brain className="text-violet-400" size={22} />
              <span className="font-bold text-white">Prompt</span>
            </a>

            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="/news" className="hover:text-white transition-colors">News</a>
              <a href="/changelog" className="hover:text-white transition-colors">Changelog</a>
              <a href="/login" className="hover:text-white transition-colors">Login</a>
              <a href="/onboarding" className="hover:text-white transition-colors">Sign Up</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
            </nav>
          </div>

          {/* Copyright */}
          <p className="text-sm text-white/40 text-center">
            &copy; 2026 Prompt. All rights reserved.
          </p>

        </div>
      </div>
    </footer>
  );
};
