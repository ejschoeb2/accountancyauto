"use client";

import { useState } from "react";
import { HeroBrowser, HeroCta } from "@/components/marketing/hero-browser";
import { motion } from "framer-motion";

const HEADING_WORDS = ["The", "Chase", "Is", "Over"];

export const HeroSection = () => {
  const [browserHovering, setBrowserHovering] = useState(false);
  const [ctaHovering, setCtaHovering] = useState(false);

  return (
    <section className="relative pt-20 pb-16 sm:pt-28 lg:pt-44 lg:pb-24 overflow-hidden">
      <div className="max-w-screen-xl mx-auto px-4 relative">
        {/* Constrained to left portion of the content area */}
        <div className="flex flex-col gap-4 max-w-[720px]">
          <h1 className="text-5xl sm:text-7xl lg:text-9xl font-bold tracking-tight text-foreground leading-none">
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
            className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-lg"
          >
            Automated client reminders for UK accounting practices. Stop manually
            chasing records and documents — Prompt handles it for you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 12, delay: 0.54 }}
          >
            <HeroCta browserHovering={browserHovering} onHoverChange={setCtaHovering} />
          </motion.div>

        </div>
      </div>

      {/* Browser preview — right side */}
      <HeroBrowser onHoverChange={setBrowserHovering} ctaHovering={ctaHovering} />
    </section>
  );
};
