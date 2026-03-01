"use client";

import { HeroParticles } from "@/components/marketing/hero-particles";
import { motion } from "framer-motion";

const HEADING_WORDS = ["The", "Chase", "Is", "Over"];

export const HeroSection = () => {
  return (
    // relative so the full-width particle overlay is contained here
    <section className="relative pt-28 pb-16 lg:pt-44 lg:pb-24">

      {/* Particles at section level — z-0, spans full viewport width.
          Text is z-10 so particles pass underneath naturally. */}
      <HeroParticles />

      <div className="max-w-screen-xl mx-auto px-4 relative">
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

        </div>
      </div>
    </section>
  );
};
