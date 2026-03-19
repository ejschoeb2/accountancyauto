"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

export const BridgeCtaSection = () => (
  <section className="relative z-[1] py-20 lg:py-28">
    <div className="max-w-screen-xl mx-auto px-4">
      {/* Main CTA card */}
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
          That&apos;s the core
        </p>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground leading-[1.15]">
          Everything you need.<br className="hidden lg:block" /> Set up in minutes.
        </h2>
        <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
          Deadline tracking, automated reminders, and email management — all you
          need to stop chasing clients. Nothing else to learn, nothing else to configure.
        </p>

        <div className="mt-8">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
          >
            Get started free
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      {/* Transition to advanced features */}
      <div className="mt-20 lg:mt-28 flex flex-col items-center gap-3 text-center">
        <div className="h-16 w-px bg-border" />
        <p className="text-sm text-muted-foreground">
          Want to go further? These optional power features are waiting when you&apos;re ready.
        </p>
        <ChevronDown size={16} className="text-muted-foreground" />
      </div>
    </div>
  </section>
);
