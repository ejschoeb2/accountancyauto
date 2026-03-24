"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Play, ArrowRight } from "lucide-react";

export const TutorialsCtaSection = () => (
  <section className="py-20 lg:py-28">
    <div className="max-w-screen-xl mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-md shadow-black/[0.07] px-8 py-14 lg:py-20"
      >
        {/* Decorative background circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 text-violet-600 mb-6">
            <Play size={22} className="ml-0.5" />
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold text-foreground leading-[1.15] mb-4">
            See it in action
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto mb-8">
            Short video walkthroughs for every feature in Prompt. Watch how
            clients, deadlines, emails, and documents all come together — at
            your own pace.
          </p>

          <Link
            href="/guides"
            className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
          >
            Browse tutorials
            <ArrowRight size={18} />
          </Link>
        </div>
      </motion.div>
    </div>
  </section>
);
