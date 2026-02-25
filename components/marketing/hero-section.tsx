"use client";

import { Rocket } from "lucide-react";
import { HeroParticles } from "@/components/marketing/hero-particles";
import { motion } from "framer-motion";

const HEADING_WORDS = ["The", "Chase", "Is", "Over"];

export const HeroSection = () => {
  return (
    // relative so the full-width particle overlay is contained here
    <section className="relative min-h-[80vh] flex items-center py-20 lg:py-32 overflow-hidden">

      {/* Particles at section level — z-0, spans full viewport width.
          Text is z-10 so particles pass underneath naturally. */}
      <HeroParticles />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Constrained to left portion of the content area */}
        <div className="flex flex-col gap-4 max-w-[720px]">
          <h1 className="text-8xl lg:text-9xl font-bold tracking-tight text-foreground leading-none">
            {HEADING_WORDS.map((word, index) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 100,
                  damping: 12,
                  delay: index * 0.08,
                }}
                className="inline-block mr-[0.25em]"
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 12, delay: 0.42 }}
            className="text-base text-muted-foreground leading-relaxed max-w-lg"
          >
            Automated client reminders for UK accounting practices. Stop manually
            chasing records and documents — Prompt handles it for you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 12, delay: 0.54 }}
          >
            <a
              href="/onboarding"
              className="group inline-flex items-center gap-2 self-start rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:from-violet-500 hover:to-purple-500 active:scale-95 transition-all duration-200"
            >
              <Rocket size={17} className="transition-transform duration-200 group-hover:-rotate-12" />
              Start Free Trial
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
